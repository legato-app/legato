import { CaretDown, CopySimple, DotsThree, Gear, Minus, PuzzlePiece, Square, Warning, WifiSlash, X } from '@phosphor-icons/react'
import { CaretLeft, CaretRight } from '../shared/ui/directional'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { lazy, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AddonsView, AddView, AlbumsView, AlbumView, ArtistsView, ArtistView, BlindTest, ConnectWizard, CoverScreen, HealthView, PipScreen, HistoryView, HomeView, ImportDialog, ImportScreen, Karaoke, MixesView, MixView, BooksView, NotFoundView, OnScreenKeyboard, PodcastsView, TvHome, RadioView, NowPlaying, PlaylistView, PluginColumn, preloadHome, RoomDialog, SearchView, SettingsView, ShareDialog, SmartView, SongsView, StatsView, VizScreen, Welcome } from './pages'
// Up next running out: similar songs (registers itself with the player).
import '../features/player/autoplay'
import { appMenu, navMenu } from '../features/menus'
import { startUpdates } from '../features/update/updates'
import { startDeferred } from './deferred'
import { PageBoundary } from './PageBoundary'
import { PageLayout } from '../shared/ui/pageLayout'
import { startBookmarks } from '../features/player/bookmarks'
import { startMedia } from '../features/player/media'
import { resumeSession, startSessionSaving } from '../features/player/session'
import { startCallPause, startUnplugPause } from '../features/player/unplug'
import { startScreenAwake } from '../features/player/screenAwake'
import { installBack } from './androidBack'
import { MiniPlayer } from '../features/player/MiniPlayer'
import { VolumeHud } from '../features/player/VolumeHud'
import { useKaraoke } from '../features/player/karaokeMode'
import { useVizFull } from '../features/player/vizFull'
import { useCoverFull } from '../features/player/coverFull'
import { minimizeWindow, usePip, watchMinimize } from '../features/player/pipMode'
import { useShare } from '../features/share/share'
import { useRoom } from '../features/rooms/room'
import { useAmbient } from '../features/player/ambient'
import { useCoverAccent } from '../features/player/coverTint'
import { trackArt } from '../shared/art'
import { PlayerBar } from '../features/player/PlayerBar'
import { SidePanel } from '../features/player/SidePanel'
import { useNowTrack, usePlayer } from '../features/player/store'
import { SearchBar } from '../features/search/SearchBar'
import { useBlind } from '../features/blind/blindOpen'
import { useOsk } from '../features/livingRoom/osk'
import { VoiceSearch } from '../features/search/VoiceSearch'
import { Sidebar } from '../features/sidebar/Sidebar'
import { api } from '../shared/api'
import { explain } from '../shared/errors'
import { useOnline } from '../shared/online'
import { usePhone } from '../shared/phone'
import { region } from '../shared/format'
import { ContextMenuHost, onMenu, openMenu, type MenuEntry } from '../shared/ui/ContextMenu'
import { CastHost, CreditsHost, DuplicatesHost, EditInfoHost } from '../features/library/dialogs'
import { linkKind, shouldWelcome } from '../features/welcome/firstRun'
import { isRemixLink } from '../features/editor/remixLink'
import { isShareCode } from '../features/share/shareCode'
import { Logo } from '../shared/ui/Logo'
import { searchShift } from './searchShift'
import { useSettings } from './settings'
import { dropLayout, useNowPlayingPages, useShellLayout } from './shellLayout'
import { useArrangeDraft } from './arrangeDraft'
import { ArrangePart } from './ArrangePart'
import { LayoutBoundary } from './LayoutBoundary'
import { arrangeParts, DEFAULT_LAYOUT, layoutRegions, PART_GROUPS, pluginOf, type PartsChoice, type Surface } from '../shared/theme/layout'
import { restoreScreen, startClosingPlayerOnNavigate, startScreenSaving } from './screen'
import { startShortcuts } from './shortcuts'
import { useStore, type View } from './store'
import { pushNotice } from './pushNotice'
import { Toasts } from './Toasts'
import { PhoneTabs } from './PhoneTabs'
import { Asker } from '../shared/ui/Ask'
import { WebcamScan } from '../features/share/WebcamScan'
import { tr, trn, useLang } from '../shared/i18n/i18n'
import { offered } from '../shared/liteCuts'

