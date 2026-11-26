'use client'

import { Code, Devices, ShieldSlash, Sparkle } from '@phosphor-icons/react'
import { motion, type Variants } from 'motion/react'
import { useCopy } from './copy'
import { DeviceStill } from './DeviceScene'
import { Logo } from './Logo'
import { EASE } from './motion'

const rise: Variants = { hidden: { opacity: 0, y: '0.35em' }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } } }
// The band's icons, in `criteria`'s order (Figma « Landing concept »).
const CRITERIA_ICONS = [ShieldSlash, Devices, Sparkle, Code]

/**
 * The hero, as Figma's « Landing concept »: the app icon, the headline, the lead and the band of what holds on every
 * device. With motion, it stands over the 3D scene the scroll plays (Story.tsx, DeviceMove); without, the scene's still
 * sits in its flow.
 */
export function Hero() {
  const c = useCopy()
  return (
    <motion.div id="top" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="flex flex-col items-center gap-[clamp(12px,2.4vh,22px)] px-(--pad) pt-[clamp(32px,6vw,64px)] pb-10 text-center story:h-full story:pt-[calc(78px+min(4vh,48px))] story:pb-[clamp(16px,4vh,40px)]">
      <motion.div variants={rise}>
        <Logo className="size-[clamp(52px,9vh,96px)] drop-shadow-[0_10px_32px_rgb(124_184_255/0.45)]" />
      </motion.div>
      <h1 className="text-[clamp(40px,min(6.4vw,8.4vh),76px)] leading-[1.08] font-bold tracking-[-0.025em] text-balance">
        {c.hero.lines.map((line) => (
          <motion.span key={line} variants={rise} className="inline-block">
            {line}&nbsp;
          </motion.span>
        ))}
      </h1>
      <motion.p variants={rise} className="max-w-[700px] text-[clamp(16px,min(1.5vw,2.3vh),20px)] leading-[1.4] text-ink-2 text-balance">
        {c.hero.lead}
      </motion.p>
      <motion.div variants={rise} className="flex w-full justify-center story:hidden">
        <DeviceStill />
      </motion.div>
      <motion.ul variants={rise} className="flex flex-wrap justify-center gap-x-10 gap-y-2.5 text-[15px] font-medium story:mt-auto max-[600px]:grid max-[600px]:grid-cols-2 max-[600px]:gap-x-5 max-[600px]:text-left max-[600px]:text-[13px]">
        {c.hero.criteria.map((criterion, n) => {
          const Icon = CRITERIA_ICONS[n] ?? Sparkle
          return (
            <li key={criterion} className="flex items-center gap-2">
              <Icon aria-hidden size={18} className="shrink-0 text-accent" />
              {criterion}
            </li>
          )
        })}
      </motion.ul>
    </motion.div>
  )
}
