//! A service's own web player in an app window, its playlists read from what the page draws (Spotify: `spotify_web`,
//! Apple Music: `apple_web`). The window gets no capability (remote page, no IPC); answers come on WebView2's message
//! channel, checked by the site's parser. Each site keeps its own inbox: two such windows can be open.

// Windows only for the channel; the rest still builds everywhere.
#![cfg_attr(not(windows), allow(dead_code))]

use crate::spotify_web::{SpotifyLibraryImport, SpotifyList, SpotifyPick, SpotifyProgress, SpotifySong};
use crate::{AppState, CmdResult, err, links};
use anyhow::Context;
use music_connectors::linklist::MAX_TRACKS;
use music_connectors::spotify_page::Message;
use music_core::model::{PlaylistRead, Source, Track};
use std::sync::Mutex;
use std::time::Duration;
use tauri::webview::Cookie;
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio::time::timeout;

/// Silence from the page past this: it stopped. A list waits up to 20 s for its first rows.
const QUIET: Duration = Duration::from_secs(40);

/// Where a site's messages go while a job runs.
pub type Inbox = Mutex<Option<UnboundedSender<Message>>>;

/// What tells one site from another.
pub struct Site {
    /// The window's title, and the service's name in errors.
    pub name: &'static str,
    /// The window's label.
    pub label: &'static str,
    /// The web player, with a closing slash.
    pub player: &'static str,
    /// The service's own sign-in page.
    pub sign_in: &'static str,
    /// The web session's cookie.
    pub cookie: &'static str,
    /// The script reading the page, and the object it puts on `window`.
    pub script: &'static str,
    pub object: &'static str,
    /// The word in the diagnostics log.
    pub log: &'static str,
    pub inbox: &'static Inbox,
    /// A message from the page, checked (its source included).
    pub parse: fn(source: &str, message: &str) -> Option<Message>,
    /// A list's path on the player; None: not an id of this site.
    pub list_path: fn(&str) -> Option<String>,
    /// A list read: saved as a playlist, its id.
    pub save: fn(&AppState, id: &str, name: &str, tracks: &[Track], complete: bool) -> anyhow::Result<i64>,
}

