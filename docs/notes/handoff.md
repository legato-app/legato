# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; older
versions are in git. Updated 2026-11-27.

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `4de9fe17`, the Beta v1.2.333 (2026-11-26). `platforms` is 26
  commits ahead; `origin/platforms` is `929f870d`, so `8990e514` and `ad4b6001` wait for a push. The local `master`
  checkout lags: use `origin/master`. Work goes to master by push only, on the owner's word.
- **Last Beta**: v1.2.333 = `4de9fe17`. Before it, v1.2.298 = `a4412ea1`. Stable **1.2.10** (2026-11-14).
- **Beta rule**: a Beta every 30 points (S = 1, M = 2, L = 3), counted from the plan lines ticked since v1.2.333: **10 points** so far.
- **Themes**: the layout is in v1, slices 1-12 landed (`75ce0116` to `14879c2a`); slice 13 (a theme's named plugin) is open.
  Not tried for real: a real YouTube video with a moved player bar, right-to-left, the installed app.
- **Duplicates**: the audit's clusters 1-6 and 8 are done (`f907d3e2`, `356c2ee1`, `b7bc6095`, `e346e565`, `ff9fcc5d`,
  `10d8b604`, `929f870d`). Cluster 7 is left on purpose, 14 too; 9-13 are small and not started.
- **Signing**: done. The bundled Discord Presence is signed (`8e3115f5`, trusted key in `trusted-authors.json`), and
  `legato-app/discord-presence` is 1.0.1 signed (`fc82a16`). The card shows "Verified" in the next Beta.
- **Launch JS**: 339 of the 340 kB budget: the next eager addition breaks it.
- **Discord presence** is a plugin: the bundled copy in `examples/plugins/discord-presence` (1.0.1; the app refreshes
  older installed copies at launch) and the public repo `legato-app/discord-presence` (MIT, API 2).
- **Docs site**: Fumadocs, static search at `/legato/api/search`. A `site` job in `check.yml` builds it on every check, so
  a broken site holds back the Beta. Developer pages come from `docs/architecture.md`, `docs/plugins.md` and
  `CONTRIBUTING.md` (`site/components/repoDocs.ts`).
- **Head commit**: never `[skip release]` on the last commit of a push you want as a Beta; `release.yml` reads its
  first line.
- **Stable**: only on the owner's word, never on a Beta's green CI.

## Next, in order
1. **The owner's Beta push**, once 30 points are reached (10 now): `git push origin platforms:master`, after a `pnpm dev`
   check of the default layout (a YouTube video through the player bar, the sidebar's resize, an album, an artist, a
   playlist, the right-click menus). On the owner's word only.
2. **Lite build**: plan-v2's `L` line "A Lite build next to the full one", with its design under it. It waits for the
   owner's yes on the design before its slices (identity, the UI cut table, the Rust cfgs). CLAUDE.md's "identifier
   exactly `app.legato.desktop`" changes with it: the owner's wording.
3. **Theme layout, slice 13**: a theme's named plugin as surface `plugin:<id>`, after v1. No theme scripts in v1.
4. **Plugin pictures**, after the 2 Dec reset: an optional manifest `icon`, verified authors only (`M`).
5. **Open plan lines**, by title (numbers move): "Much fuller diagnostics", "Normal videos (a story web series) counted
   as music", "Playlist edits sent back to the server", "Server songs levelled", "The remaining JSX moved into one component".
6. **Profiles on one PC**: plan-v2's `M-L` line, design first; the owner reconfirms the launch picker.
7. **Site and docs follow-ups** (plan-v2, after "The website made beautiful").
8. **Push `platforms`** after review (`8990e514`, `ad4b6001`): the owner's or the orchestrator's call.

## Waiting on the owner
Waiting on the owner's answer: the Spotify legal questions, removing Spotify-only songs on disconnect, and keeping the
profiles launch picker.

## Facts to keep
- **Playback**: external music plays through YouTube only; Spotify only reads playlists (`6a1c285e`). Local files and
  personal servers (Subsonic, Jellyfin, Plex) play directly.
- **Playlist sync**: a read that is cut short never removes songs (`PlaylistRead { tracks, complete }`). A refused add
  stays and is sent again at later syncs, 10 tries at most (`pending_push`, schema 24). Songs added from Legato keep the
  newest end (schema 25).
- **Releasing**: a push to master is a Beta. Stable: `git fetch --tags`, `node scripts/promote.mjs --dry-run <version>`,
  then the `promote.yml` workflow. Check `node scripts/release.mjs --dry-run` for the next Beta number.
- **Local checks**: targeted tests only, one at a time (CLAUDE.md › Commands). The full gate runs in CI, and CI is the gate.
- **Reports** (`docs/notes/report*.md`) are git-ignored and never staged. Before a push: a clean tree, and
  `git log --name-only --format= origin/master..HEAD | grep -i notes/report` prints nothing.

## Two PCs
Two Windows PCs, kept alike through GitHub; one holds the signing keys and the Android tools. Setup lives in each PC's private memory.

## Traps
- `git rev-parse <a> <b>` fails ("Needed a single revision"): one call per revision.
- Google refuses lists, radios and artist pages for 15 minutes after a refusal (`searchpace::Quiet`): never retry in a loop.
- **CRLF / LF**: a CRLF working copy fails `no_sync_command_locks_the_library`. An empty-diff `M` in `git status` is that
  artefact: never commit it.
- `pnpm install` after a merge that changes a lockfile; `pnpm add` inside `site/` for the website.

## Sessions
For a new orchestrating session: read `CLAUDE.md`, this file, then the useful parts of `plan-v2.md`. One session per
model, reused: Opus `local_f29d17e4-a03b-4179-bf7c-2a6ebd93b333` (designs, reviews), Sonnet
`local_c41fd475-c928-4160-815b-a05f053c4f82` (builds), Haiku `local_25834cd1-06af-48e4-9e8b-b22fad7585d2` (docs). One writer
at a time; stage by name.

## History
Rename to Legato (2026-10-29); Stable 1.2.10 (2026-11-14); organization moved to `legato-app` (2026-11-25). The rest is in
the release notes and `git log`.
