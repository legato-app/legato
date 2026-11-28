//! Which build runs. Only the installed app (`app.legato.desktop`, or `app.legato.lite` for a Lite build) may change what
//! lives outside its own data: install an update over itself, own the HKCU Run entry, move the old folders and keychain
//! entries. Any other identifier (dev build `.devbuild`, bench build `.bench`, smoke test build `.e2e`, a first-run test,
//! the other edition's) is a guest on this PC. A release-profile
//! guest would otherwise run all of it for real, and the Run entry and the installer are shared by every build under this
//! user.

use std::sync::OnceLock;

/// `tauri.conf.json`'s identifier. A guest adds a suffix in its own config (`tauri.dev.conf.json`, `tauri.bench.conf.json`).
#[cfg(not(feature = "lite"))]
pub const INSTALLED: &str = "app.legato.desktop";
/// `tauri.lite.conf.json`'s: a Lite build is installed under its own name only, never as the full app.
#[cfg(feature = "lite")]
pub const INSTALLED: &str = "app.legato.lite";

/// The edition's `productName`: its Run entry, tray tooltip, mixer label, window title and error box. Side by side, the two
/// editions never share one (Tauri's NSIS uninstaller deletes the Run value named after the product).
#[cfg(not(feature = "lite"))]
pub const PRODUCT: &str = "Legato";
#[cfg(feature = "lite")]
pub const PRODUCT: &str = "Legato Lite";

static RUNNING: OnceLock<String> = OnceLock::new();

/// Exactly the installed app's identifier, no prefix match: `app.legato.desktop.bench` is a guest.
pub fn is_installed(id: &str) -> bool {
    id == INSTALLED
}

/// Once, first thing in `run()`.
pub fn init(id: &str) {
    let _ = RUNNING.set(id.to_string());
}

/// This process is the installed app. False until `init` ran: unknown is a guest.
pub fn installed() -> bool {
    RUNNING.get().is_some_and(|id| is_installed(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_exact_identifier_is_the_installed_app() {
        let (this, other) = if cfg!(feature = "lite") { ("app.legato.lite", "app.legato.desktop") } else { ("app.legato.desktop", "app.legato.lite") };
        assert!(is_installed(this));
        for guest in [other, "app.legato.lite.devbuild", "app.legato.desktop.devbuild", "app.legato.desktop.bench", "app.legato.lite.bench", "app.legato.desktop.linuxtrial", "app.legato.desktop.e2e", "app.legato.desktop.firstrun", "app.legato.desktop2", "App.Legato.Desktop", "dev.musicapp.desktop", " app.legato.desktop", ""] {
            assert!(!is_installed(guest), "{guest:?} would act as the installed app");
        }
    }

    #[test]
    fn unknown_is_a_guest() {
        // No test calls `init`: nothing passes for the installed app before `run()` names it.
        assert!(!installed());
    }

    /// Whatever this build's feature (CI tests the full one only): what keeps a Lite installer off the full app's files.
    #[test]
    fn the_lite_config_keeps_off_the_full_apps_files() {
        let lite: serde_json::Value = serde_json::from_str(include_str!("../tauri.lite.conf.json")).unwrap();
        assert_eq!(lite["identifier"], "app.legato.lite");
        assert_eq!(lite["productName"], "Legato Lite", "the Run value and the install folder go by it");
        // Present and null: the overlay deletes the full app's `.lmix` association rather than inheriting it.
        assert!(lite["bundle"].as_object().unwrap().get("fileAssociations").is_some_and(serde_json::Value::is_null));
        // Lite's own hooks: the full app's would delete its `legato://` key and run the rename catch-up.
        assert_eq!(lite["bundle"]["windows"]["nsis"]["installerHooks"], "./windows/hooks-lite.nsh");
    }

    #[test]
    fn the_configs_agree_with_the_guard() {
        let id = |json: &str| serde_json::from_str::<serde_json::Value>(json).unwrap()["identifier"].as_str().unwrap().to_string();
        let installed = if cfg!(feature = "lite") { include_str!("../tauri.lite.conf.json") } else { include_str!("../tauri.conf.json") };
        assert_eq!(id(installed), INSTALLED, "the edition's config is the installed app");
        let product = serde_json::from_str::<serde_json::Value>(installed).unwrap()["productName"].as_str().unwrap().to_string();
        assert_eq!(product, PRODUCT, "the shell's name is the installer's");
        for guest in [include_str!("../tauri.dev.conf.json"), include_str!("../tauri.bench.conf.json"), include_str!("../tauri.e2e.conf.json"), include_str!("../tauri.lite.dev.conf.json"), include_str!("../tauri.lite.bench.conf.json"), include_str!("../tauri.linux-trial.conf.json")] {
            assert!(!is_installed(&id(guest)), "a guest config carries the installed identifier");
        }
    }
}
