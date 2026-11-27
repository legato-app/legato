import { notifyError } from './notifyError'
import { useStore } from './store'

/** Text to the clipboard, `done` said once it's there; a refused clipboard says why. */
export const copyText = (text: string, done: string) => navigator.clipboard.writeText(text).then(() => void useStore.getState().notify(done), notifyError)
