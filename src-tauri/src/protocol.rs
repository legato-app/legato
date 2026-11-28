//! The `legato://` link type (the share page's "Open in Legato"). The installed app registers it for this user
//! (HKCU\Software\Classes\legato, no admin); Windows then starts `legato.exe "legato://playlist/…"`, or hands the link to
//! the running one (single instance in lib.rs). The text is untrusted: it waits here until the interface takes it
//! (`link_pending`), which reads it like a pasted one (`isShareCode`, then the same import dialog) and nothing else.
//! Installed app only: the key is outside the app's folders (identity.rs). The installer's uninstall hook removes it.
//! Legato Lite registers it too when it is alone; the full app takes it over from a Lite (`keeps`), and Lite's uninstaller
//! removes it only when it still names Lite's exe (`windows/hooks-lite.nsh`).
//! A `.lmix` file double-clicked comes the same way, as its path (`file_of`): the installer registers that file type
//! (`tauri.windows.conf.json`), never the running app, and its uninstaller removes it.
//! Linux: a .deb's own entry names the types (`linux/legato.desktop`, the `.lmix` one declared by
//! `linux/legato-remix.xml`; Lite's `legato-lite.desktop` the link only); the system picks one when both are installed,
//! and the full app, once run, takes it from a Lite for this user. An AppImage installs nothing, so the app writes its
//! entry and that declaration for this user and asks for the types (`xdg-mime`). Between the two editions the same rule
//! both ways (`takes_over`).

// Windows and Linux register; the argument parsing below is tested on every system.
#![cfg_attr(not(any(windows, target_os = "linux")), allow(dead_code))]

use std::sync::Mutex;
#[cfg(any(mobile, test))]
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};

/// A link longer than this is dropped (a command line holds 32 767 characters).
const MAX: usize = 30_000;

/// The `legato://` argument of a launch, as text: that scheme only, no control characters, not too long.
pub fn arg_of(args: &[String]) -> Option<String> {
    args.iter().skip(1).find(|a| a.get(..9).is_some_and(|p| p.eq_ignore_ascii_case("legato://"))).filter(|a| a.len() <= MAX && !a.chars().any(char::is_control)).cloned()
}

/// A `.lmix` file double-clicked (the installer's file type, `tauri.windows.conf.json`: Windows starts `legato.exe "<path>"`;
/// a Linux desktop passes the path or its `file://` address): its path, absolute, that extension, not a folder, no control
/// characters. Only a path: `lmix_read` checks its size and content as for a dropped file; nothing runs it.
pub fn file_of(args: &[String]) -> Option<String> {
    use std::path::Path;
    args.iter().skip(1).filter_map(|argument| local_path(argument)).find(|path| {
        let p = Path::new(path.as_str());
        path.len() <= MAX && !path.chars().any(char::is_control) && p.is_absolute() && p.extension().is_some_and(|e| e.eq_ignore_ascii_case("lmix")) && !p.is_dir()
    })
}

/// The path an argument names: a `file://` address of this computer's own read, anything else as it is.
fn local_path(argument: &str) -> Option<String> {
    if !argument.starts_with("file://") {
        return Some(argument.to_string());
    }
    let address = tauri::Url::parse(argument).ok()?;
    if address.host_str().is_some() {
        return None;
    }
    address.to_file_path().ok()?.into_os_string().into_string().ok()
}

static PENDING: Mutex<Option<String>> = Mutex::new(None);

/// A launch's arguments (this one at start, a second one forwarded): true when they carry a link or a remix file, kept
/// for the interface.
pub fn note(args: &[String]) -> bool {
    let Some(link) = arg_of(args).or_else(|| file_of(args)) else { return false };
    *PENDING.lock().unwrap() = Some(link);
    true
}

/// A phone's sign-in under way: the links the system opens the app with go to it (a PC's answers on its loopback).
#[cfg(any(mobile, test))]
static SIGN_IN: Mutex<Option<UnboundedSender<String>>> = Mutex::new(None);

/// The links to come, for a new sign-in; one still waiting gets none any more.
#[cfg(any(mobile, test))]
pub fn sign_in_answers() -> UnboundedReceiver<String> {
    let (sender, receiver) = unbounded_channel();
    *SIGN_IN.lock().unwrap() = Some(sender);
    receiver
}

/// A link the system opened the app with (a phone): the sign-in waiting reads it; none waiting, dropped. Untrusted: any
/// app can open one, the sign-in takes its own answer only.
#[cfg(any(mobile, test))]
pub fn opened(link: &str) {
    if arg_of(&[String::new(), link.to_string()]).is_none() {
        return;
    }
    if let Some(sign_in) = SIGN_IN.lock().unwrap().as_ref() {
        let _ = sign_in.send(link.to_string());
    }
}

