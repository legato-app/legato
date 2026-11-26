//! Discord Rich Presence (plugins' `discord.set`): one thread owns the Discord connection. Newest update wins, sends spaced out
//! (Discord allows 5 per 20 s), retried while Discord is closed.
use music_connectors::discord::{self, Ipc, Pipe, Presence};
use music_core::matching::first_artist;
use music_core::searchpace::Sparse;
use serde::Serialize;
use crate::{AppState, err, links, public_ytm};
use music_connectors::ytmusic::Artist;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const GAP: Duration = Duration::from_secs(4);
const RETRY: Duration = Duration::from_secs(15);

/// The artists' pictures asked of YouTube Music (`artist_art`): nobody waits for them.
static LOOKS: Mutex<Sparse> = Mutex::new(Sparse::new());

/// The artist a picture is looked up for: the first credited, a channel's " - Topic" aside.
pub fn looked_up(artist: &str) -> &str {
    // The suffix first: trimming the front would take its space from a name that is nothing else.
    first_artist(artist.trim_end().trim_end_matches(" - Topic"))
}

/// Is this presence's artist the one a picture was found for? A plugin words its own: only a match takes the picture.
pub fn same_artist(presence: &str, artist: &str) -> bool {
    looked_up(presence).to_lowercase() == artist.to_lowercase()
}

/// An artist's picture as Discord's small image: square, from a page of YouTube Music.
fn picture(page: &Option<Artist>) -> Option<String> {
    page.as_ref()?.art.as_deref().map(discord::square).filter(|art| art.starts_with("https://") && art.len() <= 256)
}

/// The picture already known: the page the checked lookups kept first, else one found for the presence.
/// `Some(None)`: looked up, there is none.
pub fn known_picture(state: &AppState, artist: &str) -> Option<Option<String>> {
    let key = artist.to_lowercase();
    state.cache.artists.get(&key).or_else(|| state.cache.presence_artists.get(&key)).map(|page| picture(&page))
}

/// The name to find a picture for: the playing song's artist, when the presence waiting for one (`waiting`, its
/// artist) shows that artist. None too for a blank or absurd name: nothing is asked about it.
fn wanted<'a>(waiting: Option<&str>, playing: &'a str) -> Option<&'a str> {
    let name = looked_up(playing);
    (!name.is_empty() && name.chars().count() <= 200 && waiting.is_some_and(|presence| same_artist(presence, name))).then_some(name)
}

/// After `update`: the artist of the presence shown without a picture, if any.
fn note(waiting: &mut Option<String>, update: &Update) {
    match update {
        Update::Set { presence, .. } => *waiting = presence.as_ref().filter(|presence| presence.artist_art.is_none()).map(|presence| presence.artist.clone()),
        Update::ArtistArt { artist, .. } => {
            if waiting.as_deref().is_some_and(|presence| same_artist(presence, artist)) {
                *waiting = None;
            }
        }
        Update::Off => *waiting = None,
    }
}

/// A presence and the song the app plays have met (whichever came last): the picture it lacks goes on, from the pages
/// known, else asked for behind (`find_picture`) for a song YouTube plays.
pub fn fill_picture(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Some((artist, youtube)) = state.playing_artist.lock().unwrap().clone() else { return };
    let Some(name) = state.discord.wanted(&artist) else { return };
    match known_picture(&state, &name) {
        Some(Some(art)) => state.discord.send(Update::ArtistArt { artist: name, art }),
        Some(None) => {}
        None if youtube => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move { find_picture(&app.state::<AppState>(), name).await });
        }
        None => {}
    }
}

/// Asks YouTube Music for an unknown artist's page, by name alone (the owner's choice, 2026-11-06): never during an
/// import, once a minute at most, not for 15 minutes after a refusal, and no other way round it. A picture found goes
/// onto the presence, if it still shows that artist.
pub async fn find_picture(state: &AppState, artist: String) {
    if links::importing() || !LOOKS.lock().unwrap().take(Instant::now()) {
        return;
    }
    match public_ytm().artist(&artist, &[]).await {
        Ok(page) => {
            let page = state.cache.presence_artists.put(&artist.to_lowercase(), page);
            if let Some(art) = picture(&page) {
                state.discord.send(Update::ArtistArt { artist, art });
            }
        }
        Err(e) => {
            if music_connectors::refused(&err(e)) {
                LOOKS.lock().unwrap().refused(Instant::now());
            }
        }
    }
}

pub enum Update {
    /// Show this track (None = connected, nothing shown).
    Set { client_id: String, presence: Option<Presence> },
    /// A picture found after its presence was sent.
    ArtistArt { artist: String, art: String },
    /// Plugin stopped: connection closed, Discord drops the activity.
    Off,
}

/// Takes `update` into what should show. A picture only joins a presence of its artist that has none; the position
/// moves on by `since`, the time passed, so the bar stays right. False: nothing to send.
fn take(want: &mut Option<Update>, update: Update, since: Duration) -> bool {
    let Update::ArtistArt { artist, art } = update else {
        *want = Some(update);
        return true;
    };
    match want {
        Some(Update::Set { presence: Some(presence), .. }) if presence.artist_art.is_none() && same_artist(&presence.artist, &artist) => {
            if presence.playing {
                presence.position_ms += u64::try_from(since.as_millis()).unwrap_or(0);
            }
            presence.artist_art = Some(art);
            true
        }
        _ => false,
    }
}

/// What a plugin's `discord.status` answers.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Status {
    pub connected: bool,
    pub error: Option<String>,
}

pub struct Discord {
    tx: Sender<Update>,
    status: Arc<Mutex<Status>>,
    /// The artist of the presence sent without a picture (`note`).
    waiting: Mutex<Option<String>>,
}

