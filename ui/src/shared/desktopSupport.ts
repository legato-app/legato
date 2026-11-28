import { useEffect, useState } from 'react'
import { api } from './api'
import type { DesktopSupport } from './generated'

const FULL: DesktopSupport = { tray: true, keychain: true, selfUpdate: true }

/** What this desktop gives (`desktop.rs`), asked each time the screen showing it opens; everything until it answers. */
export function useDesktopSupport(): DesktopSupport {
  const [support, setSupport] = useState(FULL)
  useEffect(() => {
    api.desktopSupport().then(setSupport, () => {})
  }, [])
  return support
}
