import { expect, it } from 'vitest'
import { pluginLinks } from './pluginLinks'

it('offers a star only for a repository on GitHub', () => {
  expect(pluginLinks({ homepage: 'https://example.com', repository: 'https://github.com/a/b' })).toEqual({ star: 'https://github.com/a/b', website: 'https://example.com', source: 'https://github.com/a/b' })
  for (const repository of ['https://github.com.evil.example/a', 'https://example.com/github.com', 'not a link']) expect(pluginLinks({ repository }).star).toBeUndefined()
  expect(pluginLinks({})).toEqual({ star: undefined, website: undefined, source: undefined })
})
