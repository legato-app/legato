//! Audiobooks apart from music (Settings › General › Audiobooks, off by default): which files of the library show on
//! the Audiobooks page. One said to be a book is judged not music too, so it leaves the song lists and the mixes as such
//! a video does; a file only very long stays music. Off, nothing changes.

use crate::library::{Library, LibraryTrack};
use crate::model::Source;
use crate::musicness::Musicness;
use anyhow::Result;
use serde_json::Value;
use std::path::Path;

/// A file this long is listed with the books whatever its tags say.
const LONG_BOOK_MS: u32 = 2 * 3_600_000;
/// The shortest file its genre makes a book.
const TAGGED_BOOK_MS: u32 = 10 * 60_000;
const BOOK_GENRES: [&str; 5] = ["audiobook", "audio book", "spoken", "hörbuch", "livre audio"];

/// What the rule makes of a file on the Audiobooks page.
#[derive(Debug, PartialEq)]
pub enum Book {
    /// Said to be one (`.m4b`, a marked folder, its genre): out of the music.
    Named,
    /// Very long only (a book, or a DJ set, an opera, a sleep track): still music.
    Long,
}

/// The rule, as the interface settings say it.
#[derive(Debug, PartialEq)]
pub struct BookRule {
    /// This PC's folders marked as audiobooks (Settings › Accounts › Local files).
    folders: Vec<String>,
}

impl BookRule {
    /// None while Audiobooks is off.
    pub fn from_ui(ui: Option<&Value>) -> Option<Self> {
        let ui = ui?;
        ui.get("booksPage")?.as_bool()?.then(|| {
            let folders = ui.get("bookFolders").and_then(Value::as_array);
            Self { folders: folders.into_iter().flatten().filter_map(Value::as_str).filter(|folder| !folder.is_empty()).map(str::to_string).collect() }
        })
    }

    /// A file of this PC or of a server: `.m4b`, in a marked folder, long and tagged as a book, or very long.
    pub fn judge(&self, song: &LibraryTrack) -> Option<Book> {
        let ids = &song.track.ids;
        if ids.contains_key(&Source::Youtube) || !(ids.contains_key(&Source::Local) || ids.contains_key(&Source::Server)) {
            return None;
        }
        let path = ids.get(&Source::Local).map(Path::new);
        let named = path.is_some_and(|path| path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("m4b")) || self.folders.iter().any(|folder| path.starts_with(folder)));
        let length = song.track.duration_ms.unwrap_or(0);
        let tagged = song.genre.as_deref().map(str::to_lowercase).is_some_and(|genre| BOOK_GENRES.iter().any(|word| genre.contains(word)));
        if named || (tagged && length >= TAGGED_BOOK_MS) {
            Some(Book::Named)
        } else {
            (length >= LONG_BOOK_MS).then_some(Book::Long)
        }
    }
}

impl Library {
    pub(crate) fn book_rule(&self) -> Result<Option<BookRule>> {
        Ok(BookRule::from_ui(self.setting("ui")?.as_ref()))
    }

    /// The books among the rows: marked, the named ones judged not music. Not one the user said "It's music" of.
    pub(crate) fn mark_books(&self, rows: &mut [LibraryTrack]) -> Result<()> {
        let Some(rule) = self.book_rule()? else { return Ok(()) };
        let mut said_music = self.db.prepare_cached("SELECT 1 FROM tracks WHERE id = ?1 AND musicness = 'user:music'")?;
        for song in rows.iter_mut() {
            let Some(book) = rule.judge(song) else { continue };
            if said_music.exists([song.id])? {
                continue;
            }
            song.audiobook = Some(true);
            if book == Book::Named {
                song.track.musicness = Some(Musicness::NotMusic);
            }
        }
        Ok(())
    }

