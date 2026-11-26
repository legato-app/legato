import { expect, it, vi } from 'vitest'
import { LayoutBoundary } from './LayoutBoundary'

vi.mock('../shared/diag', () => ({ describe: () => ({ message: 'failed' }), frames: () => '', report: vi.fn() }))

const boundary = (on: boolean, drop = vi.fn()) => {
  const made = new LayoutBoundary({ on, drop, children: 'part' })
  made.setState = (state) => void (made.state = { ...made.state, ...(state as typeof made.state) })
  return made
}
const error = new Error('broken part')

it('drops the layout when a part throws under it, and draws the part again', () => {
  const drop = vi.fn()
  const under = boundary(true, drop)
  expect(under.render()).toBe('part')
  under.state = LayoutBoundary.getDerivedStateFromError(error)
  expect(under.render()).toBeNull()
  under.componentDidCatch(error, { componentStack: '' })
  expect(drop).toHaveBeenCalledOnce()
  expect(under.render()).toBe('part')
})

it('lets an error under the app’s own layout through to the root', () => {
  const drop = vi.fn()
  const own = boundary(false, drop)
  own.state = LayoutBoundary.getDerivedStateFromError(error)
  own.componentDidCatch(error, { componentStack: '' })
  expect(drop).not.toHaveBeenCalled()
  expect(() => own.render()).toThrow(error)
})
