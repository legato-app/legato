//! Verified plugin authors (docs/plugins.md): a folder signed by an author the app knows. The signed list names every
//! file with its SHA-256, so a file changed, added or removed since is no longer theirs.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use minisign_verify::{PublicKey, Signature};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Path, PathBuf};

/// The list of a signed folder's files, and its signature (`pnpm tauri signer sign`).
pub const FILE_LIST: &str = "legato.files";
pub const SIGNATURE: &str = "legato.files.sig";

/// Neither file is read past this.
const SIGNED_TEXT_MAX: u64 = 64 << 10;
/// A listed file bigger than any plugin may be (`plugins.rs`' 5 MB for them all).
const FILE_MAX: u64 = 5 << 20;

/// An author and the public key their folders are signed with, as `pnpm tauri signer generate` prints it.
#[derive(Debug, Clone, Deserialize)]
pub struct TrustedAuthor {
    pub author: String,
    pub key: String,
}

/// The authors compiled into the app.
pub fn trusted() -> Vec<TrustedAuthor> {
    serde_json::from_str(include_str!("../trusted-authors.json")).expect("trusted-authors.json")
}

/// Is the plugin in `folder`, whose manifest names `author`, signed by that author and unchanged since?
pub fn verified(folder: &Path, author: &str, trusted: &[TrustedAuthor]) -> bool {
    let (Some(list), Some(signature)) = (signed_text(&folder.join(FILE_LIST)), signed_text(&folder.join(SIGNATURE))) else { return false };
    trusted.iter().filter(|known| known.author == author).any(|known| signed_by(&list, &signature, &known.key)) && matches_folder(&list, folder)
}

fn signed_text(path: &Path) -> Option<String> {
    let mut text = String::new();
    std::fs::File::open(path).ok()?.take(SIGNED_TEXT_MAX + 1).read_to_string(&mut text).ok()?;
    (text.len() as u64 <= SIGNED_TEXT_MAX).then_some(text)
}

/// Both are base64 around minisign's text, as the app's updater reads them.
fn signed_by(list: &str, signature: &str, key: &str) -> bool {
    let decoded = |text: &str| STANDARD.decode(text.trim()).ok().and_then(|bytes| String::from_utf8(bytes).ok());
    let (Some(key), Some(signature)) = (decoded(key), decoded(signature)) else { return false };
    let (Ok(key), Ok(signature)) = (PublicKey::decode(&key), Signature::decode(&signature)) else { return false };
    key.verify(list.as_bytes(), &signature, true).is_ok()
}

/// The list as path → hash. None: a line that isn't `<sha256 hex>  <path>`, a path twice, or one that could leave the
/// folder.
fn parse(list: &str) -> Option<BTreeMap<&str, &str>> {
    let mut files = BTreeMap::new();
    for line in list.lines() {
        let (hash, path) = line.split_once("  ")?;
        let inside = !path.contains(['\\', ':']) && path.split('/').all(|part| !matches!(part, "" | "." | ".."));
        if hash.len() != 64 || !inside || files.insert(path, hash).is_some() {
            return None;
        }
    }
    Some(files)
}

/// Every file of the folder is listed with its hash, and every listed one is there. The two signing files aside.
fn matches_folder(list: &str, folder: &Path) -> bool {
    let Some(mut listed) = parse(list) else { return false };
    let mut folders: Vec<PathBuf> = vec![folder.to_path_buf()];
    while let Some(current) = folders.pop() {
        let Ok(entries) = std::fs::read_dir(&current) else { return false };
        for entry in entries {
            let Ok(entry) = entry else { return false };
            let path = entry.path();
            let Ok(kind) = entry.file_type() else { return false };
            if kind.is_dir() {
                folders.push(path);
                continue;
            }
            // A link points where the list can't answer for.
            if !kind.is_file() {
                return false;
            }
            let Some(name) = path.strip_prefix(folder).ok().and_then(Path::to_str).map(|name| name.replace('\\', "/")) else { return false };
            if name == FILE_LIST || name == SIGNATURE {
                continue;
            }
            // Not listed: said without reading it.
            let Some(hash) = listed.remove(name.as_str()) else { return false };
            if file_hash(&path).is_none_or(|found| !found.eq_ignore_ascii_case(hash)) {
                return false;
            }
        }
    }
    listed.is_empty()
}

