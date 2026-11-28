//! The system's media panel and media keys: Windows' SystemMediaTransportControls of the main window, Linux's MPRIS
//! (`media/linux.rs`). Buttons → `media-key` event to the UI ("play", "pause", "next", "previous", "stop"); seek bar → `media-seek` (ms).
//! UI → `media_update`: what's playing, shown in the volume flyout / lock screen.

use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Deserialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "MediaNow")]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub playing: bool,
    pub position_ms: u64,
    /// None = unknown yet: no seek bar.
    pub duration_ms: Option<u64>,
    /// YouTube plays it (the Discord presence's artist picture is asked of YouTube Music only then).
    #[serde(default)]
    pub youtube: bool,
}

/// ms → WinRT TimeSpan ticks (100 ns).
#[cfg(any(windows, test))]
pub fn ticks(ms: u64) -> i64 {
    i64::try_from(ms).unwrap_or(i64::MAX / 10_000).saturating_mul(10_000)
}

/// WinRT ticks → ms, negative clamped to 0.
#[cfg(any(windows, test))]
pub fn millis(ticks: i64) -> u64 {
    (ticks.max(0) / 10_000) as u64
}

#[cfg(windows)]
pub use imp::Media;

#[cfg(windows)]
mod imp {
    use super::{NowPlaying, millis, ticks};
    use tauri::{Emitter, Manager};
    use windows::Foundation::{TimeSpan, TypedEventHandler};
    use windows::Media::{MediaPlaybackStatus, MediaPlaybackType, PlaybackPositionChangeRequestedEventArgs, SystemMediaTransportControls, SystemMediaTransportControlsButton, SystemMediaTransportControlsButtonPressedEventArgs, SystemMediaTransportControlsTimelineProperties};
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream, RandomAccessStreamReference};
    use windows::Win32::System::WinRT::ISystemMediaTransportControlsInterop;
    use windows::core::{HSTRING, Result, factory};

    pub struct Media {
        smtc: SystemMediaTransportControls,
    }

    impl Media {
        /// Main thread, once the window exists.
        pub fn install(window: &tauri::WebviewWindow) -> anyhow::Result<Self> {
            let hwnd = window.hwnd()?;
            let interop = factory::<SystemMediaTransportControls, ISystemMediaTransportControlsInterop>()?;
            let smtc: SystemMediaTransportControls = unsafe { interop.GetForWindow(hwnd)? };
            smtc.SetIsPlayEnabled(true)?;
            smtc.SetIsPauseEnabled(true)?;
            smtc.SetIsNextEnabled(true)?;
            smtc.SetIsPreviousEnabled(true)?;
            smtc.SetIsStopEnabled(true)?;
            // Hidden until something plays.
            smtc.SetIsEnabled(false)?;
            let app = window.app_handle().clone();
            smtc.ButtonPressed(&TypedEventHandler::<SystemMediaTransportControls, SystemMediaTransportControlsButtonPressedEventArgs>::new(move |_, args| {
                let key = match args.ok()?.Button()? {
                    SystemMediaTransportControlsButton::Play => "play",
                    SystemMediaTransportControlsButton::Pause => "pause",
                    SystemMediaTransportControlsButton::Next => "next",
                    SystemMediaTransportControlsButton::Previous => "previous",
                    SystemMediaTransportControlsButton::Stop => "stop",
                    _ => return Ok(()),
                };
                crate::background::wake(&app);
                let _ = app.emit_to("main", "media-key", key);
                Ok(())
            }))?;
            let app = window.app_handle().clone();
            smtc.PlaybackPositionChangeRequested(&TypedEventHandler::<SystemMediaTransportControls, PlaybackPositionChangeRequestedEventArgs>::new(move |_, args| {
                let at = args.ok()?.RequestedPlaybackPosition()?;
                crate::background::wake(&app);
                let _ = app.emit_to("main", "media-seek", millis(at.Duration));
                Ok(())
            }))?;
            Ok(Self { smtc })
        }

        /// None = nothing playing: panel hidden. `art` = cover bytes (None keeps panel without one).
        pub fn update(&self, now: Option<&NowPlaying>, art: Option<&[u8]>) -> Result<()> {
            let Some(now) = now else {
                self.smtc.SetPlaybackStatus(MediaPlaybackStatus::Closed)?;
                return self.smtc.SetIsEnabled(false);
            };
            self.smtc.SetIsEnabled(true)?;
            let du = self.smtc.DisplayUpdater()?;
            du.ClearAll()?;
            du.SetType(MediaPlaybackType::Music)?;
            let music = du.MusicProperties()?;
            music.SetTitle(&HSTRING::from(&now.title))?;
            music.SetArtist(&HSTRING::from(&now.artist))?;
            if let Some(album) = &now.album {
                music.SetAlbumTitle(&HSTRING::from(album))?;
            }
            if let Some(bytes) = art {
                du.SetThumbnail(&thumbnail(bytes)?)?;
            }
            du.Update()?;
            self.set_state(now)
        }

        /// Play state and timeline (Windows moves the bar on its own while playing).
        pub fn set_state(&self, now: &NowPlaying) -> Result<()> {
            self.smtc.SetPlaybackStatus(if now.playing { MediaPlaybackStatus::Playing } else { MediaPlaybackStatus::Paused })?;
            let end = now.duration_ms.unwrap_or(0);
            let t = SystemMediaTransportControlsTimelineProperties::new()?;
            t.SetStartTime(TimeSpan::default())?;
            t.SetMinSeekTime(TimeSpan::default())?;
            t.SetEndTime(TimeSpan { Duration: ticks(end) })?;
            t.SetMaxSeekTime(TimeSpan { Duration: ticks(end) })?;
            t.SetPosition(TimeSpan { Duration: ticks(now.position_ms.min(end)) })?;
            self.smtc.UpdateTimelineProperties(&t)
        }
    }

    /// Image bytes → in-memory stream (no temp file, no URL fetched by Windows).
    fn thumbnail(bytes: &[u8]) -> Result<RandomAccessStreamReference> {
        let stream = InMemoryRandomAccessStream::new()?;
        let w = DataWriter::CreateDataWriter(&stream)?;
        w.WriteBytes(bytes)?;
        w.StoreAsync()?.join()?;
        w.FlushAsync()?.join()?;
        w.DetachStream()?;
        stream.Seek(0)?;
        RandomAccessStreamReference::CreateFromStream(&stream)
    }
}

