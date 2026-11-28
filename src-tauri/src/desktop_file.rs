//! The `.desktop` files this app writes for itself on Linux (open at sign-in, the `legato://` link), as the Desktop
//! Entry and Base Directory specs have them. Pure but for the environment, so tested on every system.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// A path from the root, as Linux writes one (`Path::is_absolute` would answer for the system running the tests).
fn rooted(value: OsString) -> Option<PathBuf> {
    value.as_encoded_bytes().starts_with(b"/").then(|| PathBuf::from(value))
}

/// The AppImage this app runs from: `current_exe` is then inside a mount that leaves with the app.
#[cfg(target_os = "linux")]
pub fn appimage() -> Option<PathBuf> {
    std::env::var_os("APPIMAGE").and_then(rooted)
}

/// What starts this app again.
#[cfg(target_os = "linux")]
pub fn launcher() -> std::io::Result<PathBuf> {
    appimage().map_or_else(std::env::current_exe, Ok)
}

/// An XDG folder: its variable when it names a path from the root, else `fallback` under the home folder.
pub fn xdg_folder(variable: Option<OsString>, home: Option<OsString>, fallback: &str) -> Option<PathBuf> {
    variable.and_then(rooted).or_else(|| home.and_then(rooted).map(|home| home.join(fallback)))
}

/// A hidden entry (no menu icon) starting `exec`, with one argument at most (`%u`: the link clicked).
pub fn entry(name: &str, icon: &str, exec: &Path, argument: Option<&str>, extra: &[(&str, &str)]) -> String {
    let argument = argument.map(|argument| format!(" {argument}")).unwrap_or_default();
    let mut text = format!("[Desktop Entry]\nType=Application\nName={name}\nExec={}{argument}\nIcon={icon}\nNoDisplay=true\n", quoted(exec));
    for (key, value) in extra {
        text.push_str(&format!("{key}={value}\n"));
    }
    text
}

/// A path as an `Exec` argument: quoted, `"`, `` ` ``, `$` and `\` escaped, `%` doubled; then every backslash doubled
/// again, the rule of any string value, which readers undo first.
fn quoted(path: &Path) -> String {
    let mut argument = String::new();
    for character in path.to_string_lossy().chars() {
        match character {
            '"' | '`' | '$' | '\\' => argument.extend(['\\', character]),
            '%' => argument.push_str("%%"),
            _ => argument.push(character),
        }
    }
    format!("\"{}\"", argument.replace('\\', "\\\\"))
}

/// The program an entry's `Exec` starts: its first argument, read back from `quoted`.
pub fn exec_of(text: &str) -> Option<PathBuf> {
    let value = text.lines().find_map(|line| line.strip_prefix("Exec="))?.replace("\\\\", "\\");
    let program = match value.strip_prefix('"') {
        Some(rest) => {
            let (mut program, mut characters) = (String::new(), rest.chars());
            loop {
                match characters.next()? {
                    '"' => break program,
                    '\\' => program.push(characters.next()?),
                    character => program.push(character),
                }
            }
        }
        None => value.split(' ').next().unwrap_or_default().to_string(),
    };
    (!program.is_empty()).then(|| PathBuf::from(program.replace("%%", "%")))
}

/// The entry with another program in its `Exec`, every other line (a desktop's own switch among them) as it is.
pub fn with_exec(text: &str, exec: &Path) -> String {
    text.lines().map(|line| if line.starts_with("Exec=") { format!("Exec={}\n", quoted(exec)) } else { format!("{line}\n") }).collect()
}

/// False once a desktop's own settings switched the entry off.
pub fn enabled(text: &str) -> bool {
    !text.lines().any(|line| matches!(line.trim(), "Hidden=true" | "X-GNOME-Autostart-enabled=false"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_entry_quotes_its_program_and_reads_it_back() {
        let exec = Path::new("/home/someone/My Apps/Legato $1 \"x\" `y` 100% \\.AppImage");
        let text = entry("Legato", "app.legato.desktop", exec, Some("%u"), &[("MimeType", "x-scheme-handler/legato;")]);
        assert!(text.starts_with("[Desktop Entry]\nType=Application\nName=Legato\n"));
        assert!(text.contains("\nExec=\"/home/someone/My Apps/Legato \\\\$1 \\\\\"x\\\\\" \\\\`y\\\\` 100%% \\\\\\\\.AppImage\" %u\n"), "{text}");
        assert!(text.contains("\nIcon=app.legato.desktop\n") && text.ends_with("\nMimeType=x-scheme-handler/legato;\n"));
        assert_eq!(exec_of(&text).as_deref(), Some(exec));
        assert_eq!(exec_of("Exec=/usr/bin/legato %u").as_deref(), Some(Path::new("/usr/bin/legato")));
        assert_eq!(exec_of("Exec=\"/unclosed"), None);
        assert_eq!(exec_of("Name=Legato"), None);
    }

    #[test]
    fn a_new_program_keeps_the_desktops_own_switch() {
        let text = entry("Legato", "legato", Path::new("/old/Legato.AppImage"), None, &[("X-GNOME-Autostart-enabled", "false")]);
        assert!(!enabled(&text) && enabled("[Desktop Entry]\nHidden=false\n") && !enabled("Hidden=true"));
        let moved = with_exec(&text, Path::new("/new/Legato.AppImage"));
        assert_eq!(exec_of(&moved).as_deref(), Some(Path::new("/new/Legato.AppImage")));
        assert!(!enabled(&moved) && moved.lines().count() == text.lines().count());
    }

    #[test]
    fn an_xdg_folder_is_the_variables_or_under_home() {
        let some = |text: &str| Some(OsString::from(text));
        assert_eq!(xdg_folder(some("/config"), some("/home/me"), ".config"), Some(PathBuf::from("/config")));
        // Unset, empty or relative: the fallback.
        for variable in [None, some(""), some("relative")] {
            assert_eq!(xdg_folder(variable, some("/home/me"), ".config"), Some(Path::new("/home/me").join(".config")));
        }
        assert_eq!(xdg_folder(None, None, ".config"), None);
    }
}
