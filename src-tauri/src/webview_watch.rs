//! The main window's WebView2 processes: one that dies is logged (a page that stops drawing left no line before, Nov
//! 2026 report: the window went blank, nothing in the log), a page whose renderer died is loaded again instead of
//! staying empty under the user, and a dead browser process restarts the app once (Nov 2026: the window stayed frozen on its
//! last frame, every webview gone with it, until the user killed the app).

/// Set just before a restart for a dead browser process; the new process inherits it and never restarts again for the
/// same reason (a browser that keeps dying would otherwise blink the window forever).
const RESTARTED_ONCE: &str = "LEGATO_RESTARTED_FOR_DEAD_BROWSER";

/// What follows a failed WebView2 process.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Then {
    Nothing,
    /// The page loaded again in the same webview.
    Reload,
    /// The whole app started again: no webview survives its browser process.
    Restart,
}

#[cfg_attr(not(windows), allow(dead_code))]
/// What a failed WebView2 process means here: the log's words, and what follows. `already_restarted` = this process was
/// itself started by such a restart.
/// Kinds: `COREWEBVIEW2_PROCESS_FAILED_KIND` (0 browser, 1 renderer, 2 renderer unresponsive, 3 a frame's renderer,
/// 4 utility, 5 sandbox helper, 6 GPU, 7-8 plugin, 9 unknown).
pub fn after(kind: i32, already_restarted: bool) -> (&'static str, Then) {
    match kind {
        0 if already_restarted => ("the WebView2 browser process exited again, not restarting twice", Then::Nothing),
        0 => ("the WebView2 browser process exited, restarting the app", Then::Restart),
        1 => ("the page's renderer exited, loading the page again", Then::Reload),
        2 => ("the page stopped answering", Then::Nothing),
        3 => ("a frame's renderer exited", Then::Nothing),
        6 => ("the WebView2 GPU process exited", Then::Nothing),
        _ => ("a WebView2 helper process exited", Then::Nothing),
    }
}

#[cfg(windows)]
pub fn install(app: &tauri::AppHandle, webview: &tauri::Webview) -> tauri::Result<()> {
    let app = app.clone();
    let already_restarted = std::env::var_os(RESTARTED_ONCE).is_some();
    webview.with_webview(move |platform_webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PROCESS_FAILED_KIND;
        use webview2_com::ProcessFailedEventHandler;
        let Ok(core) = platform_webview.controller().CoreWebView2() else { return };
        let handler = ProcessFailedEventHandler::create(Box::new(move |sender, args| {
            let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
            if let Some(args) = args {
                args.ProcessFailedKind(&mut kind)?;
            }
            let (words, then) = after(kind.0, already_restarted);
            crate::diag::warn("webview", words, "");
            match then {
                Then::Reload => {
                    if let Some(core) = sender {
                        core.Reload()?;
                    }
                }
                Then::Restart => {
                    crate::diag::closing();
                    // No window_place::save: it reaches the dead webviews (watch page, PiP). The new process reads the
                    // mark; the UI thread is the only one touching the environment here.
                    std::env::set_var(RESTARTED_ONCE, "1");
                    app.restart();
                }
                Then::Nothing => {}
            }
            Ok(())
        }));
        let mut token = Default::default();
        let _ = core.add_ProcessFailed(&handler, &mut token);
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dead_renderer_reloads_and_a_dead_browser_restarts_the_app_once() {
        assert_eq!(after(1, false).1, Then::Reload);
        assert_eq!(after(0, false).1, Then::Restart);
        // Started by such a restart: a browser that keeps dying never loops.
        assert_eq!(after(0, true).1, Then::Nothing);
        for kind in [2, 3, 4, 5, 6, 7, 8, 9, 42] {
            let (words, then) = after(kind, false);
            assert_eq!(then, Then::Nothing, "{kind}");
            assert!(!words.is_empty());
        }
    }
}
