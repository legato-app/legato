import { create } from 'zustand'
import { useStore } from '../../app/store'
import { api, type PluginCall, type PluginInfo } from '../../shared/api'
import { useBlind } from '../blind/blindOpen'
import { tr } from '../../shared/i18n/i18n'
import { setEffects, useEditor } from '../editor/editor'
import { cleanEffects } from '../player/effects'
import { onListenEnd } from '../player/listens'
import { seekListeners, usePlayer } from '../player/store'
import { cleanLookName, cleanOps } from './drawList'
import { cleanCommand, cleanCss, cleanTree, type PanelNode, type PluginCommand } from './panel'
import { usePluginViz } from './pluginViz'
import { pluginQueue, pluginTrack } from './shapes'

/**
 * Plugins in the interface: installed list, what each running one added (menu items, panel, style), and the calls
 * they make that the interface answers (player, playlists, menus, panel, style, Live Editor). Permissions are checked
 * in Rust before a call gets here.
 */
interface PluginsState {
  list: PluginInfo[]
  commands: Record<string, PluginCommand[]>
  panels: Record<string, PanelNode[]>
  styles: Record<string, string>
}

export const usePlugins = create<PluginsState>(() => ({ list: [], commands: {}, panels: {}, styles: {} }))

const MAX_COMMANDS = 20

export async function loadPlugins() {
  const list = await api.plugins().catch(() => [])
  const live = new Set(list.filter((p) => p.running).map((p) => p.id))
  // Stopped ones leave nothing behind.
  const keep = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([id]) => live.has(id)))
  usePlugins.setState((s) => ({ list, commands: keep(s.commands), panels: keep(s.panels), styles: keep(s.styles) }))
  usePluginViz.setState((s) => ({ looks: keep(s.looks), ops: keep(s.ops) }))
}

export const pluginName = (id: string) => usePlugins.getState().list.find((p) => p.id === id)?.manifest?.name ?? id

/** Menu items plugins added for this place. */
export function pluginCommands(where: PluginCommand['where'][number]): { plugin: string; command: PluginCommand }[] {
  return Object.entries(usePlugins.getState().commands).flatMap(([plugin, list]) => list.filter((c) => c.where.includes(where)).map((command) => ({ plugin, command })))
}

export const runCommand = (plugin: string, id: string, context: unknown) => void api.pluginInput(plugin, 'command', { id, context }).catch(() => {})

const nowTrack = () => {
  const { now, durationMs } = usePlayer.getState()
  return now ? pluginTrack(now, useStore.getState().tracks.find((t) => t.id === now.trackId), durationMs) : null
}

/** Library songs for the ids a plugin sent, in its order; unknown ones left out. */
function librarySongs(ids: unknown) {
  const wanted = Array.isArray(ids) ? ids.filter((x): x is number => Number.isInteger(x)).slice(0, 500) : []
  const byId = new Map(useStore.getState().tracks.map((t) => [t.id, t]))
  return wanted.map((id) => byId.get(id)).filter((t) => !!t)
}

/** The queue as plugins hear of it: at most once in this long. */
const QUEUE_EVERY_MS = 500

