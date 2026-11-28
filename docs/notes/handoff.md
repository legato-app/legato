# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-27, end of window 2 on the second PC.

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `23ce8341`, Beta **v1.2.456**. **platforms** on origin =
  `398e2eab`, pushed. Its `check` run was still going when this was written; the Linux clippy job is part of it.
  Push `platforms` after each reviewed lot (no release). master only by push, on the owner's word.
- **Pushed on platforms, up to `398e2eab`**:
  - Linux, slices 0 to 3: the trial AppImage (a push whose head message has `[linux trial]`, artifact kept 7 days),
    clippy of the app shell, the MPRIS media panel, autostart, `legato://` from the .deb or AppImage, the table of what
    Linux hides (`MISSING_ON_LINUX`), no tray means closing quits, no keyring means sign-ins last until close.
  - the swapped-title fix turned at merge time;
  - "Add from a backup" (merges a copy, removes nothing, its settings optional);
  - Spotify on the phone, step S: "Open Exportify" in the browser, then the saved file is taken;
  - Lite slices 9 and 10;
  - rearrange, slice 2 (hidden in the interface until its screen lands);
  - signatures of the installers and the APK kept apart from the build;
  - README: editions and platforms section;
  - AutoEQ licence checked: the data has no stated reuse terms; the plan line is marked "to drop", the owner decides.
- **Local, not reviewed**: `370a5bf9` (rearrange, slice 3: move the app's parts by dragging, or with the keyboard).
- **Not tried for real**: Linux (nothing run on a real Linux desktop), the trial AppImage, Spotify on the phone,
  Add from a backup, the swapped-title fix on a second PC, Lite 9-10, the release notes and signatures on a real release.

## Next, in order
1. **Opus reviews `370a5bf9`**, then one trial AppImage run by the owner (WSL or a VM, their choice).
2. **Linux slices 4 and 5**: the shield on WebKitGTK (filter and host list) and the Linux release job (x86_64 and
   aarch64, AppImage and .deb, both editions).
3. **Spotify, step M** (plan-v2): the owner's own client ID, PKCE, a `legato://` redirect.
4. **Rearrange, slices 4 to 7** (plan-v2, rearrange line).
5. **Theme code** (plan-v2, `L`): designed, not built.
6. **Profiles** (plan-v2, `M-L`): designed, after the Lite.
7. Hidden video decoding (plan-v2 lead): measure only; no rule forbids it, nothing to build.
8. Release cache: the study advises against it.


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
