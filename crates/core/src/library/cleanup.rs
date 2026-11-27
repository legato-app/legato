//! Songs that only one thing brought leave with it, when nothing of the user's holds them: once, the mixes older versions
//! synced from YouTube (made up again at each request, ~1,000 songs never chosen at every sync; the owner, 2026-11-25),
//! and, on the user's word, what Spotify brought when its account is disconnected (2026-11-26). A copy of the library is
//! made first.

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
pub struct CleanedUp {
    pub playlists: usize,
    pub songs: usize,
}

/// What a copy was made before, as its file says it.
pub const MIX_CLEANUP_COPY: &str = "mix-cleanup";
pub const SPOTIFY_REMOVAL_COPY: &str = "spotify-removal";

/// A song carrying nothing of the user's: no play, rating, preference, bookmark, edit, "added here" mark, word on what it
/// is, nor explicit mark lifted by hand. On `tracks t`.
const NOTHING_OF_THE_USERS: &str = "t.id NOT IN (SELECT track_id FROM plays)
    AND t.id NOT IN (SELECT track_id FROM track_ratings)
    AND t.id NOT IN (SELECT track_id FROM track_prefs)
    AND t.id NOT IN (SELECT track_id FROM bookmarks)
    AND t.id NOT IN (SELECT track_id FROM playlist_added)
    AND NOT EXISTS (SELECT 1 FROM edits e WHERE e.song = 't:' || t.id
                    OR e.song IN (SELECT 'yt:' || i.source_id FROM track_ids i WHERE i.track_id = t.id))
    AND coalesce(t.musicness, '') NOT LIKE 'user:%'
    AND t.explicit != 2";

/// Removes the copies made before a cleanup that are `older_than` or more: they hold the listening history too.
/// Returns how many.
pub fn remove_cleanup_backups(library: &Path, older_than: std::time::Duration) -> Result<usize> {
    let Some(folder) = library.parent() else { return Ok(0) };
    let mut removed = 0;
    for entry in std::fs::read_dir(folder)?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let ours = [MIX_CLEANUP_COPY, SPOTIFY_REMOVAL_COPY].iter().any(|copy| name.starts_with(&format!("library-before-{copy}-")));
        if !ours || !name.ends_with(".db") {
            continue;
        }
        // A date ahead of the clock: as new as can be.
        if entry.metadata()?.modified()?.elapsed().unwrap_or_default() >= older_than {
            std::fs::remove_file(entry.path())?;
            removed += 1;
        }
    }
    Ok(removed)
}

