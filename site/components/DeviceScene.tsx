'use client'

import type { MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useCopy } from './copy'
import { deviceOf, type Device } from './device'
import { rootOf } from './langs'
import { sceneProgress } from './scene'

type BatteryNavigator = Navigator & { getBattery?: () => Promise<{ charging: boolean; level: number }> }

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * The hero's 3D scene: the camera moves from the three devices to the visitor's own and stays there. Pre-rendered by
 * scripts/landing/render.mjs (docs/landing.md), on the page's colour; reduced motion shows the last frame only.
 * `scroll` (the phone's story, in stages): the scroll drives it. The scene rises to the middle of the screen as its move
 * plays, then fades into the phone with the live demo (Story.tsx). Without it, it plays once.
 */
export function DeviceScene({ scroll }: { scroll?: MotionValue<number> }) {
  const root = rootOf(useCopy().lang)
  const box = useRef<HTMLDivElement>(null)
  const film = useRef<HTMLVideoElement>(null)
  // How far the scene is lifted now: its resting place is read back from where it stands.
  const lifted = useRef(0)
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

  const place = () => {
    const el = box.current
    if (!scroll || !el) return
    const progress = sceneProgress(scroll.get())
    const video = film.current
    // Every frame is a keyframe (render.mjs: -g 1), so a seek lands at once.
    if (video?.duration && Math.abs(video.currentTime - progress * video.duration) > 0.02) video.currentTime = progress * video.duration
    const rect = el.getBoundingClientRect()
    const resting = rect.top + rect.height / 2 - lifted.current
    lifted.current = -Math.max(0, resting - innerHeight * 0.5) * smooth(progress)
    el.style.transform = `translateY(${lifted.current}px) scale(${1 + 0.5 * smooth(progress)})`
    el.style.opacity = String(1 - clamp((progress - 0.75) / 0.25))
  }
  useEffect(() => {
    if (!scroll) return
    place()
    return scroll.on('change', place)
    // `place` reads only refs and the scroll itself.
  }, [scroll])

  return (
    // A PC's window: as tall as the room the hero's text leaves (about 730 px of it), none in a short one. A phone always
    // shows it (Android's is its own device).
    <div ref={box} aria-hidden className="aspect-[16/10] w-full max-w-[440px] will-change-transform max-[1000px]:mx-auto pinned:w-[min(440px,calc((100vh-730px)*1.6))] [@media(min-width:1000px)_and_(max-height:860px)]:hidden">
      {name &&
        (still ? (
          <img src={`${name}.webp`} alt="" width={1280} height={800} className="size-full" />
        ) : (
          <video key={name} ref={film} autoPlay={!scroll} muted playsInline preload="auto" poster={scroll ? undefined : `${name}.webp`} width={1280} height={800} onLoadedData={place} className="size-full">
            <source src={`${name}.webm`} type="video/webm" />
            <source src={`${name}.mp4`} type="video/mp4" />
          </video>
        ))}
    </div>
  )
}
