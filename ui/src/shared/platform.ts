import type { Cut } from './liteCuts'

/** Phone build (Android's or iOS's WebView): texts that speak of a PC say phone there. The phone layout is `usePhone`. */
export const phoneApp = typeof navigator !== 'undefined' && /Android|iPhone|iPad/.test(navigator.userAgent)

// Set at build time by Vite's define (`vite.config.ts`, from the Tauri CLI's TAURI_ENV_PLATFORM): tests and the site's
// demo have no define. Not the user agent: GNOME Web (WebKitGTK) would hide the demo's features, a custom one the app's.
declare const __LINUX__: boolean | undefined

/** Legato on Linux: the interface built by the Tauri CLI there. */
export const linuxApp: boolean = typeof __LINUX__ !== 'undefined' && __LINUX__

/**
 * What Linux lacks for now (plan-v2 "Linux for both versions"): parts of the shell written for Windows only, hidden rather
 * than left dead (`liteCuts.ts` reads this table like Lite's). An entry leaves when its Linux twin lands.
 */
export const MISSING_ON_LINUX = {
  // The ad blocker, the list of what app windows reach and YouTube's sound processing are hooks into WebView2 (shield.rs).
  adBlocking: { sections: ['shield'], settings: ['Block ads and trackers', 'App windows'] },
  youtubeSound: { settings: ["Process YouTube's sound"] },
  // Windows' speech recognition and its settings pages.
  voiceSearch: { settings: ['Voice search'], shortcuts: ['voice'] },
  windowsSettings: {},
  // Settings › Library and storage: the size of Windows' browser engine's folder.
  webViewStorage: {},
  systemAccent: {},
  // Windows' device callbacks (unplug.rs) and its loopback capture.
  deviceEvents: { settings: ['Pause during calls', 'Pause when headphones disconnect'] },
  listenToThisPc: {},
  // Pages in a window read through WebView2's message channel: Spotify's, Exportify's and Apple Music's.
  playerPageImports: { settings: ['Connect Spotify'] },
  // YouTube's watch page for the videos that refuse the embed (ytwatch.rs).
  watchPage: {},
} satisfies Record<string, Cut>
