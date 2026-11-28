import { expect, it } from 'vitest'
import { headerHasHandle, ownersShown, surfaceHasHandle } from './shown'

const screen = { view: 'album', nowPlaying: false, hidden: [] }

it('gives handles to the bars, the shown page and its lists’ columns', () => {
  expect(ownersShown(screen)).toEqual(['playerBar', 'topbar', 'sidebar', 'album', 'columns'])
  // A page without parts of its own still has lists.
  expect(ownersShown({ ...screen, view: 'playlist' })).toEqual(['playerBar', 'topbar', 'sidebar', 'columns'])
  expect(ownersShown({ ...screen, hidden: ['sidebar'] })).toEqual(['playerBar', 'topbar', 'album', 'columns'])
  expect(headerHasHandle(screen)).toBe(true)
})

it('never arranges Settings or Add-ons', () => {
  for (const view of ['settings', 'addons']) {
    expect(ownersShown({ ...screen, view })).toEqual(['playerBar', 'topbar', 'sidebar'])
    expect(headerHasHandle({ ...screen, view })).toBe(false)
  }
})

it('under Now Playing, keeps to it and to the top bar over it', () => {
  const playing = { ...screen, nowPlaying: true }
  expect(ownersShown(playing)).toEqual(['topbar', 'nowPlayingColumns', 'nowPlaying', 'nowPlayingControls'])
  expect([surfaceHasHandle('topbar', playing), surfaceHasHandle('sidebar', playing), surfaceHasHandle('playerBar', playing)]).toEqual([true, false, false])
  expect(headerHasHandle(playing)).toBe(false)
  expect(surfaceHasHandle('sidebar', { ...screen, hidden: ['sidebar'] })).toBe(false)
})
