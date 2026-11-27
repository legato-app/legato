import { expect, it } from 'vitest'
import { installers } from './latest'

const asset = (name: string) => ({ name, browser_download_url: `https://example.test/${name}` })

it('takes each edition’s own installer, whatever the order of the files', () => {
  const files = ['latest.json', 'Legato.Lite_1.2.5_x64-setup.exe.sig', 'Legato.Lite_1.2.5_x64-setup.exe', 'Legato_1.2.5_x64-setup.exe', 'Legato_1.2.5_x64_en-US.msi'].map(asset)
  expect(installers(files)).toEqual({ full: 'https://example.test/Legato_1.2.5_x64-setup.exe', lite: 'https://example.test/Legato.Lite_1.2.5_x64-setup.exe' })
})

it('has no Lite on a release without one, and never takes it for the full app', () => {
  expect(installers([asset('Legato_1.2.0_x64-setup.exe')]).lite).toBeUndefined()
  expect(installers([asset('Legato.Lite_1.2.5_x64-setup.exe')]).full).toBeUndefined()
})
