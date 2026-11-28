//! Settings › General › Library backup: the whole library in one file, and back (`music_core::library`).

use crate::{AppState, CmdResult, err};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};
use music_core::library::now_ms;
use music_core::syncmode::Merged;

/// Once, after the first screen: the mixes older versions synced leave the library (`library::cleanup`), after a
/// copy of it next to it. No copy, no cleanup (tried again next start).
pub fn remove_old_mixes(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else { return };
    if !matches!(state.lib().mix_cleanup_pending(), Ok(true)) {
        return;
    }
    // The library is locked only once the copy is made.
    match back_up_before(app, music_core::library::MIX_CLEANUP_COPY).and_then(|_| state.lib().remove_made_up_mixes()) {
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

/// Once, after the first screen: songs saved with title and artist swapped are put right, where the library proves it.
pub fn turn_backwards_titles(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else { return };
    let turned = state.lib().turn_backwards_titles();
    match turned {
        Ok(0) => {}
        Ok(turned) => {
            crate::diag::info("library", "swapped titles put right", &format!("{turned} songs"));
            let _ = app.emit_to("main", "local-changed", 0);
        }
        Err(e) => crate::diag::warn("library", "swapped titles not put right", &format!("{e:#}")),
    }
}

/// A copy of the library next to it before a cleanup (`copy` = which).
pub fn back_up_before(app: &AppHandle, copy: &str) -> anyhow::Result<()> {
    music_core::library::back_up_before_cleanup(&app.path().app_data_dir()?.join("library.db"), copy)?;
    Ok(())
}

/// After the first screen: a copy made before a cleanup leaves after 30 days.
pub fn drop_old_cleanup_backups(app: &AppHandle) {
    drop_cleanup_backups(app, std::time::Duration::from_secs(30 * 86_400));
}

/// Removes those copies `kept` or more old; a failure is only logged.
pub fn drop_cleanup_backups(app: &AppHandle, kept: std::time::Duration) {
    let removed = app.path().app_data_dir().map_err(anyhow::Error::from).and_then(|dir| music_core::library::remove_cleanup_backups(&dir.join("library.db"), kept));
    if let Err(e) = removed {
        crate::diag::warn("library", "a copy of the library not removed", &format!("{e:#}"));
    }
}

/// A consistent copy of the library at `path`, the user's pick.
#[tauri::command]
pub async fn library_backup(app: AppHandle, path: String) -> CmdResult<()> {
    let db = app.path().app_data_dir().map_err(err)?.join("library.db");
    tauri::async_runtime::spawn_blocking(move || music_core::library::back_up(&db, Path::new(&path))).await.map_err(err)?.map_err(err)
}

/// What the backup at `path` holds and this library doesn't is added to it, its interface settings too when `settings`
/// (`Library::merge_backup`: nothing here goes).
#[tauri::command]
pub async fn library_merge_backup(app: AppHandle, path: String, settings: bool) -> CmdResult<Merged> {
    tauri::async_runtime::spawn_blocking(move || app.state::<AppState>().lib().merge_backup(Path::new(&path), settings, now_ms())).await.map_err(err)?.map_err(err)
}

/// The backup at `path` replaces the library, then the app restarts on it.
#[tauri::command]
pub async fn library_restore(app: AppHandle, state: State<'_, AppState>, path: String) -> CmdResult<()> {
    state.lib().restore(Path::new(&path)).map_err(err)?;
    crate::diag::closing();
    crate::window_place::save(&app);
    app.restart()
}
