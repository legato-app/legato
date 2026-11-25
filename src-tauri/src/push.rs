//! Changes sent to a service (likes, adds and removals on YouTube Music) don't hold the interface up: the library
//! changes at once, the request follows here, one after the other in the order made (a like then an unlike reach
//! YouTube in that order). A refusal comes back as a `push-failed` event (a notice): a removal or a rename is
//! undone here; songs added stay and are sent again at later syncs (`keep_for_later`).

use music_core::library::{Library, LibraryPlaylist};
use music_core::model::Source;
use serde::Serialize;
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;
use std::sync::mpsc::{Sender, channel};
use tauri::Emitter;

type Job = Pin<Box<dyn Future<Output = ()> + Send>>;
static QUEUE: OnceLock<Sender<Job>> = OnceLock::new();

/// Runs `job` after the ones queued before it, off the interface's path.
pub fn later(job: impl Future<Output = ()> + Send + 'static) {
    let tx = QUEUE.get_or_init(|| {
        let (tx, rx) = channel::<Job>();
        std::thread::Builder::new()
            .name("push".into())
            .spawn(move || {
                for job in rx {
                    tauri::async_runtime::block_on(job);
                }
            })
            .expect("push thread");
        tx
    });
    let _ = tx.send(Box::pin(job));
}

#[derive(Debug, Clone, Copy, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "PushKind")]
pub enum Kind {
    Add,
    /// Kept in your own Liked Music instead (liked at the next sync).
    Like,
    Remove,
    Unlike,
    /// A music server's playlist (`servers.rs`).
    ServerAdd,
    ServerRemove,
    /// Its old name put back here.
    ServerRename,
}

/// What the interface says when a change didn't reach the service.
#[derive(Debug, Clone, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "PushFailed")]
pub struct Failed {
    pub kind: Kind,
    pub playlist: String,
    pub songs: usize,
    pub reason: String,
    /// Refused because the session ended: signing in again is what helps.
    pub signed_out: bool,
}

impl Failed {
    pub fn new(kind: Kind, playlist: String, songs: usize, reason: String) -> Self {
        let signed_out = signed_out(&reason);
        Self { kind, playlist, songs, reason, signed_out }
    }
}

/// YouTube Music's or a music server's words for a session it no longer takes.
fn signed_out(reason: &str) -> bool {
    reason.starts_with(music_connectors::ytmusic::SIGNED_OUT) || reason.contains("401 Unauthorized") || music_connectors::servers::refused(&anyhow::Error::msg(reason.to_string()))
}

/// The playlists of `source` with songs waiting to be sent, and those songs.
pub fn waiting(lib: &Library, source: Source) -> anyhow::Result<Vec<(LibraryPlaylist, Vec<i64>)>> {
    let pending = lib.pending_pushes()?;
    if pending.is_empty() {
        return Ok(Vec::new());
    }
    let with_songs = |playlist: LibraryPlaylist| {
        let songs: Vec<i64> = pending.iter().filter(|(id, _)| *id == playlist.id).map(|(_, track_id)| *track_id).collect();
        (!songs.is_empty()).then_some((playlist, songs))
    };
    Ok(lib.playlists()?.into_iter().filter(|playlist| playlist.source == source && !playlist.custom).filter_map(with_songs).collect())
}

/// The service itself saying no: its own words, or a 4xx. A network failure, a 5xx or "too many requests" (429, Google's
/// "Sorry" page) says nothing about the song.
fn counts_as_try(reason: &str) -> bool {
    const REFUSALS: [&str; 5] = ["YouTube Music: ", "YouTube Music refused", "Your music server said:", "Your music server doesn't let this user", "Your music server doesn't have this item"];
    let answered_no = REFUSALS.iter().any(|words| reason.starts_with(words)) || reason.contains("→ 4");
    answered_no && !signed_out(reason) && !music_core::searchpace::refused(reason)
}

/// Songs a service didn't take into a playlist: they wait for a later sync. Only a real refusal counts as a try.
pub fn keep_for_later(lib: &Library, playlist_id: i64, track_ids: &[i64], reason: &str) {
    let kept = lib.add_pending_push(playlist_id, track_ids).and_then(|()| {
        if !counts_as_try(reason) {
            return Ok(());
        }
        track_ids.iter().try_for_each(|track_id| lib.count_push_try(playlist_id, *track_id))
    });
    if let Err(e) = kept {
        crate::diag::warn("push", "A refused song couldn't be kept for later", &format!("{e:#}"));
    }
}

pub fn failed(app: &tauri::AppHandle, f: Failed) {
    // The kind and the reason (a refusal's words); the playlist's name stays out.
    let who = if matches!(f.kind, Kind::ServerAdd | Kind::ServerRemove | Kind::ServerRename) { "A music server" } else { "YouTube Music" };
    crate::diag::warn("push", &format!("{who} refused a change ({:?})", f.kind), &f.reason);
    let _ = app.emit("push-failed", f);
}

#[cfg(test)]
mod tests {
    use super::{counts_as_try, keep_for_later, later};
    use music_core::library::Library;
    use music_core::model::{Source, Track};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    #[test]
    fn only_a_real_refusal_counts_as_a_try() {
        let network = "error sending request for url (https://music.youtube.com/youtubei/v1/browse/edit_playlist). Only playlists you own on YouTube Music can take new songs.";
        for not_counted in [
            network,
            "operation timed out",
            "YouTube Music signed you out (browse → 401 Unauthorized): sign in again",
            "YouTube Music browse/edit_playlist → 503 Service Unavailable",
            "YouTube Music browse/edit_playlist → 429 Too Many Requests",
            "YouTube Music browse/edit_playlist → 403 Forbidden Sorry...",
            "Your music server doesn't answer",
            "Your music server failed (HTTP 502): not JSON",
        ] {
            assert!(!counts_as_try(not_counted), "{not_counted}");
        }
        for counted in [
            "YouTube Music: This playlist is full",
            "YouTube Music refused to add the tracks (STATUS_FAILED)",
            "YouTube Music browse/edit_playlist → 403 Forbidden {}. Only playlists you own on YouTube Music can take new songs.",
            "Your music server doesn't let this user do that (no)",
            "Your music server said: nope (code 0)",
        ] {
            assert!(counts_as_try(counted), "{counted}");
        }
        let lib = Library::in_memory().unwrap();
        let list = lib.save_playlist(Source::Youtube, "p1", "Road trip", &[]).unwrap();
        let song = lib.upsert_track(&Track { title: "Song".into(), artist: "Artist".into(), ..Default::default() }).unwrap();
        for _ in 0..20 {
            keep_for_later(&lib, list, &[song], network);
        }
        assert_eq!(lib.pending_pushes().unwrap(), [(list, song)]);
    }

    #[test]
    fn jobs_run_in_the_order_made() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        for i in 0..5u64 {
            let seen = seen.clone();
            // The first ones are the slowest: order still holds.
            later(async move {
                tokio::time::sleep(Duration::from_millis(20 - 4 * i)).await;
                seen.lock().unwrap().push(i);
            });
        }
        let (tx, rx) = std::sync::mpsc::channel();
        later(async move {
            let _ = tx.send(());
        });
        rx.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(*seen.lock().unwrap(), vec![0, 1, 2, 3, 4]);
    }
}