async function answer(c: PluginCall): Promise<unknown> {
  const p = usePlayer.getState()
  const a = c.args
  const commands = (f: (l: PluginCommand[]) => PluginCommand[]) => usePlugins.setState((s) => ({ commands: { ...s.commands, [c.plugin]: f(s.commands[c.plugin] ?? []) } }))
  switch (c.method) {
    case 'player.state':
      return { track: nowTrack(), playing: p.playing, positionMs: Math.round(p.positionMs), durationMs: p.durationMs, volume: p.volume }
    case 'player.queue':
      return pluginQueue(p.list, p.order, p.index)
    case 'player.enqueue': {
      const songs = librarySongs(a.ids)
      if (!songs.length) throw new Error('No such songs in the library')
      return p.enqueue(songs, a.next === true)
    }
    case 'player.play':
      if (!p.playing) p.toggle()
      return null
    case 'player.pause':
      if (p.playing) p.toggle()
      return null
    case 'player.toggle':
      return p.toggle()
    case 'player.next':
      return p.step(1)
    case 'player.previous':
      return p.step(-1)
    case 'player.seek':
      return p.seek(Math.max(0, Number(a.ms) || 0))
    case 'player.volume':
      return p.setVolume(Math.min(1, Math.max(0, Number(a.value) || 0)))
    case 'player.playTracks': {
      const ids = Array.isArray(a.ids) ? a.ids.filter((x): x is number => Number.isInteger(x)) : []
      const byId = new Map(useStore.getState().tracks.map((t) => [t.id, t]))
      const list = ids.map((i) => byId.get(i)).filter((t) => !!t)
      if (!list.length) throw new Error('No such songs in the library')
      return p.playTracks(list, Math.min(list.length - 1, Math.max(0, Number(a.start) || 0)))
    }
    case 'playlists.create': {
      const id = await api.editPlaylist({ type: 'create', name: String(a.name ?? '').slice(0, 200) })
      await useStore.getState().refreshChanged()
      return id
    }
    case 'playlists.add': {
      const trackIds = Array.isArray(a.trackIds) ? a.trackIds.filter((x): x is number => Number.isInteger(x)) : []
      await api.editPlaylist({ type: 'add', id: Number(a.id), trackIds })
      await useStore.getState().refreshChanged()
      return null
    }
    case 'ui.notify':
      // Named: a plugin can't pass for the app.
      useStore.getState().notify(`${pluginName(c.plugin)}: ${String(a.text ?? '').slice(0, 200)}`, { kind: 'info' })
      return null
    case 'ui.addCommand': {
      const cmd = cleanCommand(a)
      if (!cmd) throw new Error('A command needs an id and a title')
      commands((l) => [...l.filter((x) => x.id !== cmd.id), cmd].slice(0, MAX_COMMANDS))
      return null
    }
    case 'ui.removeCommand':
      commands((l) => l.filter((x) => x.id !== a.id))
      return null
    case 'ui.setPanel':
      usePlugins.setState((s) => ({ panels: { ...s.panels, [c.plugin]: cleanTree(a.tree) } }))
      return null
    case 'ui.setStyle':
      usePlugins.setState((s) => ({ styles: { ...s.styles, [c.plugin]: cleanCss(a.css) } }))
      return null
    case 'editor.get':
      return useEditor.getState().effects
    case 'editor.set':
      setEffects(cleanEffects(a.effects))
      return null
    case 'visualizer.register':
      usePluginViz.setState((s) => ({ looks: { ...s.looks, [c.plugin]: cleanLookName(a.name, pluginName(c.plugin)) } }))
      return null
    case 'visualizer.draw':
      usePluginViz.setState((s) => ({ ops: { ...s.ops, [c.plugin]: cleanOps(a.list) } }))
      return null
  }
  throw new Error(`Unknown method: ${c.method}`)
}

/** Each plugin's CSS in its own <style>, as text. */
function syncStyles(styles: Record<string, string>) {
  const have = new Map([...document.querySelectorAll<HTMLStyleElement>('style[data-plugin]')].map((el) => [el.dataset.plugin!, el]))
  for (const [id, css] of Object.entries(styles)) {
    let el = have.get(id)
    if (!el) {
      el = document.createElement('style')
      el.dataset.plugin = id
      document.head.appendChild(el)
    }
    if (el.textContent !== css) el.textContent = css
    have.delete(id)
  }
  for (const el of have.values()) el.remove()
}

