// Release notes from commit subjects. Shared by scripts/release.mjs (every beta: the commits since the previous release)
// and scripts/promote.mjs (a Stable: everything since the previous Stable), so both say it the same way. Every line goes
// in, grouped (the owner's rule, 2026-11-05: no "And 39 more").
/** Sections in the order shown. The app reads these headers and says them in the user's language (`features/update/notes.ts`). */
const KINDS = [
  ['feat', 'Added'],
  ['fix', 'Fixed'],
  ['perf', 'Performance improved'],
]
/** Scopes whose changes nobody meets in the app: the website (2026-11-01: a beta's card listed the scroll story's six),
 *  the repository's own tools, and Linux until a release carries it. */
const HIDDEN_SCOPES = new Set(['site', 'ci', 'test', 'e2e', 'release', 'promote', 'scripts', 'bench', 'dev', 'build', 'deps', 'types', 'linux'])
/** Words only a developer reads: a subject carrying one stays out. */
const DEVELOPER_WORDS = /__\w+__|\.(?:ts|tsx|rs|mjs|yml|toml)\b|\bpnpm\b|\bcargo\b|\bclippy\b|\bCI\b|\bcompile error\b|\bthe tests\b/
/** Subjects already in the history that tell the code's inner workings in plain words. */
const INTERNAL_SUBJECTS = new Set([
  'the Lite edition in the shell, its own identifier and update feed',
  "Legato Lite's interface leaves out what it cuts, from one table",
  'Legato Lite builds without its cut commands, plugins, internet rooms and Music Detector',
  "Lite's interface never calls the visualizer stream or draws the Discord account",
  'the event names stay in the api call, not a hand-written type',
  // Rearrange's first slice: helpers only, nothing to see in the app until its screen lands.
  "the moves of a rearranged layout, within the theme rules, written back as a theme's layout",
])
/** "feat(player): smoother fades" → "Smoother fades" under "### Added". Other kinds (docs, ci, chore…) left out, and what
 *  only the code's readers care about (above): the update card is the app's. */
export function notesFrom(subjects) {
  const items = subjects
    .map((s) => /^(feat|fix|perf)(?:\(([^)]*)\))?!?:\s*(.+)$/.exec(s.trim()))
    .filter((m) => m && !HIDDEN_SCOPES.has(m[2]) && !DEVELOPER_WORDS.test(m[3]) && !INTERNAL_SUBJECTS.has(m[3]))
    .map(([, kind, , s]) => ({ kind, line: `- ${s[0].toUpperCase()}${s.slice(1)}` }))
  if (!items.length) return 'Small fixes and improvements.'
  const out = KINDS.flatMap(([kind, title]) => {
    const lines = items.filter((i) => i.kind === kind).map((i) => i.line)
    return lines.length ? [`### ${title}`, ...lines, ''] : []
  })
  return out.join('\n').trim()
}
