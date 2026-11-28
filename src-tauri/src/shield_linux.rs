//! The shield on Linux (WebKitGTK), the twin of `shield.rs`. WebKit asks no one before a request: the lists are compiled
//! into one of its content filters, once for each text they convert to (kept on disk for the next launches), and every view
//! the shield covers gets that one. Each request WebKit sends is noted (Settings › Privacy); what the filter stops is
//! never sent, so it is neither noted nor counted.

use music_core::netlog::{self, Via};
use music_shield::Shield;
use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use webkit2gtk::glib::object::ObjectExt;
use webkit2gtk::glib::translate::{ToGlibPtr, from_glib_full};
use webkit2gtk::{URIRequest, URIRequestExt, WebViewExt, ffi, gio, glib};

/// The filter's name in its version's store.
const FILTER_NAME: &CStr = c"legato-shield";

/// The views `install` covers, by label.
static SHIELDED: Mutex<Vec<String>> = Mutex::new(Vec::new());
/// The key of the rules converted last: others ready after it are dropped.
static WANTED: AtomicU64 = AtomicU64::new(0);

thread_local! {
    /// The compiled rules every shielded view gets, none until the first are ready. WebKit's: the main thread's only.
    static FILTER: RefCell<Option<Filter>> = const { RefCell::new(None) };
}

/// A compiled filter, one reference of ours.
struct Filter(*mut ffi::WebKitUserContentFilter);

impl Drop for Filter {
    fn drop(&mut self) {
        // SAFETY: the reference taken from WebKit; a view's manager holds its own.
        unsafe { ffi::webkit_user_content_filter_unref(self.0) }
    }
}

/// Rules on their way into WebKit.
struct Pending {
    app: AppHandle,
    shield: Arc<Shield>,
    json: glib::Bytes,
    key: u64,
    /// These rules' own folder: their compiled copy.
    folder: PathBuf,
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
        platform.inner().connect_resource_load_started(|_, resource, _| {
            // When the request leaves, redirects too: one the filter stops never does. By name: the bindings' own
            // signal takes the redirecting answer for always there.
            resource.connect_local("sent-request", false, |values| {
                if let Some(address) = values.get(1).and_then(|request| request.get::<URIRequest>().ok()).and_then(|request| request.uri()) {
                    netlog::note_url(&address, Via::Window, false);
                }
                None
            });
        });
    })
}

