import { expect, it } from 'vitest'
import { remarkRepoDocs, repositoryLink } from './repoDocs'

it('turns a repository link into its GitHub address, from where the document lives', () => {
  const blob = 'https://github.com/legato-app/legato/blob/master/'
  expect(repositoryLink('rooms.md', 'docs/architecture.md')).toBe(`${blob}docs/rooms.md`)
  expect(repositoryLink('../examples/plugins/rings', 'docs/plugins.md')).toBe(`${blob}examples/plugins/rings`)
  expect(repositoryLink('docs/development.md', 'CONTRIBUTING.md')).toBe(`${blob}docs/development.md`)
  for (const link of ['https://pnpm.io', '#versions', '/docs/', 'mailto:a@example.com']) expect(repositoryLink(link, 'CONTRIBUTING.md')).toBe(link)
})

it('drops the included document’s title, on those pages only', () => {
  const tree = () => ({ type: 'root' as const, children: [{ type: 'heading' as const, depth: 1 as const, children: [] }, { type: 'paragraph' as const, children: [{ type: 'link' as const, url: 'LICENSE', children: [] }] }] })
  const included = tree()
  remarkRepoDocs()(included, { path: 'C:\\site\\content\\docs\\developers\\contribute.mdx' })
  expect(included.children).toHaveLength(1)
  expect(JSON.stringify(included)).toContain('/blob/master/LICENSE')
  const own = tree()
  remarkRepoDocs()(own, { path: '/site/content/docs/using/install.mdx' })
  expect(own).toEqual(tree())
})
