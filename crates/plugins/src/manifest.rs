//! `legato.manifest` (or the older `plugin.json`, same fields): who made the plugin, what it needs. Checked before anything runs; the user approves the
//! permissions at install (and again when an update asks for more).

use crate::perms::Permission;
use anyhow::{Context, Result, bail, ensure};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Plugin API this app offers. A plugin asks for one; newer ones are refused ("update the app").
pub const API: u32 = 2;

/// The manifest's file names, the one read first leading.
pub const FILES: [&str; 2] = ["legato.manifest", "plugin.json"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "PluginManifest")]
pub struct Manifest {
    /// Reverse domain or simple name: `com.example.sleep-timer`.
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub description: String,
    /// Plugin API version it was written for.
    pub api: u32,
    /// Script file, next to the manifest.
    #[serde(default = "main_default")]
    pub main: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    /// A few words saying what it is about, shown on its card.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    /// Where the plugin's code lives.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    /// Its picture: a `.png` next to the manifest (`icon::read` checks it). Older versions of the app pass over it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

fn main_default() -> String {
    "main.js".into()
}

/// An id as the manifest's rule has it: safe as a folder's name.
pub fn id_ok(id: &str) -> bool {
    (3..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'-') && !id.starts_with(['.', '-']) && !id.contains("..")
}

impl Manifest {
    /// The manifest of the plugin in `folder`: the first of `FILES` it has. One that can't be read or checked is an
    /// error, never skipped for the next.
    pub fn read(folder: &Path) -> Result<Self> {
        let found = FILES.iter().map(|name| folder.join(name)).find(|file| file.exists()).context("No legato.manifest or plugin.json in this folder")?;
        Self::parse(&std::fs::read_to_string(found)?)
    }

    /// Parsed and checked: fields in bounds, known permissions, main file a plain name.
    pub fn parse(json: &str) -> Result<Self> {
        let mut m: Manifest = serde_json::from_str(json).map_err(|e| anyhow::anyhow!("manifest: {e}"))?;
        ensure!(id_ok(&m.id), "manifest: id must be 3-64 characters: a-z, 0-9, dots and dashes");
        ensure!(!m.name.trim().is_empty() && m.name.chars().count() <= 60, "manifest: name must be 1-60 characters");
        ensure!(!m.author.trim().is_empty() && m.author.chars().count() <= 60, "manifest: author must be 1-60 characters");
        ensure!(!m.version.is_empty() && m.version.len() <= 20, "manifest: version must be 1-20 characters");
        ensure!(m.description.chars().count() <= 300, "manifest: description is over 300 characters");
        ensure!(m.api >= 1, "manifest: api must be 1 or more");
        if m.api > API {
            bail!("This plugin needs a newer version of Legato (plugin API {}, this app has {API})", m.api);
        }
        ensure!(m.main.ends_with(".js") && !m.main.contains(['/', '\\']) && !m.main.starts_with('.') && m.main.len() <= 64, "manifest: main must be a .js file next to the manifest");
        // A .png next to the manifest, else no picture.
        m.icon = m.icon.filter(|icon| icon.to_ascii_lowercase().ends_with(".png") && !icon.contains(['/', '\\', ':']) && !icon.starts_with('.') && icon.len() <= 64);
        ensure!(m.tags.len() <= 5 && m.tags.iter().all(|tag| !tag.trim().is_empty() && tag.chars().count() <= 20), "manifest: tags must be 5 at most, 1-20 characters each");
        ensure!(m.permissions.len() <= 32, "manifest: too many permissions");
        for p in &m.permissions {
            let since = Permission::parse(p)?.since_api();
            ensure!(since <= m.api, "manifest: {p} needs plugin API {since}");
        }
        for (field, link) in [("homepage", &m.homepage), ("repository", &m.repository)] {
            if let Some(link) = link {
                ensure!(link.starts_with("https://") && link.len() <= 200, "manifest: {field} must be an https link");
            }
        }
        Ok(m)
    }

