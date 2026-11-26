// A plugin folder's file list, to sign: `node scripts/plugin-files.mjs <folder>` writes <folder>/legato.files, then
// `pnpm tauri signer sign` writes its signature (docs/plugins.md › Verified). Node only.
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

// What the app installs from a plugin folder (src-tauri/src/plugins.rs): anything else would be missing once installed.
const KINDS = ['.js', '.json', '.md', '.txt', '.png', '.css']
const SIGNING = ['legato.files', 'legato.files.sig']

const folder = process.argv[2]
if (!folder) {
  console.error('Usage: node scripts/plugin-files.mjs <plugin folder>')
  process.exit(1)
}
const names = readdirSync(folder).filter((name) => !SIGNING.includes(name)).sort()
const refused = names.filter((name) => !lstatSync(join(folder, name)).isFile() || !(name === 'legato.manifest' || KINDS.includes(extname(name).toLowerCase())))
if (refused.length) {
  console.error(`The app doesn't install these, take them out of the folder before signing: ${refused.join(', ')}`)
  process.exit(1)
}
const lines = names.map((name) => `${createHash('sha256').update(readFileSync(join(folder, name))).digest('hex')}  ${name}\n`)
writeFileSync(join(folder, 'legato.files'), lines.join(''))
console.log(`${join(folder, 'legato.files')}: ${names.length} files. Sign it: pnpm tauri signer sign -f <private key file> "${join(folder, 'legato.files')}"`)
