/**
 * What this PC alone remembers, in localStorage, as JSON. A private window, blocked or full storage: nothing kept,
 * nothing else lost.
 */

/** The value kept under `key` when `accept` takes it; else (absent, unreadable, another shape) `fallback`. */
export function readStored<Value>(key: string, fallback: Value, accept: (value: unknown) => boolean = () => true): Value {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return fallback
    const value: unknown = JSON.parse(text)
    return accept(value) ? (value as Value) : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Kept for this run only.
  }
}

export function removeStored(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked: there is nothing to remove.
  }
}

/** An object or a list, not a bare value. */
export const isObject = (value: unknown) => !!value && typeof value === 'object'