/// The copy made before a cleanup (`copy` = which), next to the library: kept 30 days, or until the history is reset.
/// Named to the second: a second cleanup the same day keeps the first's copy.
pub fn back_up_before_cleanup(library: &Path, copy: &str) -> Result<std::path::PathBuf> {
    let db = Connection::open_with_flags(library, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let now: String = db.query_row("SELECT strftime('%Y-%m-%d-%H%M%S', 'now', 'localtime')", [], |row| row.get(0))?;
    let to = library.with_file_name(format!("library-before-{copy}-{now}.db"));
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

    /// Songs among `candidates` (a condition on `tracks t`) that leave with the `leaving` lists (ids as JSON, `?1`): no
    /// source but `source` (`?2`), in no list that stays, nothing of the user's.
    fn songs_leaving(&self, candidates: &str, source: &str, leaving: &str) -> Result<Vec<i64>> {
        let mut stmt = self.db.prepare(&format!(
            "SELECT t.id FROM tracks t
             WHERE {candidates}
               AND t.id NOT IN (SELECT track_id FROM playlist_tracks WHERE playlist_id NOT IN (SELECT value FROM json_each(?1)))
               AND NOT EXISTS (SELECT 1 FROM track_ids i WHERE i.track_id = t.id AND i.source != ?2)
               AND {NOTHING_OF_THE_USERS}"
        ))?;
        Ok(stmt.query_map(params![leaving, source], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?)
    }

    fn delete_songs(&self, ids: Vec<i64>) -> Result<usize> {
        Ok(self.db.execute("DELETE FROM tracks WHERE id IN (SELECT value FROM json_each(?1))", [ids_json(ids)])?)
    }

    /// Removes the made-up mixes and the songs that were in them only and carry nothing of the user's. Nothing is
    /// recorded as removed, so Sync Mode carries no deletion to other PCs and a later import brings a song back.
    pub fn remove_made_up_mixes(&self) -> Result<CleanedUp> {
        self.tx(|| {
            let mixes = ids_json(self.made_up_mixes()?);
            let songs = self.songs_leaving("t.id IN (SELECT track_id FROM playlist_tracks WHERE playlist_id IN (SELECT value FROM json_each(?1)))", "youtube", &mixes)?;
            let playlists = self.db.execute("DELETE FROM playlists WHERE id IN (SELECT value FROM json_each(?1))", [&mixes])?;
            let songs = self.delete_songs(songs)?;
            self.set_setting(MIX_CLEANUP, &serde_json::json!(true))?;
            Ok(CleanedUp { playlists, songs })
        })
    }

    /// Spotify's account disconnected, on the user's word: its imported playlists go, recorded as gone so Sync Mode
    /// removes them from the other PCs too, with the songs only Spotify knows that nothing else holds. The songs aren't
    /// recorded as removed: a later import brings them back.
    pub fn remove_spotify_imports(&self) -> Result<CleanedUp> {
        self.tx(|| {
            let theirs: Vec<(i64, String)> = {
                let mut stmt = self.db.prepare("SELECT id, source_id FROM playlists WHERE source = 'spotify' AND custom = 0")?;
                stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?.collect::<rusqlite::Result<_>>()?
            };
            let leaving = ids_json(theirs.iter().map(|(id, _)| *id));
            let songs = self.songs_leaving("EXISTS (SELECT 1 FROM track_ids i WHERE i.track_id = t.id AND i.source = ?2)", "spotify", &leaving)?;
            for (id, source_id) in &theirs {
                self.db.execute("DELETE FROM playlists WHERE id = ?1", [id])?;
                self.gone("playlist", &format!("spotify:{source_id}"))?;
            }
            Ok(CleanedUp { playlists: theirs.len(), songs: self.delete_songs(songs)? })
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
        let kept = ["normal", "played", "rated", "preferred", "liked", "added", "local", "bookmarked", "edited", "marked", "cleared", "songedit"];
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
        // Explicit mark lifted by hand, and an edit saved under the song itself.
        lib.db.execute("UPDATE tracks SET explicit = 2 WHERE id = ?1", [id("cleared")?])?;
        lib.db.execute("INSERT INTO edits (song, name, effects, active, updated) VALUES ('t:' || ?1, 'y', '{}', 1, 1)", [id("songedit")?])?;
        assert!(lib.mix_cleanup_pending()?);
        assert_eq!(lib.remove_made_up_mixes()?, CleanedUp { playlists: 2, songs: 1 });
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

    #[test]
    fn only_what_spotify_alone_brought_leaves_with_its_account() -> Result<()> {
        let lib = Library::in_memory()?;
        let spotify = |name: &str| Track { ids: BTreeMap::from([(Source::Spotify, name.into())]), ..song(name) };
        let mut matched = spotify("matched");
        matched.ids.insert(Source::Youtube, "video".into());
        let imported = lib.save_playlist(Source::Spotify, "p1", "From Spotify", &[spotify("listed"), spotify("kept"), spotify("liked"), spotify("played"), matched])?;
        // One in no list any more, one of YouTube's own.
        lib.upsert_track(&spotify("loose"))?;
        lib.upsert_track(&song("video only"))?;
        let mine = lib.save_playlist(Source::Youtube, "PL1", "Mine", &[spotify("kept")])?;
        lib.save_playlist(Source::Youtube, "LM", "Liked Music", &[spotify("liked")])?;
        lib.db.execute("INSERT INTO plays (track_id, started_at, listened_ms, completed) VALUES (?1, 1, 1, 1)", [lib.upsert_track(&spotify("played"))?])?;
        assert_eq!(lib.remove_spotify_imports()?, CleanedUp { playlists: 1, songs: 2 });
        let mut left: Vec<String> = lib.tracks()?.into_iter().map(|t| t.track.title).collect();
        left.sort();
        assert_eq!(left, ["kept", "liked", "matched", "played", "video only"]);
        let lists: Vec<i64> = lib.playlists()?.into_iter().map(|p| p.id).collect();
        assert!(!lists.contains(&imported) && lists.contains(&mine) && lists.len() == 2);
        assert_eq!(lib.remove_spotify_imports()?, CleanedUp::default());
        Ok(())
    }

    #[test]
    fn the_copies_leave_after_30_days_or_with_the_history() {
        let folder = tempfile::tempdir().unwrap();
        let library = folder.path().join("library.db");
        std::fs::File::create(&library).unwrap();
        let day = std::time::Duration::from_secs(86_400);
        let file = |name: &str, age: u32| {
            let path = folder.path().join(name);
            let made = std::fs::File::create(&path).unwrap();
            made.set_modified(std::time::SystemTime::now() - day * age).unwrap();
            path
        };
        let (old, recent) = (file("library-before-mix-cleanup-2026-01-01.db", 31), file("library-before-spotify-removal-2026-03-01-101500.db", 29));
        let other = file("library-before-restore.db", 99);
        assert_eq!(remove_cleanup_backups(&library, day * 30).unwrap(), 1);
        assert!(!old.exists() && recent.exists() && other.exists());
        // Reset history: whatever their age.
        assert_eq!(remove_cleanup_backups(&library, std::time::Duration::ZERO).unwrap(), 1);
        assert!(!recent.exists() && other.exists() && library.exists());
    }
}
