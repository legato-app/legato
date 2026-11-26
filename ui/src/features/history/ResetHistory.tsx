import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { useStore } from '../../app/store'
import { api } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { ask } from '../../shared/ui/Ask'
import { Button } from '../../shared/ui/Button'

/** Forgets the listening history, after saying what goes with it (Mixes and History). */
export function ResetHistory({ onDone }: { onDone: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        if (!(await ask({ title: tr('Forget your listening history?'), body: `${tr('Your plays and “less / never” choices go; mixes start over. Your library stays as it is.')}\n${tr('Copies of the library made before updates keep the history until they’re replaced.')}`, ok: tr('Forget') }))) return
        await api.clearHistory().catch((e) => useStore.setState({ error: String(e) }))
        onDone()
      }}
    >
      <ArrowCounterClockwise size={14} /> {tr('Reset history')}
    </Button>
  )
}
