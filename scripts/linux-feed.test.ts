import { expect, it } from 'vitest'
import { withLinux } from './linux-feed.mjs'
import { withNotes } from './promote.mjs'

const windows = { signature: 'windows-signature', url: 'https://github.com/o/r/releases/download/v1.2.3/Legato_1.2.3_x64-setup.exe' }
const manifest = JSON.stringify({ version: '1.2.3', notes: 'n', platforms: { 'windows-x86_64': windows } })
const image = (file: string, signature = `${file} signed`) => ({ file, signature })
const images = [image('Legato_1.2.3_amd64.AppImage'), image('Legato_1.2.3_aarch64.AppImage'), image('Legato.Lite_1.2.3_amd64.AppImage'), image('Legato_1.2.2_amd64.AppImage')]
const add = (product: string, given = images) => withLinux(manifest, { version: '1.2.3', product, repository: 'o/r', images: given })

it('adds each edition’s AppImages of that version, Windows left as it is', () => {
  const { platforms } = JSON.parse(add('Legato')!)
  expect(Object.keys(platforms)).toEqual(['windows-x86_64', 'linux-x86_64', 'linux-aarch64'])
  expect(platforms['windows-x86_64']).toEqual(windows)
  expect(platforms['linux-aarch64']).toEqual({ signature: 'Legato_1.2.3_aarch64.AppImage signed', url: 'https://github.com/o/r/releases/download/v1.2.3/Legato_1.2.3_aarch64.AppImage' })
  const lite = JSON.parse(add('Legato.Lite')!).platforms
  expect(lite['linux-x86_64'].url).toContain('/Legato.Lite_1.2.3_amd64.AppImage')
  expect(Object.keys(lite)).toHaveLength(2)
})

it('stays a file a promotion accepts', () => {
  expect(() => withNotes(add('Legato')!, '1.2.3', 'new notes')).not.toThrow()
})

it('writes nothing without an AppImage, and nothing unsigned or of another version', () => {
  expect(add('Legato', [image('Legato_1.2.3_amd64.deb')])).toBeNull()
  expect(() => add('Legato', [image('Legato_1.2.3_amd64.AppImage', '')])).toThrow('no signature')
  expect(() => withLinux(manifest, { version: '1.2.4', product: 'Legato', repository: 'o/r', images })).toThrow('v1.2.3')
})
