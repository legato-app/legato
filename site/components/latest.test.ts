import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { androidDownload, BETA_APK, installers } from './latest'

const asset = (name: string) => ({ name, browser_download_url: `https://example.test/${name}` })

it('takes each edition’s own installer, whatever the order of the files', () => {
  const files = ['latest.json', 'Legato.Lite_1.2.5_x64-setup.exe.sig', 'Legato.Lite_1.2.5_x64-setup.exe', 'Legato_1.2.5_x64-setup.exe', 'Legato_1.2.5_x64_en-US.msi'].map(asset)
  expect(installers(files)).toEqual({ full: 'https://example.test/Legato_1.2.5_x64-setup.exe', lite: 'https://example.test/Legato.Lite_1.2.5_x64-setup.exe' })
})

it('has no Lite on a release without one, and never takes it for the full app', () => {
  expect(installers([asset('Legato_1.2.0_x64-setup.exe')]).lite).toBeUndefined()
  expect(installers([asset('Legato.Lite_1.2.5_x64-setup.exe')]).full).toBeUndefined()
})

const release = (tag: string, ...files: string[]) => ({ tag_name: tag, assets: files.map(asset) })

it('links the Beta’s APK before GitHub answers, when it refuses, and never Stable’s page', () => {
  expect(androidDownload([])).toEqual({ href: BETA_APK, version: null })
  expect(BETA_APK.endsWith('/releases/download/beta/Legato_android-arm64.apk')).toBe(true)
})

it('takes only the version from GitHub’s list: the newest release with a versioned APK, not the rolling `beta`', () => {
  const list = [release('beta', 'latest.json', 'Legato_android-arm64.apk'), release('v1.2.456', 'Legato_1.2.456_x64-setup.exe'), release('v1.2.455', 'Legato_1.2.455_android-arm64.apk')]
  expect(androidDownload(list)).toEqual({ href: BETA_APK, version: '1.2.455' })
})

it('is the file the release workflow uploads to `beta`', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8')
  expect(workflow).toContain(`gh release upload beta fixed/${BETA_APK.split('/').pop()} --clobber`)
})
