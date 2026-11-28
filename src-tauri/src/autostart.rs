//! Opens at sign-in (Settings › Advanced). Windows: the HKCU Run entry Task Manager › Startup apps lists.
//! Task Manager's own switch lives in StartupApproved: read here, and turned back on with ours. Linux: a file of ours in
//! the XDG autostart folder, a desktop's own switch in it read the same way. Elsewhere: not offered.

/// Run value name (Task Manager falls back to it when the exe has no description): the edition's product name, the one
/// its uninstaller deletes. Lite's own entry: both editions may open at sign-in, neither changes the other's.
#[cfg(windows)]
const NAME: &str = crate::identity::PRODUCT;
/// The same entry under the app's first name: `follow` renames it. The full app's only (rename catch-up).
#[cfg(all(windows, not(feature = "lite")))]
const OLD_NAME: &str = "Music App";

/// Some(on) on Windows and Linux: this app registered and not turned off by the system's own switch. None elsewhere.
pub fn get() -> Option<bool> {
    #[cfg(windows)]
    return Some(std::env::current_exe().is_ok_and(|exe| win::get(NAME, &exe)));
    #[cfg(target_os = "linux")]
    return Some(linux::get());
    #[cfg(not(any(windows, target_os = "linux")))]
    None
}

/// The entry is shared by every build under this user: only the installed app writes it.
#[cfg(any(windows, target_os = "linux"))]
fn may_write(on: bool) -> anyhow::Result<()> {
    // A dev or bench build switching it off would switch the real one off.
    anyhow::ensure!(crate::identity::installed(), "Open at startup works in the installed app: another build would change the real app's entry");
    anyhow::ensure!(!on || !cfg!(debug_assertions), "Open at startup works in the installed app: a dev build would start without its dev server");
    Ok(())
}

pub fn set(on: bool) -> anyhow::Result<()> {
    #[cfg(windows)]
    {
        may_write(on)?;
        win::set(NAME, &std::env::current_exe()?, on)
    }
    #[cfg(target_os = "linux")]
    {
        may_write(on)?;
        linux::set(on)
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        let _ = on;
        anyhow::bail!("Open at startup isn't offered on this system")
    }
}

/// Music App became Legato (2026-10-29): its Run entry takes the new name, and since updates install in a new folder, it
/// may still name the old exe, gone with the old folder: pointed at this one. Task Manager's switch stays as it was.
/// Installed app only (`identity.rs`): any other build would point the real app's entry at itself.
pub fn follow() {
    #[cfg(windows)]
    if !cfg!(debug_assertions)
        && crate::identity::installed()
        && let Ok(exe) = std::env::current_exe()
    {
        #[cfg(not(feature = "lite"))]
        let _ = win::rename(OLD_NAME, NAME);
        let _ = win::follow(NAME, &exe);
    }
    #[cfg(target_os = "linux")]
    if !cfg!(debug_assertions) && crate::identity::installed() {
        let _ = linux::follow();
    }
}

/// This edition's file in the XDG autostart folder of `config`.
#[cfg(any(target_os = "linux", test))]
fn autostart_file(config: &std::path::Path) -> std::path::PathBuf {
    config.join("autostart").join(format!("{}.desktop", crate::identity::INSTALLED))
}

#[cfg(target_os = "linux")]
mod linux {
    use crate::desktop_file::{enabled, entry, exec_of, launcher, with_exec, xdg_folder};
    use std::path::PathBuf;

    fn file() -> Option<PathBuf> {
        xdg_folder(std::env::var_os("XDG_CONFIG_HOME"), std::env::var_os("HOME"), ".config").map(|config| super::autostart_file(&config))
    }

    /// Registered for what starts this app now, and not switched off by the desktop.
    pub fn get() -> bool {
        let Some(text) = file().and_then(|file| std::fs::read_to_string(file).ok()) else { return false };
        enabled(&text) && launcher().is_ok_and(|launcher| exec_of(&text) == Some(launcher))
    }

