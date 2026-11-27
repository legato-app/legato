import { Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'
import { tr } from '../shared/i18n/i18n'
import { Button } from '../shared/ui/Button'
import { notifyError } from './notifyError'

/** A value and its Copy button, which says "Copied" for a moment; a refused clipboard says why. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => void navigator.clipboard.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), notifyError)
  return (
    <div className="flex h-10.5 items-center gap-2.5 rounded-[9px] border border-line bg-raised pe-1.5 ps-3">
      <code className="flex-1 truncate font-mono text-[0.6875rem]">{value}</code>
      <Button variant="ghost" className="px-2.5! py-1! text-[0.6875rem]" onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? tr('Copied') : tr('Copy')}
      </Button>
    </div>
  )
}
