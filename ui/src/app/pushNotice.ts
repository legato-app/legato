/** What is said when a change didn't reach the service (push.rs). */
import type { PushFailed } from '../shared/api'
import { explain } from '../shared/errors'
import { tr } from '../shared/i18n/i18n'

export type PushNotice =
  /** Signed out, the change waiting here: said calmly, with a way back in. */
  | { signIn: 'youtube' | 'server'; text: string }
  | { signIn: null; text: string }

export function pushNotice(failed: PushFailed): PushNotice {
  // Only these keep the change here; the others are undone, so "it waits" would be untrue.
  if (failed.signedOut && (failed.kind === 'add' || failed.kind === 'like')) return { signIn: 'youtube', text: tr('Signed out of YouTube Music. Your changes wait here until you sign in again.') }
  if (failed.signedOut && failed.kind === 'serverAdd') return { signIn: 'server', text: tr('Signed out of your music server. Your changes wait here until you sign in again.') }
  // The reason in plain words, before the sentence around it (its own full stop goes: the sentence has one).
  const say = { name: failed.playlist, reason: explain(failed.reason).text.replace(/\.$/, '') }
  const text = {
    add: tr('Not added to {name} on YouTube Music yet: {reason}. Kept here, sent again at the next sync.', say),
    like: tr('Couldn’t like it on YouTube Music: {reason}. Kept in your Liked Music, liked at the next sync.', say),
    remove: tr('Not removed from {name} on YouTube Music: {reason}. Put back here.', say),
    unlike: tr('Couldn’t take the like back on YouTube Music: {reason}. Still in {name}.', say),
    serverAdd: tr('Not added to {name} on your music server yet: {reason}. Kept here, sent again at the next sync.', say),
    serverRemove: tr('Not removed from {name} on your music server: {reason}. Put back here.', say),
    serverRename: tr('Not renamed on your music server: {reason}. Called {name} here again.', say),
  }[failed.kind]
  return { signIn: null, text }
}
