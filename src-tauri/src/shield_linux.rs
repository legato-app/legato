//! The shield on Linux (WebKitGTK), the twin of `shield.rs`. WebKit asks no one before a request: the rules are compiled
//! into one of its content filters, and each resource it loads is noted (Settings › Privacy). What the filter stops is
//! never loaded, so it is neither noted nor counted.

use music_core::netlog::{self, Via};
use music_shield::Shield;
use std::ffi::{CStr, CString};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use webkit2gtk::glib::translate::{ToGlibPtr, from_glib_full};
use webkit2gtk::{URIRequestExt, UserContentManager, WebResourceExt, WebViewExt, ffi, gio, glib};

/// The filter's name in WebKit's store: compiled again under it each time the rules are given.
const FILTER_NAME: &CStr = c"legato-shield";

/// The views `install` covers, by label.
static SHIELDED: Mutex<Vec<String>> = Mutex::new(Vec::new());
/// None until the lists are converted.
static RULES: Mutex<Option<Rules>> = Mutex::new(None);

/// The lists as WebKit's store compiles them, and the folder it keeps the result in.
#[derive(Clone)]
struct Rules {
    json: glib::Bytes,
    store: CString,
}

/// What a compilation under way is for.
struct Waiting {
    manager: UserContentManager,
    shield: Arc<Shield>,
}

pub fn install(webview: &tauri::Webview, shield: Arc<Shield>) -> tauri::Result<()> {
    watch(webview)?;
    let mut shielded = SHIELDED.lock().unwrap();
    if !shielded.iter().any(|label| label == webview.label()) {
        shielded.push(webview.label().to_string());
    }
    drop(shielded);
    give_filter(webview, shield)
}

/// A sign-in or Connect window: its requests noted (Settings › Privacy), none blocked (their pages stay as they are).
pub fn watch(webview: &tauri::Webview) -> tauri::Result<()> {
    webview.with_webview(|platform| {
        platform.inner().connect_resource_load_started(|_, resource, request| {
            note(request.uri());
            // A redirect changes the resource's address.
            resource.connect_uri_notify(|resource| note(resource.uri()));
        });
    })
}

fn note(address: Option<glib::GString>) {
    if let Some(address) = address {
        netlog::note_url(&address, Via::Window, false);
    }
}

/// The first lists, or fresh ones: converted for WebKit (a moment's work: not on the main thread), then given to the
/// shielded views. `lists_dir`: where the downloaded lists are.
pub fn rules_changed(app: &AppHandle, shield: &Arc<Shield>, lists_dir: &Path, lists: &str) {
    let store = lists_dir.join("webkit");
    let rules = music_shield::content_blocker(lists).and_then(|json| Ok(Rules { json: glib::Bytes::from_owned(json.into_bytes()), store: CString::new(store.to_string_lossy().as_ref())? }));
    match rules {
        Ok(rules) => {
            *RULES.lock().unwrap() = Some(rules);
            refresh(app, shield);
        }
        Err(error) => crate::diag::warn("shield", "rules not converted for WebKit", &format!("{error:#}")),
    }
}

/// The switch moved, or the rules did: every shielded view follows.
pub fn refresh(app: &AppHandle, shield: &Arc<Shield>) {
    let labels = SHIELDED.lock().unwrap().clone();
    for webview in labels.iter().filter_map(|label| app.get_webview(label)) {
        if let Err(error) = give_filter(&webview, shield.clone()) {
            crate::diag::warn("shield", "a view not given the rules", &error.to_string());
        }
    }
}

/// The view's filter as the switch says: the rules, or none.
fn give_filter(webview: &tauri::Webview, shield: Arc<Shield>) -> tauri::Result<()> {
    webview.with_webview(move |platform| {
        let Some(manager) = platform.inner().user_content_manager() else { return };
        if !shield.enabled.load(Ordering::Relaxed) {
            // SAFETY: a live manager, on the main thread (`with_webview`).
            unsafe { ffi::webkit_user_content_manager_remove_all_filters(manager.to_glib_none().0) };
            return;
        }
        let rules = RULES.lock().unwrap().clone();
        if let Some(rules) = rules {
            compile(rules, Waiting { manager, shield });
        }
    })
}

/// WebKit compiles on its own thread and answers on the main one (`compiled`). The bindings leave its filters out:
/// called by hand.
fn compile(rules: Rules, waiting: Waiting) {
    // SAFETY: the strings and bytes outlive the call (WebKit copies what it keeps); the pending save holds its own
    // reference to the store; `compiled` is called once and takes the box back.
    unsafe {
        let store = ffi::webkit_user_content_filter_store_new(rules.store.as_ptr());
        let waiting = Box::into_raw(Box::new(waiting));
        ffi::webkit_user_content_filter_store_save(store, FILTER_NAME.as_ptr(), rules.json.to_glib_none().0, std::ptr::null_mut(), Some(compiled), waiting.cast());
        glib::gobject_ffi::g_object_unref(store.cast());
    }
}

unsafe extern "C" fn compiled(store: *mut glib::gobject_ffi::GObject, result: *mut gio::ffi::GAsyncResult, data: glib::ffi::gpointer) {
    // SAFETY: `data` is the box `compile` gave this one call.
    let waiting = unsafe { Box::from_raw(data.cast::<Waiting>()) };
    let mut error = std::ptr::null_mut();
    // SAFETY: the store and the result are this call's own.
    let filter = unsafe { ffi::webkit_user_content_filter_store_save_finish(store.cast(), result, &mut error) };
    if filter.is_null() {
        // SAFETY: no filter, so WebKit set the error, ours to free.
        let error: glib::Error = unsafe { from_glib_full(error) };
        crate::diag::warn("shield", "WebKit did not compile the rules", &error.to_string());
        return;
    }
    // SAFETY: a live manager and the new filter, which the manager references before ours is dropped.
    unsafe {
        // Switched off while WebKit worked: nothing to add.
        if waiting.shield.enabled.load(Ordering::Relaxed) {
            let manager = waiting.manager.to_glib_none().0;
            ffi::webkit_user_content_manager_remove_all_filters(manager);
            ffi::webkit_user_content_manager_add_filter(manager, filter);
        }
        ffi::webkit_user_content_filter_unref(filter);
    }
}