/** Mounted once: answers plugins, tells them what plays, keeps their styles on the page. Returns cleanup. */
export function startPlugins(): () => void {
  void loadPlugins()
  const calls = api.onPluginCall((c) => {
    // A note (id 0, the visualizer's drawings): nothing waits for an answer.
    if (c.id === 0) {
      void answer(c).catch(() => {})
      return
    }
    answer(c)
      .then((v) => api.pluginReply(c.plugin, c.id, true, v ?? null))
      .catch((e) => api.pluginReply(c.plugin, c.id, false, undefined, e instanceof Error ? e.message : String(e)))
      .catch(() => {})
  })
  const states = api.onPluginState(() => void loadPlugins())
  const offStyles = usePlugins.subscribe((s, prev) => s.styles !== prev.styles && syncStyles(s.styles))
  const listening = () => usePlugins.getState().list.some((p) => p.running)
  const tell = (name: Parameters<typeof api.pluginEvent>[0], payload: unknown) => void (listening() && api.pluginEvent(name, payload).catch(() => {}))
  const offEnded = onListenEnd((play) => tell('ended', { trackId: play.trackId, listenedMs: play.listenedMs, completed: play.completed }))
  const seeked = (ms: number) => tell('seek', { positionMs: Math.max(0, Math.round(ms)) })
  seekListeners.add(seeked)
  // A blind test: Rust holds back what plays; once it closes, plugins are told how the player stands.
  void api.pluginQuiz(useBlind.getState().open).catch(() => {})
  const offQuiz = useBlind.subscribe((quiz, before) => {
    if (quiz.open === before.open) return
    void api.pluginQuiz(quiz.open).catch(() => {})
    if (quiz.open) return
    const { playing, list, order, index } = usePlayer.getState()
    tell('track', nowTrack())
    tell('playing', playing)
    tell('queue', pluginQueue(list, order, index))
  })
  let queueTimer: ReturnType<typeof setTimeout> | undefined
  const offPlayer = usePlayer.subscribe((s, prev) => {
    if (!listening()) return
    if (s.volume !== prev.volume) tell('volume', { volume: s.volume })
    // Several changes in a row: one event, with the queue as it is then.
    if ((s.list !== prev.list || s.order !== prev.order || s.index !== prev.index) && queueTimer === undefined)
      queueTimer = setTimeout(() => {
        queueTimer = undefined
        const { list, order, index } = usePlayer.getState()
        tell('queue', pluginQueue(list, order, index))
      }, QUEUE_EVERY_MS)
    if (s.now !== prev.now && (s.now?.title !== prev.now?.title || s.now?.trackId !== prev.now?.trackId)) void api.pluginEvent('track', nowTrack()).catch(() => {})
    if (s.playing !== prev.playing) void api.pluginEvent('playing', s.playing).catch(() => {})
  })
  return () => {
    void calls.then((f) => f())
    void states.then((f) => f())
    offStyles()
    offPlayer()
    offQuiz()
    offEnded()
    seekListeners.delete(seeked)
    clearTimeout(queueTimer)
    syncStyles({})
  }
}

/** Permission → what it lets a plugin do, for the approval dialog. */
export function permissionText(p: string): { text: string; risky: boolean; warning?: string } {
  if (p.startsWith('network:')) return { text: tr('Send and receive data from {host} (it can send there what it can read)', { host: p.slice(8) }), risky: true }
  switch (p) {
    case 'discord:presence':
      return { text: tr('Show what you play on Discord'), risky: true, warning: tr('Can show any text and links on your Discord profile, through the Discord app on this PC') }
    case 'player:queue':
      return { text: tr('See the play queue'), risky: false }
    case 'history:read':
      return { text: tr('Read your listening history'), risky: true, warning: tr('Sees what you listened to and when') }
    case 'player:read':
      return { text: tr('See what plays and when it changes'), risky: false }
    case 'player:control':
      return { text: tr('Play, pause, skip and choose songs'), risky: false }
    case 'library:read':
      return { text: tr('Read your songs and playlists'), risky: false }
    case 'library:write':
      return { text: tr('Make playlists and add songs to them'), risky: false }
    case 'ui':
      return { text: tr('Add menu items, a panel and notifications'), risky: false }
    case 'ui:style':
      return { text: tr('Restyle the whole interface'), risky: true }
    case 'editor':
      return { text: tr('Read and change the Live Editor’s settings'), risky: false }
    case 'visualizer':
      return { text: tr('Draw a look for the visualizer from the music’s levels'), risky: false }
  }
  return { text: p, risky: true }
}
