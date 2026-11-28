use anyhow::Result;
use keyring::{Entry, Error};
use music_core::model::SecretStore;
#[cfg(any(target_os = "linux", test))]
use music_core::model::MemoryStore;
use std::path::Path;
use std::sync::Arc;
#[cfg(any(target_os = "linux", test))]
use std::sync::atomic::{AtomicBool, Ordering};

/// The user's AudD token (Music Detector): kept and synced by both editions.
pub const AUDD_TOKEN: &str = "audd_token";

/// The app's secrets: the OS keychain (`KeyringOrMemory` on Linux), or on Android a private file (`FileStore`).
#[cfg(not(any(target_os = "android", target_os = "linux")))]
pub fn store(service: &str, _: &Path) -> Arc<dyn SecretStore> {
    Arc::new(KeyringStore::new(service))
}

#[cfg(target_os = "linux")]
pub fn store(service: &str, _: &Path) -> Arc<dyn SecretStore> {
    Arc::new(KeyringOrMemory::new(KeyringStore::new(service)))
}

#[cfg(target_os = "android")]
pub fn store(_: &str, dir: &Path) -> Arc<dyn SecretStore> {
    Arc::new(FileStore::new(dir.join("secrets.json")))
}

/// OS keychain: Windows Credential Manager, macOS Keychain, Secret Service. One entry per key, JSON value.
pub struct KeyringStore {
    service: String,
}

impl KeyringStore {
    pub fn new(service: &str) -> Self {
        Self { service: service.into() }
    }
}

impl SecretStore for KeyringStore {
    fn get(&self, key: &str) -> Option<serde_json::Value> {
        let raw = Entry::new(&self.service, key).ok()?.get_password().ok()?;
        serde_json::from_str(&raw).ok()
    }

    fn set(&self, key: &str, value: Option<serde_json::Value>) -> Result<()> {
        let entry = Entry::new(&self.service, key)?;
        match value {
            Some(v) => entry.set_password(&v.to_string())?,
            None => match entry.delete_credential() {
                Ok(()) | Err(Error::NoEntry) => {}
                Err(e) => return Err(e.into()),
            },
        }
        Ok(())
    }
}

/// False once Linux's keyring refused to keep a secret: it lasts until the app closes.
pub fn keychain_kept() -> bool {
    #[cfg(target_os = "linux")]
    return KEPT.load(Ordering::Relaxed);
    #[cfg(not(target_os = "linux"))]
    true
}

#[cfg(any(target_os = "linux", test))]
static KEPT: AtomicBool = AtomicBool::new(true);

/// Linux: the Secret Service (GNOME Keyring, KWallet), which a session may not run. What it can't take stays in memory
/// until the app closes, never in a plain file. Nothing asks it at start: that would open its unlock dialog every time.
#[cfg(any(target_os = "linux", test))]
struct KeyringOrMemory<Keyring> {
    keyring: Keyring,
    /// What the keyring couldn't take; `null`: removed meanwhile.
    memory: MemoryStore,
}

#[cfg(any(target_os = "linux", test))]
impl<Keyring: SecretStore> KeyringOrMemory<Keyring> {
    fn new(keyring: Keyring) -> Self {
        Self { keyring, memory: MemoryStore::default() }
    }
}

#[cfg(any(target_os = "linux", test))]
impl<Keyring: SecretStore> SecretStore for KeyringOrMemory<Keyring> {
    fn get(&self, key: &str) -> Option<serde_json::Value> {
        // Memory first: what it holds is newer than what the keyring may still have.
        self.memory.get(key).or_else(|| self.keyring.get(key)).filter(|value| !value.is_null())
    }

    fn set(&self, key: &str, value: Option<serde_json::Value>) -> Result<()> {
        match self.keyring.set(key, value.clone()) {
            Ok(()) => self.memory.set(key, None),
            Err(error) if unreachable(&error) => {
                if KEPT.swap(false, Ordering::Relaxed) {
                    crate::diag::warn("secrets", "keychain not reachable, secrets kept in memory", "");
                }
                self.memory.set(key, Some(value.unwrap_or_default()))
            }
            Err(error) => Err(error),
        }
    }
}