impl Site {
    /// Does one of these cookies say the web player is signed in?
    fn session_among(&self, cookies: &[Cookie<'_>]) -> bool {
        cookies.iter().any(|cookie| cookie.name() == self.cookie && !cookie.value().is_empty())
    }

    /// Signed in on the site's page. Profile shared with the main window.
    /// WebView2: call from async commands or threads only (sync = deadlock).
    pub fn signed_in(&self, app: &AppHandle) -> bool {
        // Phones: no Spotify, Apple or Google sign-in (one webview, signed out). Android's WebView also throws on a
        // page with no cookie yet (wry 0.57: getCookie(...) must not be null), which aborts the app.
        if cfg!(mobile) {
            return false;
        }
        let Some(main) = app.get_webview("main") else { return false };
        let Ok(url) = Url::parse(self.player) else { return false };
        main.cookies_for_url(url).is_ok_and(|cookies| self.session_among(&cookies))
    }

    /// Opens (or focuses) the site's page, straight on its sign-in when signed out.
    /// WebView2: call from async commands or threads only (`signed_in`).
    pub fn open(&'static self, app: &AppHandle) -> tauri::Result<()> {
        if let Some(window) = app.get_webview_window(self.label) {
            return window.set_focus();
        }
        let page = if self.signed_in(app) { self.player } else { self.sign_in };
        WebviewWindowBuilder::new(app, self.label, WebviewUrl::External(Url::parse(page).expect("valid url"))).additional_browser_args(&crate::background::browser_args()).title(self.name).inner_size(1100.0, 760.0).initialization_script(self.script).build()?;
        #[cfg(any(windows, target_os = "linux"))]
        if let Some(webview) = app.get_webview(self.label) {
            let _ = crate::shield::watch(&webview);
            #[cfg(windows)]
            crate::ytwatch::on_message(&webview, move |source, message| {
                if let Some(parsed) = (self.parse)(source, message)
                    && let Some(inbox) = self.inbox.lock().unwrap().as_ref()
                {
                    let _ = inbox.send(parsed);
                }
            })?;
        }
        Ok(())
    }

    /// Starts a job of the page's script (`call`: a fixed name), on `path` of the player. The new page takes a moment
    /// and the script runs one job at a time: asked again until it says it started.
    async fn start(&self, app: &AppHandle, path: &str, call: &str) -> anyhow::Result<UnboundedReceiver<Message>> {
        let window = app.get_webview_window(self.label).with_context(|| format!("{}'s window was closed", self.name))?;
        let (sender, mut receiver) = unbounded_channel();
        *self.inbox.lock().unwrap() = Some(sender);
        window.navigate(Url::parse(&format!("{}{path}", self.player))?)?;
        // The page being left must not take the call.
        tokio::time::sleep(Duration::from_millis(1500)).await;
        for _ in 0..30 {
            window.eval(format!("window.{object} && window.{object}.{call}()", object = self.object))?;
            if let Ok(Some(Message::Started)) = timeout(Duration::from_secs(1), receiver.recv()).await {
                return Ok(receiver);
            }
        }
        anyhow::bail!("{}'s page didn't answer", self.name)
    }

    async fn next(&self, receiver: &mut UnboundedReceiver<Message>) -> anyhow::Result<Message> {
        match timeout(QUIET, receiver.recv()).await {
            Ok(Some(Message::Failed(error))) => anyhow::bail!("{}'s page: {error}", self.name),
            Ok(Some(message)) => Ok(message),
            _ => anyhow::bail!("{}'s page stopped answering", self.name),
        }
    }

    /// The songs of one list, as the page draws them. `read`: songs so far, songs the list says it has.
    async fn songs(&self, app: &AppHandle, id: &str, mut read: impl FnMut(usize, usize)) -> anyhow::Result<PlaylistRead> {
        let path = (self.list_path)(id).context("Invalid list")?;
        let mut receiver = self.start(app, &path, "read").await?;
        let mut all = Vec::new();
        let mut announced = 0;
        loop {
            match self.next(&mut receiver).await? {
                Message::Songs { songs, total } => {
                    announced = total;
                    all.extend(songs);
                    all.truncate(MAX_TRACKS);
                    read(all.len(), total.max(all.len()));
                }
                Message::Done => return Ok(PlaylistRead::from_page(all, announced)),
                _ => {}
            }
        }
    }

    /// The playlists in the signed-in user's library, listed on `path` of the player.
    pub async fn lists(&self, app: &AppHandle, path: &str) -> CmdResult<Vec<SpotifyList>> {
        async {
            let mut receiver = self.start(app, path, "lists").await?;
            let mut all = Vec::new();
            loop {
                match self.next(&mut receiver).await? {
                    Message::Lists(lists) => all.extend(lists.into_iter().map(|list| SpotifyList { id: list.id, name: list.name, cover: list.cover, songs: None })),
                    Message::Done => return anyhow::Ok(all),
                    _ => {}
                }
            }
        }
        .await
        .map_err(err)
    }

    /// The ticked lists → imported playlists, each song with its YouTube version; a second import updates them. A list
    /// that fails is reported, the others go on. `import_link_stop` ends it with "canceled": lists already saved stay.
    pub async fn import(&self, app: &AppHandle, state: &AppState, picks: Vec<SpotifyPick>) -> CmdResult<SpotifyLibraryImport> {
        // Trust boundary: ids checked by list_path, names bounded.
        if picks.is_empty() || picks.len() > 500 || picks.iter().any(|pick| pick.name.trim().is_empty() || pick.name.chars().count() > 200) {
            return Err("Invalid lists".into());
        }
        let _running = links::begin()?;
        let window = app.get_webview_window(self.label).ok_or_else(|| format!("{}'s window was closed", self.name))?;
        // Chromium stops drawing a window hidden behind others, and the list draws its rows as it goes.
        #[cfg(desktop)]
        let _ = window.set_always_on_top(true);
        let lists = picks.len();
        let mut report = SpotifyLibraryImport { playlist_id: None, lists: 0, songs: 0, playable: 0, failed: Vec::new(), unsearched: 0 };
        for (index, pick) in picks.iter().enumerate() {
            if links::stopped() {
                break;
            }
            let before = report.playable;
            let tell = |matching, done, total, playable, wait_secs, song: Option<&Track>| {
                let _ = app.emit_to("main", "spotify-import", SpotifyProgress { name: pick.name.clone(), list: index + 1, lists, matching, done, total, all_done: 0, all_total: 0, playable, searched: 0, to_search: 0, wait_secs, song: song.map(SpotifySong::from) });
            };
            tell(false, 0, 0, before, 0, None);
            let read = match self.songs(app, &pick.id, |done, total| tell(false, done, total, before, 0, None)).await {
                Ok(read) if !read.tracks.is_empty() => read,
                Ok(_) => {
                    report.failed.push(pick.name.clone());
                    continue;
                }
                Err(error) => {
                    crate::diag::warn(self.log, "a list couldn't be read", &format!("{error:#}"));
                    report.failed.push(pick.name.clone());
                    continue;
                }
            };
            let total = read.tracks.len();
            let to_list = |known: &[Track]| (self.save)(state, &pick.id, pick.name.trim(), known, read.complete);
            let Some((id, links::Found { tracks, unsearched })) = links::save_then_find(app, &read.tracks, to_list, |step| tell(true, step.done, total, before + step.found, step.wait_secs, step.song)).await? else { break };
            report.unsearched += unsearched;
            report.playlist_id.get_or_insert(id);
            report.lists += 1;
            report.songs += total;
            report.playable += tracks.iter().filter(|track| track.ids.contains_key(&Source::Youtube)).count();
        }
        let _ = window.close();
        if links::stopped() {
            return Err("canceled".into());
        }
        Ok(report)
    }

    /// The dialog is gone: its window goes too, the session stays.
    pub fn close(&self, app: &AppHandle) -> CmdResult<()> {
        match app.get_webview_window(self.label) {
            Some(window) => window.close().map_err(err),
            None => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_in_only_with_the_sites_own_cookie_set() {
        static INBOX: Inbox = Mutex::new(None);
        let site = Site { name: "Site", label: "site", player: "https://example.com/", sign_in: "https://example.com/login", cookie: "session", script: "", object: "o", log: "site", inbox: &INBOX, parse: |_, _| None, list_path: |_| None, save: |_, _, _, _, _| Ok(0) };
        assert!(site.session_among(&[Cookie::new("other", "x"), Cookie::new("session", "x")]));
        assert!(!site.session_among(&[Cookie::new("session", ""), Cookie::new("other", "x")]));
        assert!(!site.session_among(&[]));
    }
}
