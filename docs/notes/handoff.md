# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-28, window 5 (Beta v1.2.552 released 14:56Z).

## Where things stand
- **Repository**: `legato-app/legato`. **master** = `a7361874`, Beta **v1.2.552**, released 2026-11-28 14:56Z (its release
  run is green). Its assets: the Lite AppImages (amd64, aarch64), the Lite and full `.deb` (amd64, arm64), the Windows
  installers and `.msi`, the Android APK. It has **no full-edition AppImage**: `4f772292` fixes it, in the next Beta. Its
  Linux packages are untried. The Beta counts 35 points; Spotify on the phone (M) and later commits are not in it. Last
  Beta before it: v1.2.456 (`23ce8341`).
  **platforms** on origin = `e50875b8`, pushed. Push `platforms` after each reviewed lot (no release). master only by
  push, on the owner's word.
- **Pushed, up to `e50875b8`**:
  - Linux, slices 0 to 5: the trial AppImage (a push whose head message has `[linux trial]`, artifact kept 7 days),
    clippy of the app shell, the MPRIS media panel, autostart, `legato://` from the .deb or AppImage, the table of what
    Linux hides (`MISSING_ON_LINUX`), no tray means closing quits, no keyring means sign-ins last until close, ad
    blocking on WebKitGTK (`b72805c9`), and the release AppImage and .deb packages with their update path (`1b074936`).
    Their first run is untried. v1.2.552 has no full-edition AppImage: `4f772292` fixes it, in the next Beta.
  - the swapped-title fix turned at merge time, and a backwards title a merge brings arrives the right way round;
  - "Add from a backup" (merges a backup file, removes nothing, its settings optional);
  - a PC joining a sync takes the others' settings instead of overwriting them with its own (`bc5c271d`);
  - Spotify on the phone, step S: "Open Exportify" in the browser, then the saved file is taken;
  - Lite slices 9 and 10;
  - rearrange, slices 1 to 3: the mode is visible now (`370a5bf9`), with its LOW fixes (`5fb54de7`) and right-to-left
    languages (`f5fbce08`);
  - signatures of the installers and the APK kept apart from the build;
  - README: editions and platforms, with the Android and Linux wording checked (`3b9a60e8`);
  - AutoEQ licence checked: the data has no stated reuse terms; the plan line is marked "to drop", the owner decides.
  - Linux 4 to 6 and the `.lmix`: `ef89862f`, `42ab7c2f` (the filter's cache key), `20a42e28`, `025ca068`; Linux 5's
    packages and the `.deb` fixes: `4f772292`, `d0de3c42`.
  - Rearrange, slices 4 and 5: the bars' parts and the eye (`295442be`), then the pages' parts, the list columns and the
    page header (`e50875b8`).
  - Spotify on the phone, step M: `1674fb72`.
- **Local, not pushed, in review** (`git log origin/platforms..HEAD`), oldest first:
  - `bd60d6b0`: Linux: the content filter's text written one rule at a time.
  - `048865b0`: rearrange: grab a bar's containers, count only what shows.
  - `ac319561`: rearrange: the sidebar's and the side panel's width.
  - `a5717d1f`, `9f55c6a4`: docs: how to arrange the app by hand; CSS counting can look off while arranging.
  - `5d1b27bd`: plan-v2: the theme code and profiles design update.
- **Review state**: Opus has reviewed `ef89862f`, `20a42e28`, `025ca068`, `42ab7c2f`, `4f772292`, `1674fb72`, `90d068e3`,
  `295442be`, `d0de3c42` and `e50875b8`. Not yet reviewed: `bd60d6b0`, `048865b0`, `ac319561`, `a5717d1f`, `9f55c6a4`,
  `5d1b27bd`, `30ce987b`. Open LOWs on `e50875b8`: the "1 sur 3" count still counts a part that is empty; CSS
  `:nth-child` rules shift while arranging (a line in `docs/themes.md`); the `.deb`'s menu entry names are assumed, not
  checked. Opus's LOWs on the rearrange slices are closed (`5fb54de7`).
- **Not tried for real**: Linux (nothing run on a real Linux desktop, no Linux release yet), the trial AppImage, Spotify
  on the phone, Add from a backup, the swapped-title fix on a second PC, Lite 9-10, the release notes and signatures
  on a real release.

## Next, in order
1. **Review the local commits** (Opus): `bd60d6b0`, `048865b0`, `ac319561`, `a5717d1f`, `9f55c6a4`, `5d1b27bd`, `30ce987b`.
   Then the LOWs above.
2. **Next Beta**: it carries the full-edition AppImage fix (`4f772292`, already on platforms) and Spotify M (`1674fb72`).
   Its points are counted from `a7361874`.
3. **Linux trial**: in the owner's Linux environment, once their apt line is run (see the private note). One AppImage
   run, then a `[linux trial]` push, since `linux-trial.yml` runs on Ubuntu 22.04 and nothing has compiled the WebKitGTK
   calls there yet. Then Linux slice 7 (plan-v2): measure the Lite on a small aarch64 machine.
4. **Spotify on the phone, step M** (`1674fb72`, local): built, not tried on a phone; a phone run is the owner's.
5. **Rearrange, slices 4 to 7** (plan-v2, rearrange line).
6. **Theme code** (plan-v2, `L`): designed, not built.
7. **Profiles** (plan-v2, `M-L`): designed, after the Lite.
8. Hidden video decoding (plan-v2 lead): measure only; no rule forbids it, nothing to build.
9. Release cache: the study advises against it.

## Waiting on the owner
- The two bench runs: `node scripts/bench.mjs --skip-build`, then `node scripts/bench.mjs --lite --skip-build`, about
  20 minutes each, with nothing else heavy running.
- **The owner's apt line** for the Linux trial (see the private note).
- Fixing every song saved swapped for sure would take one YouTube request per song: the owner's call.
- The Spotify legal questions.

## Traps
- Light local checks: vitest per file with `--maxWorkers=1`; one cargo command at a time with `CARGO_BUILD_JOBS=2`. Heavy
  commands use 4 jobs (workflow.md). No bench, no `pnpm build`, no e2e while the machine is in use.
- A `node_modules` linked to an old checkout path makes `pnpm vitest` fail ("packages field missing"): run `pnpm install`
  first. Global `pnpm` 9.12.2 refuses the workspace: use `npx pnpm@11.9.0`.
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
- Machine-specific notes: a private, git-ignored file.

## Sessions
For a new orchestrating session: read `CLAUDE.md`, this file, then the useful parts of `plan-v2.md`. One session per
model, reused: Opus designs and reviews, Sonnet builds, Haiku writes docs. One writer per file set; stage by name. Each
builder's work is reviewed by the other model before a push.

## History
Rename to Legato (2026-10-29); Stable 1.2.10 (2026-11-14); organization moved to `legato-app` (2026-11-25); Beta v1.2.416
(2026-11-27); Beta v1.2.456 (2026-11-27); Beta v1.2.552 from `a7361874` (2026-11-28 14:56Z). The rest is in the release notes and `git log`.
