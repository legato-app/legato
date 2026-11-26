import { MagnifyingGlass } from '@phosphor-icons/react'
import { useState } from 'react'
import { tr } from '../../shared/i18n/i18n'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PluginsSection } from '../plugins/PluginsSection'

export function AddonsView() {
  const [query, setQuery] = useState('')
  return (
    <>
      <PageHeader kicker={tr('Extras')} title={tr('Add-ons')} sub={tr('Extra features, off until you turn them on.')} />
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-8">
        <div className="flex flex-col gap-5">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-3 focus-within:border-ink-3">
            <MagnifyingGlass size={14} className="text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Search for an add-on…')} aria-label={tr('Search add-ons')} className="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-ink-3" />
          </label>
          <PluginsSection query={query} />
        </div>
      </div>
    </>
  )
}