    pub fn permissions(&self) -> Vec<Permission> {
        self.permissions.iter().filter_map(|p| Permission::parse(p).ok()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(extra: &str) -> String {
        format!(r#"{{"id":"com.example.timer","name":"Sleep timer","version":"1.0.0","author":"Ann","api":1{extra}}}"#)
    }

    #[test]
    fn good_manifest_and_defaults() {
        let m = Manifest::parse(&json(r#","permissions":["player:control","network:api.example.com"]"#)).unwrap();
        assert_eq!(m.main, "main.js");
        assert_eq!(m.permissions().len(), 2);
        assert!(m.tags.is_empty());
        assert_eq!(Manifest::parse(&json(r#","tags":["Social"]"#)).unwrap().tags, ["Social"]);
    }

    #[test]
    fn legato_manifest_is_read_first_and_plugin_json_still_works() {
        let folder = std::env::temp_dir().join(format!("legato-manifest-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        assert!(Manifest::read(&folder).is_err());
        std::fs::write(folder.join("plugin.json"), json("")).unwrap();
        assert_eq!(Manifest::read(&folder).unwrap().api, 1);
        std::fs::write(folder.join("legato.manifest"), json(r#","repository":"https://example.com/code""#).replace("\"api\":1", "\"api\":2")).unwrap();
        let read = Manifest::read(&folder).unwrap();
        assert_eq!((read.api, read.repository.as_deref()), (2, Some("https://example.com/code")));
        // A broken one is said, not passed over.
        std::fs::write(folder.join("legato.manifest"), "{").unwrap();
        assert!(Manifest::read(&folder).is_err());
        std::fs::remove_dir_all(&folder).unwrap();
        assert!(Manifest::parse(&json(r#","repository":"http://x""#)).is_err());
        assert!(Manifest::parse(&json("").replace("\"api\":1", "\"api\":3")).unwrap_err().to_string().contains("newer version of Legato"));
    }

    #[test]
    fn an_icon_is_a_png_next_to_the_manifest_and_unknown_fields_pass() {
        assert_eq!(Manifest::parse(&json(r#","icon":"My Icon.PNG""#)).unwrap().icon.as_deref(), Some("My Icon.PNG"));
        // A picture the app can't take is passed over: the plugin stays.
        for bad in ["icon.svg", "../icon.png", "art/icon.png", "C:icon.png", ".png"] {
            assert_eq!(Manifest::parse(&json(&format!(r#","icon":"{bad}""#))).unwrap().icon, None, "{bad}");
        }
        // How an older app reads a newer manifest: what it doesn't know, it passes over.
        assert!(Manifest::parse(&json(r#","mascot":"cat.png""#)).is_ok());
    }

    #[test]
    fn the_newer_permissions_need_a_newer_api() {
        let asking = json(r#","permissions":["discord:presence","player:queue","history:read"]"#);
        assert!(Manifest::parse(&asking).unwrap_err().to_string().contains("needs plugin API 2"));
        assert_eq!(Manifest::parse(&asking.replace("\"api\":1", "\"api\":2")).unwrap().permissions().len(), 3);
    }

    #[test]
    fn bad_fields_are_refused() {
        for bad in [
            json(r#","permissions":["files:all"]"#),
            json(r#","main":"../x.js""#),
            json(r#","main":"main.py""#),
            json(r#","homepage":"http://x""#),
            json(r#","tags":["a","b","c","d","e","f"]"#),
            json(r#","tags":[" "]"#),
            json(r#","tags":["a tag far too long to fit"]"#),
            json(r#","permissions":["network:*"]"#),
            r#"{"id":"../evil","name":"x","version":"1","author":"a","api":1}"#.into(),
            r#"{"id":"ok.id","name":"","version":"1","author":"a","api":1}"#.into(),
        ] {
            assert!(Manifest::parse(&bad).is_err(), "{bad}");
        }
        let newer = Manifest::parse(&json("").replace("\"api\":1", "\"api\":9")).unwrap_err().to_string();
        assert!(newer.contains("newer version of Legato"), "{newer}");
    }
}