/// The link (or the remix file's path) a launch carried, once.
#[tauri::command]
pub fn link_pending() -> Option<String> {
    PENDING.lock().unwrap().take()
}

/// The link type pointed at this exe, when it is the installed app (updates install in a new folder: a command naming a
/// gone exe is replaced, another working one is left alone, except a Lite's when this is the full app).
pub fn register() {
    #[cfg(windows)]
    if !cfg!(debug_assertions)
        && crate::identity::installed()
        && let Ok(exe) = std::env::current_exe()
    {
        let _ = win::register(&exe);
    }
    #[cfg(target_os = "linux")]
    if !cfg!(debug_assertions) && crate::identity::installed() {
        // Off the start: `xdg-mime` is a shell script.
        std::thread::spawn(|| {
            let registered = match crate::desktop_file::appimage() {
                Some(appimage) => linux::register(&appimage),
                None => linux::take_from_lite(),
            };
            if let Err(error) = registered {
                crate::diag::warn("protocol", "link type not registered", &format!("{error:#}"));
            }
        });
    }
}

/// Legato Lite's entries on Linux: the one its AppImage writes, named after its identifier, and its .deb's, named after
/// the product (tauri-bundler).
#[cfg(any(target_os = "linux", test))]
const LITE_ENTRIES: [&str; 2] = ["app.legato.lite.desktop", "Legato Lite.desktop"];

/// A `.lmix` file's type, as `linux/legato-remix.xml` declares it.
#[cfg(any(target_os = "linux", test))]
const REMIX_TYPE: &str = "application/x-legato-remix";
/// The .deb installs this file; an AppImage's app writes it.
#[cfg(any(target_os = "linux", test))]
const REMIX_DECLARATION: &str = include_str!("../linux/legato-remix.xml");

/// Whether the entry holding a type (`current`, none: nobody) gives way to `mine`: nobody's or ours does, and a Lite's
/// to the full app. Anything else was the user's choice.
#[cfg(any(target_os = "linux", test))]
fn takes_over(current: Option<&str>, mine: &str, this_is_lite: bool) -> bool {
    current.is_none_or(|name| name.is_empty() || name == mine || (LITE_ENTRIES.contains(&name) && !this_is_lite))
}

#[cfg(target_os = "linux")]
mod linux {
    use crate::desktop_file::{entry, xdg_folder};
    use std::path::Path;
    use std::process::Command;

    const SCHEME: &str = "x-scheme-handler/legato";
    /// What this edition opens: the Lite has no remixes.
    const OPENS: &[&str] = if cfg!(feature = "lite") { &[SCHEME] } else { &[SCHEME, super::REMIX_TYPE] };

    pub fn register(appimage: &Path) -> anyhow::Result<()> {
        let mine = format!("{}.desktop", crate::identity::INSTALLED);
        let mut free = Vec::new();
        for &kind in OPENS {
            if super::takes_over(Some(&default_of(kind)?), &mine, cfg!(feature = "lite")) {
                free.push(kind);
            }
        }
        if free.is_empty() {
            return Ok(());
        }
        let data = xdg_folder(std::env::var_os("XDG_DATA_HOME"), std::env::var_os("HOME"), ".local/share").ok_or_else(|| anyhow::anyhow!("No home folder"))?;
        if OPENS.contains(&super::REMIX_TYPE) {
            declare_remix(&data)?;
        }
        let applications = data.join("applications");
        std::fs::create_dir_all(&applications)?;
        let types: String = OPENS.iter().map(|kind| format!("{kind};")).collect();
        let text = entry(crate::identity::PRODUCT, crate::identity::INSTALLED, appimage, Some("%u"), &[("MimeType", &types)]);
        std::fs::write(applications.join(&mine), text)?;
        for kind in free {
            set_default(&mine, kind)?;
        }
        Ok(())
    }

    /// A .deb's full app takes the link from a Lite installed beside it. Anything else keeps what the system and the
    /// user chose; without the package's own entry (another way of installing), nothing is asked.
    pub fn take_from_lite() -> anyhow::Result<()> {
        let mine = format!("{}.desktop", crate::identity::PRODUCT);
        if cfg!(feature = "lite") || !Path::new("/usr/share/applications").join(&mine).exists() {
            return Ok(());
        }
        let current = default_of(SCHEME)?;
        if current != mine && super::takes_over(Some(&current), &mine, false) {
            set_default(&mine, SCHEME)?;
        }
        Ok(())
    }