/// MPRIS: the position a desktop was told, moved on by the time since while the song plays.
#[cfg(any(target_os = "linux", test))]
pub fn position_at(now: &NowPlaying, elapsed_ms: u64) -> u64 {
    let position = now.position_ms.saturating_add(if now.playing { elapsed_ms } else { 0 });
    now.duration_ms.map_or(position, |duration| position.min(duration))
}

/// A seek by an offset, kept inside the song.
#[cfg(any(target_os = "linux", test))]
pub fn seek_target(position_ms: u64, offset_ms: i64, duration_ms: u64) -> u64 {
    position_ms.saturating_add_signed(offset_ms).min(duration_ms)
}

/// Further than a bar moving on its own gets: the desktop must be told.
#[cfg(any(target_os = "linux", test))]
pub fn jumped(expected_ms: u64, got_ms: u64) -> bool {
    expected_ms.abs_diff(got_ms) > 2_000
}

/// MPRIS' one play / pause button, as the key the interface knows.
#[cfg(any(target_os = "linux", test))]
pub fn toggle_key(playing: bool) -> &'static str {
    if playing { "pause" } else { "play" }
}

#[cfg(any(target_os = "linux", test))]
pub fn playback_status(now: Option<&NowPlaying>) -> &'static str {
    match now {
        None => "Stopped",
        Some(now) if now.playing => "Playing",
        Some(_) => "Paused",
    }
}

/// The end of the name on the bus: only the installed app takes its edition's, any other build never does.
#[cfg(any(target_os = "linux", test))]
pub fn bus_suffix(installed: bool, lite: bool, process: u32) -> String {
    match (installed, lite) {
        (true, false) => "legato".into(),
        (true, true) => "legato_lite".into(),
        (false, _) => format!("legato.instance{process}"),
    }
}

/// A cover file's extension, from its first bytes.
#[cfg(any(target_os = "linux", test))]
pub fn art_extension(bytes: &[u8]) -> &'static str {
    match bytes {
        [0x89, b'P', b'N', b'G', ..] => "png",
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => "webp",
        _ => "jpg",
    }
}

