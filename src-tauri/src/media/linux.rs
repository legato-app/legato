//! Linux media panel and media keys: MPRIS (`org.mpris.MediaPlayer2`) on the session bus. A desktop's panel and the
//! keyboard's media keys call its methods; each one becomes the same `media-key` / `media-seek` event as on Windows.
//! Nothing leaves the PC. Written on zbus, which the keychain already brings.

use super::{MprisFields, NowPlaying, art_extension, bus_suffix, jumped, metadata_of, playback_status, position_at, seek_target, toggle_key};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use zbus::blocking::object_server::InterfaceRef;
use zbus::object_server::SignalEmitter;
use zbus::zvariant::{ObjectPath, OwnedValue, Value};

const PATH: &str = "/org/mpris/MediaPlayer2";

/// `org.mpris.MediaPlayer2`: who plays, and its window.
struct Root {
    app: AppHandle,
}

#[zbus::interface(name = "org.mpris.MediaPlayer2")]
impl Root {
    fn raise(&self) {
        crate::tray::show_main(&self.app);
    }

    fn quit(&self) {
        crate::background::quit(&self.app);
    }

    #[zbus(property)]
    fn can_quit(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn can_raise(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn has_track_list(&self) -> bool {
        false
    }

    #[zbus(property)]
    fn identity(&self) -> String {
        crate::identity::PRODUCT.into()
    }

    /// The name of the installed `.desktop` file, to confirm with the first .deb.
    #[zbus(property)]
    fn desktop_entry(&self) -> String {
        crate::identity::PRODUCT.into()
    }

    #[zbus(property)]
    fn supported_uri_schemes(&self) -> Vec<String> {
        Vec::new()
    }

    #[zbus(property)]
    fn supported_mime_types(&self) -> Vec<String> {
        Vec::new()
    }
}

/// The song as last told, and when: the position moves on from there while it plays.
struct Player {
    app: AppHandle,
    now: Option<NowPlaying>,
    told: Instant,
    art: Option<PathBuf>,
    /// Counts the songs: each one's track id, and its cover's file name.
    track: u64,
}

impl Player {
    fn position_ms(&self) -> u64 {
        self.now.as_ref().map_or(0, |now| position_at(now, self.told.elapsed().as_millis() as u64))
    }

    fn key(&self, key: &str) {
        crate::background::wake(&self.app);
        let _ = self.app.emit_to("main", "media-key", key);
    }

    fn seek_to(&self, position_ms: u64) {
        crate::background::wake(&self.app);
        let _ = self.app.emit_to("main", "media-seek", position_ms);
    }

    fn fields(&self) -> Option<MprisFields> {
        self.now.as_ref().map(|now| metadata_of(now, self.art.as_deref(), self.track))
    }
}

#[zbus::interface(name = "org.mpris.MediaPlayer2.Player")]
impl Player {
    fn play(&self) {
        self.key("play");
    }

    fn pause(&self) {
        self.key("pause");
    }

    fn play_pause(&self) {
        self.key(toggle_key(self.now.as_ref().is_some_and(|now| now.playing)));
    }

    fn stop(&self) {
        self.key("stop");
    }

    fn next(&self) {
        self.key("next");
    }

    fn previous(&self) {
        self.key("previous");
    }

    fn seek(&self, offset_us: i64) {
        if let Some(duration_ms) = self.now.as_ref().and_then(|now| now.duration_ms) {
            self.seek_to(seek_target(self.position_ms(), offset_us / 1000, duration_ms));
        }
    }

    /// Ignored for another track than the one playing, or past its end (the MPRIS rule).
    fn set_position(&self, track_id: ObjectPath<'_>, position_us: i64) {
        let Some(fields) = self.fields() else { return };
        if fields.track_id == track_id.as_str() && fields.length_us.is_some_and(|length| (0..=length).contains(&position_us)) {
            self.seek_to(position_us as u64 / 1000);
        }
    }

    /// Nothing is opened from the bus.
    fn open_uri(&self, _uri: String) {}

    #[zbus(signal)]
    async fn seeked(emitter: &SignalEmitter<'_>, position_us: i64) -> zbus::Result<()>;

    #[zbus(property)]
    fn playback_status(&self) -> String {
        playback_status(self.now.as_ref()).into()
    }

    #[zbus(property)]
    fn metadata(&self) -> HashMap<String, OwnedValue> {
        self.fields().map(dictionary).unwrap_or_default()
    }

    /// Never signalled: a desktop moves its bar on its own (`Seeked` says when it jumps).
    #[zbus(property(emits_changed_signal = "false"))]
    fn position(&self) -> i64 {
        self.position_ms() as i64 * 1000
    }

    #[zbus(property)]
    fn rate(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    fn minimum_rate(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    fn maximum_rate(&self) -> f64 {
        1.0
    }

    /// The app's own volume stays its own: read only.
    #[zbus(property)]
    fn volume(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    fn can_go_next(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn can_go_previous(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn can_play(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn can_pause(&self) -> bool {
        true
    }

    #[zbus(property)]
    fn can_seek(&self) -> bool {
        self.now.as_ref().is_some_and(|now| now.duration_ms.is_some())
    }

    #[zbus(property)]
    fn can_control(&self) -> bool {
        true
    }
}

/// The song as MPRIS names its parts. A value the bus refuses is left out.
fn dictionary(fields: MprisFields) -> HashMap<String, OwnedValue> {
    let mut values: Vec<(&str, Value<'_>)> = vec![("xesam:title", fields.title.into()), ("xesam:artist", fields.artists.into())];
    if let Ok(track_id) = ObjectPath::try_from(fields.track_id) {
        values.push(("mpris:trackid", track_id.into()));
    }
    values.extend(fields.album.map(|album| ("xesam:album", album.into())));
    values.extend(fields.length_us.map(|length| ("mpris:length", length.into())));
    values.extend(fields.art_url.map(|url| ("mpris:artUrl", url.into())));
    values.into_iter().filter_map(|(key, value)| Some((key.to_string(), value.try_to_owned().ok()?))).collect()
}

pub struct Media {
    player: InterfaceRef<Player>,
    /// Where the cover playing is written: a desktop reads it from a file, never from the internet.
    art_folder: PathBuf,
    /// One update at a time: each one writes the cover, then tells the bus.
    updating: Mutex<()>,
    /// Dropping it would leave the bus.
    _connection: zbus::blocking::Connection,
}

impl Media {
    /// No session bus (or the name taken): an error, and the app goes without a media panel.
    pub fn install(window: &tauri::WebviewWindow) -> anyhow::Result<Self> {
        let app = window.app_handle().clone();
        let art_folder = app.path().app_cache_dir()?.join("media");
        let name = format!("org.mpris.MediaPlayer2.{}", bus_suffix(crate::identity::installed(), cfg!(feature = "lite"), std::process::id()));
        let player = Player { app: app.clone(), now: None, told: Instant::now(), art: None, track: 0 };
        let connection = zbus::blocking::connection::Builder::session()?.serve_at(PATH, Root { app })?.serve_at(PATH, player)?.name(name)?.build()?;
        let player = connection.object_server().interface::<_, Player>(PATH)?;
        Ok(Self { player, art_folder, updating: Mutex::default(), _connection: connection })
    }

    /// A new song, or none. `art` = cover bytes (None: no cover).
    pub fn update(&self, now: Option<&NowPlaying>, art: Option<&[u8]>) -> anyhow::Result<()> {
        let _one_at_a_time = self.updating.lock().unwrap();
        {
            let mut player = self.player.get_mut();
            // One cover file at a time, a new name for each song: desktops keep a picture by its address.
            if let Some(old) = player.art.take() {
                let _ = std::fs::remove_file(old);
            }
            player.track += 1;
            if let (Some(_), Some(bytes)) = (now, art) {
                std::fs::create_dir_all(&self.art_folder)?;
                let file = self.art_folder.join(format!("now-{}-{}.{}", std::process::id(), player.track, art_extension(bytes)));
                std::fs::write(&file, bytes)?;
                player.art = Some(file);
            }
            player.now = now.cloned();
            player.told = Instant::now();
        }
        let player = self.player.get();
        let emitter = self.player.signal_emitter();
        zbus::block_on(async {
            player.metadata_changed(emitter).await?;
            player.can_seek_changed(emitter).await?;
            player.playback_status_changed(emitter).await
        })?;
        Ok(())
    }

    /// Play state and position of the same song.
    pub fn set_state(&self, now: &NowPlaying) -> anyhow::Result<()> {
        let _one_at_a_time = self.updating.lock().unwrap();
        let (moved, status_changed) = {
            let mut player = self.player.get_mut();
            let moved = jumped(player.position_ms(), now.position_ms);
            let status_changed = playback_status(player.now.as_ref()) != playback_status(Some(now));
            player.now = Some(now.clone());
            player.told = Instant::now();
            (moved, status_changed)
        };
        let player = self.player.get();
        let emitter = self.player.signal_emitter();
        zbus::block_on(async {
            if status_changed {
                player.playback_status_changed(emitter).await?;
            }
            if moved {
                Player::seeked(emitter, now.position_ms as i64 * 1000).await?;
            }
            zbus::Result::Ok(())
        })?;
        Ok(())
    }
}
