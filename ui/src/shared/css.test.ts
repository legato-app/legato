import { describe, expect, it } from 'vitest'
import { cleanCss } from './css'

describe('cleanCss', () => {
  it('holds when a removal joins banned pieces back', () => {
    expect(cleanCss('</st</styleyle>.a{}')).not.toMatch(/<\/?style/i)
    expect(cleanCss('.a{background:urexpression(l(https://evil.example/x)}')).not.toMatch(/url\(/i)
    expect(cleanCss('@im@import;port "https://evil.example/x.css";.a{}')).toBe('.a{}')
    expect(cleanCss('/@import;* hidden */.a{}')).toBe('.a{}')
  })

  it('leaves a normal theme as it is', () => {
    const theme = ':root { --ink: #123 } .a { background: url(data:image/png;base64,AA); color: var(--ink) }'
    expect(cleanCss(theme)).toBe(theme)
  })

  it('gives nothing for text that never settles', () => {
    const nested = '@im'.repeat(50) + '@import;' + 'port;'.repeat(50)
    expect(cleanCss(nested)).toBe('')
  })
})