    /// The entry that opens a type for this user, "" for none.
    fn default_of(kind: &str) -> anyhow::Result<String> {
        let answer = Command::new("xdg-mime").args(["query", "default", kind]).output()?;
        Ok(String::from_utf8_lossy(&answer.stdout).trim().to_string())
    }

    fn set_default(entry: &str, kind: &str) -> anyhow::Result<()> {
        let set = Command::new("xdg-mime").args(["default", entry, kind]).status()?;
        anyhow::ensure!(set.success(), "xdg-mime refused");
        Ok(())
    }

    /// Tells this user's desktop what a `.lmix` file is.
    fn declare_remix(data: &Path) -> anyhow::Result<()> {
        let mime = data.join("mime");
        std::fs::create_dir_all(mime.join("packages"))?;
        std::fs::write(mime.join("packages").join(format!("{}.xml", crate::identity::INSTALLED)), super::REMIX_DECLARATION)?;
        // Missing on some desktops: the type stays unknown there, the link still registers.
        if let Err(error) = Command::new("update-mime-database").arg(&mime).status() {
            crate::diag::warn("protocol", "remix files not declared", &error.to_string());
        }
        Ok(())
    }
}

#[cfg(any(windows, test))]
fn command(exe: &std::path::Path) -> String {
    format!("\"{}\" \"%1\"", exe.display())
}

/// The registered command `have` stays when it is this exe's, or names another exe that works, unless that one is
/// Legato Lite's and this is the full app: the full app wins whichever was installed first.
#[cfg(any(windows, test))]
fn keeps(have: &str, exe: &std::path::Path, lite: bool) -> bool {
    let named = exe_of(have);
    have.eq_ignore_ascii_case(&command(exe)) || (named.exists() && (lite || !in_lite_folder(&named)))
}

/// An exe in Lite's install folder, "Legato Lite" (NSIS: `$LOCALAPPDATA\${PRODUCTNAME}`).
// shortcut: a Lite installed in a folder of another name keeps the link from the full app; read its exe's identity if that shows up.
#[cfg(any(windows, test))]
fn in_lite_folder(exe: &std::path::Path) -> bool {
    exe.parent().and_then(|dir| dir.file_name()).is_some_and(|name| name.eq_ignore_ascii_case("Legato Lite"))
}

/// The exe a registered command names.
#[cfg(any(windows, test))]
fn exe_of(command: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(command.trim_start().strip_prefix('"').and_then(|c| c.split('"').next()).unwrap_or_default())
}

#[cfg(windows)]
mod win {
    use anyhow::Result;
    use std::path::Path;
    use windows_registry::CURRENT_USER;

    const KEY: &str = r"Software\Classes\legato";
    const COMMAND: &str = r"Software\Classes\legato\shell\open\command";

