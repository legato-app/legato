import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { oldAnchor } from './oldAnchor'
import { INCLUDED } from './repoDocs'

const docs = fileURLToPath(new URL('../content/docs', import.meta.url))
const repository = fileURLToPath(new URL('../..', import.meta.url))

/** Every folder of the docs, the root first. */
const folders = (folder: string): string[] => [folder, ...readdirSync(folder).map((name) => join(folder, name)).filter((path) => statSync(path).isDirectory()).flatMap(folders)]

it('each folder’s meta.json lists exactly its pages and folders', () => {
  for (const folder of folders(docs)) {
    const { pages } = JSON.parse(readFileSync(join(folder, 'meta.json'), 'utf8')) as { pages: string[] }
    const there = readdirSync(folder).filter((name) => name !== 'meta.json').map((name) => name.replace(/\.mdx$/, ''))
    expect([...pages].sort(), folder).toEqual(there.sort())
  }
})

it('each included document exists, and is the one its links are read from', () => {
  for (const [name, document] of Object.entries(INCLUDED)) {
    const page = join(docs, 'developers', name)
    const included = [...readFileSync(page, 'utf8').matchAll(/<include>(.*?)<\/include>/g)].map((found) => resolve(dirname(page), found[1]))
    expect(included, name).toEqual([resolve(repository, document)])
    expect(existsSync(included[0]), document).toBe(true)
  }
})

it('a change to an included document builds the site again', () => {
  const workflow = readFileSync(join(repository, '.github/workflows/pages.yml'), 'utf8')
  const paths = /^\s*paths: \[([^\]]*)\]/m.exec(workflow)![1].split(', ')
  expect(paths.filter((path) => path.endsWith('.md')).sort()).toEqual(Object.values(INCLUDED).sort())
  expect(paths).not.toContain('docs/**')
})

it('each old section has its page', () => {
  for (const section of ['install', 'first-steps', 'import', 'sync', 'share', 'stream-deck', 'shortcuts', 'architecture', 'plugins', 'themes', 'build', 'contribute']) {
    const page = oldAnchor(`#${section}`)!.replace(/^\/docs\/|\/$/g, '')
    expect(existsSync(join(docs, `${page}.mdx`)), section).toBe(true)
  }
})
