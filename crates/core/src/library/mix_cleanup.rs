//! Once: the mixes older versions synced from YouTube (made up again at each request, ~1,000 songs never chosen at
//! every sync) leave the library, with the songs only they brought (the owner, 2026-11-25). A copy of the library is
//! made first; anything the user touched stays.

use super::*;

/// Done once per library: the settings row.
const MIX_CLEANUP: &str = "mixCleanup1";

/// A YouTube list made up again at each request: "SE" (Episodes for Later, podcasts) or an "RD" mix, not YouTube's own
/// fixed "RDCLAK" playlists. A brand account's lists end with "~" and its key.
pub fn is_made_up_mix(source_id: &str) -> bool {
    let id = source_id.split('~').next().unwrap_or(source_id);
    id == "SE" || (id.starts_with("RD") && !id.starts_with("RDCLAK"))
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct MixesRemoved {
    pub playlists: usize,
    pub songs: usize,
}

/// The copy made before the cleanup, next to the library, kept.
pub fn back_up_before_mix_cleanup(library: &Path) -> Result<std::path::PathBuf> {
    let db = Connection::open_with_flags(library, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let today: String = db.query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))?;
    let to = library.with_file_name(format!("library-before-mix-cleanup-{today}.db"));
    copy_to(&db, &to)?;
    Ok(to)
}

impl Library {
    fn made_up_mixes(&self) -> Result<Vec<i64>> {
        let mut stmt = self.db.prepare("SELECT id, source_id FROM playlists WHERE source = 'youtube' AND custom = 0")?;
        let lists: Vec<(i64, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
        Ok(lists.into_iter().filter(|(_, source_id)| is_made_up_mix(source_id)).map(|(id, _)| id).collect())
    }

    /// True while the cleanup has mixes to remove (so a copy is worth making). A library with none is marked done.
    pub fn mix_cleanup_pending(&self) -> Result<bool> {
        if self.setting(MIX_CLEANUP)?.is_some() {
            return Ok(false);
        }
        if self.made_up_mixes()?.is_empty() {
            self.set_setting(MIX_CLEANUP, &serde_json::json!(true))?;
            return Ok(false);
        }
        Ok(true)
    }

    /// Removes the made-up mixes and the songs that were in them only and carry nothing of the user's. Nothing is
    /// recorded as removed, so Sync Mode carries no deletion to other PCs and a later import brings a song back.
    pub fn remove_made_up_mixes(&self) -> Result<MixesRemoved> {
        self.tx(|| {
            let mixes = ids_json(self.made_up_mixes()?);
            // Songs of those mixes with no other list, nothing but YouTube to play them, and no trace of the user: no
            // play, rating, preference, bookmark, edit, "added here" mark, or word on what the song is.
            let mut stmt = self.db.prepare(
                "SELECT t.id FROM tracks t
                 WHERE t.id IN (SELECT track_id FROM playlist_tracks WHERE playlist_id IN (SELECT value FROM json_each(?1)))
                   AND t.id NOT IN (SELECT track_id FROM playlist_tracks WHERE playlist_id NOT IN (SELECT value FROM json_each(?1)))
                   AND NOT EXISTS (SELECT 1 FROM track_ids i WHERE i.track_id = t.id AND i.source != 'youtube')
                   AND t.id NOT IN (SELECT track_id FROM plays)
                   AND t.id NOT IN (SELECT track_id FROM track_ratings)
                   AND t.id NOT IN (SELECT track_id FROM track_prefs)
                   AND t.id NOT IN (SELECT track_id FROM bookmarks)
                   AND t.id NOT IN (SELECT track_id FROM playlist_added)
                   AND NOT EXISTS (SELECT 1 FROM edits e WHERE e.song = 't:' || t.id
                                   OR e.song IN (SELECT 'yt:' || i.source_id FROM track_ids i WHERE i.track_id = t.id))
                   AND coalesce(t.musicness, '') NOT LIKE 'user:%'
                   AND t.explicit != 2",
            )?;
            let songs: Vec<i64> = stmt.query_map([&mixes], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
            let playlists = self.db.execute("DELETE FROM playlists WHERE id IN (SELECT value FROM json_each(?1))", [&mixes])?;
            let songs = self.db.execute("DELETE FROM tracks WHERE id IN (SELECT value FROM json_each(?1))", [ids_json(songs)])?;
            self.set_setting(MIX_CLEANUP, &serde_json::json!(true))?;
            Ok(MixesRemoved { playlists, songs })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn song(name: &str) -> Track {
        Track { title: name.into(), artist: format!("{name} artist"), ids: BTreeMap::from([(Source::Youtube, name.into())]), ..Default::default() }
    }

    #[test]
    fn only_the_songs_a_made_up_mix_brought_leave() -> Result<()> {
        assert!(is_made_up_mix("RDTMAK5") && is_made_up_mix("SE~1") && !is_made_up_mix("RDCLAK5uy") && !is_made_up_mix("PL1") && !is_made_up_mix("LM"));
        let lib = Library::in_memory()?;
        let kept = ["normal", "played", "rated", "preferred", "liked", "added", "local", "bookmarked", "edited", "marked"];
        let mut in_mix: Vec<Track> = kept.iter().map(|name| song(name)).collect();
        in_mix.push(song("alone"));
        in_mix[6].ids.insert(Source::Local, "C:/a.flac".into());
        lib.save_playlist(Source::Youtube, "RDTMAK5~1", "My Mix", &in_mix)?;
        lib.save_playlist(Source::Youtube, "SE", "Episodes for Later", &[song("alone")])?;
        let fixed = lib.save_playlist(Source::Youtube, "RDCLAK5uy", "Fixed", &[song("fixed")])?;
        let normal = lib.save_playlist(Source::Youtube, "PL1", "Mine", &[song("normal")])?;
        lib.save_playlist(Source::Youtube, "LM", "Liked Music", &[song("liked")])?;
        let id = |name: &str| lib.upsert_track(&song(name));
        lib.db.execute("INSERT INTO plays (track_id, started_at, listened_ms, completed) VALUES (?1, 1, 1, 1)", [id("played")?])?;
        lib.db.execute("INSERT INTO track_ratings (track_id, stars, at) VALUES (?1, 8, 1)", [id("rated")?])?;
        lib.db.execute("INSERT INTO track_prefs (track_id, pref, at) VALUES (?1, 'less', 1)", [id("preferred")?])?;
        lib.add_sent_songs(normal, &[id("added")?])?;
        lib.db.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2", [normal, id("added")?])?;
        lib.db.execute("INSERT INTO bookmarks (track_id, ms, note, created) VALUES (?1, 1, '', 1)", [id("bookmarked")?])?;
        lib.db.execute("INSERT INTO edits (song, name, effects, active, updated) VALUES ('yt:edited', 'x', '{}', 1, 1)", [])?;
        lib.db.execute("UPDATE tracks SET musicness = 'user:music' WHERE id = ?1", [id("marked")?])?;
        assert!(lib.mix_cleanup_pending()?);
        assert_eq!(lib.remove_made_up_mixes()?, MixesRemoved { playlists: 2, songs: 1 });
        let mut left: Vec<String> = lib.tracks()?.into_iter().map(|t| t.track.title).collect();
        left.sort();
        let mut expected: Vec<&str> = kept.iter().copied().chain(["fixed"]).collect();
        expected.sort_unstable();
        assert_eq!(left, expected);
        assert_eq!(lib.playlist_orders()?[&fixed].len(), 1);
        assert_eq!(lib.playlists()?.len(), 3);
        // Once.
        assert!(!lib.mix_cleanup_pending()?);
        Ok(())
    }
}