// The arranging mode's bar, loaded when the mode opens (`startArranging`).
const ArrangeBar = lazy(() => import('../features/arrange/ArrangeBar'))

// Pages load on first visit (pages.ts), Home's download starts now, in parallel with the settings and the library.
preloadHome()

const win = getCurrentWindow()
// Full contrast: grey window buttons were hard to find (user, 2026-10-23).
const winBtn = 'grid h-9 w-11 phone:size-11 place-items-center rounded-md text-ink transition hover:bg-raised'
const navBtn = 'grid size-8 phone:size-10 place-items-center rounded-full bg-raised text-ink-2 transition hover:text-ink disabled:pointer-events-none disabled:opacity-40'

/**
 * Replaces the OS title bar (decorations: false), full width on the window's background like Spotify's: logo and name
 * (Home, from anywhere, the player included), search, Add-ons and Settings, window buttons. Empty areas drag the
 * window. Over Now Playing it's see-through: the player's backdrop or tint runs under it, no grey band.
 */
/** The search's middle on the window's, whatever sits left and right of it (clamped inside its box: `searchShift`). */
function useSearchCentered(box: React.RefObject<HTMLDivElement | null>, on: boolean) {
  const [shift, setShift] = useState(0)
  useEffect(() => {
    const el = box.current
    const bar = el?.firstElementChild
    if (!on || !el || !bar) return void setShift(0)
    const measure = () => {
      const b = el.getBoundingClientRect()
      setShift(searchShift(document.documentElement.clientWidth / 2, { left: b.left, width: b.width }, bar.getBoundingClientRect().width))
    }
    // Its box resizes with the window and with what sits beside it (Back, Close player, Offline); the bar on focus.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [on, box])
  return shift
}

/** The logo and name: Home, from anywhere. In the top bar, or where the theme puts it; never hidden (`data-brand`). */
function Brand({ className = '', order }: { className?: string; order?: number }) {
  const go = useStore((s) => s.go)
  return (
    <button data-brand data-surface="brand" onClick={() => go({ name: 'home' })} title={tr('Home')} style={{ order }} className={`flex items-center gap-2.5 rounded-md px-2 py-1 ${className}`}>
      <Logo />
      <span data-brand-name className="text-[0.9375rem] font-bold tracking-tight phone:hidden">Legato</span>
    </button>
  )
}

/** `bare`: a theme hides it. The logo, the search (nothing else searches), Settings, the window's buttons and the drag
 *  area stay: nothing else closes the window. `choice`: the theme's order and hidden parts; what is hidden is in More. */
function TopBar({ brand, bare, order, choice }: { brand: boolean; bare: boolean; order?: number; choice?: PartsChoice }) {
  const full = usePlayer((s) => s.full)
  const searchBox = useRef<HTMLDivElement>(null)
  // The phone's bar has no room to move the search: it stays put.
  const phone = usePhone()
  const shift = useSearchCentered(searchBox, !phone)
  // Now Playing opening or closing swaps what sits left of the search (Back / Forward, Close player): its recentring jumps then, it
  // does not slide (2026-11-13). Focus and the window's own resizes still glide.
  const [snap, setSnap] = useState(false)
  useLayoutEffect(() => {
    setSnap(true)
    const t = setTimeout(() => setSnap(false), 400)
    return () => clearTimeout(t)
  }, [full])
  const setFull = usePlayer((s) => s.setFull)
  const go = useStore((s) => s.go)
  const page = useStore((s) => s.view.name)
  const { canBack, canForward, goBack, goForward } = useStore(useShallow((s) => ({ canBack: s.back.length > 0, canForward: s.fwd.length > 0, goBack: s.goBack, goForward: s.goForward })))
  const online = useOnline()
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    const check = () => void win.isMaximized().then(setMaximized, () => {})
    check()
    const off = win.onResized(check)
    return () => void off.then((f) => f())
  }, [])
  const shown: string[] = bare ? ['search'] : arrangeParts(choice, PART_GROUPS.topbar[0])
  const addons = !full && offered('plugins') && shown.includes('addons') && (
    <button className={`${winBtn} rounded-full! phone:hidden ${page === 'addons' ? 'bg-raised' : ''}`} aria-label={tr('Add-ons')} title={tr('Add-ons')} onClick={() => go({ name: 'addons' })} onContextMenu={onMenu(() => navMenu({ name: 'addons' }))}>
      <PuzzlePiece size={18} weight={page === 'addons' ? 'fill' : 'regular'} />
    </button>
  )
  // Left last, Add-ons sits close to Settings, as in the app's own order.
  const addonsBySettings = shown.at(-1) === 'addons'
  const hidesSome = !shown.includes('history') || !shown.includes('addons')
  const inSettings = !full && page === 'settings'
  const hiddenEntries = (): MenuEntry[] => [
    !shown.includes('history') && { label: tr('Back'), icon: <CaretLeft size={16} />, disabled: !canBack, onSelect: goBack },
    !shown.includes('history') && { label: tr('Forward'), icon: <CaretRight size={16} />, disabled: !canForward, onSelect: goForward },
    offered('plugins') && !shown.includes('addons') && { label: tr('Add-ons'), icon: <PuzzlePiece size={16} />, onSelect: () => go({ name: 'addons' }) },
  ]
  const blocks: Record<string, ReactNode> = {
    // ← → of the mockups (the mouse's back / forward buttons do the same). Nowhere to go: not drawn, its place kept
    // (a calm bar, plan-v2 › U2; the search doesn't move). Now Playing has Close player instead.
    history: !full && (
      <span className="flex items-center gap-2">
        <button className={`${navBtn} nudge-l ${canBack ? '' : 'invisible phone:hidden'}`} aria-label={tr('Back')} title={tr('Back')} disabled={!canBack} onClick={goBack}>
          <CaretLeft size={16} />
        </button>
        <button className={`${navBtn} nudge-r phone:hidden ${canForward ? '' : 'invisible'}`} aria-label={tr('Forward')} title={tr('Forward')} disabled={!canForward} onClick={goForward}>
          <CaretRight size={16} />
        </button>
      </span>
    ),
    search: (
      <div ref={searchBox} data-tauri-drag-region className={`flex h-full min-w-0 flex-1 items-center justify-center px-4 phone:px-1 *:translate-x-(--shift) ${snap ? '' : '*:transition-[translate] *:duration-300'}`} style={{ ['--shift' as string]: `${shift}px` }}>
        <SearchBar>
          {(offered('voiceSearch') || offered('musicDetector')) && <VoiceSearch />}
        </SearchBar>
      </div>
    ),
    offline: !online && (
      <span role="status" title={tr('No internet connection: your own files still play. Searches and YouTube come back with the connection.')} className="swap-in flex shrink-0 items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-medium text-ink-2">
        <WifiSlash size={14} /> {tr('Offline')}
      </span>
    ),
    addons: !addonsBySettings && addons,
  }
  return (
    // Over Now Playing: a veil from the top keeps logo, Close player and window buttons readable on any cover.
    <header data-tauri-drag-region data-surface="topbar" style={{ order }} className={`relative z-30 flex h-13 shrink-0 items-center gap-3 pe-2 ps-5 phone:gap-1 phone:pe-2 phone:ps-1 ${full ? 'bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--bg)_80%,transparent),transparent)] phone:hidden' : ''}`}>
      {/* The phone: the logo or Back, never both (Home is a tab there). */}
      {brand && <Brand className={canBack && !full ? 'phone:hidden' : ''} />}
      {full && (
        <button onClick={() => setFull(false)} title={tr('Close Now Playing (Esc)')} className="glass flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition hover:bg-raised">
          <CaretDown size={12} weight="bold" /> {tr('Close player')}
        </button>
      )}
      {shown.map((part) => (
        <ArrangePart key={part} surface="topbar" part={part}>
          {blocks[part]}
        </ArrangePart>
      ))}
      {/* Over Now Playing: the gear alone (Add-ons and More stay out, the player stays calm), on glass like the
          window's buttons (on the span: on the button it would hide its hover); the page under the player doesn't light it. */}
      <span className={`flex items-center gap-1 ${full ? 'glass me-2 rounded-full' : 'pe-2'}`}>
        {addonsBySettings && (
          <ArrangePart surface="topbar" part="addons">
            {addons}
          </ArrangePart>
        )}
        {!full && hidesSome && (
          <button className={`${winBtn} rounded-full! phone:hidden`} aria-label={tr('More')} title={tr('More')} onClick={(e) => openMenu(e, hiddenEntries(), { place: 'below' })}>
            <DotsThree size={18} weight="bold" />
          </button>
        )}
        <button className={`${winBtn} turn rounded-full! ${inSettings ? 'bg-raised' : ''}`} aria-label={tr('Settings')} title={tr('Settings')} onClick={() => go({ name: 'settings', section: 'general' })} onContextMenu={onMenu(() => navMenu({ name: 'settings', section: 'general' }))}>
          <Gear size={18} weight={inSettings ? 'fill' : 'regular'} />
        </button>
      </span>
      <span className={`flex items-center phone:hidden ${full ? 'glass rounded-lg' : ''}`}>
        <button className={winBtn} aria-label={tr('Minimize')} title={tr('Minimize')} onClick={minimizeWindow}>
          <Minus size={16} />
        </button>
        <button className={winBtn} aria-label={maximized ? tr('Restore') : tr('Maximize')} title={maximized ? tr('Restore') : tr('Maximize')} onClick={() => win.toggleMaximize()}>
          {maximized ? <CopySimple size={15} /> : <Square size={14} />}
        </button>
        <button className={`${winBtn} hover:bg-danger! hover:text-white!`} aria-label={tr('Close')} title={tr('Close')} onClick={() => win.close()}>
          <X size={16} />
        </button>
      </span>
    </header>
  )
}

