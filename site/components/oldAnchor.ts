/** The one-page docs' sections (until 2026-11-26), each now a page: /docs/#plugins and the like still arrive. */
const SECTIONS: Record<string, 'using' | 'developers'> = {
  install: 'using',
  'first-steps': 'using',
  import: 'using',
  sync: 'using',
  share: 'using',
  'stream-deck': 'using',
  shortcuts: 'using',
  architecture: 'developers',
  plugins: 'developers',
  themes: 'developers',
  build: 'developers',
  contribute: 'developers',
}

/** The page an old address's `#section` means now; null: not one of them. */
export function oldAnchor(hash: string): string | null {
  const section = hash.replace(/^#/, '')
  return Object.hasOwn(SECTIONS, section) ? `/docs/${SECTIONS[section]}/${section}/` : null
}
