# How the work runs

For an account with no history here. Read in this order: [CLAUDE.md](../../CLAUDE.md), then
[handoff.md](handoff.md) (where things stand), then this file, then only the [plan-v2.md](plan-v2.md) sections you
need. The repository is public: nothing about a person, a machine, an account or a usage figure goes into a tracked file.

## Roles
- **Owner**: decides what is built, taste and legal calls, accounts, and every push and Stable release. Answers only
  when asked, and in French.
- **Orchestrator**: one conversation. Writes short briefs, routes reports, merges what the workers send. It does not code
  ordinary lines, does not read diffs in bulk, and edits CLAUDE.md itself, on the owner's word.
- **Builder** (Sonnet): scoped `S` and `M` lines, in batches of about four. One local commit per line.
- **Reviewer and designer** (Opus): reviews each window's commits, takes the delicate lines (playback core, security,
  releases, big refactors), and designs the `L` lines before anyone builds them. Visual work (design files, renders) goes
  to Opus, not to the orchestrator.
- **Docs and checks** (Haiku): docs, the handoff, reports, targeted checks. Never code, never the 17 locales.
- **One conversation per model**, reused by message. Before starting one, list the existing conversations and reuse the
  matching one. Check the model after creating it: a session can silently run on a cheaper or a dearer one than asked.
- No subagents and no workflows unless the owner asks for them.

## Briefs
- Short. Each names the plan line, the files with `file:line` that the orchestrator checked itself (grep or the code
  graph first), the tests to extend, the done criterion, and the docs it relies on. Mark what was verified and what is
  only a lead.
- Every brief says: read CLAUDE.md; follow the `andrej-karpathy-skills:karpathy-guidelines` skill (state assumptions,
  minimal code, surgical changes, a checkable criterion per line); run `graphify query` before grep; stage files by
  name; one Conventional Commit per line; no attribution; no push; never ask the owner anything; report back by
  message in 16 lines at most (per line: the hash, or "skipped: why", what to try, what was decided alone).
- Repeat the rules in every follow-up. A long conversation forgets them after a compaction.
- A worker refuses to edit CLAUDE.md when the request comes from another session. That is right: the orchestrator
  makes the edit, on the owner's word.

## One writer at a time
- Only one worker writes to the checkout at a time. Before briefing a writer, check `git status` and that no other
  worker is mid-task there.
- A reviewer works read-only while a builder writes, and commits its own fixes with `git commit -- <its paths>`.

## Heavy commands
- Locally: targeted tests only, one at a time: `cargo test -p <crate> <name>`, `pnpm vitest run <file>`,
  `cargo check -p <crate>`. Never the full suite, `pnpm e2e`, `clippy --workspace`, `pnpm build` or the site build,
  unless the owner asks for it in that conversation.
- Before a heavy command, check that the owner's PC is not busy with something heavy. A check script kept outside the
  repo says so. Use low CPU priority and 4 build jobs (`CARGO_BUILD_JOBS=4`, `RUST_TEST_THREADS=4`).
- The gate is CI: the `check` workflow runs everything, end-to-end included. A release job starts only when it is green.

## Commits
- One local commit per plan line, Conventional Commits, English. Notes use `docs(notes): ...` or `docs(plan): ...`.
- Stage by name: `git add <file>`, or `git commit -m "…" -- <paths>`. Never `git add -A` or `git add .`.
- `docs/notes/report*.md` never enters a commit. Those files are git-ignored and private; `git ls-files docs/notes | grep
  report` must print nothing.
- No attribution in commits or pull requests: no "generated with" line and no co-author trailer naming an AI tool.
- A plan line is ticked in the same commit as its work, with the date and what was not tried for real
  ("Decided alone (date): what, why" for a choice the builder made alone).
- A `[skip release]` at the start of the head commit's subject means no app Beta from that push. The website still
  deploys when the site or the documents it includes change. Use it for docs-only pushes, never for a push you want
  released, since the release reads the head commit only.

## Push
- A Beta every 30 points only (the owner, 2026-11-26: too many versions): count the lines ticked since the last Beta
  (`S` = 1, `M` = 2, `L` = 3; see "The plan"). Below 30, the work stays local; a push that must go out sooner (an
  urgent fix, the owner's ask) or a docs-only push carries `[skip release]` on its head commit.
- Only on the owner's word. A push to `master` is a Beta release (`release.yml`) and can deploy the website. Stable is
  never promoted without the owner trying the Beta first.
- Before a push, the leak check on the whole range, not only the tree:
  `git log --name-only --format= origin/master..HEAD | grep -i notes/report` must print nothing, and the commit messages
  and changed files are read for personal data (names, addresses, accounts, machine names, usage figures).
- After a push, watch CI. A red run is fixed and pushed again, three tries at most.
- A permission classifier can refuse a push made from an unattended run. Then leave the tree clean and say so in one
  line. Never work around a refusal; only the owner can add a permission rule.

## Pacing
- Watch the plan's limits. Before the current usage window runs out, pause the workers so they end on a commit. A worker that
  hits the limit mid-turn dies, and the messages queued for it are lost: resend them after the reset.
- Stop at the owner's weekly stop, and say so in the report.
- Keep the orchestrator conversation short. Every message re-reads all of it.

## Questions
- A decision goes to the owner as a multiple-choice question in French ("tu"), recommended option first, four at most
  per call, in daytime only.
- During an autonomous run there are no questions at all. Decide alone, pick the option easiest to undo, write
  "Decided alone (date): what, why" in the plan line, and list it under "waiting for you" in the report.

## Reports
- A run or a window ends with a report in French, `docs/notes/report-<date>.md`: what was done (with hashes), what to
  try, what waits for the owner. It is private and git-ignored.
- Workers send their end markers to `docs/notes/report-inbox.md` (private). The orchestrator merges them into the
  dated report and empties the inbox.
- The handoff is rewritten at the end of each window: English, short, public-safe, never `[skip release]` on its own
  commit when the push must be released.

## The plan
- `docs/notes/plan-v2.md` holds the open work. Open lines are `- [ ]`, sized `S` (one session), `M` (a few) or `L`
  (many). `L` lines are designed first, with sub-bullets for the design and the slices.
- Tick a line when it lands, with its date. A release drops ticked lines; the history stays in git.
- For the push cadence, count ticked lines by size: `S` = 1 point, `M` = 2, `L` = 3.

## Tests and checks
- Rust tests live in the module (`#[cfg(test)]`); front-end tests sit next to the code (`*.test.ts`).
- Tests never touch the real network: use mocks (`mockito` for HTTP).
- New logic (a branch, a loop, a parser, money, security) leaves a small test. A trivial change needs none.
- Interface text goes through `shared/i18n`, in English and the 17 locales, or the i18n test fails.

## Facts before claims
- Check a fact in the code or in git before writing it into a brief, a plan line or a handoff. Cite `file:line`.
- A feature that was built and tested but never run on a real device or account is marked "not tried for real".
- Repeat checks with `gh` for release, CI and pull-request state; do not trust a remembered number.
