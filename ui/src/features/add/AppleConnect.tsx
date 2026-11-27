import { AppleLogo } from '@phosphor-icons/react'
import { useState } from 'react'
import { useStore } from '../../app/store'
import { api, type SpotifyList, type SpotifyPick } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { Button } from '../../shared/ui/Button'
import { Card } from './Card'
import { firstPageStep, PageReadDialogs, usePageRead, type PageStep } from './pageRead'

// Apple's terms: said once on this PC, before its page is first read.
const AGREED = 'apple-rules-read'

/**
 * Apple Music's playlists, Favorite Songs included (user's choice 2026-10-31): Apple's own page in a window, the user
 * signs in there, its playlists are read (against Apple's terms, the dialog says so; src-tauri/src/apple_web.rs) and
 * ticked here, each song then found on YouTube. Its button goes where Spotify's does: Add music, Settings › Accounts.
 */
export function AppleImport({ label, className }: { label: string; className?: string }) {
  const [step, setStep] = useState<PageStep>()
  const [lists, setLists] = useState<SpotifyList[]>([])

  const close = () => {
    setStep(undefined)
    void api.appleWebClose().catch(() => {})
  }
  const fail = (e: unknown) => {
    close()
    useStore.setState({ error: String(e) })
  }
  const signIn = usePageRead<never>(step, setStep, {
    open: api.appleWebOpen,
    signedIn: api.appleWebStatus,
    read: api.appleLists,
    found: (found) => {
      if (!found.length) return fail(tr('No playlists were found in your Apple Music library.'))
      setLists(found)
      setStep('pick')
    },
    fail,
  })

  const start = (picks: SpotifyPick[]) => {
    setStep(undefined)
    void useStore.getState().importSpotifyLists(() => api.appleImport(picks), 'apple')
  }

  return (
    <>
      <Button className={className} onClick={() => (firstPageStep(AGREED) === 'rules' ? setStep('rules') : signIn())}>
        {label}
      </Button>
      <PageReadDialogs
        step={step}
        rulesKey={AGREED}
        words={{
          title: tr('Connect Apple Music'),
          reads: tr('Legato opens Apple Music’s own page and reads your playlists as they appear on it. Your password stays with Apple, and each song is then found on YouTube.'),
          rules: tr('Apple’s terms forbid reading its services with an automated tool. We know of no account closed for it, but we can’t rule it out: the choice is yours.'),
          signIn: tr('Sign in on Apple Music’s page. The next step comes by itself.'),
          reading: tr('Reading your playlists on Apple Music…'),
          pick: tr('Your Apple Music playlists'),
        }}
        lists={lists}
        signIn={signIn}
        start={start}
        close={close}
      />
    </>
  )
}

export function AppleConnect() {
  return (
    <Card icon={AppleLogo} title={tr('Connect Apple Music')} sub={tr('Import your Apple Music playlists, Favorite Songs included.')}>
      <AppleImport className="mt-auto self-start" label={tr('Connect')} />
    </Card>
  )
}
