//! Settings › General › Library backup: the whole library in one file, and back (`music_core::library`).

use crate::{AppState, CmdResult, err};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};

/// Once, after the first screen: the mixes older versions synced leave the library (`library::mix_cleanup`), after a
/// copy of it next to it. No copy, no cleanup (tried again next start).
pub fn remove_old_mixes(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else { return };
    if !matches!(state.lib().mix_cleanup_pending(), Ok(true)) {
        return;
    }
    let copied = app.path().app_data_dir().map_err(anyhow::Error::from).and_then(|dir| music_core::library::back_up_before_mix_cleanup(&dir.join("library.db")));
    // The library is locked only once the copy is made.
    match copied.and_then(|_| state.lib().remove_made_up_mixes()) {
        Ok(removed) => {
            crate::diag::info("library", "old YouTube mixes removed", &format!("{} lists, {} songs", removed.playlists, removed.songs));
            let _ = app.emit_to("main", "local-changed", 0);
        }
        Err(e) => crate::diag::warn("library", "old YouTube mixes not removed", &format!("{e:#}")),
    }
}

/// Once, after the first screen: Spotify's covers kept by older versions leave the library.
pub fn drop_spotify_art(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else { return };
    let changed = state.lib().drop_spotify_art();
    match changed {
        Ok(dropped) if dropped.is_empty() => {}
        Ok(dropped) => {
            // Their pictures leave the cover cache too.
            for url in &dropped {
                state.art.forget(url);
            }
            let _ = app.emit_to("main", "local-changed", 0);
        }
        Err(e) => crate::diag::warn("library", "old Spotify covers not removed", &format!("{e:#}")),
    }
}

/// After the first screen: the copy made before the mixes' cleanup leaves after 30 days.
pub fn drop_old_mix_backups(app: &AppHandle) {
    let kept = std::time::Duration::from_secs(30 * 86_400);
    let removed = app.path().app_data_dir().map_err(anyhow::Error::from).and_then(|dir| music_core::library::remove_mix_cleanup_backups(&dir.join("library.db"), kept));
    if let Err(e) = removed {
        crate::diag::warn("library", "an old copy of the library not removed", &format!("{e:#}"));
    }
}

/// A consistent copy of the library at `path`, the user's pick.
#[tauri::command]
pub async fn library_backup(app: AppHandle, path: String) -> CmdResult<()> {
    let db = app.path().app_data_dir().map_err(err)?.join("library.db");
    tauri::async_runtime::spawn_blocking(move || music_core::library::back_up(&db, Path::new(&path))).await.map_err(err)?.map_err(err)
}

/// The backup at `path` replaces the library, then the app restarts on it.
#[tauri::command]
pub async fn library_restore(app: AppHandle, state: State<'_, AppState>, path: String) -> CmdResult<()> {
    state.lib().restore(Path::new(&path)).map_err(err)?;
    crate::diag::closing();
    crate::window_place::save(&app);
    app.restart()
}