/// No keyring service to answer, or it stays locked.
#[cfg(any(target_os = "linux", test))]
fn unreachable(error: &anyhow::Error) -> bool {
    matches!(error.downcast_ref::<Error>(), Some(Error::NoStorageAccess(_) | Error::PlatformFailure(_)))
}

/// Android: `keyring` has no store there. One JSON object in the app's private folder, sealed by a key in Android's
/// Keystore (`mobile/keystore.rs`): `secrets.bin`. An older `secrets.json` (plain) is sealed and removed at the first
/// launch; if the Keystore refuses, the plain file stays rather than losing a sign-in.
#[cfg(target_os = "android")]
pub struct FileStore {
    plain: std::path::PathBuf,
    sealed: std::path::PathBuf,
    lock: std::sync::Mutex<()>,
}

#[cfg(target_os = "android")]
impl FileStore {
    pub fn new(plain: std::path::PathBuf) -> Self {
        let sealed = plain.with_extension("bin");
        let me = Self { plain, sealed, lock: std::sync::Mutex::new(()) };
        if me.plain.exists() && !me.sealed.exists() {
            let all = me.read();
            let _ = me.write(&all);
        }
        me
    }

    fn read(&self) -> serde_json::Map<String, serde_json::Value> {
        if let Ok(bytes) = std::fs::read(&self.sealed) {
            // A key gone (restored backup, reset lock screen): nothing to read, the sign-ins are asked again.
            return crate::keystore::open(&bytes).ok().flatten().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
        }
        std::fs::read(&self.plain).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
    }

    fn write(&self, all: &serde_json::Map<String, serde_json::Value>) -> Result<()> {
        let json = serde_json::to_vec(all)?;
        // Whole file at once: a crash mid-write keeps the old one.
        match crate::keystore::seal(&json) {
            Ok(sealed) => {
                let tmp = self.sealed.with_extension("tmp");
                std::fs::write(&tmp, sealed)?;
                std::fs::rename(&tmp, &self.sealed)?;
                let _ = std::fs::remove_file(&self.plain);
            }
            Err(_) => {
                let tmp = self.plain.with_extension("tmp");
                std::fs::write(&tmp, json)?;
                std::fs::rename(&tmp, &self.plain)?;
            }
        }
        Ok(())
    }
}

#[cfg(target_os = "android")]
impl SecretStore for FileStore {
    fn get(&self, key: &str) -> Option<serde_json::Value> {
        let _held = self.lock.lock().unwrap();
        self.read().remove(key)
    }

    fn set(&self, key: &str, value: Option<serde_json::Value>) -> Result<()> {
        let _held = self.lock.lock().unwrap();
        let mut all = self.read();
        match value {
            Some(v) => all.insert(key.into(), v),
            None => all.remove(key),
        };
        self.write(&all)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A keyring that answers every write as told, and holds nothing new.
    struct Refusing(fn() -> anyhow::Error);

    impl SecretStore for Refusing {
        fn get(&self, key: &str) -> Option<serde_json::Value> {
            (key == "old").then(|| "from the keyring".into())
        }

        fn set(&self, _: &str, _: Option<serde_json::Value>) -> Result<()> {
            Err((self.0)())
        }
    }

    fn no_service() -> anyhow::Error {
        Error::NoStorageAccess("no Secret Service".into()).into()
    }

    #[test]
    fn secrets_a_missing_keyring_cannot_take_stay_in_memory() -> Result<()> {
        assert!(unreachable(&no_service()) && unreachable(&Error::PlatformFailure("no bus".into()).into()));
        assert!(!unreachable(&Error::NoEntry.into()) && !unreachable(&anyhow::anyhow!("other")));
        let store = KeyringOrMemory::new(Refusing(no_service));
        assert_eq!(store.get("old"), Some("from the keyring".into()));
        store.set("token", Some("kept".into()))?;
        assert_eq!(store.get("token"), Some("kept".into()));
        assert!(!KEPT.load(Ordering::Relaxed));
        // Signed out meanwhile: gone, even if the keyring still holds it.
        store.set("old", None)?;
        store.set("token", None)?;
        assert_eq!((store.get("old"), store.get("token")), (None, None));
        // Another failure is told, nothing kept.
        let refused = KeyringOrMemory::new(Refusing(|| anyhow::anyhow!("value too long")));
        assert!(refused.set("token", Some("lost".into())).is_err() && refused.get("token").is_none());
        Ok(())
    }
}
