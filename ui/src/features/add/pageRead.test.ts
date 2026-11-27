import { afterEach, expect, it, vi } from 'vitest'
import { firstPageStep } from './pageRead'

afterEach(() => vi.unstubAllGlobals())

it('says a service’s rules once on this PC, then goes to its sign-in', () => {
  const kept = new Map([['read', '1']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => kept.get(key) ?? null })
  expect(firstPageStep('unread')).toBe('rules')
  expect(firstPageStep('read')).toBe('sign-in')
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
  })
  expect(firstPageStep('read')).toBe('rules')
})
