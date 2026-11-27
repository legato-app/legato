import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CopyField } from './CopyField'

it('shows the value beside its Copy button', () => {
  expect(renderToStaticMarkup(createElement(CopyField, { value: 'LG1:abc' }))).toMatch(/LG1:abc<\/code><button.*Copy/)
})
