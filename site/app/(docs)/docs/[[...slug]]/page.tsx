import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import defaultComponents from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OldAnchors } from '@/components/OldAnchors'
import { source } from '@/lib/source'

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug)
  if (!page) notFound()
  const Content = page.data.body
  return (
    <DocsPage toc={page.data.toc}>
      {!page.slugs.length && <OldAnchors />}
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Content components={defaultComponents} />
      </DocsBody>
    </DocsPage>
  )
}

// A static export: every page is made at build, no other exists.
export const dynamicParams = false
export const generateStaticParams = () => source.generateParams()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug)
  if (!page) notFound()
  // The front page is already named after the docs.
  return { title: page.slugs.length ? page.data.title : { absolute: page.data.title }, description: page.data.description, alternates: { canonical: `/legato${page.url.replace(/\/?$/, '/')}` } }
}
