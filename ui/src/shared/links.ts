/** Legato on the web: opened in the browser (Tauri's opener), never fetched by the app. */
export const REPO = 'https://github.com/legato-app/legato'
/** Questions, ideas and themes (GitHub Discussions, on since 2026-11-07). */
export const DISCUSSIONS = `${REPO}/discussions`
/** A version's release, its downloads on it. */
export const releasePage = (version: string) => `${REPO}/releases/tag/v${version}`

/** Exportify (not ours), Spotify's lists into a file: the phone opens it in the browser, a PC in its own window. */
export const EXPORTIFY = 'https://exportify.app/'

/** The website's "What leaves your PC" table (site/components/content.tsx, PRIVACY). */
export const PRIVACY_PAGE = 'https://legato-app.github.io/legato/#privacy'
