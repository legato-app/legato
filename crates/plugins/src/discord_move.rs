//! The built-in Discord presence became a plugin (examples/plugins/discord-presence): what moves with a user who had
//! it on.

use crate::{Manifest, verify};
use anyhow::Result;
use serde_json::{Value, json};
use std::path::Path;

/// The bundled plugin, written into the app's plugin folder: (file name, content). Signed by Legato: the signature
/// covers the manifest and the script, a change to either needs them signed again (docs/plugins.md › Verified).
pub const FILES: [(&str, &str); 4] = [
    ("legato.manifest", include_str!("../../../examples/plugins/discord-presence/legato.manifest")),
    ("main.js", include_str!("../../../examples/plugins/discord-presence/main.js")),
    (verify::FILE_LIST, include_str!("../../../examples/plugins/discord-presence/legato.files")),
    (verify::SIGNATURE, include_str!("../../../examples/plugins/discord-presence/legato.files.sig")),
];

/// An installed copy older than the bundled one gets the bundled files; the same version, unchanged, gets the signing
/// files it lacks. True when something was written. Storage and granted permissions are the library's, not touched.
pub fn refresh(folder: &Path) -> Result<bool> {
    let bundled = Manifest::parse(FILES[0].1)?;
    let installed = Manifest::read(folder)?;
    if installed.id != bundled.id {
        return Ok(false);
    }
    let older = matches!((numbers(&installed.version), numbers(&bundled.version)), (Some(old), Some(new)) if old < new);
    let wanted = if older {
        FILES.to_vec()
    } else if installed.version == bundled.version {
        unsigned_files(folder)
    } else {
        Vec::new()
    };
    // The manifest last, each file swapped in whole: a copy cut short still reads as old, and is done again at the
    // next launch.
    for (name, content) in wanted.iter().rev() {
        let temporary = folder.join(format!("{name}.tmp"));
        std::fs::write(&temporary, content)?;
        std::fs::rename(&temporary, folder.join(name))?;
    }
    Ok(!wanted.is_empty())
}

/// The signing files a copy of the bundled version lacks. None for a copy changed since: the user's own, left alone.
fn unsigned_files(folder: &Path) -> Vec<(&'static str, &'static str)> {
    let signs = |name: &str| name == verify::FILE_LIST || name == verify::SIGNATURE;
    let unchanged = FILES.iter().filter(|(name, _)| !signs(name)).all(|(name, content)| std::fs::read_to_string(folder.join(name)).is_ok_and(|found| found == *content));
    if !unchanged {
        return Vec::new();
    }
    FILES.iter().filter(|(name, _)| signs(name) && !folder.join(name).exists()).copied().collect()
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
            assert!(std::fs::read_dir(&folder).unwrap().all(|entry| !entry.unwrap().path().extension().is_some_and(|kind| kind == "tmp")), "{version}: a temporary file left");
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
    fn the_same_version_unchanged_gets_its_signature_and_is_verified() {
        let folder = std::env::temp_dir().join(format!("legato-discord-signing-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        // As installed before the app shipped a signature: the manifest and the script alone.
        for (name, content) in &FILES[..2] {
            std::fs::write(folder.join(name), content).unwrap();
        }
        let verified = || verify::verified(&folder, "Legato", &verify::trusted());
        assert!(!verified());
        // The user's own change: nothing added.
        std::fs::write(folder.join("main.js"), "mine").unwrap();
        assert!(!refresh(&folder).unwrap());
        assert!(!folder.join(verify::SIGNATURE).exists());
        std::fs::write(folder.join("main.js"), FILES[1].1).unwrap();
        assert!(refresh(&folder).unwrap());
        assert!(verified(), "the bundled copy verifies against Legato's key");
        assert!(!refresh(&folder).unwrap(), "once");
        std::fs::remove_dir_all(&folder).unwrap();
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
