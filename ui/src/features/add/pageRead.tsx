import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { SpotifyList, SpotifyPick } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { readStored, writeStored } from '../../shared/stored'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { ListPick } from './ListPick'

/**
 * Reading a service's own page (Spotify's, Apple Music's): its rules said once on this PC, the sign-in on its page,
 * the lists read, then ticked. The steps and dialogs both connect buttons share.
 */
export type PageStep = 'rules' | 'sign-in' | 'reading' | 'pick'

/** Where reading the page starts: its sign-in, after its rules once. */
export const firstPageStep = (rulesKey: string): 'rules' | 'sign-in' => (readStored<number>(rulesKey, 0) === 1 ? 'sign-in' : 'rules')

/** Drives the sign-in and the reading while `step` is one of them. `found` takes the lists read. */
export function usePageRead<Step extends string>(step: Step | PageStep | undefined, setStep: Dispatch<SetStateAction<Step | PageStep | undefined>>, site: { open: () => Promise<unknown>; signedIn: () => Promise<boolean>; read: () => Promise<SpotifyList[]>; found: (lists: SpotifyList[]) => void; fail: (error: unknown) => void }) {
  const signIn = () => {
    setStep('sign-in')
    site.open().catch(site.fail)
  }

  // The session cookie is the sign-in's end (the window stays: it reads next).
  useEffect(() => {
    if (step !== 'sign-in') return
    const id = setInterval(() => {
      void site.signedIn().then((on) => on && setStep((now) => (now === 'sign-in' ? 'reading' : now)), () => {})
    }, 1500)
    return () => clearInterval(id)
  }, [step])

  useEffect(() => {
    if (step !== 'reading') return
    let live = true
    site.read().then(
      (lists) => {
        if (live) site.found(lists)
      },
      (error) => {
        if (live) site.fail(error)
      },
    )
    return () => {
      live = false
    }
  }, [step])

  return signIn
}

/** The dialogs of the steps above; each service gives its own words. */
export function PageReadDialogs({ step, rulesKey, words, lists, signIn, start, close }: { step: string | undefined; rulesKey: string; words: { title: string; reads: string; rules: string; signIn: string; reading: string; pick: string }; lists: SpotifyList[]; signIn: () => void; start: (picks: SpotifyPick[]) => void; close: () => void }) {
  if (step === 'rules')
    return (
      <Dialog title={tr('Before you connect')} onClose={close}>
        <p className="text-sm text-ink-2">{words.reads}</p>
        <p className="text-sm text-ink-2">{words.rules}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {tr('Cancel')}
          </Button>
          <Button
            onClick={() => {
              // Not kept: said again next time.
              writeStored(rulesKey, 1)
              signIn()
            }}
          >
            {tr('I understand, continue')}
          </Button>
        </div>
      </Dialog>
    )
  if (step === 'sign-in' || step === 'reading')
    return (
      <Dialog title={words.title} onClose={close}>
        <p role="status" className="text-sm text-ink-2">
          {step === 'sign-in' ? words.signIn : words.reading}
        </p>
      </Dialog>
    )
  return step === 'pick' ? <ListPick title={words.pick} lists={lists} onClose={close} onStart={start} /> : null
}
