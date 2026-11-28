/** Passes after which text still changing is nobody's theme: refused whole. */
const CLEAN_PASSES = 10

/** An escape that spells a plain letter (`\75 ` is u, `\r` is r): written as the letter, so the rules below read the CSS as
 *  the browser does. Other escapes stay as they are. */
const plainLetters = (css: string) =>
  css.replace(/\\(?:([0-9a-fA-F]{1,6})(?:\r\n|[ \t\r\n\f])?|([g-zG-Z]))/g, (escape, code: string | undefined, letter: string | undefined) => {
    const read = letter ?? String.fromCodePoint(Math.min(parseInt(code!, 16), 0x10ffff))
    return /^[a-zA-Z]$/.test(read) ? read : escape
  })

/** `image-set()` takes a bare address too: one naming anything but a data: picture goes, like url(). */
const IMAGE_SET = /(?:-webkit-)?image-set\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/gi
const ADDRESS_IN_QUOTES = /["']\s*(?:[a-z][a-z0-9+.-]*:(?!image\/)|\/\/)/i

const cleanOnce = (css: string) =>
  plainLetters(css)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!data:image\/)[^)]*\)/gi, 'none')
    .replace(IMAGE_SET, (set) => (ADDRESS_IN_QUOTES.test(set) ? 'none' : set))
    .replace(/expression\s*\(|-moz-binding|behavior\s*:/gi, '')
    // One character, escaped as CSS reads it: no removal that could join its neighbors into the tag again.
    .replace(/<(?=\/?style)/gi, '\\3C ')

/**
 * CSS from outside the app (plugins, themes): comments, @import, links (url(), except data: images, and the app's
 * own image scheme when allowed) and old script hooks taken out, a `<` that would open or close a <style> escaped. Again
 * until nothing changes: a removal can join the pieces around it into a banned one. Set as text, never parsed as HTML. Pure.
 */
export function cleanCss(raw: unknown, max = 100_000): string {
  let css = typeof raw === 'string' ? raw.slice(0, max) : ''
  for (let pass = 0; pass < CLEAN_PASSES; pass++) {
    const cleaned = cleanOnce(css)
    if (cleaned === css) return css
    css = cleaned
  }
  return ''
}

/**
 * Legato's name, logo and legal notices (marked `data-brand`) stay as they are, whatever a theme's or a plugin's
 * CSS says. Goes after their styles.
 */
export const BRAND_GUARD = `:root [data-brand][data-brand][data-brand], :root [data-brand][data-brand][data-brand] * { visibility: visible !important; opacity: 1 !important; filter: none !important; clip-path: none !important; transform: none !important; mask: none !important; }
:root [data-brand][data-brand][data-brand] { display: revert-layer !important; }
:root [data-brand][data-brand][data-brand]::before, :root [data-brand][data-brand][data-brand]::after, :root [data-brand][data-brand][data-brand] *::before, :root [data-brand][data-brand][data-brand] *::after { content: none !important; }
:root [data-brand-name][data-brand-name][data-brand-name] { font-size: 15px !important; letter-spacing: normal !important; color: var(--ink) !important; }`
