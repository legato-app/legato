import { useLayoutEffect, useRef } from 'react'
import { fitSize } from './fitSize'

/**
 * A song's name, whole: at the size its classes give while it holds in two lines, else smaller by just enough (a long
 * word too). Down to `floor` px, then it takes the lines it needs. Never cut.
 */
export function FitTitle({ title, floor, className }: { title: string; floor: number; className: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const element = heading.current!
    const fit = () => {
      // Measured unbroken: a word wider than the line shrinks the name rather than being split.
      element.style.fontSize = ''
      element.style.overflowWrap = 'normal'
      const size = fitSize(parseFloat(getComputedStyle(element).fontSize), floor, (candidate) => {
        element.style.fontSize = `${candidate}px`
        const style = getComputedStyle(element)
        const height = element.offsetHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        // "normal" parses to no number.
        const lineHeight = parseFloat(style.lineHeight) || 1.1 * candidate
        return element.scrollWidth <= element.clientWidth && height <= 2 * lineHeight + 1
      })
      element.style.fontSize = `${size}px`
      element.style.overflowWrap = 'anywhere'
    }
    fit()
    // Measured again with the real font, should it come in after.
    let mounted = true
    void document.fonts.ready.then(() => mounted && fit())
    // Again when the room changes, not when only the height does (ours).
    let width = element.clientWidth
    const watch = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      fit()
    })
    watch.observe(element)
    return () => {
      mounted = false
      watch.disconnect()
    }
  }, [title, floor, className])
  return (
    <h2 ref={heading} className={className}>
      {title}
    </h2>
  )
}
