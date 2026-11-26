import { expect, it } from 'vitest'
import { oldAnchor } from './oldAnchor'

it('sends an old section’s address to its page', () => {
  expect(oldAnchor('#plugins')).toBe('/docs/developers/plugins/')
  expect(oldAnchor('#first-steps')).toBe('/docs/using/first-steps/')
  for (const other of ['', '#', '#toString', '#nothing']) expect(oldAnchor(other)).toBeNull()
})