function Alerts() {
  const { lastSync, error, dismissError, view } = useStore(useShallow((s) => ({ lastSync: s.lastSync, error: s.error, dismissError: s.dismissError, view: s.view })))
  // The 15-minute sync refused by Google says nothing: it waits and tries later on its own.
  const errors = lastSync && !(lastSync.auto && lastSync.report.refused) ? lastSync.report.errors : []
  // Wizard shows its own error.
  const shown = view.name === 'settings' && view.wizard ? undefined : error
  if (!shown && !errors.length) return null
  // Raw network failures in plain words, Rust's message one click away.
  const said = shown ? explain(shown) : undefined
  return (
    <div role="alert" className="mx-6 mt-5 flex items-start gap-2.5 rounded-lg border border-line bg-recess px-3.5 py-3 text-xs">
      <Warning size={15} className="mt-px shrink-0 text-danger" />
      <div className="flex-1">
        {said && <p>{said.text}</p>}
        {said?.detail && (
          <details className="mt-1 text-ink-3">
            <summary className="cursor-pointer">{tr('Details')}</summary>
            <p className="mt-1 font-mono text-[0.6875rem] break-all">{said.detail}</p>
          </details>
        )}
        {errors.length > 0 && (
          <details>
            <summary className="cursor-pointer">
              {trn(errors.length, '{n} error during sync', '{n} errors during sync')}
            </summary>
            <ul className="mt-1.5 list-disc ps-4 text-ink-2">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {shown && (
        <button aria-label={tr('Dismiss')} onClick={dismissError} className="text-ink-3 hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/** One key per page shown: a new one replays the page's entrance. */
const pageKey = (v: View) => ('id' in v ? `${v.name}:${v.id}` : 'album' in v ? `album:${v.album}` : 'artist' in v ? `artist:${v.artist}` : v.name === 'settings' ? 'settings' : v.name)

export function App() {
  const { view, go, refresh, incoming } = useStore(useShallow((s) => ({ view: s.view, go: s.go, refresh: s.refresh, incoming: s.incoming })))
  const full = usePlayer((s) => s.full)
  const blind = useBlind((s) => s.open)
  const osk = useOsk((s) => !!s.target)
  const importing = useStore((s) => !!s.importRun && !s.importRun.hidden)
  const karaoke = useKaraoke((s) => s.open)
  const vizFull = useVizFull((s) => s.open)
  const coverFull = useCoverFull((s) => s.open)
  const pip = usePip((s) => s.on)
  const share = useShare((s) => s.open)
  const room = useRoom((s) => s.open)
  const tintOn = useSettings((s) => s.settings.appTint)
  const libraryWide = useSettings((s) => s.settings.libraryWide)
  // Re-rendered when the theme, accent or Windows' light / dark change (current() below).
  useSettings((s) => s.settings.theme)
  useSettings((s) => s.settings.accent)
  useSettings((s) => s.systemDark)
  const nowTrack = useNowTrack()
  const appTint = useAmbient(tintOn && nowTrack ? trackArt(nowTrack)[0] : undefined, useSettings.getState().current())
  const coverAccentOn = useSettings((s) => s.settings.accent === 'cover')
  useCoverAccent(coverAccentOn && nowTrack ? trackArt(nowTrack)[0] : undefined)
  // First launch: what the app is, what stays on this PC, where the music comes from (features/welcome).
  const [welcome, setWelcome] = useState(false)
  const [up, setUp] = useState(false)
  const [settingsIn, setSettingsIn] = useState(false)
  // Language changed: everything below renders again in it (nothing remounts: the player keeps playing).
  useLang((s) => s.lang)
  useEffect(() => {
    const settings = useSettings.getState().load()
    void settings.finally(() => setSettingsIn(true))
    const library = refresh()
    // Settings and library both needed: resume flag, and the saved queue's tracks. First launch after an update:
    // everything back as it was (queue, paused or not, screen), whatever the resume settings.
    const updated = api.updateStatus().catch(() => null)
    const loaded = Promise.all([settings, library, updated])
    // Up (even when a load failed): the deferred start follows, whatever the resume below does.
    void loaded.then(() => setUp(true), () => setUp(true))
    void loaded
      .then(async ([, , u]) => {
        const exact = !!u?.justUpdated
        const s = useSettings.getState().settings
        await resumeSession(s.resume, exact)
        if (s.reopen || exact) restoreScreen()
        const lib = useStore.getState()
        if (shouldWelcome(s.welcomed, lib.tracks.length, lib.playlists.length)) setWelcome(true)
        if (exact && u?.lastUpdate) useStore.getState().notify(tr('Version {version} installed', { version: u.lastUpdate.to }), { action: { label: tr('What’s new'), run: () => useStore.getState().go({ name: 'settings', section: 'about', focus: 'Updates' }) } })
      })
      .catch(() => {})
    void library
      .then(() => api.backfillArt(region()))
      .then((n) => (n ? useStore.getState().refreshChanged() : undefined))
      .catch(() => {})
  }, [refresh])
  useEffect(() => startSessionSaving(), [])
  useEffect(() => startScreenSaving(), [])
  useEffect(() => startClosingPlayerOnNavigate(), [])
  useEffect(() => startMedia(), [])
  useEffect(() => startBookmarks(), [])
  useEffect(() => startUnplugPause(), [])
  useEffect(() => startCallPause(), [])
  useEffect(() => startScreenAwake(), [])
  useEffect(() => installBack(), [])
  useEffect(() => watchMinimize(), [])
  useEffect(() => startShortcuts(), [])
  useEffect(() => startUpdates(), [])
  // Watched local folders changed: the library shows it.
  useEffect(() => {
    const off = api.onLocalChanged(() => void useStore.getState().refreshChanged())
    return () => void off.then((f) => f())
  }, [])
  // A like, add or removal a service refused after the fact (push.rs): said here.
  useEffect(() => {
    const off = api.onPushFailed((failed) => {
      const { notify, go } = useStore.getState()
      const notice = pushNotice(failed)
      if (notice.signIn === null) notify(notice.text, { kind: 'error' })
      else {
        // Same words each time: the toast already up is replaced, never stacked.
        const signIn = notice.signIn === 'youtube' ? () => void api.ytmSignIn().catch((e: unknown) => useStore.setState({ error: String(e) })) : () => go({ name: 'settings', section: 'sources' })
        notify(notice.text, { kind: 'info', action: { label: tr('Sign in again'), run: signIn } })
      }
      void useStore.getState().refreshChanged()
    })
    return () => void off.then((f) => f())
  }, [])
  // Settings and library in (or failed), page mounted: the rest starts. Not on a paint: a hidden start has none.
  useEffect(() => (up ? startDeferred() : undefined), [up])

  // Ctrl+V outside text fields: share code → import, Spotify / Deezer / Apple Music playlist or album → import, YouTube or SoundCloud
  // song → library.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Target may be document itself (nothing focused): not an Element.
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return
      const text = e.clipboardData?.getData('text').trim() ?? ''
      const kind = linkKind(text)
      if (offered('liveEditor') && isRemixLink(text)) void import('../features/editor/remixFile').then((m) => m.openRemixLink(text))
      else if (isShareCode(text)) useStore.setState({ incoming: text })
      else if (kind === 'spotify') void useStore.getState().importSpotify(text)
      else if (kind === 'deezer' || kind === 'apple') void useStore.getState().importLink(text, kind)
      else if (kind === 'youtube' || kind === 'soundcloud') void useStore.getState().addLink(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // Where the theme puts the shell's parts (its own arrangement without a layout).
  const placement = useShellLayout()
  const arranging = useArrangeDraft((state) => !!state.draft)
  const nowPlayingPages = useNowPlayingPages(placement.pages)
  const shell = layoutRegions(placement, full)
  // Open wide, the library stands in for the page: only with a sidebar to hold it.
  const sidebarShown = shell.regions.left.includes('sidebar') || shell.regions.right.includes('sidebar')
  // A part that throws under a theme's layout drops it (LayoutBoundary).
  const arranged = placement !== DEFAULT_LAYOUT
  const part = (surface: Surface, drawn: ReactNode) => (
    <LayoutBoundary key={surface} on={arranged} drop={dropLayout}>
      {drawn}
    </LayoutBoundary>
  )
  // Above and under the middle row; the player bar is drawn apart.
  const bar = (surface: Surface) => {
    if (surface === 'topbar') return part(surface, <TopBar brand={shell.brandInTopbar} bare={shell.topbarBare} order={shell.order?.topbar} choice={placement.parts.topbar} />)
    return surface === 'brand' && part(surface, <Brand className="mx-4 my-1 shrink-0 self-start" order={shell.order?.brand} />)
  }
  // The columns keep off the window's edge when no bar is under them.
  const nothingUnder = !shell.regions.bottom.some((surface) => surface !== 'playerBar' || !shell.playerBarHidden)
  const column = (surface: Surface, side: 'left' | 'right') => {
    if (surface === 'sidebar') return part(surface, <Sidebar side={side} fixedWidth={placement.sizes.sidebar} choice={placement.parts.sidebar} />)
    const plugin = pluginOf(surface)
    if (plugin) {
      return part(
        surface,
        <PageBoundary fallback={null}>
          <PluginColumn plugin={plugin} />
        </PageBoundary>,
      )
    }
    return part(surface, surface === 'brand' ? <Brand className="shrink-0 self-start" /> : <SidePanel width={placement.sizes.sidePanel} />)
  }

  return (
    // Setting appTint: every surface takes the playing cover's color (text keeps AA, ambient.ts).
    // Layered panels on the window's background (docs/design.md): sidebar, page, right panel; the player bar below.
    <div className="flex h-full flex-col bg-recess transition-colors duration-700" style={appTint}>
      {shell.regions.top.map(bar)}
      <div className={`flex min-h-0 flex-1 gap-2 px-2 phone:px-0 ${nothingUnder ? 'pb-2' : ''}`} style={{ order: shell.order?.main }}>
        {shell.regions.left.map((surface) => column(surface, 'left'))}
        {/* Your library open wide takes the page's place (kept, hidden: it comes back as it was). */}
        <main className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-bg phone:rounded-none ${libraryWide && sidebarShown ? 'hidden' : ''}`}>
          <Alerts />
          {/* New page: a short rise (styles.css .page-in), not when only its details change. Its padding is what a
              page band undoes to reach the pane's edges (PageHeader). */}
          <div key={pageKey(view)} className="page-in flex min-h-0 flex-1 flex-col px-6 pt-5 phone:px-4 phone:pt-3">
            {/* No page before the start screen is known: another one would show, and load, for nothing. */}
            {/* Settings and Add-ons keep the app's own pages, whatever the theme: the way back, the permission review. */}
            {settingsIn && (
              <PageLayout.Provider value={view.name === 'settings' || view.name === 'addons' ? DEFAULT_LAYOUT.pages : placement.pages}>
              <PageBoundary>
                {view.name === 'home' && <HomeView />}
                {view.name === 'add' && <AddView />}
                {view.name === 'search' && <SearchView />}
                {view.name === 'mixes' && <MixesView />}
                {view.name === 'radio' && <RadioView />}
                {view.name === 'podcasts' && <PodcastsView />}
                {view.name === 'tv' && <TvHome />}
                {view.name === 'books' && <BooksView />}
                {view.name === 'stats' && <StatsView />}
                {view.name === 'history' && <HistoryView />}
                {view.name === 'smart' && <SmartView id={view.id} />}
                {view.name === 'notFound' && <NotFoundView />}
                {view.name === 'health' && <HealthView />}
                {view.name === 'mix' && <MixView id={view.id} />}
                {view.name === 'songs' && <SongsView />}
                {view.name === 'albums' && <AlbumsView />}
                {view.name === 'album' && <AlbumView album={view.album} artist={view.artist} />}
                {view.name === 'artists' && <ArtistsView />}
                {view.name === 'artist' && <ArtistView artist={view.artist} />}
                {view.name === 'playlist' && <PlaylistView id={view.id} />}
                {view.name === 'settings' && <SettingsView section={view.section} />}
                {view.name === 'addons' && <AddonsView />}
              </PageBoundary>
              </PageLayout.Provider>
            )}
          </div>
        </main>
        {shell.regions.right.map((surface) => column(surface, 'right'))}
        {view.name === 'settings' && view.wizard && (
          <PageBoundary fallback={null}>
            <ConnectWizard key={view.wizard} service={view.wizard} onClose={() => go({ name: 'settings', section: 'sources' })} />
          </PageBoundary>
        )}
      </div>
      {shell.regions.bottom.map(bar)}
      {/* Here whatever the layout (a moved video frame reloads): shown above by its flex order. */}
      {part('playerBar', <PlayerBar hidden={shell.playerBarHidden} order={shell.order?.playerBar} />)}
      <PhoneTabs />
      <MiniPlayer />
      <VolumeHud />
      {arranging && (
        <PageBoundary fallback={null}>
          <ArrangeBar />
        </PageBoundary>
      )}
      {full && (
        <PageBoundary fallback={null}>
          <PageLayout.Provider value={nowPlayingPages}>
            <NowPlaying />
          </PageLayout.Provider>
        </PageBoundary>
      )}
      {karaoke && (
        <PageBoundary fallback={null}>
          <Karaoke />
        </PageBoundary>
      )}
      {vizFull && (
        <PageBoundary fallback={null}>
          <VizScreen />
        </PageBoundary>
      )}
      {coverFull && (
        <PageBoundary fallback={null}>
          <CoverScreen />
        </PageBoundary>
      )}
      {pip && (
        <PageBoundary fallback={null}>
          <PipScreen />
        </PageBoundary>
      )}
      {share && (
        <PageBoundary fallback={null}>
          <ShareDialog />
        </PageBoundary>
      )}
      {room && (
        <PageBoundary fallback={null}>
          <RoomDialog />
        </PageBoundary>
      )}
      {importing && (
        <PageBoundary fallback={null}>
          <ImportScreen />
        </PageBoundary>
      )}
      <Toasts />
      <Asker />
      <WebcamScan />
      <EditInfoHost />
      <CastHost />
      <CreditsHost />
      <ContextMenuHost fallback={appMenu} />
      <DuplicatesHost />
      {osk && (
        <PageBoundary fallback={null}>
          <OnScreenKeyboard />
        </PageBoundary>
      )}
      {blind && (
        <PageBoundary fallback={null}>
          <BlindTest />
        </PageBoundary>
      )}
      {incoming && (
        <PageBoundary fallback={null}>
          <ImportDialog key={incoming} code={incoming} />
        </PageBoundary>
      )}
      {welcome && (
        <PageBoundary fallback={null}>
          <Welcome onClose={() => setWelcome(false)} />
        </PageBoundary>
      )}
    </div>
  )
}
