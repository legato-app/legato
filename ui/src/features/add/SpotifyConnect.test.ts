import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { EXPORTIFY } from '../../shared/links'
import { SpotifyConnect } from './SpotifyConnect'

const device = vi.hoisted(() => ({ phone: false }))
vi.mock('../../shared/platform', async (original) => ({
  ...(await original<typeof import('../../shared/platform')>()),
  get phoneApp() {
    return device.phone
  },
}))
vi.mock('../../app/store', () => ({ useStore: () => undefined }))

const card = (phone: boolean) => {
  device.phone = phone
  return renderToStaticMarkup(createElement(SpotifyConnect))
}

it('offers a phone Exportify in its browser and the file it saves, never a window of the app', () => {
  const phone = card(true)
  expect(phone).toContain('>Open Exportify</button>')
  expect(phone).toContain('>Choose the Exportify file…</button>')
  expect(phone).toContain('It opens in your browser')
  expect(phone).not.toContain('>Connect</button>')
  expect(EXPORTIFY).toBe('https://exportify.app/')
})

it('keeps Connect and the data export on a PC', () => {
  const desktop = card(false)
  expect(desktop).toContain('>Connect</button>')
  expect(desktop).toContain('>Open Spotify’s data export…</button>')
  expect(desktop).not.toContain('Open Exportify')
})
