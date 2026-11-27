//! A plugin's picture (the manifest's `icon`): a small PNG in its folder, checked here before the app shows it. Never
//! fetched.

use crate::manifest::Manifest;
use std::io::Read;
use std::path::Path;

/// Largest file and side taken.
const MAX_BYTES: u64 = 256 << 10;
const MAX_SIDE: u32 = 512;

/// The picture the manifest names, from the plugin's `folder`. None without one, or when it isn't a plain file holding
/// a PNG within the bounds.
pub fn read(folder: &Path, manifest: &Manifest) -> Option<Vec<u8>> {
    let path = folder.join(manifest.icon.as_ref()?);
    // A link could point anywhere.
    if !std::fs::symlink_metadata(&path).ok()?.is_file() {
        return None;
    }
    let mut bytes = Vec::new();
    std::fs::File::open(path).ok()?.take(MAX_BYTES + 1).read_to_end(&mut bytes).ok()?;
    (bytes.len() as u64 <= MAX_BYTES && small_png(&bytes)).then_some(bytes)
}

/// The PNG signature, then the header chunk with both sides in bounds.
fn small_png(bytes: &[u8]) -> bool {
    let Some(head) = bytes.get(..24) else { return false };
    let side = |at: usize| u32::from_be_bytes([head[at], head[at + 1], head[at + 2], head[at + 3]]);
    head.starts_with(b"\x89PNG\r\n\x1a\n") && &head[12..16] == b"IHDR" && [side(16), side(20)].iter().all(|length| (1..=MAX_SIDE).contains(length))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A PNG's start: its signature and header chunk, then `padding` bytes.
    fn png(width: u32, height: u32, padding: usize) -> Vec<u8> {
        let mut bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR".to_vec();
        bytes.extend(width.to_be_bytes());
        bytes.extend(height.to_be_bytes());
        bytes.resize(bytes.len() + padding, 0);
        bytes
    }

    #[test]
    fn only_a_small_png_the_manifest_names_is_read() {
        let folder = std::env::temp_dir().join(format!("legato-icon-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let manifest = |extra: &str| Manifest::parse(&format!(r#"{{"id":"com.example.icon","name":"Icon","version":"1","author":"Ann","api":1{extra}}}"#)).unwrap();
        let named = manifest(r#","icon":"icon.png""#);
        let write = |bytes: &[u8]| std::fs::write(folder.join("icon.png"), bytes).unwrap();
        // Named, not there.
        assert_eq!(read(&folder, &named), None);
        write(&png(512, 1, 10));
        assert_eq!(read(&folder, &named), Some(png(512, 1, 10)));
        // Not named: none, whatever the folder holds.
        assert_eq!(read(&folder, &manifest("")), None);
        for bad in [png(513, 64, 0), png(64, 0, 0), png(64, 64, MAX_BYTES as usize), b"GIF89a not a png at all, long enough".to_vec(), png(64, 64, 0)[..20].to_vec()] {
            write(&bad);
            assert_eq!(read(&folder, &named), None, "{} bytes", bad.len());
        }
        // A folder of that name is no picture.
        std::fs::remove_file(folder.join("icon.png")).unwrap();
        std::fs::create_dir(folder.join("icon.png")).unwrap();
        assert_eq!(read(&folder, &named), None);
        std::fs::remove_dir_all(&folder).unwrap();
    }
}
