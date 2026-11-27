import { FolderOpen, Gear, GithubLogo, Globe, Info, PuzzlePiece, SealCheck, Star, Warning, WarningCircle } from '@phosphor-icons/react'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../../app/store'
import { api, type PluginInfo, type PluginInspect } from '../../shared/api'
import { formatBytes } from '../../shared/format'
import { tr } from '../../shared/i18n/i18n'
import { ask } from '../../shared/ui/Ask'
import { Button } from '../../shared/ui/Button'
import { onMenu } from '../../shared/ui/ContextMenu'
import { RoundButton, Toggle } from '../../shared/ui/controls'
import { Dialog } from '../../shared/ui/Dialog'
import { pluginMenu } from '../menus'
import { loadPlugins, permissionText, usePlugins } from './host'
import { pluginLinks } from './pluginLinks'
import { PluginPanel } from './PluginPanel'
import { notifyError } from '../../app/notifyError'


function Permissions({ list, fresh }: { list: string[]; fresh?: string[] }) {
  if (!list.length) return <p className="text-[0.8125rem] text-ink-2">{tr('Nothing beyond its own storage.')}</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((p) => {
        const { text, risky, warning } = permissionText(p)
        return (
          <li key={p} className="flex items-start gap-2 text-[0.8125rem]">
            {risky ? <Warning size={15} className="mt-0.5 shrink-0 text-[#F0B232]" /> : <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-3" />}
            <span>
              {text}
              {fresh?.includes(p) && <span className="ms-1.5 rounded-full border border-line px-1.5 text-[0.625rem] text-ink-2">{tr('New')}</span>}
              {warning && <span className="block text-xs text-ink-2">{warning}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Who made it, and whether Rust found their signature on every file (docs/plugins.md › Verified). */
function Standing({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="flex items-center gap-1 font-medium text-ink-2">
      <SealCheck size={14} weight="fill" className="text-accent-ink" /> {tr('Verified')}
    </span>
  ) : (
    <>{tr('Not verified')}</>
  )
}

/** Before installing: who made it, what it can do. Nothing is copied or run until the user agrees. */
function Approve({ folder, onClose }: { folder: string; onClose: () => void }) {
  const [info, setInfo] = useState<PluginInspect>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api
      .pluginInspect(folder)
      .then(setInfo)
      .catch((e) => setError(String(e)))
  }, [folder])
  const install = async () => {
    setBusy(true)
    try {
      await api.pluginInstall(folder)
      await loadPlugins()
      useStore.getState().notify(tr('{name} installed and turned on', { name: info!.manifest.name }), { kind: 'ok' })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const m = info?.manifest
  return (
    <Dialog title={m ? m.name : tr('Install a plugin')} kicker={m ? (info.installed ? tr('Update {from} → {to}', { from: info.installed, to: m.version }) : tr('Plugin · version {version}', { version: m.version })) : undefined} onClose={onClose}>
      {!info && !error && <p className="text-sm text-ink-2">{tr('Reading the plugin…')}</p>}
      {m && (
        <>
          <p className="text-[0.8125rem] text-ink-2">{m.description || tr('No description.')}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            {info.verified ? (
              <>
                {m.author} · <Standing verified />
              </>
            ) : (
              <>
                <WarningCircle size={14} /> {tr('By {author} · not checked by the app’s developer', { author: m.author })}
              </>
            )}
          </p>
          <section className="flex flex-col gap-2">
            <h3 className="text-[0.8125rem] font-semibold">{tr('It will be able to:')}</h3>
            <Permissions list={m.permissions} fresh={info.installed ? info.newPermissions : undefined} />
          </section>
          <p className="text-xs text-ink-3">{tr('It runs apart from the app: no access to your files, passwords or accounts, and no internet except the sites listed. {files} files, {size}.', { files: info.files, size: formatBytes(info.size) })}</p>
        </>
      )}
      {error && <p className="text-sm text-[#F23F43]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {tr('Cancel')}
        </Button>
        <Button disabled={!m || busy} onClick={() => void install()}>
          {info?.installed ? tr('Update') : tr('Install')}
        </Button>
      </div>
    </Dialog>
  )
}

/** The words its maker put on it. */
function Tags({ list }: { list?: string[] }) {
  if (!list?.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {list.map((tag, index) => (
        <li key={index} className="rounded-full border border-line px-2 py-0.5 text-[0.6875rem] text-ink-2">
          {tag}
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[0.8125rem] font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** One plugin: what it is, who made it, its settings, what it may do, its log; Reset and its links at the bottom. */
function Details({ p, onClose }: { p: PluginInfo; onClose: () => void }) {
  const [log, setLog] = useState<string[]>([])
  useEffect(() => {
    const read = () => void api.pluginLog(p.id).then(setLog).catch(() => {})
    read()
    const id = setInterval(read, 2000)
    return () => clearInterval(id)
  }, [p.id])
  const m = p.manifest
  const name = m?.name ?? p.id
  const links = pluginLinks(m ?? {})
  const buttons = [
    { url: links.star, label: tr('Star on GitHub'), icon: <Star size={16} /> },
    { url: links.website, label: tr('Website'), icon: <Globe size={16} /> },
    { url: links.source, label: tr('Source code'), icon: <GithubLogo size={16} /> },
  ]
  const reset = async () => {
    if (!(await ask({ title: tr('Reset {name}?', { name }), body: tr('Its settings and everything it stored are erased.'), ok: tr('Reset') }))) return
    await api.pluginReset(p.id).then(loadPlugins).catch(notifyError)
  }
  return (
    <Dialog title={name} kicker={tr('Plugin')} onClose={onClose}>
      {m && (
        <>
          <p className="text-[0.8125rem] text-ink-2">{m.description}</p>
          <Tags list={m.tags} />
          <Section title={tr('Authors')}>
            <p className="flex items-center gap-2 text-[0.8125rem]">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-recess font-semibold uppercase">
                {[...m.author.trim()][0]}
              </span>
              {m.author}
              <span className="text-xs text-ink-3">
                <Standing verified={p.verified} />
              </span>
            </p>
          </Section>
        </>
      )}
      <Section title={tr('Settings')}>
        <PluginPanel plugin={p.id} />
      </Section>
      {m && (
        <Section title={tr('Allowed to:')}>
          <Permissions list={p.granted} />
        </Section>
      )}
      {p.error && <p className="text-xs text-[#F23F43]">{p.error}</p>}
      <Section title={tr('Log')}>
        <pre className="max-h-48 overflow-auto rounded-md bg-recess p-2 font-mono text-[0.6875rem] whitespace-pre-wrap text-ink-2">{log.length ? log.join('\n') : tr('Nothing yet.')}</pre>
      </Section>
      {m && <p className="text-xs text-ink-2">{tr('Version {version} · by {author} · plugin API {api}', { version: m.version, author: m.author, api: m.api })}</p>}
      <p className="text-[0.6875rem] break-all text-ink-3">{p.folder}</p>
      <div className="flex items-center gap-1">
        <Button className="bg-[#D83C3E]! text-white!" onClick={() => void reset()}>
          {tr('Reset')}
        </Button>
        <span className="flex-1" />
        {buttons.map(
          ({ url, label, icon }) =>
            url && (
              <RoundButton key={label} label={label} kind="plain" size="sm" onClick={() => void openUrl(url).catch(notifyError)}>
                {icon}
              </RoundButton>
            ),
        )}
      </div>
    </Dialog>
  )
}

function Card({ p, onDetails }: { p: PluginInfo; onDetails: () => void }) {
  const hasPanel = usePlugins((s) => !!s.panels[p.id]?.length)
  const name = p.manifest?.name ?? p.id
  return (
    <article onContextMenu={onMenu(() => pluginMenu(p, onDetails))} className="flex flex-col gap-2 rounded-xl border border-line bg-raised p-4">
      <div className="flex items-center gap-2">
        <PuzzlePiece size={16} className="text-ink-3" />
        <h3 className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold">{name}</h3>
        <RoundButton label={hasPanel ? tr('{name} settings', { name }) : tr('About {name}', { name })} kind="plain" size="xs" onClick={onDetails}>
          {hasPanel ? <Gear size={16} /> : <Info size={16} />}
        </RoundButton>
        <Toggle label={tr('Turn on {name}', { name })} checked={p.on} onChange={(on) => void api.pluginSet(p.id, on).then(loadPlugins).catch(notifyError)} />
      </div>
      <p className="text-xs leading-relaxed text-ink-2">{p.manifest?.description}</p>
      <Tags list={p.manifest?.tags} />
      {p.error && <p className="text-xs text-[#F23F43]">{p.error}</p>}
      <footer className="mt-auto flex items-center gap-2 border-t border-line-soft pt-2.5 text-[0.6875rem] text-ink-3">
        {!p.verified && <WarningCircle size={14} />}
        {p.manifest && `${p.manifest.author} · `}
        <Standing verified={p.verified} />
        <span className="flex-1" />
        {p.manifest && <span>v{p.manifest.version}</span>}
      </footer>
    </article>
  )
}

/** Add-ons › Plugins: third-party plugins installed from a folder. */
export function PluginsSection({ query }: { query: string }) {
  const list = usePlugins((s) => s.list)
  const [installing, setInstalling] = useState<string | null>(null)
  // The open one by its id: what the dialog shows stays current.
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const details = list.find((p) => p.id === detailsId)
  useEffect(() => void loadPlugins(), [])
  const q = query.trim().toLowerCase()
  const shown = list.filter((p) => !q || `${p.manifest?.name} ${p.manifest?.description} ${p.manifest?.author} ${p.manifest?.tags?.join(' ') ?? ''}`.toLowerCase().includes(q))
  const pick = async () => {
    const dir = await open({ directory: true, title: tr('The plugin’s folder (with legato.manifest)') })
    if (typeof dir === 'string') setInstalling(dir)
  }
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="kicker flex-1">{tr('Plugins')}</h2>
        <Button variant="ghost" onClick={() => void pick()}>
          <FolderOpen size={14} /> {tr('Install a plugin…')}
        </Button>
      </div>
      {shown.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {shown.map((p) => (
            <Card key={p.id} p={p} onDetails={() => setDetailsId(p.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.8125rem] text-ink-3">{list.length ? tr('No plugin matches.') : tr('Plugins made by others add features. Each asks before it can do anything, and runs apart from the app. How to write one: docs/plugins.md.')}</p>
      )}
      {installing && <Approve folder={installing} onClose={() => setInstalling(null)} />}
      {details && <Details p={details} onClose={() => setDetailsId(null)} />}
    </section>
  )
}
