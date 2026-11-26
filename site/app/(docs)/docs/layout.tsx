import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import type { ReactNode } from 'react'
import { DISCORD, GITHUB } from '@/components/content'
import { Logo } from '@/components/Logo'
import { source } from '@/lib/source'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        // data-brand: the name and the logo stay as they are (docs/design.md).
        title: (
          <span data-brand className="flex items-center gap-2 text-lg font-black tracking-[-0.02em]">
            <Logo className="size-6" />
            Legato
          </span>
        ),
        url: '/docs',
      }}
      links={[
        { text: 'Back to the website', url: '/' },
        { text: 'Discord', url: DISCORD, external: true },
      ]}
      githubUrl={GITHUB}
      // Light or dark follows the system, as on the rest of the site.
      themeSwitch={{ enabled: false }}
    >
      {children}
    </DocsLayout>
  )
}
