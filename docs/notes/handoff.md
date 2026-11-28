# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-27, end of window 2 on the second PC.

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `23ce8341`, Beta **v1.2.456**. **platforms** on origin =
  `7503849c`, pushed; local `platforms` = `bddcee60`, four commits ahead (not pushed, not reviewed). Push `platforms`
  after each reviewed lot (`check` runs, no release). master only by push, on the owner's word.
- **Pushed on platforms, up to `7503849c`**:
  - the site's Android link takes the newest APK (`f406039d`, `4dd9e5ec`);
  - Linux, slices 0 and 1: a CI build and a trial AppImage on a push whose message says `[linux trial]` (`1374f868`,
    `ce87dc3e`), the interface hides what Linux lacks (`5950c1fd`);
  - a Stable release cleaned up: CodeQL, release notes that leave out what only the code's readers care about
    (`11aed31b`, `7419231c`);
  - the Lite sync fix: a PC that joins others' sync takes their settings instead of overwriting them (`bc5c271d`);
  - security pass fixes landed, details in private notes.
- **Local, not reviewed**: `40060f24` (resuming a stopped sync keeps this PC's settings), `7d32c78d` (a backup can be
  added to the library, removing nothing), `7723f222` (Add from a backup, with its settings if wanted), `bddcee60`
  (untick the swapped-title turn on merged songs, which no commit built).
- **Release gate**: the Stable check has a point 10, a read-only white-hat pass, its report kept private (`bf1cc912`).
- **Not tried for real**: Linux (nothing run on a real Linux yet), the Lite build (its sync overwrote the full app's
  settings once, fixed in `bc5c271d`, not re-run), Adaptive Sound and the Android crackle fixes on a phone, the swapped-title fix on a second PC,
  the Stable gate's white-hat pass.

## Next, in order
1. **Opus reviews** the four local commits above, then the pushed batch if not yet reviewed.
2. **Swapped titles**: the fix is `merge_in` plus `backwardsTitles3` (a swapped title came back on Beta v1.2.456).
3. **Rest of `51276a5a`** (release workflow hardening; the actions are pinned): the part not yet landed, in private notes.
4. **Linux, slices 2 and 3** (plan-v2, Linux line).
5. **Spotify on the phone** (plan-v2, `S` then `M`): Exportify in the phone's browser, then the user's own client ID
   with PKCE over a `legato://` redirect.
6. **Then the rest of the handoff's list**: Lite slices 9 and 10 (a lighter background, the 250 MB cover cache is
   disk), rearrange slices 2 to 7, the theme code. The owner's bench (two commands) is still to run.

## Waiting on the owner
- The two bench runs (item 1). Auto mode refused to start them.
- A Beta at 30 points: count the ticked plan-v2 lines since v1.2.456 (`S` 1, `M` 2, `L` 3). A push to master is a Beta
  (`git push origin platforms:master`; the head must not carry `[skip release]`), on the owner's word.
- Fixing every song saved swapped for sure would take one YouTube request per song: the owner's call.
- The Spotify legal questions.

## Traps
- Keep local checks light (the PC may be in use): vitest per file with `--maxWorkers=1`, one cargo command at a time with
  `CARGO_BUILD_JOBS=2`. No bench, no `pnpm build`, no e2e while they listen.
- `node_modules` on one PC links to an old checkout path: `pnpm vitest` then fails ("packages field missing"). Run
  `pnpm install` first. Global `pnpm` 9.12.2 refuses the workspace: use `npx pnpm@11.9.0`.
- `git rev-parse <a> <b>` fails ("Needed a single revision"): one call per revision.
- Google refuses lists, radios and artist pages for 15 minutes after a refusal (`searchpace::Quiet`): never retry in a loop.
- **CRLF / LF**: a CRLF working copy fails `no_sync_command_locks_the_library`. An empty-diff `M` in `git status` is that
  artefact: never commit it.
- `pnpm dev:lite` can't run beside `pnpm dev` (same port and exe).

## Facts to keep
- **Playback**: external music plays through YouTube only; Spotify only reads playlists. Local files and personal servers
  (Subsonic, Jellyfin, Plex) play directly.
- **Releasing**: a push to master is a Beta. Stable: `git fetch --tags`, `node scripts/promote.mjs --dry-run <version>`,
  then the `promote.yml` workflow. `node scripts/release.mjs --dry-run` gives the next Beta number.
- **Local checks**: targeted tests only, one at a time (CLAUDE.md › Commands). The full gate runs in CI.
- **Reports** (`docs/notes/report*.md`) are git-ignored and never staged. Before a push: a clean tree, and
  `git log --name-only --format= origin/master..HEAD | grep -i notes/report` prints nothing.

## Two PCs
Two Windows PCs, kept alike through GitHub; one holds the signing keys and the Android tools. Setup lives in each PC's
private memory. Moving PCs: push platforms, then on the other PC `git fetch` and `git switch platforms`; copy the private
`docs/notes/report*.md` by hand if they are wanted there.

## Sessions
For a new orchestrating session: read `CLAUDE.md`, this file, then the useful parts of `plan-v2.md`. One session per
model, reused: Opus designs and reviews, Sonnet builds, Haiku writes docs. One writer per file set; stage by name. Each
builder's work is reviewed by the other model before a push.

## History
Rename to Legato (2026-10-29); Stable 1.2.10 (2026-11-14); organization moved to `legato-app` (2026-11-25); Beta v1.2.416
(2026-11-27); Beta v1.2.456 (2026-11-27). The rest is in the release notes and `git log`.
