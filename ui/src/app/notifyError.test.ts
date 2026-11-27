import { expect, it, vi } from 'vitest'
import { notifyError } from './notifyError'

const notify = vi.fn(() => 7)
vi.mock('./store', () => ({ useStore: { getState: () => ({ notify }) } }))

it('shows any error as an error toast', () => {
  expect(notifyError(new Error('offline'))).toBe(7)
  expect(notify).toHaveBeenCalledWith('Error: offline', { kind: 'error' })
})