    pub fn register(exe: &Path) -> Result<()> {
        if let Ok(have) = CURRENT_USER.open(COMMAND).and_then(|k| k.get_string(""))
            && super::keeps(&have, exe, cfg!(feature = "lite"))
        {
            return Ok(());
        }
        let want = super::command(exe);
        let root = CURRENT_USER.create(KEY)?;
        root.set_string("", "URL:Legato")?;
        root.set_string("URL Protocol", "")?;
        CURRENT_USER.create(COMMAND)?.set_string("", &want)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn only_a_clean_legato_link_is_kept() {
        assert_eq!(arg_of(&args(&["legato.exe", "legato://playlist/ABC"])).as_deref(), Some("legato://playlist/ABC"));
        assert_eq!(arg_of(&args(&["legato.exe", "LEGATO://playlist/x"])).as_deref(), Some("LEGATO://playlist/x"));
        assert_eq!(arg_of(&args(&["legato.exe", "--jump", "shuffle"])), None);
        assert_eq!(arg_of(&args(&["legato.exe", "https://x.example/legato://"])), None);
        assert_eq!(arg_of(&args(&["legato://playlist/first-is-the-exe"])), None);
        assert_eq!(arg_of(&args(&["legato.exe", "legato://playlist/a\nb"])), None);
        assert_eq!(arg_of(&args(&["legato.exe", &format!("legato://playlist/{}", "a".repeat(MAX))])), None);
        assert_eq!(arg_of(&args(&["legato.exe", "é"])), None);
    }

    #[test]
    fn a_double_clicked_remix_file_is_kept_as_its_absolute_path() {
        let dir = std::env::temp_dir();
        let path = |name: &str| dir.join(name).to_string_lossy().into_owned();
        let spaced = path("My mixes/Été · remix.LMIX");
        assert_eq!(file_of(&args(&["legato.exe", &spaced])).as_deref(), Some(spaced.as_str()));
        // Two files: the first; the Jump List's argument and a link are not files.
        let other = path("b.lmix");
        assert_eq!(file_of(&args(&["legato.exe", &spaced, &other])).as_deref(), Some(spaced.as_str()));
        assert_eq!(file_of(&args(&["legato.exe", "--jump", "shuffle"])), None);
        assert_eq!(file_of(&args(&["legato.exe", "legato://remix/abc"])), None);
        // Longer than MAX_PATH is still a path; past what a command line holds, dropped.
        let long = path(&format!("{}.lmix", "a".repeat(300)));
        assert_eq!(file_of(&args(&["legato.exe", &long])).as_deref(), Some(long.as_str()));
        assert_eq!(file_of(&args(&["legato.exe", &path(&format!("{}.lmix", "a".repeat(MAX)))])), None);
        // Relative, another type, the exe itself, a control character, a folder: none.
        for bad in ["mix.lmix", r"..\mix.lmix", &path("mix.lmix.exe"), &path("mix.json"), &path("a\nb.lmix")] {
            assert_eq!(file_of(&args(&["legato.exe", bad])), None, "{bad}");
        }
        assert_eq!(file_of(&args(&[&spaced])), None);
        // The same file by its `file://` address; another computer's is not read.
        let address = tauri::Url::from_file_path(&spaced).unwrap().to_string();
        // As paths: the address comes back with this system's separators only.
        assert_eq!(file_of(&args(&["legato.exe", &address])).map(std::path::PathBuf::from), Some(std::path::PathBuf::from(&spaced)));
        assert_eq!(file_of(&args(&["legato.exe", "file://elsewhere/share/mix.lmix"])), None);
        let folder = dir.join("legato-test-folder.lmix");
        std::fs::create_dir_all(&folder).unwrap();
        assert_eq!(file_of(&args(&["legato.exe", &folder.to_string_lossy()])), None);
        let _ = std::fs::remove_dir(&folder);
    }

    #[test]
    fn the_registered_command_quotes_the_exe_and_the_link() {
        let exe = std::path::Path::new(r"C:\Program Files\Legato\legato.exe");
        assert_eq!(command(exe), r#""C:\Program Files\Legato\legato.exe" "%1""#);
        assert_eq!(exe_of(&command(exe)), exe);
        assert_eq!(exe_of("nonsense"), std::path::PathBuf::new());
    }

    #[test]
    fn the_full_app_takes_the_link_from_a_lite_and_never_the_other_way() {
        let dir = std::env::temp_dir().join(format!("legato-protocol-{}", std::process::id()));
        let exe_in = |folder: &str| {
            let exe = dir.join(folder).join("legato.exe");
            std::fs::create_dir_all(exe.parent().unwrap()).unwrap();
            std::fs::write(&exe, b"").unwrap();
            exe
        };
        let (full, lite, other) = (exe_in("Legato"), exe_in("Legato Lite"), exe_in("Other"));
        let gone = std::path::Path::new(r"C:\Nowhere\Legato\legato.exe");
        // Its own command stays; one on a gone exe goes, in both editions.
        assert!(keeps(&command(&full), &full, false) && keeps(&command(&lite), &lite, true));
        assert!(!keeps(&command(gone), &full, false) && !keeps(&command(gone), &lite, true));
        // The full app takes a working Lite's; a Lite leaves a working full app's.
        assert!(!keeps(&command(&lite), &full, false));
        assert!(keeps(&command(&full), &lite, true));
        // Another working exe, not Lite's: left alone by both.
        assert!(keeps(&command(&other), &full, false) && keeps(&command(&other), &lite, true));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn on_linux_the_link_leaves_another_choice_alone() {
        let (full, [lite, lite_deb]) = ("app.legato.desktop.desktop", LITE_ENTRIES);
        for nobody_or_ours in [None, Some(""), Some(full)] {
            assert!(takes_over(nobody_or_ours, full, false), "{nobody_or_ours:?}");
        }
        assert!(takes_over(Some(lite), full, false) && takes_over(Some(lite), lite, true));
        // A Lite's .deb gives way to the full app too, from its AppImage or its own .deb; not to a Lite's AppImage.
        assert!(takes_over(Some(lite_deb), full, false) && takes_over(Some(lite_deb), "Legato.desktop", false));
        assert!(!takes_over(Some(lite_deb), lite, true));
        assert!(!takes_over(Some(full), lite, true) && !takes_over(Some("Legato.desktop"), lite, true) && !takes_over(Some("other.desktop"), full, false));
        // The names the Lite's config gives.
        let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.lite.conf.json")).unwrap();
        let named = |key: &str| format!("{}.desktop", config[key].as_str().unwrap());
        assert_eq!([named("identifier"), named("productName")], LITE_ENTRIES);
    }

    #[test]
    fn only_the_full_apps_deb_opens_remix_files() {
        let json = |text: &str| serde_json::from_str::<serde_json::Value>(text).unwrap();
        let full = json(include_str!("../tauri.linux.conf.json"));
        assert_eq!(full["bundle"]["linux"]["deb"]["files"], serde_json::json!({ "/usr/share/mime/packages/app.legato.desktop.xml": "./linux/legato-remix.xml" }));
        assert!(REMIX_DECLARATION.contains(&format!("type=\"{REMIX_TYPE}\"")) && REMIX_DECLARATION.contains("pattern=\"*.lmix\""));
        assert!(include_str!("../linux/legato.desktop").contains(&format!("{REMIX_TYPE};")));
        // Lite's own entry, claiming the link alone, and no declaration: two packages can't own the same file.
        let lite = json(include_str!("../tauri.lite-linux.conf.json"));
        assert_eq!(lite["bundle"]["linux"]["deb"]["desktopTemplate"], "./linux/legato-lite.desktop");
        assert!(lite["bundle"]["linux"]["deb"]["files"].is_null());
        let entry = include_str!("../linux/legato-lite.desktop");
        assert!(entry.contains("\nExec={{exec}} %u\n") && entry.contains("\nMimeType=x-scheme-handler/legato;") && !entry.contains(REMIX_TYPE));
    }

    #[test]
    fn a_phones_sign_in_gets_the_links_opened_while_it_waits() {
        opened("legato://spotify-callback?state=early");
        let mut first = sign_in_answers();
        opened("legato://spotify-callback?code=C&state=S");
        opened("https://example.test/not-ours");
        assert_eq!(first.try_recv().ok().as_deref(), Some("legato://spotify-callback?code=C&state=S"));
        assert!(first.try_recv().is_err());
        // A newer one takes over: the first learns nothing more is coming.
        let mut second = sign_in_answers();
        assert!(matches!(first.try_recv(), Err(tokio::sync::mpsc::error::TryRecvError::Disconnected)));
        opened("legato://spotify-callback?state=T");
        assert!(second.try_recv().is_ok());
    }

    #[test]
    fn the_android_app_and_the_connect_steps_name_the_phones_redirect() {
        let redirect = music_connectors::spotify::PHONE_REDIRECT;
        let address = tauri::Url::parse(redirect).unwrap();
        let filter = format!("<data android:scheme=\"{}\" android:host=\"{}\" />", address.scheme(), address.host_str().unwrap());
        assert!(include_str!("../gen/android/app/src/main/AndroidManifest.xml").contains(&filter), "{filter}");
        assert!(include_str!("../../ui/src/features/sources/guides.ts").contains(&format!("'{redirect}'")));
    }

    #[test]
    fn the_deb_entry_takes_the_link_and_passes_it_on() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.linux.conf.json")).unwrap();
        assert_eq!(config["bundle"]["linux"]["deb"]["desktopTemplate"], "./linux/legato.desktop");
        let template = include_str!("../linux/legato.desktop");
        assert!(template.contains("\nExec={{exec}} %u\n") && template.contains("\nMimeType=x-scheme-handler/legato;"));
    }

    #[test]
    fn lites_uninstaller_removes_the_link_only_when_it_is_lites() {
        let hooks = include_str!("../windows/hooks-lite.nsh");
        assert!(hooks.contains(r#"ReadRegStr $0 HKCU "Software\Classes\legato\shell\open\command" """#));
        assert!(hooks.contains(r#"${If} $0 == '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'"#), "the delete is guarded by the exe it names");
        assert!(!hooks.contains("Music App"), "the rename catch-up is the full app's only");
    }

    #[test]
    fn a_link_waits_for_the_interface_once() {
        assert!(!note(&args(&["legato.exe"])));
        assert!(note(&args(&["legato.exe", "legato://playlist/Z"])));
        assert_eq!(link_pending().as_deref(), Some("legato://playlist/Z"));
        assert_eq!(link_pending(), None);
        // A double-clicked remix file the same way (one test: the pending slot is shared).
        let file = std::env::temp_dir().join("w.lmix").to_string_lossy().into_owned();
        assert!(note(&args(&["legato.exe", &file])));
        assert_eq!(link_pending(), Some(file));
    }
}
