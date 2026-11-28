//! Like Discord: closing the window keeps the app in the notification area, music playing. Hidden, the webview is told
//! so (no painting, throttled timers) and asked to free memory; after a while with nothing playing it is suspended
//! (scripts stop) and woken before anything reaches it again: show, tray, global shortcut, media key. Quit (tray) is the
//! only real exit. Legato Lite lets the hidden page take a background priority and suspends it sooner (`SleepRule`).

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// WebView2 flags for every webview (one browser process: they must match). wry's defaults (no mini menu, no
/// SmartScreen), plus: hidden page keeps full-speed timers and normal priority, so the next song starts at once from
/// the tray (review 2026-10-23: switches took seconds in the background). Silent and hidden long = suspended anyway.
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IntensiveWakeUpThrottling --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows";

/// Lite goes without this one of them: its hidden page gives up CPU, and a song change there may take longer.
const LITE_DROPS: &str = " --disable-renderer-backgrounding";

fn edition_args(lite: bool) -> String {
    if lite { BROWSER_ARGS.replace(LITE_DROPS, "") } else { BROWSER_ARGS.to_string() }
}

/// What every webview is built with. e2e build: the walk's own flags after them (DevTools port, English).
pub fn browser_args() -> String {
    let args = edition_args(cfg!(feature = "lite"));
    #[cfg(feature = "e2e")]
    if let Ok(walk) = std::env::var("LEGATO_E2E_BROWSER_ARGS") {
        return format!("{args} {walk}");
    }
    args
}

/// Quit asked: the next close is real.
static QUITTING: AtomicBool = AtomicBool::new(false);
/// Something plays (media panel updates): never suspended then.
static PLAYING: AtomicBool = AtomicBool::new(false);
/// The last moment something was playing. None: nothing yet.
static LAST_HEARD: Mutex<Option<Instant>> = Mutex::new(None);
static SUSPENDED: AtomicBool = AtomicBool::new(false);
/// Hidden window, page `visible` until the music moves (first position seen while playing).
static HELD: Mutex<Option<Option<u64>>> = Mutex::new(None);
/// Since when the window is hidden.
static HIDDEN: Mutex<Option<Instant>> = Mutex::new(None);

pub fn quitting() -> bool {
    QUITTING.load(Ordering::Relaxed)
}

pub fn set_playing(playing: bool) {
    // While it plays, and the moment it stops.
    if PLAYING.swap(playing, Ordering::Relaxed) || playing {
        *LAST_HEARD.lock().unwrap() = Some(Instant::now());
    }
}

/// How long nothing has played. None: something does.
fn quiet_for() -> Option<Duration> {
    (!PLAYING.load(Ordering::Relaxed)).then(|| LAST_HEARD.lock().unwrap().map_or(Duration::MAX, |heard| heard.elapsed()))
}

/// Music really moved: playing, over a second past the first position seen.
pub fn has_moved(first: Option<u64>, playing: bool, position_ms: u64) -> bool {
    playing && first.is_some_and(|f| position_ms > f + 1000)
}

/// Launch in the tray (after an update from there): hidden, page held `visible` until the music moves.
pub fn hide_until_playing(app: &AppHandle) {
    hide(app);
    hold(app);
}

/// Chromium never starts a new media load in a hidden page: a song resumed after a tray launch sat at 0:00
/// (2026-10-26), a second embed (songs overlapping) never started (2026-10-28). Page `visible` until the music moves.
pub fn hold(app: &AppHandle) {
    if HIDDEN.lock().unwrap().is_none() {
        return;
    }
    *HELD.lock().unwrap() = Some(None);
    set_visible(app, true);
}

/// Player report (media panel): ends the hold once the music moves.
pub fn played(app: &AppHandle, playing: bool, position_ms: u64) {
    let mut held = HELD.lock().unwrap();
    let Some(first) = *held else { return };
    if has_moved(first, playing, position_ms) {
        *held = None;
        drop(held);
        if HIDDEN.lock().unwrap().is_some() {
            set_visible(app, false);
        }
    } else if playing && first.is_none_or(|f| position_ms < f) {
        // First report, or a new song from its start: counted from there.
        *held = Some(Some(position_ms));
    }
}

