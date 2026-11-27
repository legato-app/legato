import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Cut } from './liteCuts'

// One edition per `load`: the cuts are worked out when the modules are first imported.
async function load(lite: boolean) {
  vi.resetModules()
  vi.doMock('./edition', () => ({ LITE: lite }))
  return {
    cuts: await import('./liteCuts'),
    keys: await import('../app/keys'),
    catalog: await import('../features/settings/catalog'),
    search: await import('../features/settings/search'),
    menus: await import('./ui/menuShape'),
    theme: await import('./theme/theme'),
    books: await import('../features/books/books'),
  }
}

type Edition = Awaited<ReturnType<typeof load>>

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const listed = (edition: Edition, list: (cut: Cut) => readonly string[] | undefined) => Object.values<Cut>(edition.cuts.LITE_CUTS).flatMap((cut) => list(cut) ?? [])

describe('Legato Lite', () => {
  let lite: Edition
  beforeAll(async () => {
    lite = await load(true)
  })

  it('has no cut page: each is a stub in pages.ts, and no other page is', () => {
    const wrapped = [...source('../app/pages.ts').matchAll(/unlessCut\('(\w+)'/g)].map((match) => match[1])
    expect(wrapped.sort()).toEqual(listed(lite, (cut) => cut.pages).sort())
    expect(wrapped.every(lite.cuts.isCutPage)).toBe(true)
  })

  it('binds and lists no cut shortcut', () => {
    const cut = listed(lite, (entry) => entry.shortcuts)
    const offered = lite.keys.OFFERED_ACTIONS.map((action) => action.id as string)
    expect(cut.length).toBeGreaterThan(0)
    for (const id of cut) {
      expect(lite.keys.ACTIONS.some((action) => action.id === id), id).toBe(true)
      expect(offered, id).not.toContain(id)
    }
    expect(offered).toHaveLength(lite.keys.ACTIONS.length - cut.length)
  })

  it('shows and finds no cut setting', () => {
    const found = new Set(lite.search.SETTINGS_INDEX.map((entry) => entry.label))
    for (const id of listed(lite, (cut) => cut.settings)) {
      expect(lite.catalog.categoryOf(id) ?? lite.catalog.groupDef(id), id).toBeDefined()
      expect(found.has(id), id).toBe(false)
      expect(lite.cuts.isCutSetting(id), id).toBe(true)
    }
    for (const kept of ['Equalizer per output device', 'Volume levelling', 'Adaptive Sound', 'Voice search', 'Cast to speakers']) expect(found.has(kept), kept).toBe(true)
  })

  it('draws no cut right-click item, and keeps it in a saved layout', () => {
    const known = new Set(Object.values(lite.menus.MENU_ITEMS).flatMap((items) => items.map((item) => item.id)))
    for (const id of listed(lite, (cut) => cut.menuItems)) {
      expect(known.has(id), id).toBe(true)
      const drawn = lite.menus.shapeMenu('player', [{ id }, { id: 'playNext' }], lite.menus.DEFAULT_MENU_LAYOUT, (items) => ({ id: 'more', items }))
      expect(JSON.stringify(drawn), id).not.toContain(`"${id}"`)
    }
    for (const kind of listed(lite, (cut) => cut.menuKinds)) expect(kind in lite.menus.MENU_ITEMS, kind).toBe(true)
    // Karaoke sits between Full screen and Cover display: moving the last one up passes both, Karaoke kept.
    const moved = lite.menus.moveItem(lite.menus.DEFAULT_MENU_LAYOUT, 'player', 'coverDisplay', -1).order.player!
    expect(moved).toContain('karaoke')
    expect(moved.indexOf('coverDisplay')).toBeLessThan(moved.indexOf('fullScreen'))
  })

  it('starts nothing that was cut', () => {
    const starts = [...source('../app/deferred.ts').matchAll(/^ {4}\['([^']+)',/gm)].map((match) => match[1])
    for (const name of listed(lite, (cut) => cut.starters)) {
      expect(starts, name).toContain(name)
      expect(lite.cuts.isCutStarter(name), name).toBe(true)
    }
    for (const kept of ['Sync Mode', 'Auto sync', 'Alarm']) expect(lite.cuts.isCutStarter(kept), kept).toBe(false)
  })

  it('shows an audiobook among the music, having no Audiobooks page', () => {
    const tracks = [{ audiobook: true, musicness: 'notMusic' }] as Parameters<Edition['books']['withoutBooks']>[0]
    expect(lite.books.withoutBooks(tracks)).toBe(tracks)
  })

  it('keeps what a full app saved: its switches and the keys of cut actions', () => {
    const saved = lite.theme.sanitize({ visualizer: true, podcasts: true, livingRoom: true, editor: true, shortcuts: { karaoke: { keys: 'KeyJ' } } })
    expect(saved).toMatchObject({ visualizer: true, podcasts: true, livingRoom: true, editor: true })
    expect(saved.shortcuts.karaoke?.keys).toBe('KeyJ')
  })
})

describe('Legato, the full app', () => {
  it('cuts nothing', async () => {
    const full = await load(false)
    expect(full.keys.OFFERED_ACTIONS).toEqual(full.keys.ACTIONS)
    expect(full.books.withoutBooks([{ audiobook: true, musicness: 'notMusic' }] as Parameters<Edition['books']['withoutBooks']>[0])).toEqual([])
    expect(full.search.SETTINGS_INDEX.map((entry) => entry.label)).toContain('Podcasts')
    for (const page of listed(full, (cut) => cut.pages)) expect(full.cuts.isCutPage(page), page).toBe(false)
    for (const id of listed(full, (cut) => cut.menuItems)) expect(full.cuts.isCutMenuItem(id), id).toBe(false)
    for (const feature of Object.keys(full.cuts.LITE_CUTS)) expect(full.cuts.offered(feature as keyof typeof full.cuts.LITE_CUTS), feature).toBe(true)
  })
})
