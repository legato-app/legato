/** The looks "Varied" mix covers pick among: 4 song covers, the first one, the numbered tile, the first one tinted. */
const MIX_STYLES = ['grid', 'single', 'template', 'tinted'] as const

/**
 * A mix's look under "Varied": the same every time for one mix id. Four numbered neighbours (daily-1 to daily-4)
 * never look alike: the hash moves with the last digit.
 */
export function coverStyleFor(mixId: string): (typeof MIX_STYLES)[number] {
  let hash = 0
  for (const char of mixId) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return MIX_STYLES[hash % MIX_STYLES.length]
}
