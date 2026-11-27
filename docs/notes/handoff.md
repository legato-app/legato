# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-27, end of window 2 on the second PC.

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `23ce8341`, the Beta **v1.2.456** (2026-11-27). Work goes on
  **platforms**, pushed: `origin/platforms` = `c12057ae`, 15 commits ahead of master. Push it after each reviewed lot
  (`check` runs on it, no release). master only by push, on the owner's word. The local `master` checkout lags: use `origin/master`.
- **Releases**: Beta v1.2.456 = `23ce8341`; before it v1.2.416 = `711b310a`. Stable **1.2.10** (2026-11-14).
- **Beta rule**: a Beta every 30 points (S = 1, M = 2, L = 3), counted from the ticked plan-v2 lines since v1.2.456.
  An `L` counts once.
- **Already on master (Beta v1.2.456)**: the window freeze fix (`8d95ef1e`, `382034c0`: the hidden Google session refresh
  asks for no passkey, `about:blank` before close, a dead WebView2 browser restarts the app once, never in a loop); the
  Settings gear over the full player and no window Full screen button (F11 stays); swapped YouTube titles turned (search,
  pasted links, song lists, share codes; known artists = the library's plus YouTube Music catalog names seen, capped at
  20,000); the Lite build's first slices (see below).
- **On platforms, not yet in a Beta** (`15d85ae0`..`c12057ae`, reviewed):
  - **Lite slices 2 and 3**: the Lite interface leaves out what it cuts, from one table (`ui/src/shared/liteCuts.ts`);
    Rust cuts through cargo features (`default = ["full"]`; Lite = `--no-default-features --features lite`;
    `compile_error!` if built the wrong way); Lite clippy runs in CI.
  - **Lite slice 5** (bench only): `pnpm bench --lite` (identifier `app.legato.lite.bench`). Its measuring run is NOT done.
  - **Lite slice 7**: one YouTube embed in Legato Lite, no song fading into the next (`cueNext()` returns at once in Lite;
    the crossfade settings are absent from Lite). Next starts in about 0.5 to 1 s.
  - **Lite slice 8**: animations off by default in Lite (`motion`, `backdropMotion` false); plain glass where animations
    are off (`:where(.still) .glass`, 92 % opaque background). Not tried in a Lite.
  - **Sync**: `motion` and `backdropMotion` are per-PC (`LOCAL_SETTINGS`): each PC keeps its own; the rest travels.
    Two full PCs no longer sync these two settings.
  - **Home backdrop** follows Background motion (`backdropMotion`), and the flowing WebGL depends on Animations too.
  - **Dropped theme** applies at once, with a guarded Undo toast (`withAddedTheme` / `undoAddedTheme`, one path for every
    door); the question only when the layout changes. Cap 24 custom themes.
  - **Rearrange, slice 1 of 7** (pure helpers in `shared/theme/arrange.ts`, tested round trips); no UI yet.
  - **Profiles and Linux** designed in plan-v2 (Opus, not built). Both lines are open; Linux folds in the old item 18.
  - **Android CI**: `check (android)` passed on its first run (`cce99b4e`).
  - **Theme code** designed (plan-v2 `L` "Theme code", 9 slices, 32 points), not built.
- **Opus's WebView2 memory map** (read-only, 2026-11-27, Legato's Windows build): 823 MB, of which GPU process 372 and
  renderers 296; most is outside `legato.exe`. Leads, by likely gain: (1) a YouTube video decoded while only the cover shows
  (the 200×200 iframe stays mounted under `opacity-0`: `PlayerBar.tsx:250-252`), **unchecked**; (2) a second YouTube player
  during the crossfade (fixed in Lite by slice 7); (3) the Home WebGL backdrop (runs only with Animations and the Home flow on; the
  backdrop fix gains about 0 MB); (4) live `backdrop-filter` over Now Playing; (5) a spare renderer
  (`SpareRendererForSitePerProcess`, untested); (6) background renderers never light (`--disable-renderer-backgrounding`).
- **Earlier work** (in v1.2.416): audiobooks (`.m4b`, chaptered `.m4a`, schema v26), Sync Mode `import-left` /
  `import-back`, blind test timer, crossfade fixes, plugin icons, theme layout slices 1-13, lazy library pages
  (launch JS 320 of 340 kB), Spotify disconnect with a backup, signed Discord Presence, pnpm 11.9.0.

## Not tried for real
- Everything since v1.2.456: the Lite is not built, installed or run; the Lite release jobs never ran; the bench has not
  run (the owner's two commands below); the dropped-theme Undo and the rearrange helpers are not seen in the app; the
  freeze fix never ran against a real Google page.
- From before: Sync Mode with a Spotify disconnect on two PCs, the blind test timer, a folder of books, a plugin with an
  icon, a crossfade between real YouTube embeds.

## Next, in order (the owner's decisions of 2026-11-27)
1. **The owner runs the bench** (their PC, about 20 minutes each, nothing else heavy running):
   `node scripts/bench.mjs --skip-build`, then `node scripts/bench.mjs --lite --skip-build`. Each run adds its line to
   `docs/performance.md`. Then compare the Lite against the target (120 / 150 / 50 MB; 0.1 / 1.5 % of the PC) and tick slice 5.
2. **Lite, the rest**: slice 9 (a lighter background: a 60 s sleep in Lite, no `--disable-renderer-backgrounding` there,
   check three back-to-back songs in the tray), slice 6 (docs and a Lite download on the site), slice 10 (the 250 MB cover
   cache: disk, not memory), and the hidden-video check (lead 1 above, measured with the bench in play).
   Then platforms: Windows, then Android (its own overlay `app.legato.lite.mobile`, an APK feed per edition), then Linux.
3. **Rearrange, slices 2-7** (plan-v2, under the `L` line).
4. **Theme code** (`L`, designed): a sandbox nothing gets out of, an API in Rust through Tauri that lets a theme change the
   interface as much as possible; only `data-brand` elements (logo, legal notices) always stay visible.
5. **Small items**: AutoEQ (check the data licence; integrate only if a free public app may use it, else drop the line
   and tell the owner); the verified plugin author's picture = the Legato logo.
6. **Profiles** (`M-L`, designed 2026-11-27): six slices, 11 points, after the Lite; the app opens on the last profile,
   switched from the avatar menu.
7. **Linux for both versions** (`L`, designed 2026-11-27), after the Lite on Windows and Android.
8. Then the open plan lines (Plex album gain, LAN blind test, `.mp4` audiobooks, code quality clusters 7, 9, 12-14...).

## Waiting on the owner
- The two bench runs (item 1). Auto mode refused to start them.
- A Beta at 30 points: count the ticked plan-v2 lines since v1.2.456 (`S` 1, `M` 2, `L` 3). A push to master is a Beta
  (`git push origin platforms:master`; the head must not carry `[skip release]`), on the owner's word.
- Fixing every song saved swapped for sure would take one YouTube request per song: the owner's call.
- The Spotify legal questions.

## Traps
- Keep the PC light while the owner plays: vitest per file with `--maxWorkers=1`, one cargo command at a time with
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
