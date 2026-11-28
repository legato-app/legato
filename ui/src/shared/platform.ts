import type { Cut } from './liteCuts'

/** Phone build (Android's or iOS's WebView): texts that speak of a PC say phone there. The phone layout is `usePhone`. */
export const phoneApp = typeof navigator !== 'undefined' && /Android|iPhone|iPad/.test(navigator.userAgent)

/** Legato on Linux: WebKitGTK's user agent. Android's says Linux too; a browser (the website's demo) says Chrome or Firefox. */
export const linuxApp = typeof navigator !== 'undefined' && /Linux/.test(navigator.userAgent) && !/Android|Chrome|Firefox/.test(navigator.userAgent)

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
  systemAccent: {},
  // Windows' device callbacks (unplug.rs), its media sessions (session.rs) and its loopback capture.
  deviceEvents: { settings: ['Pause during calls', 'Pause when headphones disconnect'] },
  mediaSessionLookup: { settings: ['Ask this PC’s media players first'] },
  listenToThisPc: {},
  // Pages in a window read through WebView2's message channel: Spotify's, Exportify's and Apple Music's.
  playerPageImports: { settings: ['Connect Spotify'] },
  // YouTube's watch page for the videos that refuse the embed (ytwatch.rs).
  watchPage: {},
} satisfies Record<string, Cut>