/// The first lists, or fresh ones: converted for WebKit (a moment's work: not on the main thread), then loaded or
/// compiled and given to the shielded views. `lists_dir`: where the downloaded lists are.
pub fn rules_changed(app: &AppHandle, shield: &Arc<Shield>, lists_dir: &Path, lists: &str) {
    let json = match music_shield::content_blocker(lists) {
        Ok(json) => json,
        // The rules asked for before stay wanted.
        Err(error) => return crate::diag::warn("shield", "rules not converted for WebKit", &format!("{error:#}")),
    };
    let key = music_shield::content_blocker_key(&json);
    WANTED.store(key, Ordering::Relaxed);
    let folder = lists_dir.join("webkit").join(format!("{key:016x}"));
    let pending = Pending { app: app.clone(), shield: shield.clone(), json: glib::Bytes::from_owned(json.into_bytes()), key, folder };
    if let Err(error) = app.run_on_main_thread(move || load(pending)) {
        crate::diag::warn("shield", "rules not given to WebKit", &error.to_string());
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

/// The view's filter as the switch says: the compiled rules, or none.
fn give_filter(webview: &tauri::Webview, shield: Arc<Shield>) -> tauri::Result<()> {
    webview.with_webview(move |platform| {
        let Some(manager) = platform.inner().user_content_manager() else { return };
        // SAFETY: a live manager and filter, on the main thread (`with_webview`).
        unsafe {
            ffi::webkit_user_content_manager_remove_all_filters(manager.to_glib_none().0);
            if shield.enabled.load(Ordering::Relaxed) {
                FILTER.with_borrow(|filter| {
                    if let Some(filter) = filter {
                        ffi::webkit_user_content_manager_add_filter(manager.to_glib_none().0, filter.0);
                    }
                });
            }
        }
    })
}

/// WebKit's store in `folder`, one reference of ours. The bindings leave the content filters out: called by hand, here
/// and below. None for a path with a zero byte, which no file system gives.
fn open_store(folder: &Path) -> Option<*mut ffi::WebKitUserContentFilterStore> {
    let path = CString::new(folder.to_string_lossy().as_ref()).ok()?;
    // SAFETY: WebKit copies the path.
    Some(unsafe { ffi::webkit_user_content_filter_store_new(path.as_ptr()) })
}

/// The copy compiled at an earlier launch; none yet: `compile`.
fn load(pending: Pending) {
    let Some(store) = open_store(&pending.folder) else { return };
    let pending = Box::into_raw(Box::new(pending));
    // SAFETY: the pending load holds its own reference to the store; `loaded` is called once and takes the box back.
    unsafe {
        ffi::webkit_user_content_filter_store_load(store, FILTER_NAME.as_ptr(), std::ptr::null_mut(), Some(loaded), pending.cast());
        glib::gobject_ffi::g_object_unref(store.cast());
    }
}

unsafe extern "C" fn loaded(store: *mut glib::gobject_ffi::GObject, result: *mut gio::ffi::GAsyncResult, data: glib::ffi::gpointer) {
    // SAFETY: `data` is the box `load` gave this one call.
    let pending = *unsafe { Box::from_raw(data.cast::<Pending>()) };
    let mut error = std::ptr::null_mut();
    // SAFETY: the store and the result are this call's own.
    let filter = unsafe { ffi::webkit_user_content_filter_store_load_finish(store.cast(), result, &mut error) };
    if filter.is_null() {
        // SAFETY: no filter, so WebKit set the error, ours to free. Not compiled yet, most often.
        drop::<glib::Error>(unsafe { from_glib_full(error) });
        compile(pending);
    } else {
        ready(pending, Filter(filter));
    }
}

/// WebKit compiles on a thread of its own and answers on the main one (`compiled`).
fn compile(pending: Pending) {
    let Some(store) = open_store(&pending.folder) else { return };
    let json = pending.json.clone();
    let pending = Box::into_raw(Box::new(pending));
    // SAFETY: the bytes outlive the call (WebKit copies what it keeps); the pending save holds its own reference to the
    // store; `compiled` is called once and takes the box back.
    unsafe {
        ffi::webkit_user_content_filter_store_save(store, FILTER_NAME.as_ptr(), json.to_glib_none().0, std::ptr::null_mut(), Some(compiled), pending.cast());
        glib::gobject_ffi::g_object_unref(store.cast());
    }
}

unsafe extern "C" fn compiled(store: *mut glib::gobject_ffi::GObject, result: *mut gio::ffi::GAsyncResult, data: glib::ffi::gpointer) {
    // SAFETY: `data` is the box `compile` gave this one call.
    let pending = *unsafe { Box::from_raw(data.cast::<Pending>()) };
    let mut error = std::ptr::null_mut();
    // SAFETY: the store and the result are this call's own.
    let filter = unsafe { ffi::webkit_user_content_filter_store_save_finish(store.cast(), result, &mut error) };
    if filter.is_null() {
        // SAFETY: no filter, so WebKit set the error, ours to free.
        let error: glib::Error = unsafe { from_glib_full(error) };
        crate::diag::warn("shield", "WebKit did not compile the rules", &error.to_string());
    } else {
        ready(pending, Filter(filter));
    }
}

/// Kept for the views to come, given to those there, unless newer rules were asked for meanwhile.
fn ready(pending: Pending, filter: Filter) {
    if WANTED.load(Ordering::Relaxed) != pending.key {
        return;
    }
    FILTER.set(Some(filter));
    forget_older(&pending.folder);
    refresh(&pending.app, &pending.shield);
}

/// Other rules' compiled copies, beside the one kept: removed (best effort).
fn forget_older(kept: &Path) {
    let Some(Ok(copies)) = kept.parent().map(std::fs::read_dir) else { return };
    for copy in copies.flatten().filter(|copy| copy.path() != kept) {
        let _ = std::fs::remove_dir_all(copy.path());
    }
}
