// release.yml's `tauriScript` for tauri-action: the steps before it built and signed the installers, so the build the
// action asks for does nothing, and the action only publishes what is there.
console.log('Installers already built and signed: nothing to build.')
