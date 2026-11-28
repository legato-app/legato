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

  it('leaves no style tag and no comment, however they are nested', () => {
    for (const nested of ['<sty<style>le>', '</sty</style>le>', '<<style>style>', '<STY<StYlE>LE>', '</st</styleyle>', '<sty/**/le>', '<sty@import;le>']) {
      expect(cleanCss(`.a{}${nested}`), nested).not.toMatch(/<\/?style/i)
    }
    for (const nested of ['/*/**/*/', '//**/* hidden */', '/*/*/**/', '/@import;* x */']) expect(cleanCss(`${nested}.a{}`), nested).not.toMatch(/\/\*[\s\S]*\*\//)
  })

  it('keeps a theme written before: queries, strings, pictures', () => {
    const theme = [
      ':root { --ink: #1d1d1f; --accent: #3aa0ff }',
      '@media (400px <= width < 900px) { .kicker { letter-spacing: 0.2em } }',
      '.crumb::after { content: "<" }',
      '.player > .title::before { content: "</>" }',
      '.cover { background: url(data:image/svg+xml;utf8,<svg/>) no-repeat }',
    ].join('\n')
    expect(cleanCss(theme)).toBe(theme)
  })

  it('reads an address however it is written, keeping data: pictures', () => {
    const outside = ['a{background:url(https://x.example/a)}', 'a{background:\\75 rl(http://art.localhost/x)}', 'a{background:u\\r\\l(https://x.example/a)}', 'a{background:image-set("http://art.localhost/x" 1x)}', 'a{background:-webkit-image-set("https://x.example/a" 1x)}', '@font-face{font-family:f;src:\\75rl("http://art.localhost/y")}']
    for (const css of outside) expect(cleanCss(css), css).not.toMatch(/https?:/)
    for (const kept of ['a{background:image-set(url(data:image/png;base64,AA) 1x)}', 'a{background:image-set("data:image/png;base64,AA" type("image/png") 1x)}', '.a::after{content:"\\201C \\2014"}']) expect(cleanCss(kept), kept).toBe(kept)
  })

  it('gives nothing for text that never settles', () => {
    const nested = '@im'.repeat(50) + '@import;' + 'port;'.repeat(50)
    expect(cleanCss(nested)).toBe('')
  })
})
