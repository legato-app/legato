# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-28, window 5 (Beta pushed 14:07Z).

## Where things stand
- **Repository**: `legato-app/legato`. **master** and **platforms** on origin = `a7361874`, pushed 2026-11-28 14:07Z.
  That push is the Beta in progress (the owner's word): its check and release jobs run (Windows, Android, apk, lite,
  linux). Its Linux part ships only if its job passes; a failure does not hold Windows or Android back. Last tagged Beta:
  v1.2.456 (`23ce8341`). The Beta counts 35 points; Spotify on the phone (M) and the later local commits are not in it.
  Push `platforms` after each reviewed lot (no release). master only by push, on the owner's word.
- **Pushed, up to `a7361874`**:
  - Linux, slices 0 to 5: the trial AppImage (a push whose head message has `[linux trial]`, artifact kept 7 days),
    clippy of the app shell, the MPRIS media panel, autostart, `legato://` from the .deb or AppImage, the table of what
    Linux hides (`MISSING_ON_LINUX`), no tray means closing quits, no keyring means sign-ins last until close, ad
    blocking on WebKitGTK (`b72805c9`), and the release AppImage and .deb packages with their update path (`1b074936`).
    Their first run is untried. The full and Lite builds overwrite each other's packages in that Beta: the fix is
    `4f772292`, local, not in it.
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
- **Local, not pushed, in review** (`git log origin/platforms..HEAD`):
  - `ef89862f`: Linux 4's three LOW items: the content filter compiled once per version, and a request noted when it
    leaves the page.
  - `42ab7c2f`: closes `ef89862f`'s MED: the filter is filed under a hash of the converted rules, not the app version.
  - `20a42e28`: Linux slice 6: the site lists Linux downloads per edition once a Stable release has them; the Linux docs.
  - `025ca068`: on Linux, a double-clicked `.lmix` opens in the full app.
  - `90d068e3`: the handoff's window-5 state.
  - `4f772292`: Linux 5: the full and Lite builds' packages are copied right after each build, and the job stops if one
    is missing; the .deb's Lite side and two settings fixes.
  - `1674fb72`: Spotify on the phone, step M: the user's own client ID, PKCE, `legato://spotify-callback`.
  - `30ce987b`: plan-v2 lines matched to the window's commits.
- **Review state**: Opus has reviewed `ef89862f`, `20a42e28` and `025ca068`. Not yet reviewed: `42ab7c2f`, `4f772292`,
  `1674fb72`, `90d068e3`, `30ce987b`. Opus's LOWs on the rearrange slices are closed (`5fb54de7`).
- **Not tried for real**: Linux (nothing run on a real Linux desktop, no Linux release yet), the trial AppImage, Spotify
  on the phone, Add from a backup, the swapped-title fix on a second PC, Lite 9-10, the release notes and signatures
  on a real release.

## Next, in order
1. **Review the local commits** (Opus): `42ab7c2f`, `4f772292`, `1674fb72`, `90d068e3`, `30ce987b`. Then push `platforms`.
2. **Next Beta**: it carries `4f772292`'s overwrite fix and Spotify M. Its points are counted from `a7361874`.
3. **Linux trial runs**: one AppImage run by the owner (WSL2 Debian, `wsl --install -d Debian`, or a VM), and a `[linux trial]` push, since
   `linux-trial.yml` runs on Ubuntu 22.04 and nothing has compiled the WebKitGTK calls there yet. Then Linux slice 7
   (plan-v2): measure the Lite on a small aarch64 machine.
4. **Spotify on the phone, step M** (`1674fb72`, local): built, not tried on a phone; a phone run is the owner's.
5. **Rearrange, slices 4 to 7** (plan-v2, rearrange line).
6. **Theme code** (plan-v2, `L`): designed, not built.
7. **Profiles** (plan-v2, `M-L`): designed, after the Lite.
8. Hidden video decoding (plan-v2 lead): measure only; no rule forbids it, nothing to build.
9. Release cache: the study advises against it.

## Waiting on the owner
- The two bench runs: `node scripts/bench.mjs --skip-build`, then `node scripts/bench.mjs --lite --skip-build`, about
  20 minutes each, with nothing else heavy running.
- **WSL2 Debian** for the Linux trial: `wsl --install -d Debian` (admin and a reboot: the owner's).
- **The "Two PCs" section** in this public file: keep or remove (the owner's call).
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
(2026-11-27); Beta v1.2.456 (2026-11-27); Beta in progress at `a7361874` (2026-11-28 14:07Z). The rest is in the release notes and `git log`.
