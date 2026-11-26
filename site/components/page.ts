import type { Viewport } from 'next'
import localFont from 'next/font/local'

/** What every root layout shares, the docs' too: no style sheet comes with it. */
// Served from here (OFL, public/roboto-LICENSE.txt): no font host sees the visitors.
export const roboto = localFont({ src: '../app/fonts/roboto.woff2', weight: '100 900', variable: '--font-roboto', display: 'swap' })

export const VIEWPORT: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131313' },
  ],
}
