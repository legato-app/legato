import { afterEach, describe, expect, it, vi } from 'vitest'
import { isObject, readStored, removeStored, writeStored } from './stored'

const store = new Map<string, string>()
const working = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) }
const blocked = () => {
  throw new Error('blocked')
}

afterEach(() => {
  store.clear()
  vi.unstubAllGlobals()
})

describe('what this PC remembers', () => {
  it('reads back what was written, the fallback for anything absent, unreadable or of another shape', () => {
    vi.stubGlobal('localStorage', working)
    expect(readStored('key', {}, isObject)).toEqual({})
    writeStored('key', { volume: 0.5 })
    expect(readStored('key', {}, isObject)).toEqual({ volume: 0.5 })
    expect(readStored('key', [], Array.isArray)).toEqual([])
    store.set('key', 'null')
    expect(readStored('key', {}, isObject)).toEqual({})
    store.set('key', '{')
    expect(readStored('key', 7)).toBe(7)
    removeStored('key')
    expect(store.size).toBe(0)
  })

  it('goes on without storage', () => {
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
    expect(readStored('key', 'none')).toBe('none')
    expect(() => (writeStored('key', 1), removeStored('key'))).not.toThrow()
  })
})
