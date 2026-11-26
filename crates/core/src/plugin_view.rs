//! What plugins read of the library (`library.search`, `history.recent`, docs/plugins.md): the pure half.

use crate::history::Play;
use crate::library::LibraryTrack;
use std::collections::HashMap;

/// Songs whose title, artist or album holds `query` (any case), `limit` at most. A blank query finds nothing.
pub fn search_tracks<'a>(tracks: &'a [LibraryTrack], query: &str, limit: usize) -> Vec<&'a LibraryTrack> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Vec::new();
    }
    let holds = |song: &&LibraryTrack| [Some(&song.track.title), Some(&song.track.artist), song.track.album.as_ref()].into_iter().flatten().any(|text| text.to_lowercase().contains(&query));
    tracks.iter().filter(holds).take(limit).collect()
}

/// Each play with its song, in the plays' order; plays of songs gone from the library left out.
pub fn recent_plays<'a>(plays: &'a [Play], songs: &'a [LibraryTrack]) -> Vec<(&'a Play, &'a LibraryTrack)> {
    let by_id: HashMap<i64, &LibraryTrack> = songs.iter().map(|song| (song.id, song)).collect();
    plays.iter().filter_map(|play| Some((play, *by_id.get(&play.track_id)?))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::Library;
    use crate::model::{Source, Track};

    fn library() -> Vec<LibraryTrack> {
        let lib = Library::in_memory().unwrap();
        for (title, artist, album) in [("Harbor", "Band", "Tides"), ("Other", "Harbor Boys", "x"), ("Third", "Else", "y")] {
            // A song of the library: with a source to play it from.
            let ids = [(Source::Youtube, title.to_string())].into();
            lib.upsert_track(&Track { title: title.into(), artist: artist.into(), album: Some(album.into()), ids, ..Default::default() }).unwrap();
        }
        lib.tracks().unwrap()
    }

    #[test]
    fn a_search_reads_title_artist_and_album_up_to_the_limit() {
        let songs = library();
        let titles = |query: &str, limit: usize| search_tracks(&songs, query, limit).iter().map(|song| song.track.title.clone()).collect::<Vec<_>>();
        let mut both = titles(" HARBOR ", 10);
        both.sort();
        assert_eq!(both, ["Harbor", "Other"]);
        assert_eq!((titles("tides", 10).len(), titles("harbor", 1).len(), titles("  ", 10).len()), (1, 1, 0));
    }

    #[test]
    fn recent_plays_keep_their_order_and_drop_songs_gone() {
        let songs = library();
        let play = |track_id: i64, started_at: i64| Play { track_id, started_at, listened_ms: 1, completed: true };
        let plays = [play(songs[0].id, 30), play(9999, 20), play(songs[1].id, 10)];
        assert_eq!(recent_plays(&plays, &songs).iter().map(|(play, _)| play.started_at).collect::<Vec<_>>(), [30, 10]);
    }
}