/// When a hidden window goes to sleep.
struct SleepRule {
    /// Hidden at least this long.
    hidden: Duration,
    /// Nothing playing for at least this long: a song change says "not playing" for a moment, and a page suspended
    /// then would never start the next song.
    quiet: Duration,
    /// Looked at this often.
    check: Duration,
}

const FULL_SLEEP: SleepRule = SleepRule { hidden: Duration::from_secs(5 * 60), quiet: Duration::ZERO, check: Duration::from_secs(60) };
const LITE_SLEEP: SleepRule = SleepRule { hidden: Duration::from_secs(60), quiet: Duration::from_secs(60), check: Duration::from_secs(15) };
const SLEEP: SleepRule = if cfg!(feature = "lite") { LITE_SLEEP } else { FULL_SLEEP };

/// Should a hidden window go to sleep now?
fn should_sleep(rule: &SleepRule, hidden_for: Option<Duration>, quiet_for: Option<Duration>, suspended: bool) -> bool {
    !suspended && hidden_for.is_some_and(|hidden| hidden >= rule.hidden) && quiet_for.is_some_and(|quiet| quiet >= rule.quiet)
}

/// Window closed: hidden, webview in low-resource mode. Music goes on.
pub fn hide(app: &AppHandle) {
    if let Some(w) = app.get_window("main") {
        let _ = w.hide();
    }
    *HIDDEN.lock().unwrap() = Some(Instant::now());
    set_visible(app, false);
}

/// Back on screen (tray, second launch, global shortcut): woken first, then shown and focused.
pub fn show(app: &AppHandle) {
    wake(app);
    *HIDDEN.lock().unwrap() = None;
    *HELD.lock().unwrap() = None;
    set_visible(app, true);
    // Started in the tray: first time on screen, at its saved place.
    if !crate::window_place::placed()
        && let Some(w) = app.get_webview_window("main")
    {
        let _ = crate::window_place::restore(&w);
    }
    if let Some(w) = app.get_window("main") {
        #[cfg(desktop)]
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    #[cfg(desktop)]
    crate::update::check_if_stale(app);
}

/// The only real exit: the watch-page child goes first (window state is saved for single-webview windows only).
pub fn quit(app: &AppHandle) {
    QUITTING.store(true, Ordering::Relaxed);
    wake(app);
    let _ = crate::ytwatch::close(app);
    crate::diag::closing();
    crate::window_place::save(app);
    app.exit(0);
}

/// Before the webview gets anything (key, tray, shortcut): resumed if suspended; hidden, page held `visible`. Resume()
/// alone left a hidden page frozen: the key was lost, nothing played until the window opened (2026-10-28).
pub fn wake(app: &AppHandle) {
    hold(app);
    if !SUSPENDED.swap(false, Ordering::Relaxed) {
        return;
    }
    #[cfg(windows)]
    if let Some(wv) = app.get_webview("main") {
        let _ = wv.with_webview(|pw| unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
            use windows::core::Interface;
            if let Ok(core) = pw.controller().CoreWebView2().and_then(|c| c.cast::<ICoreWebView2_3>()) {
                let _ = core.Resume();
            }
        });
    }
    #[cfg(not(windows))]
    let _ = app;
}

/// WebView2: hidden = no painting, page `hidden` (rAF stops, timers throttled); memory target low while hidden.
fn set_visible(app: &AppHandle, visible: bool) {
    #[cfg(windows)]
    if let Some(wv) = app.get_webview("main") {
        let _ = wv.with_webview(move |pw| unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::*;
            use windows::core::Interface;
            let controller = pw.controller();
            let _ = controller.SetIsVisible(visible);
            if let Ok(core) = controller.CoreWebView2().and_then(|c| c.cast::<ICoreWebView2_19>()) {
                let level = if visible { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW };
                let _ = core.SetMemoryUsageTargetLevel(level);
            }
        });
    }
    #[cfg(not(windows))]
    let _ = (app, visible);
}

