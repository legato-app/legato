//! The OS media session (Windows: SMTC, `GlobalSystemMediaTransportControlsSessionManager`; Linux: the MPRIS players
//! on the session bus): which song the apps playing on this PC say they play. Metadata only, no audio; read when the
//! user presses Listen on "This PC" with the setting on. Other platforms: nothing (the Detector goes on to the next
//! layer).

use music_core::session::Session;

#[cfg(windows)]
pub fn read() -> Vec<Session> {
    use windows::Media::Control::{GlobalSystemMediaTransportControlsSessionManager as Manager, GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status};
    use windows::Win32::System::WinRT::{RO_INIT_MULTITHREADED, RoInitialize};
    let go = || -> windows::core::Result<Vec<Session>> {
        // A worker thread has no COM yet; "already started in another mode" is fine.
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let manager = Manager::RequestAsync()?.join()?;
        let mut out = Vec::new();
        for s in manager.GetSessions()? {
            let one = || -> windows::core::Result<Session> {
                let props = s.TryGetMediaPropertiesAsync()?.join()?;
                Ok(Session {
                    app: s.SourceAppUserModelId()?.to_string(),
                    playing: s.GetPlaybackInfo()?.PlaybackStatus()? == Status::Playing,
                    title: props.Title()?.to_string(),
                    artist: props.Artist()?.to_string(),
                    album: props.AlbumTitle()?.to_string(),
                })
            };
            if let Ok(one) = one() {
                out.push(one);
            }
        }
        Ok(out)
    };
    go().unwrap_or_default()
}

/// A player that doesn't answer is passed over. Legato's own is among them: `music_core::session::pick` leaves it out.
#[cfg(target_os = "linux")]
pub fn read() -> Vec<Session> {
    use music_core::session::{MPRIS_PREFIX, from_mpris};
    use zbus::blocking::{Connection, Proxy, connection::Builder, fdo::DBusProxy};
    use zbus::zvariant::OwnedValue;

    fn one(connection: &Connection, name: &str) -> Option<Session> {
        let player = Proxy::new(connection, name, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player").ok()?;
        let status: String = player.get_property("PlaybackStatus").ok()?;
        let mut metadata: std::collections::HashMap<String, OwnedValue> = player.get_property("Metadata").ok()?;
        let mut text = |key: &str| metadata.remove(key).and_then(|value| String::try_from(value).ok()).unwrap_or_default();
        let (title, album) = (text("xesam:title"), text("xesam:album"));
        let artists = metadata.remove("xesam:artist").and_then(|value| Vec::<String>::try_from(value).ok()).unwrap_or_default();
        from_mpris(name, &status, &title, &artists, &album)
    }

    let go = || -> zbus::Result<Vec<Session>> {
        let connection = Builder::session()?.method_timeout(std::time::Duration::from_millis(500)).build()?;
        let names = DBusProxy::new(&connection)?.list_names()?;
        Ok(names.iter().filter(|name| name.starts_with(MPRIS_PREFIX)).filter_map(|name| one(&connection, name)).collect())
    };
    go().unwrap_or_default()
}

#[cfg(not(any(windows, target_os = "linux")))]
pub fn read() -> Vec<Session> {
    Vec::new()
}
