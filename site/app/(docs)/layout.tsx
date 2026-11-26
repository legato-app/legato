import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { roboto } from '@/components/page'
import './docs.css'

export { VIEWPORT as viewport } from '@/components/page'

// The docs: English in every language; the English root's send-off to the visitor's language never runs here.
export const metadata: Metadata = {
  metadataBase: new URL('https://legato-app.github.io'),
  title: { default: 'Legato docs', template: '%s · Legato docs' },
  description: 'Install, import, sync and share with Legato; the architecture, plugins, themes and how to build and contribute.',
}

// next.config.ts' base path: a plain fetch doesn't get it by itself.
const searchIndex = `${process.env.NODE_ENV === 'production' ? '/legato' : ''}/api/search`

/** html and body of the docs, apart from the languages' pages: Fumadocs and its styles stay here. */
export default function DocsRoot({ children }: { children: ReactNode }) {
  return (
    // The theme's class is set before the first paint, on the client alone.
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: 'static', api: searchIndex } }} theme={{ hotKey: false }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
