# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Rewrite it, short, when a branch, a release or the next step
changes; older versions are in git. Updated 2026-11-27 evening (window 4, before the owner moves to the other PC).

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `711b310a`, the Beta **v1.2.416** (2026-11-27). Work goes on
  **platforms**; push it after each reviewed lot (`check` runs on it, no release). master only by push, on the owner's
  word. The local `master` checkout lags: use `origin/master`.
- **Releases**: Beta v1.2.416 = `711b310a`; before it v1.2.333 = `4de9fe17`. Stable **1.2.10** (2026-11-14).
- **Beta rule**: a Beta every 30 points (S = 1, M = 2, L = 3), counted from the ticked plan-v2 lines since v1.2.416:
  a few so far (swapped titles `M`, Android CI `S`, the top bar's gear and Full screen button). An `L` counts once.
- **On platforms since the Beta**:
  - Top bar: the Settings gear stays over the full player (lights on hover); the window's Full screen button is gone (F11 stays).
  - **Swapped YouTube titles** ("like that - doja cat *slowed*" read as title "doja cat *slowed*"): `turn_round` runs on
    search, pasted links, song lists and share codes; known artists = the library's (rows from a single video skipped,
    `is_video_only`) plus YouTube Music catalog names already seen (capped, video search only, no new request). Songs
    already saved swapped turn once (`backwardsTitles2`, video-only rows of 10 min at most). Follow-ups: plan-v2 lines
    near "Mixes' artist key" and "A video-only title saved swapped".
  - **Lite build** (`L`, plan-v2 "A Lite build next to the full one"): slice 0 (the full app measured, a numeric target),
    slice 1 (cargo feature `lite`, `tauri.lite.conf.json`, identifier `app.legato.lite`, `__LITE__` + `shared/edition.ts`,
    `pnpm dev:lite` / `pnpm build:lite`, rename catch-up compiled out) and slice 4 (`release.yml` job `lite` + `lite-attach`,
    `latest-lite.json` Stable and Beta, `promote.mjs`) are written. Fixes from slice 1's review (Lite registers `legato://`
    when alone, `hooks-lite.nsh`, config tests, the name "Legato Lite") and slice 4's review may still be open: check
    `git log` and the plan line.
  - **Android CI**: `check.yml` job `check (android)` (`cargo check --target aarch64-linux-android`). Never run yet: watch
    the first platforms run. A red there blocks the Beta.
  - **Theme code** designed (plan-v2 `L` "Theme code", 9 slices, 32 points), not built.
- **Earlier work** (in v1.2.416): audiobooks (`.m4b`, chaptered `.m4a`, schema v26), Sync Mode `import-left` /
  `import-back`, blind test timer, crossfade fixes, plugin icons, theme layout slices 1-13, lazy library pages
  (launch JS 320 of 340 kB), Spotify disconnect with a backup, signed Discord Presence, pnpm 11.9.0.

## Not tried for real
- Everything above since v1.2.416: no Lite built, installed or run; the Lite release jobs and the Android CI job never ran;
  the swapped-title turn never seen in the installed app.
- From before: Sync Mode with a Spotify disconnect on two PCs, the blind test timer, a folder of books, a plugin with an
  icon, a crossfade between real YouTube embeds.

## Next, in order (the owner's decisions of 2026-11-27)
1. **Finish what is in flight**: the Lite slice 1 fixes, Sonnet's review of slice 4 and its fixes, Sonnet's "21 bis"
   (`artist_keys` filtered in SQL, a Coldplay test that proves something). Review, then push platforms.
2. **Lite, the rest**: slices 2 and 3 (the UI and Rust cuts, `cargo check --features lite` in CI), 5 (`pnpm bench` on the
   Lite), 6 (docs and a Lite download on the site), then the performance slices 7-10, each measured against the target:
   one YouTube embed and no crossfade, animations off by default, fewer background tasks, a 250 MB cover cache. Platform
   order: Windows, then Android (its own overlay `app.legato.lite.mobile`, an APK feed per edition), then Linux.
3. **Themes, as easy as possible** (the owner: the app must be really user-friendly):
   (a) a theme file dropped on the app applies at once and joins "My themes"; a small warning only if it changes the
   layout (`askAboutLayout`, `themeLayoutImport.ts`, the drop in `PlayerBar.tsx`);
   (b) rearranging the app by dragging its parts (sidebar, player, parts of pages), saved into one's own theme: Opus
   designs it first.
4. **Theme code** (`L`, designed): a sandbox nothing gets out of, an API in Rust through Tauri that lets a theme change the
   interface as much as possible; only `data-brand` elements (logo, legal notices) always stay visible.
5. **Small items**: AutoEQ (check the data licence; integrate only if a free public app may use it, else drop the line
   and tell the owner); the verified plugin author's picture = the Legato logo.
6. **Profiles** (`M-L`), after the Lite, designed by Opus first; the app opens on the last profile, switched from the
   avatar menu.
7. **Linux for both versions** (`L`, plan-v2), designed by Opus, after the Lite on Windows and Android.
8. Then the open plan lines (Plex album gain, LAN blind test, `.mp4` audiobooks, code quality clusters 7, 9, 12-14...).

## Waiting on the owner
- A Beta push when 30 points are reached (`git push origin platforms:master`; the head must not carry `[skip release]`).
- Fixing every song saved swapped for sure would take one YouTube request per song: the owner's call.
- The Spotify legal questions.

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

## Traps
- `git rev-parse <a> <b>` fails ("Needed a single revision"): one call per revision.
- Google refuses lists, radios and artist pages for 15 minutes after a refusal (`searchpace::Quiet`): never retry in a loop.
- **CRLF / LF**: a CRLF working copy fails `no_sync_command_locks_the_library`. An empty-diff `M` in `git status` is that
  artefact: never commit it.
- `pnpm install` after a merge that changes a lockfile; `pnpm add` inside `site/` for the website.
- `pnpm dev:lite` can't run beside `pnpm dev` (same port and exe).

## Sessions
For a new orchestrating session: read `CLAUDE.md`, this file, then the useful parts of `plan-v2.md`. One session per
model, reused: Opus designs and reviews, Sonnet builds, Haiku writes docs. One writer per file set; stage by name. Each
builder's work is reviewed by the other model before a push.

## History
Rename to Legato (2026-10-29); Stable 1.2.10 (2026-11-14); organization moved to `legato-app` (2026-11-25); Beta v1.2.416
(2026-11-27). The rest is in the release notes and `git log`.
