'use client'

import { useMotionValueEvent, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useCopy } from './copy'
import { deviceOf, type Device } from './device'
import { rootOf } from './langs'
import type { Point } from './homography'
import SCREENS from './screens.json'

type BatteryNavigator = Navigator & { getBattery?: () => Promise<{ charging: boolean; level: number }> }

/** Each move's frame (scripts/landing/render.mjs): the phone's stands up. */
export const FRAME: Record<Device, { w: number; h: number }> = { phone: { w: 900, h: 1600 }, monitor: { w: 1600, h: 900 }, laptop: { w: 1600, h: 900 } }

/** The film's frame showing at `move` (0-1): the one the scroll seeks (DeviceMove) and the screen's corners follow. */
export const frameOf = (device: Device, move: number) => Math.min(SCREENS[device].length - 1, Math.floor(move * SCREENS[device].length))

/**
 * The visitor's screen in a frame of the move, in px of a `w`×`h` stage the film covers (object-fit: cover): its
 * corners, top left first, clockwise. The live interface is laid on them all the way in (Story.tsx).
 */
export function cornersAt(device: Device, frame: number, w: number, h: number): Point[] {
  const size = FRAME[device]
  const k = Math.max(w / size.w, h / size.h)
  const [left, top] = [(w - size.w * k) / 2, (h - size.h * k) / 2]
  const at = SCREENS[device][frame]
  return [0, 2, 4, 6].map((n) => [left + at[n] * size.w * k, top + at[n + 1] * size.h * k])
}

/** Where the screen lands as the move ends: its centre and size, square on. */
export function screenOn(device: Device, w: number, h: number) {
  const [[left, top], , [right, bottom]] = cornersAt(device, SCREENS[device].length - 1, w, h)
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top }
}

/** The device the visitor holds (device.ts) and the page's theme. Null until the browser has told. */
export function useVisitor() {
  const [device, setDevice] = useState<Device | null>(null)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => setDark(scheme.matches)
    follow()
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
  return { device, dark }
}

/** The wide view the move starts from: all that reduced motion shows (in the hero's flow). */
export function DeviceStill() {
  const root = rootOf(useCopy().lang)
  const { dark } = useVisitor()
  return <img src={`${root}landing/monitor-${dark ? 'dark' : 'light'}.webp`} alt="" width={1600} height={900} className="h-auto w-full max-w-[1100px]" />
}

/**
 * The hero's 3D scene over the whole stage: the camera goes from the three devices into `device`'s screen as `move`
 * goes 0 → 1 (scripts/landing/render.mjs, docs/landing.md). Its poster is the first frame; the film itself loads once
 * the page has (or at the first scroll), so it never holds the first paint.
 */
export function DeviceMove({ device, dark, move, opacity }: { device: Device; dark: boolean; move: MotionValue<number>; opacity: MotionValue<number> }) {
  const name = `${rootOf(useCopy().lang)}landing/${device}-${dark ? 'dark' : 'light'}`
  const film = useRef<HTMLVideoElement>(null)
  const [wanted, setWanted] = useState(false)
  useEffect(() => {
    const want = () => setWanted(true)
    if (document.readyState === 'complete') want()
    addEventListener('load', want, { once: true })
    addEventListener('scroll', want, { once: true, passive: true })
    return () => {
      removeEventListener('load', want)
      removeEventListener('scroll', want)
    }
  }, [])
  // Sources added after the element: it reads them on load() only.
  useEffect(() => {
    if (wanted) film.current?.load()
  }, [wanted, name])
  const seek = () => {
    const video = film.current
    // The middle of the frame the screen's corners belong to. Every frame is a keyframe (render.mjs: -g 1), so a seek
    // lands at once.
    const to = ((frameOf(device, move.get()) + 0.5) / SCREENS[device].length) * (video?.duration || 0)
    if (video?.duration && Math.abs(video.currentTime - to) > 0.02) video.currentTime = to
  }
  useMotionValueEvent(move, 'change', seek)
  useMotionValueEvent(opacity, 'change', (o) => film.current && (film.current.style.opacity = String(o)))
  return (
    <video key={name} ref={film} aria-hidden muted playsInline preload={wanted ? 'auto' : 'none'} poster={`${name}.webp`} onLoadedData={seek} className="pointer-events-none absolute inset-0 size-full object-cover">
      {/* All-intra H.264 comes out about half VP9's size (render.mjs): the MP4 first, the WebM for a browser without it. */}
      {wanted && <source src={`${name}.mp4`} type="video/mp4" />}
      {wanted && <source src={`${name}.webm`} type="video/webm" />}
    </video>
  )
}
