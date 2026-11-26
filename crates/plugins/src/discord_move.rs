//! The built-in Discord presence became a plugin (examples/plugins/discord-presence): what moves with a user who had
//! it on.

use serde_json::{Value, json};

/// The bundled plugin, written into the app's plugin folder: (file name, content).
pub const FILES: [(&str, &str); 2] = [
    ("legato.manifest", include_str!("../../../examples/plugins/discord-presence/legato.manifest")),
    ("main.js", include_str!("../../../examples/plugins/discord-presence/main.js")),
];

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
    use crate::Manifest;

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
