'use client'

import { useEffect, useState } from 'react'
import { GITHUB } from './content'

const RELEASES = `${GITHUB}/releases/latest`
/** `lite`: Legato Lite's installer, null while the latest release has none. */
type Latest = { href: string; lite: string | null; version: string | null }
type Asset = { name: string; browser_download_url: string }
type Release = { tag_name: string; assets: Asset[] }

/** The Windows installers among a release's files: Legato's, and Legato Lite's when the release has it. */
export function installers(assets: Asset[]) {
  const setup = (prefix: string) => assets.find((a) => a.name.startsWith(prefix) && a.name.endsWith('-setup.exe'))?.browser_download_url
  return { full: setup('Legato_'), lite: setup('Legato.Lite_') }
}

// One request per visit, shared by every download button.
let pending: Promise<Latest> | null = null
const latest = () =>
  (pending ??= fetch('https://api.github.com/repos/legato-app/legato/releases/latest')
    .then((r) => (r.ok ? (r.json() as Promise<Release>) : Promise.reject(new Error(String(r.status)))))
    .then((r) => {
      const { full, lite } = installers(r.assets)
      return { href: full ?? RELEASES, lite: lite ?? null, version: r.tag_name.replace(/^v/, '') }
    })
    .catch(() => ({ href: RELEASES, lite: null, version: null })))

/** The newest Beta's APK, under a name that never changes (release.yml's `apk` job). Never the latest release's page: that
 *  is Stable's, whose APK is older than a phone's Beta, and Android refuses the downgrade. */
export const BETA_APK = `${GITHUB}/releases/download/beta/Legato_android-arm64.apk`

type Android = { href: string; version: string | null }

/** The Android download: always that file. GitHub's list of releases only says its version: the newest release carrying a
 *  versioned APK (none known: no version). */
export function androidDownload(releases: Release[]): Android {
  const versioned = releases.find((release) => release.assets.some((asset) => /^Legato_[0-9.]+_android-arm64\.apk$/.test(asset.name)))
  return { href: BETA_APK, version: versioned?.tag_name.replace(/^v/, '') ?? null }
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
  const [l, setL] = useState<Latest>({ href: RELEASES, lite: null, version: null })
  useEffect(() => {
    let live = true
    void latest().then((x) => live && setL(x))
    return () => {
      live = false
    }
  }, [])
  return l
}
