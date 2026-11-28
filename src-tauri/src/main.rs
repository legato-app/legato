// No console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // First of all: it sets an environment variable, safe only while this is the one thread.
    #[cfg(target_os = "linux")]
    legato_lib::label_audio();
    legato_lib::run()
}