/// A song as MPRIS names its parts.
#[cfg(any(target_os = "linux", test))]
#[derive(Debug, PartialEq)]
pub struct MprisFields {
    pub track_id: String,
    pub title: String,
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub length_us: Option<i64>,
    /// A `file://` address: the desktop reads the cover this PC holds, never one on the internet.
    pub art_url: Option<String>,
}

#[cfg(any(target_os = "linux", test))]
pub fn metadata_of(now: &NowPlaying, art: Option<&std::path::Path>, track: u64) -> MprisFields {
    MprisFields {
        track_id: format!("/app/legato/track/{track}"),
        title: now.title.clone(),
        artists: vec![now.artist.clone()],
        album: now.album.clone(),
        length_us: now.duration_ms.map(|duration| i64::try_from(duration.saturating_mul(1000)).unwrap_or(i64::MAX)),
        art_url: art.and_then(|file| tauri::Url::from_file_path(file).ok()).map(String::from),
    }
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::Media;

/// Elsewhere (macOS, phones): no media panel here.
#[cfg(not(any(windows, target_os = "linux")))]
pub struct Media;

#[cfg(not(any(windows, target_os = "linux")))]
impl Media {
    pub fn install(_: &tauri::WebviewWindow) -> anyhow::Result<Self> {
        Ok(Self)
    }
    pub fn update(&self, _: Option<&NowPlaying>, _: Option<&[u8]>) -> anyhow::Result<()> {
        Ok(())
    }
    pub fn set_state(&self, _: &NowPlaying) -> anyhow::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn song(playing: bool, position_ms: u64, duration_ms: Option<u64>) -> NowPlaying {
        NowPlaying { title: "One More Time".into(), artist: "Daft Punk".into(), album: None, playing, position_ms, duration_ms, youtube: false }
    }

    #[test]
    fn mpris_keeps_the_position_and_seeks_inside_the_song() {
        assert_eq!(position_at(&song(true, 1_000, Some(10_000)), 500), 1_500);
        assert_eq!(position_at(&song(false, 1_000, Some(10_000)), 500), 1_000);
        assert_eq!(position_at(&song(true, 9_900, Some(10_000)), 500), 10_000);
        assert_eq!(position_at(&song(true, 9_900, None), 500), 10_400);
        assert_eq!(seek_target(1_000, -5_000, 10_000), 0);
        assert_eq!(seek_target(8_000, 5_000, 10_000), 10_000);
        assert_eq!(seek_target(1_000, 2_000, 10_000), 3_000);
        assert!(!jumped(1_000, 2_900) && jumped(1_000, 3_500) && jumped(9_000, 1_000));
    }

    #[test]
    fn mpris_names_the_song_and_the_build() {
        assert_eq!((toggle_key(true), toggle_key(false)), ("pause", "play"));
        assert_eq!((playback_status(None), playback_status(Some(&song(true, 0, None))), playback_status(Some(&song(false, 0, None)))), ("Stopped", "Playing", "Paused"));
        assert_eq!(bus_suffix(true, false, 7), "legato");
        assert_eq!(bus_suffix(true, true, 7), "legato_lite");
        assert_eq!(bus_suffix(false, true, 7), "legato.instance7");
        assert_eq!((art_extension(b"\x89PNG\r\n"), art_extension(b"RIFF\0\0\0\0WEBPVP8 "), art_extension(&[0xff, 0xd8, 0xff])), ("png", "webp", "jpg"));
        let file = std::env::temp_dir().join("now cover.jpg");
        let fields = metadata_of(&song(true, 0, Some(320_000)), Some(&file), 3);
        assert_eq!((fields.track_id.as_str(), fields.artists.as_slice(), fields.length_us), ("/app/legato/track/3", &["Daft Punk".to_string()][..], Some(320_000_000)));
        assert!(fields.art_url.is_some_and(|url| url.starts_with("file:///") && url.ends_with("now%20cover.jpg")));
        assert_eq!(metadata_of(&song(true, 0, None), None, 4).art_url, None);
    }

    #[test]
    fn timespan_conversions() {
        assert_eq!(ticks(1), 10_000);
        assert_eq!(ticks(90_000), 900_000_000);
        assert_eq!(millis(ticks(123_456)), 123_456);
        assert_eq!(millis(-5), 0);
        // Huge values saturate instead of wrapping.
        assert!(ticks(u64::MAX) > 0);
    }
}
