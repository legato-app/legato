//! Connect Apple Music (user's choice 2026-10-31, against Apple's terms: the app says so first): Apple's own web player
//! (music.apple.com) in an app window, the user signs in on Apple's page, then `music_shield::APPLE_SCRIPT` reads the
//! playlists and songs it draws. No token, no request of ours to Apple, no developer account. Answers come on WebView2's
//! message channel, checked by `music_connectors::apple_page`; songs then go through the same import as Spotify's.

use crate::spotify_web::{SpotifyLibraryImport, SpotifyList, SpotifyPick};
use crate::web_reader::{Inbox, Site};
use crate::{AppState, CmdResult, err};
use music_connectors::apple_page;
use music_core::model::Source;
use tauri::{AppHandle, State};

static INBOX: Inbox = Inbox::new(None);

static SITE: Site = Site {
    name: "Apple Music",
    label: "apple-music",
    player: "https://music.apple.com/",
    // Apple's own sign-in sheet over the player.
    sign_in: "https://music.apple.com/login",
    cookie: "media-user-token",
    script: music_shield::APPLE_SCRIPT,
    object: "__legatoApple",
    log: "apple",
    inbox: &INBOX,
    parse: apple_page::parse,
    list_path: apple_page::list_path,
    save: |state, id, name, tracks, complete| state.lib().save_playlist_read(Source::Apple, id, name, tracks, complete),
};

/// WebView2: call from async commands or threads only (`Site::signed_in`).
pub fn signed_in(app: &AppHandle) -> bool {
    SITE.signed_in(app)
}

#[tauri::command]
pub async fn apple_web_open(app: AppHandle) -> CmdResult<()> {
    SITE.open(&app).map_err(err)
}

#[tauri::command]
pub async fn apple_web_status(app: AppHandle) -> bool {
    signed_in(&app)
}

/// The playlists in the signed-in user's library (Favorite Songs is one).
#[tauri::command]
pub async fn apple_lists(app: AppHandle) -> CmdResult<Vec<SpotifyList>> {
    SITE.lists(&app, apple_page::LISTS_PATH).await
}

/// The ticked playlists imported (`Site::import`).
#[tauri::command]
pub async fn apple_import(app: AppHandle, state: State<'_, AppState>, picks: Vec<SpotifyPick>) -> CmdResult<SpotifyLibraryImport> {
    SITE.import(&app, &state, picks).await
}

#[tauri::command]
pub async fn apple_web_close(app: AppHandle) -> CmdResult<()> {
    SITE.close(&app)
}
