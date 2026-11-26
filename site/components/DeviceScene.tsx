'use client'

import { useEffect, useState } from 'react'
import { useCopy } from './copy'
import { deviceOf, type Device } from './device'
import { rootOf } from './langs'

type BatteryNavigator = Navigator & { getBattery?: () => Promise<{ charging: boolean; level: number }> }

/**
 * The hero's 3D scene: the camera moves from the three devices to the visitor's own and stays there. Pre-rendered by
 * scripts/landing/render.mjs (docs/landing.md), on the page's colour; reduced motion shows the last frame only.
 */
export function DeviceScene() {
  const root = rootOf(useCopy().lang)
  const [device, setDevice] = useState<Device | null>(null)
  const [dark, setDark] = useState(false)
  const [still, setStill] = useState(false)
  useEffect(() => {
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => setDark(scheme.matches)
    follow()
    setStill(matchMedia('(prefers-reduced-motion: reduce)').matches)
    scheme.addEventListener('change', follow)
    const browser = navigator as BatteryNavigator
    let live = true
    void (browser.getBattery?.() ?? Promise.resolve(undefined))
      .catch(() => undefined)
      .then((battery) => live && setDevice(deviceOf({ userAgent: browser.userAgent, battery: battery && { charging: battery.charging, level: battery.level } })))
    return () => {
      live = false
      scheme.removeEventListener('change', follow)
    }
  }, [])
  const name = device && `${root}landing/${device}-${dark ? 'dark' : 'light'}`
  return (
    <div aria-hidden className="aspect-[16/10] w-full max-w-[640px] [@media(max-height:760px)]:hidden">
      {name &&
        (still ? (
          <img src={`${name}.webp`} alt="" width={1280} height={800} className="size-full" />
        ) : (
          <video key={name} autoPlay muted playsInline preload="auto" poster={`${name}.webp`} width={1280} height={800} className="size-full">
            <source src={`${name}.webm`} type="video/webm" />
            <source src={`${name}.mp4`} type="video/mp4" />
          </video>
        ))}
    </div>
  )
}