    pub fn set(on: bool) -> anyhow::Result<()> {
        let file = file().ok_or_else(|| anyhow::anyhow!("No home folder"))?;
        if on {
            std::fs::create_dir_all(file.parent().unwrap_or(&file))?;
            std::fs::write(file, entry(crate::identity::PRODUCT, crate::identity::INSTALLED, &launcher()?, None, &[]))?;
        } else if file.exists() {
            std::fs::remove_file(file)?;
        }
        Ok(())
    }

    /// An entry naming a program that's gone (an AppImage updated under a new name, or moved): this one.
    pub fn follow() -> anyhow::Result<()> {
        let Some(file) = file() else { return Ok(()) };
        let Ok(text) = std::fs::read_to_string(&file) else { return Ok(()) };
        if exec_of(&text).is_some_and(|named| !named.exists()) {
            std::fs::write(file, with_exec(&text, &launcher()?))?;
        }
        Ok(())
    }
}

/// Run command. Quoted: install folders can have a space.
#[cfg(any(windows, test))]
fn command(exe: &std::path::Path) -> String {
    format!("\"{}\"", exe.display())
}

/// A Run command to point at `exe`: another exe's, and that one gone or Music App's (its install outlived the rename on
/// the owner's PC, 2026-11-06: the entry kept starting music-app.exe).
#[cfg(any(windows, test))]
fn stale(run: &str, exe: &std::path::Path) -> bool {
    let named = std::path::Path::new(run.trim_matches('"'));
    !run.eq_ignore_ascii_case(&command(exe)) && (!named.exists() || named.file_name().is_some_and(|n| n.eq_ignore_ascii_case("music-app.exe")))
}

/// StartupApproved value: odd first byte = turned off in Task Manager. No value = on.
#[cfg(any(windows, test))]
fn approved(value: Option<&[u8]>) -> bool {
    value.and_then(|v| v.first()).is_none_or(|b| b & 1 == 0)
}

#[cfg(windows)]
mod win {
    use anyhow::Result;
    use std::path::Path;
    use windows_registry::{CURRENT_USER, Type};

    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    /// Task Manager's "Enabled".
    const ENABLED: [u8; 12] = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const NOT_FOUND: i32 = 0x8007_0002_u32 as i32;

    /// Registered for this exe (an old dev build or install path doesn't count) and on in Task Manager.
    pub fn get(name: &str, exe: &Path) -> bool {
        let ours = CURRENT_USER.open(RUN).and_then(|k| k.get_string(name)).is_ok_and(|v| v.eq_ignore_ascii_case(&super::command(exe)));
        let value = CURRENT_USER.open(APPROVED).and_then(|k| k.get_value(name)).ok();
        ours && super::approved(value.as_deref())
    }

    /// Entry made under `old`: now under `new`, Task Manager's switch with it.
    #[cfg(not(feature = "lite"))]
    pub fn rename(old: &str, new: &str) -> Result<()> {
        let Ok(command) = CURRENT_USER.open(RUN).and_then(|k| k.get_string(old)) else { return Ok(()) };
        CURRENT_USER.create(RUN)?.set_string(new, &command)?;
        if let Ok(switch) = CURRENT_USER.open(APPROVED).and_then(|k| k.get_value(old)) {
            CURRENT_USER.create(APPROVED)?.set_bytes(new, Type::Bytes, &switch)?;
        }
        set(old, Path::new(""), false)
    }

    /// Entry naming an exe that no longer exists, or Music App's: now `exe`. Ours already, another exe, or none: left alone.
    pub fn follow(name: &str, exe: &Path) -> Result<()> {
        let Ok(old) = CURRENT_USER.open(RUN).and_then(|k| k.get_string(name)) else { return Ok(()) };
        if super::stale(&old, exe) {
            CURRENT_USER.create(RUN)?.set_string(name, super::command(exe))?;
        }
        Ok(())
    }

