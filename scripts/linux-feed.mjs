// Adds a release's Linux AppImages to one of its updater files (latest.json, latest-lite.json), each entry shaped like
// the Windows one there (scripts/promote.mjs `withNotes` reads every platform). CI: release.yml `linux-attach`.
// Usage: VERSION=1.2.3 GITHUB_REPOSITORY=owner/name node scripts/linux-feed.mjs <updater file> <folder> <product>
// The folder holds the AppImages and their .sig; product = the files' first word (Legato, Legato.Lite).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The architecture in an AppImage's name → the updater's. */
const ARCHITECTURES = { amd64: 'x86_64', x86_64: 'x86_64', aarch64: 'aarch64', arm64: 'aarch64' }

const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * `text` with a `linux-…` entry for each of `images` (`{ file, signature }`) that is `product`'s AppImage of `version`.
 * Null when none is.
 */
export function withLinux(text, { version, product, repository, images }) {
  const manifest = JSON.parse(text)
  if (String(manifest.version).replace(/^v/, '') !== version) throw new Error(`The updater file is v${manifest.version}'s, not v${version}'s`)
  const appImage = new RegExp(`^${literally(product)}_${literally(version)}_(${Object.keys(ARCHITECTURES).join('|')})\\.AppImage$`)
  let added = 0
  for (const { file, signature } of images) {
    const architecture = appImage.exec(file)?.[1]
    if (!architecture) continue
    if (!signature) throw new Error(`${file} has no signature`)
    manifest.platforms[`linux-${ARCHITECTURES[architecture]}`] = { signature, url: `https://github.com/${repository}/releases/download/v${version}/${file}` }
    added += 1
  }
  return added ? JSON.stringify(manifest, null, 2) : null
}

function main([updaterFile, folder, product]) {
  const { VERSION, GITHUB_REPOSITORY } = process.env
  if (!updaterFile || !folder || !product || !VERSION || !GITHUB_REPOSITORY) throw new Error('Usage: see the head of scripts/linux-feed.mjs')
  const signatureOf = (file) => (existsSync(join(folder, `${file}.sig`)) ? readFileSync(join(folder, `${file}.sig`), 'utf8').trim() : '')
  const images = readdirSync(folder)
    .filter((file) => file.endsWith('.AppImage'))
    .map((file) => ({ file, signature: signatureOf(file) }))
  const text = withLinux(readFileSync(updaterFile, 'utf8'), { version: VERSION, product, repository: GITHUB_REPOSITORY, images })
  if (text) writeFileSync(updaterFile, text)
  console.log(text ? `${updaterFile}: Linux added` : `${updaterFile}: no AppImage of ${product} v${VERSION}, left as is`)
}

// Run as a script, not when a test imports the function.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
