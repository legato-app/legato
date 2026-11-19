import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Adaptive Sound's measure in live.js (the block between lv:begin and lv:end), with live.js' own `lufs`.
const src = readFileSync(new URL('./live.js', import.meta.url), 'utf8')
const lv = src.slice(src.indexOf('// lv:begin'), src.indexOf('// lv:end'))
const lufsLine = src.split('\n').find((l) => l.includes('const lufs = ')) ?? ''
type State = { elapsed: number; momentary: number; short: number; gated: number; gatedS: number }
const { smooth, gate, lufs } = new Function(`${lufsLine}; ${lv}; return { smooth, gate, lufs }`)() as {
  smooth: (g: State, ms: number, span: number) => void
  gate: (g: State, span: number) => void
  lufs: (ms: number) => number
}

const TICK = 1 / 30
/** What Adaptive Sound wants at each tick of a song whose mean square is `at(t)`, to -14 LUFS. */
function wants(at: (t: number) => number, secs: number) {
  const g: State = { elapsed: 0, momentary: 0, short: 0, gated: 0, gatedS: 0 }
  const out: number[] = []
  for (let t = 0; t < secs; t += TICK) {
    smooth(g, at(t), TICK)
    gate(g, TICK)
    out.push(g.gatedS > 0 ? -14 - lufs(g.gated / g.gatedS) : NaN)
  }
  return out
}
// Verses 12 dB under the choruses, 8 s each.
const song = (t: number) => (Math.floor(t / 8) % 2 ? 0.16 : 0.01)

describe('Adaptive Sound (live.js)', () => {
  it('one gain for the song: it hardly moves once the song has started, so verses stay under choruses', () => {
    const w = wants(song, 80).slice(24 / TICK)
    // Following the last 3 s, it swung about 12 dB with each chorus.
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(1.5)
  })
  it('songs of different loudness both land on the level asked', () => {
    for (const ms of [0.01, 0.16]) expect(wants(() => ms, 20).at(-1)! + lufs(ms)).toBeCloseTo(-14, 1)
  })
  it('silence and quiet passages are not measured', () => {
    const g: State = { elapsed: 0, momentary: 0, short: 0, gated: 0, gatedS: 0 }
    for (let t = 0; t < 10; t += TICK) {
      smooth(g, 0, TICK)
      gate(g, TICK)
    }
    expect(g.gatedS).toBe(0)
    const loud = wants((t) => (t < 20 ? 0.16 : 0.0001), 40).at(-1)!
    expect(loud).toBeCloseTo(-14 - lufs(0.16), 0)
  })
})
