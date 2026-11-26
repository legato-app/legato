/** Which of the hero's three devices the visitor holds (the 3D scene zooms on it, site/public/landing). */
export type Device = 'phone' | 'monitor' | 'laptop'

/** What the browser tells: its user agent, and its battery when it shows one (Chromium only). */
export type Clues = { userAgent: string; battery?: { charging: boolean; level: number } }

/**
 * Android → the phone (the app's other build). A battery running down or not full → a laptop: a desktop reports
 * none, or one always charging and full. Anything else, a laptop on its charger included → the monitor.
 */
export function deviceOf({ userAgent, battery }: Clues): Device {
  if (/Android/i.test(userAgent)) return 'phone'
  if (battery && (!battery.charging || battery.level < 1)) return 'laptop'
  return 'monitor'
}