impl Discord {
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();
        let status = Arc::new(Mutex::new(Status::default()));
        let s = status.clone();
        std::thread::Builder::new().name("discord".into()).spawn(move || run(rx, s)).expect("discord thread");
        Self { tx, status, waiting: Mutex::default() }
    }

    fn wanted(&self, playing: &str) -> Option<String> {
        wanted(self.waiting.lock().unwrap().as_deref(), playing).map(String::from)
    }

    pub fn send(&self, u: Update) {
        note(&mut self.waiting.lock().unwrap(), &u);
        let _ = self.tx.send(u);
    }

    pub fn status(&self) -> Status {
        self.status.lock().unwrap().clone()
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

fn run(rx: Receiver<Update>, status: Arc<Mutex<Status>>) {
    let mut conn: Option<(String, Ipc<Pipe>)> = None;
    let mut want: Option<Update> = None;
    let mut failed = false;
    let mut last = Instant::now() - GAP;
    // When the presence wanted was worded: its position is as of then.
    let mut worded = Instant::now();
    let mut accept = |want: &mut Option<Update>, update: Update| {
        let fresh = !matches!(update, Update::ArtistArt { .. });
        let taken = take(want, update, worded.elapsed());
        // A picture added moved the position up to now.
        if taken || fresh {
            worded = Instant::now();
        }
        taken
    };
    loop {
        match rx.recv_timeout(if failed { RETRY } else { Duration::from_secs(3600) }) {
            Ok(u) => {
                if !accept(&mut want, u) {
                    continue;
                }
            }
            Err(RecvTimeoutError::Timeout) if failed => {}
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => return,
        }
        // Spaced out; whatever came meanwhile replaces it.
        std::thread::sleep(GAP.saturating_sub(last.elapsed()));
        while let Ok(u) = rx.try_recv() {
            accept(&mut want, u);
        }
        let result = match &want {
            Some(Update::Set { client_id, presence }) => {
                if conn.as_ref().is_some_and(|(id, _)| id != client_id) {
                    conn = None;
                }
                let ready = match conn.take() {
                    Some(c) => Ok(c),
                    None => discord::connect(client_id).map(|ipc| (client_id.clone(), ipc)),
                };
                ready.and_then(|(id, mut ipc)| {
                    let r = ipc.set_activity(std::process::id(), presence.as_ref().map(|p| discord::activity(p, now_ms())));
                    if r.is_ok() {
                        conn = Some((id, ipc));
                    }
                    r
                })
            }
            // Never kept as what should show (`take`).
            Some(Update::ArtistArt { .. } | Update::Off) | None => {
                conn = None;
                Ok(())
            }
        };
        last = Instant::now();
        let off = matches!(want, Some(Update::Off));
        failed = result.is_err() && !off;
        *status.lock().unwrap() = Status { connected: conn.is_some(), error: result.err().map(|e| e.to_string()) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(artist: &str, playing: bool) -> Option<Update> {
        let presence = Presence { title: "Song".into(), artist: artist.into(), album: None, art: None, artist_art: None, buttons: vec![], playing, position_ms: 1_000, duration_ms: None, status: discord::StatusShows::Song };
        Some(Update::Set { client_id: "1".into(), presence: Some(presence) })
    }

    fn picture_of(artist: &str) -> Update {
        Update::ArtistArt { artist: artist.into(), art: "https://x/a".into() }
    }

    fn shown(want: &Option<Update>) -> (Option<&str>, u64) {
        let Some(Update::Set { presence: Some(presence), .. }) = want else { panic!("no presence") };
        (presence.artist_art.as_deref(), presence.position_ms)
    }

    #[test]
    fn the_picture_is_wanted_whichever_of_the_presence_and_the_song_comes_last() {
        let mut waiting = None;
        // The plugin's new song lands while the app still says the one before.
        note(&mut waiting, set("Muse", true).as_ref().unwrap());
        assert_eq!(wanted(waiting.as_deref(), "Daft Punk"), None);
        // Then the app's own word of it: now.
        assert_eq!(wanted(waiting.as_deref(), "Muse - Topic"), Some("Muse"));
        note(&mut waiting, &picture_of("Daft Punk"));
        assert!(waiting.is_some());
        note(&mut waiting, &picture_of("muse"));
        assert_eq!(wanted(waiting.as_deref(), "Muse"), None, "it has one");
        note(&mut waiting, set("Muse", true).as_ref().unwrap());
        note(&mut waiting, &Update::Off);
        assert_eq!(wanted(waiting.as_deref(), "Muse"), None);
        // A blank name is never asked about, even for a blank presence.
        for blank in ["", "  ", " - Topic"] {
            assert_eq!(wanted(Some(blank), blank), None, "{blank:?}");
        }
    }

    #[test]
    fn a_late_picture_joins_its_artist_only_and_the_bar_stays_right() {
        let second = Duration::from_secs(1);
        let mut want = set("Daft Punk, Pharrell Williams", true);
        assert!(!take(&mut want, picture_of("Muse"), second));
        assert_eq!(shown(&want), (None, 1_000));
        assert!(take(&mut want, picture_of("daft punk"), second));
        assert_eq!(shown(&want), (Some("https://x/a"), 2_000));
        assert!(!take(&mut want, picture_of("Daft Punk"), second), "has one already");
        let mut paused = set("Muse - Topic", false);
        assert!(take(&mut paused, picture_of("Muse"), second));
        assert_eq!(shown(&paused), (Some("https://x/a"), 1_000));
        // Stopped meanwhile: nothing comes back.
        let mut off = Some(Update::Off);
        assert!(!take(&mut off, picture_of("Muse"), second));
        assert!(matches!(off, Some(Update::Off)));
    }
}
