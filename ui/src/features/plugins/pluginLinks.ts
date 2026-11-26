/** A plugin's links, from its manifest (https, checked in Rust). A star only makes sense for code on GitHub. */
export function pluginLinks(manifest: { homepage?: string | null; repository?: string | null }) {
  const website = manifest.homepage ?? undefined
  const source = manifest.repository ?? undefined
  const onGithub = !!source && URL.canParse(source) && new URL(source).hostname === 'github.com'
  return { star: onGithub ? source : undefined, website, source }
}