fn file_hash(path: &Path) -> Option<String> {
    let mut bytes = Vec::new();
    std::fs::File::open(path).ok()?.take(FILE_MAX + 1).read_to_end(&mut bytes).ok()?;
    (bytes.len() as u64 <= FILE_MAX).then(|| Sha256::digest(&bytes).iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Signed once with a throwaway key, its private half kept nowhere; `OTHER_KEY` is another throwaway's public half.
    const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/signed");
    const TEST_KEY: &str = include_str!("../fixtures/test-key.pub");
    const OTHER_KEY: &str = include_str!("../fixtures/other-key.pub");

    fn known(key: &str) -> Vec<TrustedAuthor> {
        vec![TrustedAuthor { author: "Test author".into(), key: key.trim().into() }]
    }

    /// A copy of the fixture to change.
    fn copy(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("legato-verify-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        for entry in std::fs::read_dir(FIXTURE).unwrap() {
            let entry = entry.unwrap();
            std::fs::copy(entry.path(), folder.join(entry.file_name())).unwrap();
        }
        folder
    }

    fn after(name: &str, change: impl Fn(&Path)) -> bool {
        let folder = copy(name);
        change(&folder);
        let verified = verified(&folder, "Test author", &known(TEST_KEY));
        std::fs::remove_dir_all(&folder).unwrap();
        verified
    }

    #[test]
    fn the_shipped_list_reads() {
        assert!(trusted().iter().all(|known| !known.author.is_empty() && !known.key.is_empty()));
    }

    #[test]
    fn a_signed_folder_is_verified_for_its_author_and_key_alone() {
        assert!(after("good", |_| {}));
        let folder = Path::new(FIXTURE);
        assert!(!verified(folder, "Someone else", &known(TEST_KEY)));
        assert!(!verified(folder, "test author", &known(TEST_KEY)), "the name exactly");
        assert!(!verified(folder, "Test author", &known(OTHER_KEY)));
        assert!(!verified(folder, "Test author", &[]));
    }

    #[test]
    fn any_change_loses_it() {
        assert!(!after("edited", |folder| std::fs::write(folder.join("main.js"), "app.log('other')\n").unwrap()));
        assert!(!after("extra", |folder| std::fs::write(folder.join("more.js"), "").unwrap()));
        assert!(!after("nested", |folder| {
            std::fs::create_dir(folder.join("more")).unwrap();
            std::fs::write(folder.join("more/main.js"), "").unwrap();
        }));
        assert!(!after("missing", |folder| std::fs::remove_file(folder.join("main.js")).unwrap()));
        assert!(!after("garbage", |folder| std::fs::write(folder.join(SIGNATURE), "bm90IGEgc2lnbmF0dXJl").unwrap()));
        assert!(!after("unsigned", |folder| std::fs::remove_file(folder.join(SIGNATURE)).unwrap()));
        // The list rewritten to fit a change: the signature is of the old one.
        assert!(!after("relisted", |folder| {
            let list = std::fs::read_to_string(folder.join(FILE_LIST)).unwrap();
            std::fs::write(folder.join(FILE_LIST), list.replace("main.js", "other.js")).unwrap();
            std::fs::rename(folder.join("main.js"), folder.join("other.js")).unwrap();
        }));
    }

    #[test]
    fn a_path_that_leaves_the_folder_is_refused() {
        let hash = "a".repeat(64);
        assert!(parse(&format!("{hash}  main.js\n{hash}  sub/other.js\n")).is_some());
        for path in ["../main.js", "sub/../../x", "/etc/passwd", "C:/x.js", "sub\\x.js", "", "./main.js", "sub//x"] {
            assert!(parse(&format!("{hash}  {path}\n")).is_none(), "{path}");
        }
        assert!(parse(&format!("{hash}  a.js\n{hash}  a.js\n")).is_none() && parse("short  a.js\n").is_none() && parse("nothing").is_none());
    }
}
