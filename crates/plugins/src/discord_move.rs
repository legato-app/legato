//! The built-in Discord presence became a plugin (examples/plugins/discord-presence): what moves with a user who had
//! it on.

use crate::Manifest;
use anyhow::Result;
use serde_json::{Value, json};
use std::path::Path;

/// The bundled plugin, written into the app's plugin folder: (file name, content).
pub const FILES: [(&str, &str); 2] = [
    ("legato.manifest", include_str!("../../../examples/plugins/discord-presence/legato.manifest")),
    ("main.js", include_str!("../../../examples/plugins/discord-presence/main.js")),
];

/// An installed copy older than the bundled one gets the bundled files: true when it did. Storage and granted
/// permissions are the library's, not touched here.
pub fn refresh(folder: &Path) -> Result<bool> {
    let bundled = Manifest::parse(FILES[0].1)?;
    let installed = Manifest::read(folder)?;
    let older = matches!((numbers(&installed.version), numbers(&bundled.version)), (Some(old), Some(new)) if old < new);
    if installed.id != bundled.id || !older {
        return Ok(false);
    }
    // The manifest last, each file swapped in whole: a copy cut short still reads as old, and is done again at the
    // next launch.
    for (name, content) in FILES.iter().rev() {
        let temporary = folder.join(format!("{name}.tmp"));
        std::fs::write(&temporary, content)?;
        std::fs::rename(&temporary, folder.join(name))?;
    }
    Ok(true)
}

/// "1.2.10" as numbers. None for anything else: that copy is the user's own, left alone.
fn numbers(version: &str) -> Option<Vec<u32>> {
    version.split('.').map(|part| part.parse().ok()).collect()
}

/// The old add-on's settings (`settings.discord`) as the plugin's storage. One that isn't there stays unset: the
/// plugin's own default holds.
pub fn storage(settings: &Value) -> Value {
    let kept = [("appId", "clientId"), ("status", "shows"), ("paused", "paused"), ("buttons", "buttons"), ("github", "github")];
    let moved = kept.iter().filter_map(|(old, new)| Some((new.to_string(), settings.get(old).filter(|value| value.is_string() || value.is_boolean())?.clone())));
    json!(moved.collect::<serde_json::Map<_, _>>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_an_older_copy_gets_the_bundled_files() {
        let folder = std::env::temp_dir().join(format!("legato-discord-refresh-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let bundled = Manifest::parse(FILES[0].1).unwrap();
        let at = |version: &str| FILES[0].1.replace(&format!("\"version\": \"{}\"", bundled.version), &format!("\"version\": \"{version}\""));
        for (version, refreshed) in [("1.0.0", true), ("0.9.9", true), (bundled.version.as_str(), false), ("1.0.10", false), ("2.0.0", false), ("1.0.0-mine", false)] {
            std::fs::write(folder.join("legato.manifest"), at(version)).unwrap();
            std::fs::write(folder.join("main.js"), "mine").unwrap();
            assert_eq!(refresh(&folder).unwrap(), refreshed, "{version}");
            assert_eq!(std::fs::read_to_string(folder.join("main.js")).unwrap() == FILES[1].1, refreshed, "{version}");
            assert_eq!(std::fs::read_dir(&folder).unwrap().count(), 2, "{version}: a temporary file left");
        }
        // A manifest that can't be written (a folder sits where its temporary file goes): the old one still reads, and
        // the next launch does the copy.
        std::fs::write(folder.join("legato.manifest"), at("1.0.0")).unwrap();
        std::fs::create_dir(folder.join("legato.manifest.tmp")).unwrap();
        assert!(refresh(&folder).is_err());
        assert_eq!(Manifest::read(&folder).unwrap().version, "1.0.0");
        std::fs::remove_dir(folder.join("legato.manifest.tmp")).unwrap();
        // Half a temporary file from a cut run is written over.
        std::fs::write(folder.join("main.js.tmp"), "half").unwrap();
        assert!(refresh(&folder).unwrap());
        assert_eq!(Manifest::read(&folder).unwrap().version, bundled.version);
        assert!(!folder.join("main.js.tmp").exists());
        std::fs::remove_dir_all(&folder).unwrap();
        // Not installed: nothing written.
        assert!(refresh(&folder).is_err());
        assert!(!folder.exists());
    }

    #[test]
    fn the_old_settings_become_the_plugins_storage() {
        let settings = json!({ "appId": "123", "status": "both", "paused": true, "buttons": false, "github": true, "extra": 1 });
        assert_eq!(storage(&settings), json!({ "clientId": "123", "shows": "both", "paused": true, "buttons": false, "github": true }));
        assert_eq!(storage(&json!({ "appId": 7 })), json!({}));
        assert_eq!(storage(&Value::Null), json!({}));
    }

    #[test]
    fn the_bundled_plugin_asks_for_what_is_granted_with_it() {
        let manifest = Manifest::parse(FILES[0].1).unwrap();
        assert_eq!(manifest.permissions, ["player:read", "discord:presence", "ui"]);
        assert_eq!(manifest.main, FILES[1].0);
    }
}
