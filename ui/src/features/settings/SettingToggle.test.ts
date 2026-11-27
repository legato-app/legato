import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SettingToggle } from './SettingToggle'

const state = { settings: { motion: true, tvHome: false } }
vi.mock('../../app/settings', () => ({ useSettings: (select: (s: typeof state) => unknown) => select(state) }))

it('shows the setting it edits, named like its row', () => {
  const on = renderToStaticMarkup(createElement(SettingToggle, { setting: 'motion', label: 'Animations' }))
  expect(on).toContain('aria-label="Animations"')
  expect(on).toContain('aria-checked="true"')
  expect(renderToStaticMarkup(createElement(SettingToggle, { setting: 'tvHome', label: 'TV home' }))).toContain('aria-checked="false"')
})
