// Which edition this build is: Legato or Legato Lite (plan-v2 "A Lite build"). Set at build time by Vite's define
// (`vite.config.ts`, `--mode lite`); tests and the site's demo have no define: the full app.
declare const __LITE__: boolean | undefined

/** Legato Lite: the essentials, lighter. Read here only; what it cuts reads this. */
export const LITE: boolean = typeof __LITE__ !== 'undefined' && __LITE__
