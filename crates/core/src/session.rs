//! What the operating system's media sessions say is playing (Windows: SMTC, Linux: MPRIS): title, artist, album,
//! nothing more. No
//! sound is read; the Music Detector asks it first (a name for free, at once) before it listens. The OS half is in
//! `src-tauri/src/session.rs`; this half picks the right session and cleans its words.

use crate::model::Track;
use std::collections::BTreeMap;

/// One media session as the OS reports it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    /// The app behind it (Windows' AppUserModelId: `Spotify.exe`, `chrome.exe`, …).
    pub app: String,
    pub playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
}

/// What every MPRIS player's name on the Linux session bus starts with.
pub const MPRIS_PREFIX: &str = "org.mpris.MediaPlayer2.";

/// An MPRIS player's answer as a session: the app is its bus name without the prefix and the `.instance…` a second copy
/// adds. No title: nothing to name.
pub fn from_mpris(bus_name: &str, status: &str, title: &str, artists: &[String], album: &str) -> Option<Session> {
    if title.trim().is_empty() {
        return None;
    }
    let name = bus_name.strip_prefix(MPRIS_PREFIX).unwrap_or(bus_name);
    let numbered = |rest: &str| rest.chars().all(|character| character.is_ascii_digit() || character == '_');
    let app = name.rsplit_once(".instance").filter(|(_, rest)| numbered(rest)).map_or(name, |(app, _)| app);
    Some(Session { app: app.into(), playing: status == "Playing", title: title.into(), artist: artists.join(", "), album: album.into() })
}

/// The song of the first session that is playing and says a title, never the app's own (`own`: a part of its id,
/// lower case). A session that says no artist is no song (a browser tab's page title, a video's file name).
pub fn pick(sessions: &[Session], own: &str) -> Option<Track> {
    let s = sessions.iter().find(|s| s.playing && !s.app.to_lowercase().contains(own) && !s.title.trim().is_empty() && !artist(&s.artist).is_empty())?;
    let album = s.album.trim();
    Some(Track {
        title: s.title.trim().to_string(),
        artist: artist(&s.artist),
        album: (!album.is_empty()).then(|| album.to_string()),
        duration_ms: None,
        isrc: None,
        ids: BTreeMap::new(),
        art: None,
        musicness: None,
        explicit: false,
    })
}

/// YouTube Music names an auto-generated channel "Artist - Topic".
fn artist(a: &str) -> String {
    let a = a.trim();
    a.strip_suffix(" - Topic").unwrap_or(a).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(app: &str, playing: bool, title: &str, artist: &str) -> Session {
        Session { app: app.into(), playing, title: title.into(), artist: artist.into(), album: String::new() }
    }

    #[test]
    fn the_playing_session_names_the_song_and_a_paused_one_does_not() {
        let all = [s("Spotify.exe", false, "Old", "Someone"), s("chrome.exe", true, " Warriors ", "Imagine Dragons - Topic")];
        let t = pick(&all, "legato").unwrap();
        assert_eq!((t.title.as_str(), t.artist.as_str(), t.album), ("Warriors", "Imagine Dragons", None));
        assert!(pick(&all[..1], "legato").is_none());
    }

    #[test]
    fn an_mpris_player_reads_as_a_session() {
        let artists = ["Daft Punk".to_string(), "Romanthony".to_string()];
        let firefox = from_mpris("org.mpris.MediaPlayer2.firefox.instance_1_23", "Playing", "One More Time", &artists, "Discovery").unwrap();
        assert_eq!((firefox.app.as_str(), firefox.playing, firefox.artist.as_str(), firefox.album.as_str()), ("firefox", true, "Daft Punk, Romanthony", "Discovery"));
        let paused = from_mpris("org.mpris.MediaPlayer2.vlc", "Paused", "Song", &artists[..1], "").unwrap();
        assert_eq!((paused.app.as_str(), paused.playing), ("vlc", false));
        assert!(!from_mpris("org.mpris.MediaPlayer2.x.instanceTwo", "Something new", "Song", &[], "").unwrap().playing);
        assert_eq!(from_mpris("org.mpris.MediaPlayer2.vlc", "Playing", " ", &artists, ""), None);
        // Legato's own, whatever the build: never picked.
        let own = from_mpris("org.mpris.MediaPlayer2.legato.instance42", "Playing", "Mine", &artists, "").unwrap();
        assert!(own.app == "legato" && pick(&[own], "legato").is_none());
    }

    #[test]
    fn the_app_itself_and_pages_with_no_artist_are_not_songs() {
        let all = [s("app.legato.desktop", true, "Mine", "Me"), s("chrome.exe", true, "Some page", " "), s("vlc.exe", true, "", "Nobody")];
        assert!(pick(&all, "legato").is_none());
        let mut album = s("vlc.exe", true, "Song", "Band");
        album.album = "Record".into();
        assert_eq!(pick(&[album], "legato").unwrap().album.as_deref(), Some("Record"));
    }
}