    pub fn set(name: &str, exe: &Path, on: bool) -> Result<()> {
        if on {
            CURRENT_USER.create(RUN)?.set_string(name, super::command(exe))?;
            CURRENT_USER.create(APPROVED)?.set_bytes(name, Type::Bytes, &ENABLED)?;
            return Ok(());
        }
        for path in [RUN, APPROVED] {
            match CURRENT_USER.options().write().open(path).and_then(|k| k.remove_value(name)) {
                Err(e) if e.code().0 != NOT_FOUND => return Err(e.into()),
                _ => {}
            }
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// Real HKCU, own value name, fake exe (harmless if left behind). By hand: cargo test -p legato -- --ignored
        #[test]
        #[ignore = "writes the user's registry"]
        fn round_trip_and_task_manager_switch() {
            let (name, exe) = ("Music App test entry", Path::new(r"C:\Nowhere\Music App\music-app.exe"));
            set(name, exe, true).unwrap();
            assert_eq!(CURRENT_USER.open(RUN).unwrap().get_string(name).unwrap(), r#""C:\Nowhere\Music App\music-app.exe""#);
            assert!(get(name, exe));
            assert!(!get(name, Path::new(r"C:\Other\music-app.exe")));
            // Switched off in Task Manager.
            CURRENT_USER.create(APPROVED).unwrap().set_bytes(name, Type::Bytes, &[3, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]).unwrap();
            assert!(!get(name, exe));
            set(name, exe, true).unwrap();
            assert!(get(name, exe));
            set(name, exe, false).unwrap();
            assert!(!get(name, exe));
            assert!(CURRENT_USER.open(RUN).unwrap().get_string(name).is_err());
            set(name, exe, false).unwrap();
        }

        /// Same, by hand: an entry left on a removed install follows this exe; one on an exe that exists stays.
        #[test]
        #[ignore = "writes the user's registry"]
        #[cfg(not(feature = "lite"))]
        fn follows_a_moved_install() {
            let (old, name, gone, here) = ("Legato test old entry", "Legato test entry 2", Path::new(r"C:\Nowhere\Music App\music-app.exe"), std::env::current_exe().unwrap());
            set(old, gone, true).unwrap();
            rename(old, name).unwrap();
            assert!(CURRENT_USER.open(RUN).unwrap().get_string(old).is_err());
            follow(name, &here).unwrap();
            assert!(get(name, &here));
            follow(name, gone).unwrap();
            assert!(get(name, &here));
            set(name, &here, false).unwrap();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_edition_has_its_own_autostart_file_on_linux() {
        let file = autostart_file(std::path::Path::new("/home/me/.config"));
        assert_eq!(file, std::path::Path::new("/home/me/.config").join("autostart").join(format!("{}.desktop", crate::identity::INSTALLED)));
    }

    #[test]
    fn command_is_quoted() {
        assert_eq!(command(std::path::Path::new(r"C:\Users\a\AppData\Local\Music App\music-app.exe")), r#""C:\Users\a\AppData\Local\Music App\music-app.exe""#);
    }

    #[test]
    fn an_entry_on_a_gone_exe_or_music_apps_follows_this_one() {
        let here = std::env::current_exe().unwrap();
        let old = std::env::temp_dir().join(format!("legato-stale-{}", std::process::id())).join("music-app.exe");
        std::fs::create_dir_all(old.parent().unwrap()).unwrap();
        std::fs::write(&old, b"").unwrap();
        assert!(stale(&command(&old), &here), "Music App's, still there");
        assert!(stale(r#""C:\Nowhere\Legato\legato.exe""#, &here), "gone");
        assert!(!stale(&command(&here), &here), "ours");
        assert!(!stale(&command(&here), std::path::Path::new(r"C:\Other\legato.exe")), "another exe that exists");
        std::fs::remove_dir_all(old.parent().unwrap()).unwrap();
    }

    #[test]
    fn task_manager_switch() {
        assert!(approved(None));
        assert!(approved(Some(&[2, 0, 0, 0])));
        assert!(approved(Some(&[6, 0])));
        assert!(!approved(Some(&[3, 0, 0, 0, 9, 9])));
        assert!(!approved(Some(&[7])));
        assert!(approved(Some(&[])));
    }
}
