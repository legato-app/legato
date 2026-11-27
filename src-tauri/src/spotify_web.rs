//! Spotify without keys: Spotify's own page (open.spotify.com) in an app window, opened to import lists.
//! The user signs in on Spotify's page.
//! The window gets no capability (remote page, no IPC) and no ad blocking: the shield only hooks the main window.
//! Connect Spotify (user's choice 2026-10-31, against Spotify's User Guidelines: the app says so first): the page's own
//! rows are read by `music_shield::SPOTIFY_SCRIPT`, private playlists and Liked Songs included. No token, no request of
//! ours to Spotify. Answers come on WebView2's message channel, checked by `music_connectors::spotify_page`.

use crate::web_reader::{Inbox, Site};
use crate::{AppState, CmdResult};
use music_connectors::spotify_page;
use music_core::model::{Source, Track};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Url};

const PLAYER: &str = "https://open.spotify.com/";
/// Spotify's own sign-in page, back to the player after.
const SIGN_IN: &str = "https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F";
const LABEL: &str = "spotify-web";

static INBOX: Inbox = Inbox::new(None);

static SITE: Site = Site {
    name: "Spotify",
    label: LABEL,
    player: PLAYER,
    sign_in: SIGN_IN,
    // sp_dc = Spotify's web session cookie.
    cookie: "sp_dc",
    script: music_shield::SPOTIFY_SCRIPT,
    object: "__legatoSpotify",
    log: "spotify",
    inbox: &INBOX,
    parse: spotify_page::parse,
    list_path: spotify_page::list_path,
    save,
};

/// WebView2: call from async commands or threads only (`Site::signed_in`).
pub fn signed_in(app: &AppHandle) -> bool {
    SITE.signed_in(app)
}

/// The sign-in on Spotify's page forgotten: its cookies on its two sites, nothing else of the shared profile.
/// WebView2: call from async commands or threads only (`signed_in`).
pub fn sign_out(app: &AppHandle) -> tauri::Result<()> {
    if cfg!(mobile) {
        return Ok(());
    }
    if let Some(window) = app.get_webview_window(LABEL) {
        window.close()?;
    }
    let Some(main) = app.get_webview("main") else { return Ok(()) };
    for site in [PLAYER, SIGN_IN] {
        for cookie in main.cookies_for_url(Url::parse(site).expect("valid url"))? {
            main.delete_cookie(cookie)?;
        }
    }
    Ok(())
}

/// WebView2: call from async commands or threads only (`signed_in`).
pub fn open(app: &AppHandle) -> tauri::Result<()> {
    SITE.open(app)
}

/// A list to tick. Song count: Exportify's files give it, Spotify's column doesn't.
#[derive(Debug, Clone, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SpotifyList {
    pub id: String,
    pub name: String,
    pub cover: Option<String>,
    pub songs: Option<u32>,
}

/// The playlists in the signed-in user's library. Liked Songs isn't one: the interface adds it.
#[tauri::command]
pub async fn spotify_lists(app: AppHandle, state: State<'_, AppState>) -> CmdResult<Vec<SpotifyList>> {
    state.spotify_takes()?;
    SITE.lists(&app, "").await
}

#[derive(Debug, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct SpotifyPick {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SpotifyLibraryImport {
    /// The first list saved, to open.
    pub playlist_id: Option<i64>,
    pub lists: usize,
    pub songs: usize,
    /// Of those, the ones with a YouTube version (they play in full).
    pub playable: usize,
    /// Lists that couldn't be read or held no songs.
    pub failed: Vec<String>,
    /// Songs YouTube's refusals left unsearched: a later import finishes them.
    pub unsearched: usize,
}

/// A song going through: what the import screen shows.
#[derive(Clone, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct SpotifySong {
    pub title: String,
    pub artist: String,
    pub cover: Option<String>,
    pub playable: bool,
}

impl From<&Track> for SpotifySong {
    fn from(t: &Track) -> Self {
        Self { title: t.title.clone(), artist: t.artist.clone(), cover: t.art.clone(), playable: t.ids.contains_key(&Source::Youtube) }
    }
}

#[derive(Clone, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SpotifyProgress {
    pub name: String,
    /// This list's place among the picked ones, from 1.
    pub list: usize,
    pub lists: usize,
    /// False: reading Spotify's page, or saving the lists. True: finding the songs on YouTube.
    pub matching: bool,
    pub done: usize,
    pub total: usize,
    /// Every list's songs. 0: not known yet (Spotify's page says them list by list).
    pub all_done: usize,
    pub all_total: usize,
    /// With a YouTube version so far, every list.
    pub playable: usize,
    /// One search of every list's unknown songs, what the time left counts. 0: Spotify's page goes list by list.
    pub searched: usize,
    pub to_search: usize,
    /// YouTube refused: seconds before the searches go on. 0: they're running.
    pub wait_secs: u32,
    pub song: Option<SpotifySong>,
}

/// A list imported: a playlist of its own, a second import updates it. Liked Songs joins Liked Music, all services in one.
/// `complete` false: a list read short, so nothing leaves it.
pub fn save(state: &AppState, id: &str, name: &str, tracks: &[Track], complete: bool) -> anyhow::Result<i64> {
    if id == music_core::spotify_export::LIKED { state.lib().add_likes(tracks) } else { state.lib().save_playlist_read(Source::Spotify, id, name, tracks, complete) }
}

/// The ticked lists imported (`Site::import`). Same ids as a Spotify link's import, so a second import updates them.
#[tauri::command]
pub async fn spotify_import(app: AppHandle, state: State<'_, AppState>, picks: Vec<SpotifyPick>) -> CmdResult<SpotifyLibraryImport> {
    SITE.import(&app, &state, picks).await
}

#[tauri::command]
pub async fn spotify_web_close(app: AppHandle) -> CmdResult<()> {
    SITE.close(&app)
}