/// Looks now and then: hidden and silent long enough (`SleepRule`) = suspended.
pub fn spawn_sleeper(app: AppHandle) {
    // Suspending the webview is WebView2's: elsewhere the app is only checked on.
    #[cfg(not(windows))]
    let _ = app;
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(SLEEP.check);
            let hidden_for = HIDDEN.lock().unwrap().map(|t| t.elapsed());
            if !should_sleep(&SLEEP, hidden_for, quiet_for(), SUSPENDED.load(Ordering::Relaxed)) {
                continue;
            }
            // Held for a key that started nothing: hidden again (WebView2 only suspends hidden pages).
            if HELD.lock().unwrap().take().is_some() {
                set_visible(&app, false);
            }
            #[cfg(windows)]
            if let Some(wv) = app.get_webview("main") {
                let _ = wv.with_webview(|pw| unsafe {
                    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
                    use webview2_com::TrySuspendCompletedHandler;
                    use windows::core::Interface;
                    let Ok(core) = pw.controller().CoreWebView2().and_then(|c| c.cast::<ICoreWebView2_3>()) else { return };
                    let handler = TrySuspendCompletedHandler::create(Box::new(|result, done| {
                        if result.is_ok() && done {
                            SUSPENDED.store(true, Ordering::Relaxed);
                        }
                        Ok(())
                    }));
                    let _ = core.TrySuspend(&handler);
                });
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_launch_hold_ends_once_the_music_moves() {
        assert!(!has_moved(None, true, 5000), "first report");
        assert!(!has_moved(Some(0), true, 0), "stuck at 0:00");
        assert!(!has_moved(Some(0), false, 5000), "paused");
        assert!(has_moved(Some(60_000), true, 62_000));
        assert!(!has_moved(Some(208_000), true, 0), "next song starting");
    }

    #[test]
    fn sleeps_only_hidden_silent_and_long_enough() {
        for rule in [&FULL_SLEEP, &LITE_SLEEP] {
            let long = Some(rule.hidden + Duration::from_secs(1));
            let silent = Some(rule.quiet);
            assert!(should_sleep(rule, long, silent, false));
            assert!(!should_sleep(rule, long, None, false), "music playing");
            assert!(!should_sleep(rule, long, silent, true), "already asleep");
            assert!(!should_sleep(rule, None, silent, false), "on screen");
            assert!(!should_sleep(rule, Some(Duration::from_secs(30)), silent, false), "just hidden");
        }
        // The full app: five minutes hidden, silent at the moment it looks.
        assert!(!should_sleep(&FULL_SLEEP, Some(Duration::from_secs(299)), Some(Duration::MAX), false));
        assert!(should_sleep(&FULL_SLEEP, Some(Duration::from_secs(300)), Some(Duration::ZERO), false));
    }

    /// Three songs from the tray, hidden for long: "not playing" between two of them never suspends Lite's page.
    #[test]
    fn lite_never_sleeps_between_two_songs() {
        let hidden = Some(Duration::from_secs(600));
        for gap in [0, 1, 5, 20, 59] {
            assert!(!should_sleep(&LITE_SLEEP, hidden, Some(Duration::from_secs(gap)), false), "{gap} s between two songs");
        }
        assert!(should_sleep(&LITE_SLEEP, hidden, Some(Duration::from_secs(60)), false), "paused for a minute");
        assert!(should_sleep(&LITE_SLEEP, hidden, Some(Duration::MAX), false), "opened in the tray, never played");
    }

    #[test]
    fn music_stopped_counts_from_its_last_moment() {
        // The one test of the shared state.
        set_playing(false);
        assert_eq!(quiet_for(), Some(Duration::MAX), "nothing played yet");
        set_playing(true);
        assert_eq!(quiet_for(), None);
        set_playing(false);
        let first = quiet_for().expect("silent");
        set_playing(false);
        assert!(first < Duration::from_secs(5) && quiet_for().is_some_and(|again| again >= first), "a silent report restarts nothing");
    }

    #[test]
    fn only_lite_lets_its_hidden_page_take_a_background_priority() {
        let (full, lite) = (edition_args(false), edition_args(true));
        assert!(full.contains("--disable-renderer-backgrounding") && !lite.contains("--disable-renderer-backgrounding"));
        // The rest stays: timers at full speed, so a song's end is acted on at once.
        for kept in ["--disable-features=", "--disable-background-timer-throttling", "IntensiveWakeUpThrottling", "--disable-backgrounding-occluded-windows"] {
            assert!(full.contains(kept) && lite.contains(kept), "{kept}");
        }
        assert_eq!(full.replace(LITE_DROPS, ""), lite);
    }
}
