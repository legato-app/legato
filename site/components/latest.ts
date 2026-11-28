'use client'

import { useEffect, useState } from 'react'
import { GITHUB } from './content'

const RELEASES = `${GITHUB}/releases/latest`
/** `lite`: Legato Lite's installer, null while the latest release has none. `linux`: empty while it has no Linux file. */
type Latest = { href: string; lite: string | null; version: string | null; linux: { full: LinuxDownload[]; lite: LinuxDownload[] } }
type Asset = { name: string; browser_download_url: string }
type Release = { tag_name: string; assets: Asset[] }

/** The Windows installers among a release's files: Legato's, and Legato Lite's when the release has it. */
export function installers(assets: Asset[]) {
  const setup = (prefix: string) => assets.find((a) => a.name.startsWith(prefix) && a.name.endsWith('-setup.exe'))?.browser_download_url
  return { full: setup('Legato_'), lite: setup('Legato.Lite_') }
}

export type LinuxDownload = { name: string; href: string }

/** What each Linux file's name ends with (Tauri's own names): an AppImage or a .deb, for one processor. */
const LINUX_FILES: [name: string, endings: string[]][] = [
  ['AppImage x86_64', ['_amd64.AppImage', '_x86_64.AppImage']],
  ['AppImage ARM64', ['_aarch64.AppImage', '_arm64.AppImage']],
  ['.deb x86_64', ['_amd64.deb']],
  ['.deb ARM64', ['_arm64.deb']],
]

/** One edition's Linux files among a release's (release.yml's `linux-attach` job): listed means there. */
export function linuxDownloads(assets: Asset[], product: 'Legato' | 'Legato.Lite'): LinuxDownload[] {
  return LINUX_FILES.flatMap(([name, endings]) => {
    const file = assets.find((asset) => asset.name.startsWith(`${product}_`) && endings.some((ending) => asset.name.endsWith(ending)))
    return file ? [{ name, href: file.browser_download_url }] : []
  })
}

const NO_LINUX = { full: [], lite: [] }

// One request per visit, shared by every download button.
let pending: Promise<Latest> | null = null
const latest = () =>
  (pending ??= fetch('https://api.github.com/repos/legato-app/legato/releases/latest')
    .then((r) => (r.ok ? (r.json() as Promise<Release>) : Promise.reject(new Error(String(r.status)))))
    .then((r) => {
      const { full, lite } = installers(r.assets)
      const linux = { full: linuxDownloads(r.assets, 'Legato'), lite: linuxDownloads(r.assets, 'Legato.Lite') }
      return { href: full ?? RELEASES, lite: lite ?? null, version: r.tag_name.replace(/^v/, ''), linux }
    })
    .catch(() => ({ href: RELEASES, lite: null, version: null, linux: NO_LINUX })))

/** The newest Beta's APK, under a name that never changes (release.yml's `apk` job): the link while GitHub's list hasn't
 *  answered, or refuses (60 asks an hour per address). Never the latest release's page: that is Stable's, whose APK is
 *  older than a phone's Beta, and Android refuses the downgrade. */
export const BETA_APK = `${GITHUB}/releases/download/beta/Legato_android-arm64.apk`

const VERSIONED_APK = /^Legato_([0-9.]+)_android-arm64\.apk$/

type Android = { href: string; version: string | null }

/** The Android download: the newest release's own APK (prereleases too: every Beta carries one, a Beta whose Android job
 *  failed has none and is passed over). Listed means there: never a 404 while `beta`'s copy is still on its way, or was
 *  never made. None in the list: `beta`'s copy, version unknown. */
export function androidDownload(releases: Release[]): Android {
  for (const release of releases) {
    for (const asset of release.assets) {
      const version = VERSIONED_APK.exec(asset.name)?.[1]
      if (version) return { href: asset.browser_download_url, version }
    }
  }
  return { href: BETA_APK, version: null }
}

let pendingApk: Promise<Android> | null = null
const apk = () =>
  (pendingApk ??= fetch('https://api.github.com/repos/legato-app/legato/releases?per_page=10')
    .then((r) => (r.ok ? (r.json() as Promise<Release[]>) : Promise.reject(new Error(String(r.status)))))
    .then(androidDownload)
    .catch(() => androidDownload([])))

/** The newest Android APK straight from GitHub, linked before GitHub's list answers and if it refuses. */
export function useAndroid(): Android {
  const [l, setL] = useState<Android>(() => androidDownload([]))
  useEffect(() => {
    let live = true
    void apk().then((x) => live && setL(x))
    return () => {
      live = false
    }
  }, [])
  return l
}

/** The latest installer straight from GitHub; its releases page until GitHub answers, or if it doesn't. */
export function useLatest(): Latest {
  const [l, setL] = useState<Latest>({ href: RELEASES, lite: null, version: null, linux: NO_LINUX })
  useEffect(() => {
    let live = true
    void latest().then((x) => live && setL(x))
    return () => {
      live = false
    }
  }, [])
  return l
}
