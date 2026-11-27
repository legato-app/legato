import { afterEach, expect, it, vi } from 'vitest'
import { copyText } from './copyText'

const notify = vi.fn()
vi.mock('./store', () => ({ useStore: { getState: () => ({ notify }) } }))
afterEach(() => (notify.mockClear(), vi.unstubAllGlobals()))

it('says what was copied, or why it was not', async () => {
  const written: string[] = []
  vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void written.push(text) } })
  await copyText('link', 'Link copied')
  expect(written).toEqual(['link'])
  expect(notify).toHaveBeenLastCalledWith('Link copied')
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('refused')) } })
  await copyText('link', 'Link copied')
  expect(notify).toHaveBeenLastCalledWith('Error: refused', { kind: 'error' })
})
