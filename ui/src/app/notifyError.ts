import { useStore } from './store'

/** An error as a toast, in plain words when it's a network failure (`notify`). */
export const notifyError = (error: unknown) => useStore.getState().notify(String(error), { kind: 'error' })
