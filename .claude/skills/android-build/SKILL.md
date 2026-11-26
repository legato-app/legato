---
name: android-build
description: How to build Legato's Android app (an emulator APK or a phone APK). Use when a change must be built or tried on Android.
---

# Android build

- Emulator (AVD `legato36`): `. C:\dev\android\env.ps1; pnpm tauri android build --debug --target x86_64 --apk`
- A phone: the same with `--target aarch64 --apk`. Signed when `src-tauri/gen/android/keystore.properties` exists
  (never in git).
- What differs on Android (identifier `app.legato.mobile`, `#[cfg(desktop)]`, `src-tauri/src/mobile/`): CLAUDE.md › Layout.