    /// Every song counts as changed: the interface's next read judges them again.
    pub(crate) fn judge_all_again(&self) -> Result<()> {
        // `WHERE true`: SQLite's way to tell the upsert clause from a join's.
        self.db.execute("INSERT INTO changed SELECT 0, id, '' FROM tracks WHERE true ON CONFLICT DO NOTHING", [])?;
        // The change log is no table the update hook counts.
        self.versions.touch("tracks");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Track;
    use serde_json::json;
    use std::collections::BTreeMap;

    fn file(path: &str, minutes: u32, genre: &str) -> LibraryTrack {
        let track = Track { title: path.into(), artist: "Author".into(), duration_ms: Some(minutes * 60_000), ids: BTreeMap::from([(Source::Local, path.into())]), ..Default::default() };
        LibraryTrack { id: 1, added: 1, added_at: None, genre: (!genre.is_empty()).then(|| genre.into()), year: None, bpm: None, key: None, audiobook: None, track }
    }

    #[test]
    fn off_there_is_no_rule() {
        assert_eq!(BookRule::from_ui(None), None);
        assert_eq!(BookRule::from_ui(Some(&json!({ "bookFolders": ["C:/Books"] }))), None);
        assert_eq!(BookRule::from_ui(Some(&json!({ "booksPage": false }))), None);
    }

    #[test]
    fn m4b_marked_folders_and_tagged_files_are_books_long_ones_only_listed() {
        let rule = BookRule::from_ui(Some(&json!({ "booksPage": true, "bookFolders": ["C:/Books", "", 7] }))).unwrap();
        for book in [file("C:/a.M4B", 3, ""), file("C:/Books/b/1.mp3", 3, ""), file("C:/d.mp3", 10, "Audio Book"), file("C:/e.mp3", 400, "Spoken Word")] {
            assert_eq!(rule.judge(&book), Some(Book::Named), "{}", book.track.title);
        }
        assert_eq!(rule.judge(&file("C:/mix.mp3", 120, "Electronic")), Some(Book::Long));
        for song in [file("C:/a.m4a", 3, ""), file("C:/Bookshop/1.mp3", 3, ""), file("C:/c.mp3", 119, "Rock"), file("C:/d.mp3", 9, "Audiobook")] {
            assert_eq!(rule.judge(&song), None, "{}", song.track.title);
        }
        let mut video = file("C:/f.m4b", 300, "");
        video.track.ids.insert(Source::Youtube, "video".into());
        let mut streamed = file("C:/g.mp3", 300, "");
        streamed.track.ids = BTreeMap::from([(Source::Spotify, "s".into())]);
        let mut server = file("", 300, "");
        server.track.ids = BTreeMap::from([(Source::Server, "k:1".into())]);
        assert_eq!([&video, &streamed, &server].map(|song| rule.judge(song)), [None, None, Some(Book::Long)]);
    }

    #[test]
    fn a_three_hour_dj_mix_stays_in_songs() -> Result<()> {
        let library = Library::in_memory()?;
        library.upsert_track(&file("C:/mix.mp3", 180, "").track)?;
        library.set_setting("ui", &json!({ "booksPage": true }))?;
        let song = &library.tracks()?[0];
        // On the Audiobooks page, and music all the same.
        assert_eq!((song.audiobook, song.track.musicness), (Some(true), Some(Musicness::Music)));
        Ok(())
    }

    #[test]
    fn books_leave_the_music_while_audiobooks_is_on() -> Result<()> {
        let library = Library::in_memory()?;
        let id = library.upsert_track(&file("C:/a.m4b", 40, "").track)?;
        let read = || library.tracks().map(|songs| (songs[0].audiobook, songs[0].track.musicness));
        assert_eq!(read()?, (None, Some(Musicness::Music)));
        library.take_changes(10)?;
        library.set_setting("ui", &json!({ "booksPage": true }))?;
        // The interface hears of it at its next read.
        let changes = library.take_changes(10)?.unwrap();
        assert_eq!(changes.tracks.iter().map(|song| (song.id, song.audiobook)).collect::<Vec<_>>(), [(id, Some(true))]);
        assert_eq!(read()?, (Some(true), Some(Musicness::NotMusic)));
        // Another setting: nothing to judge again.
        library.set_setting("ui", &json!({ "booksPage": true, "language": "fr" }))?;
        assert!(library.take_changes(10)?.unwrap().tracks.is_empty());
        // The user's word wins.
        library.db.execute("UPDATE tracks SET musicness = 'user:music' WHERE id = ?1", [id])?;
        assert_eq!(read()?, (None, Some(Musicness::Music)));
        Ok(())
    }
}
