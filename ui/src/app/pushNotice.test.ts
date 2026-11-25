import { describe, expect, it } from 'vitest'
import type { PushFailed } from '../shared/api'
import { pushNotice } from './pushNotice'

const failed = (patch: Partial<PushFailed>): PushFailed => ({ kind: 'add', playlist: 'Road trip', songs: 1, reason: 'YouTube Music signed you out (browse → 401 Unauthorized)', signedOut: true, ...patch })

describe('push notice', () => {
  it('signed out with the change kept: calm, no reason, a way back in', () => {
    expect(pushNotice(failed({}))).toEqual({ signIn: 'youtube', text: 'Signed out of YouTube Music. Your changes wait here until you sign in again.' })
    expect(pushNotice(failed({ kind: 'serverAdd' })).signIn).toBe('server')
  })
  it('signed out but undone: says what was undone', () => {
    const notice = pushNotice(failed({ kind: 'remove' }))
    expect(notice.signIn).toBeNull()
    expect(notice.text).toContain('Put back here.')
  })
  it('a refused add is kept and sent again', () => {
    expect(pushNotice(failed({ signedOut: false, reason: 'Not yours.' })).text).toBe('Not added to Road trip on YouTube Music yet: Not yours. Kept here, sent again at the next sync.')
  })
})
