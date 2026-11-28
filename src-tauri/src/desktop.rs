//! What this desktop gives the app, where Linux's differ: no tray icons (GNOME without an extension), no keyring
//! service. The interface says so instead of offering a switch that does nothing.

use serde::Serialize;

#[derive(Debug, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DesktopSupport {
    /// An icon in the notification area can show.
    pub tray: bool,
    /// Secrets are kept after the app closes (false once a keyring refused one: `secrets.rs`).
    pub keychain: bool,
}

#[tauri::command]
pub async fn desktop_support() -> DesktopSupport {
    DesktopSupport { tray: crate::tray::host_seen(), keychain: crate::secrets::keychain_kept() }
}

/// Whether closing the window hides it (setting `closeToTray`, on until turned off) rather than quits: never without
/// a tray icon to come back by. The saved setting stays as it is.
pub fn closes_to_tray(setting: Option<bool>, tray: bool) -> bool {
    setting.unwrap_or(true) && tray
}

#[cfg(test)]
mod tests {
    use super::closes_to_tray;

    #[test]
    fn the_window_hides_only_when_a_tray_can_bring_it_back() {
        assert!(closes_to_tray(None, true) && closes_to_tray(Some(true), true));
        assert!(!closes_to_tray(Some(false), true) && !closes_to_tray(None, false) && !closes_to_tray(Some(true), false));
    }
}
