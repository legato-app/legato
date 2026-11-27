# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; older
versions are in git. Updated 2026-11-27 (after night window 2).

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `4de9fe17`, the Beta v1.2.333 (2026-11-26). **platforms** is
  50 commits ahead of origin/master; **origin/platforms** = `f062be31` (pushed during the night; `check` was still
  running on it when this was written, `ce7e0a58` was green). The local `master` checkout lags: use `origin/master`.
  Work goes to master by push only, on the owner's word.
- **Last Beta**: v1.2.333 = `4de9fe17`. Before it, v1.2.298 = `a4412ea1`. Stable **1.2.10** (2026-11-14).
- **Beta rule**: a Beta every 30 points (S = 1, M = 2, L = 3). Since v1.2.333: **19 points** (ticked lines in
  `plan-v2.md`; the theme `L` counts once, its slices inside it).
- **Themes**: the layout is in v1; the `L` line is ticked (`bed4beab`). Slices 1-13 landed (`75ce0116` to `491572ed`):
  a theme's named plugin is a panel surface `plugin:<id>`, at most two, only for an installed plugin granted `ui`.
- **Library**: Songs, Albums, Artists and Playlist load on demand (`afc5d6f3`); the launch JS is 320 of 340 kB gzip.
  The start screen is Home until the settings are in, then the chosen view, only while nothing was visited (`ecc854b7`).
- **Episodes**: a numbered episode is not music, and a doubt never seeds a Like mix (`16590b39`, `83432244`).
- **Diagnostics**: Copy carries up to 200 KB of recent lines; Settings › About › Save writes the whole log. Stalls,
  update sizes, sync merges and output changes are logged (`82cf5a5b`, `c08b6de8`, `36c5d373`, `37eddb41`, `fafbe844`).
- **Equalizer per output**: built (`8fc31212`), its tests in `329a89f5`. AutoEQ profiles are a separate open line.
- **Spotify disconnect**: one question, a backup first; removes the imported playlists and the songs only Spotify
  holds; an older Liked Songs list stays (`ae9f7a42`, `dd0e5682`, `f062be31`). A synced PC still brings the songs back:
  a new open line.
- **Duplicates**: the audit's clusters 1-6, 8, 10 and 11 are done. Clusters 7, 9, 12, 13 and 14 are left on purpose
  (tried and left, or not worth the lines).
- **Signing**: done. The bundled Discord Presence is signed (`8e3115f5`), and `legato-app/discord-presence` is 1.0.1
  signed (`fc82a16`). The card shows "Verified" in the next Beta.
- **pnpm**: one version, 11.9.0, pinned by `packageManager` (`9d480d25`).
- **Discord presence** is a plugin: the bundled copy in `examples/plugins/discord-presence` and the public repo
  `legato-app/discord-presence` (MIT, API 2).
- **Docs site**: Fumadocs, static search at `/legato/api/search`. A `site` job in `check.yml` builds it on every check.
- **Head commit**: never `[skip release]` on the last commit of a push you want as a Beta; `release.yml` reads its
  first line.
- **Stable**: only on the owner's word, never on a Beta's green CI.

## Not tried for real
- A theme with a plugin panel in the installed app (only a demo with an invented plugin).
- A real YouTube video with a moved player bar; right-to-left; the installed app.
- Episodes on a real library (a web series may now disappear from it).
- Copy and Save diagnostics on a phone (the clipboard's 200 KB limit is a lead).
- A stall or a phone leaving the screen on a phone; the Windows default-output change; headphones with EQ per output.
- The settings search with accents (NFKD folding); the copy field of the Spotify wizard and of a room's link.
- Android is not compiled by `check.yml` on platforms; the owner decides whether to add it (CI time).
- The first `check` and `release.yml` runs with pnpm 11.9.0.

## Next, in order
1. **The owner's Beta push**, once 30 points are reached (19 now): `git push origin platforms:master`, after a `pnpm dev`
   check of the default layout (a YouTube video through the player bar, the sidebar's resize, an album, an artist, a
   playlist, the right-click menus). On the owner's word only.
2. **Lite build**: plan-v2's `L` line "A Lite build next to the full one". Its design waits for the owner's yes before
   any slice. CLAUDE.md's "identifier exactly `app.legato.desktop`" changes with it: the owner's wording.
3. **Sync Mode carries the Spotify-disconnect removal** (`M`, new): a record kind of its own, so the removed songs stay
   removed on synced PCs without deleting their unsynced history.
4. **AutoEQ profiles** (`S`): check the measurement data's licence first.
5. **Plugin pictures**, after the 2 Dec reset: an optional manifest `icon`, verified authors only (`M`).
6. **Open plan lines**, by title (numbers move): "Songs old mixes dropped" (`S`, a "Clean up songs" with undo),
   "Reordering a music server's playlist" (`S`), "Server songs levelled", "The remaining JSX moved into one component",
   and "Code quality" (`L`, clusters 7, 9, 12, 13 and 14 left).
7. **Profiles on one PC**: plan-v2's `M-L` line, design first; the owner reconfirms the launch picker.
8. **Site and docs follow-ups** (plan-v2, after "The website made beautiful").
9. **Small leftovers from the reviews** (LOW, not planned yet): episode doubts on "Stories" bands and "lofi beats mix ep. 3"
   (`musicness.rs:86-87`); a theme saved by an older Legato loses its `plugin:` panel; the Hindi settings search loosens;
   the Windows default-output row text.

## Waiting on the owner
Waiting on the owner's answer: the Spotify legal questions, keeping the profiles launch picker, the Lite design, the
AutoEQ data licence, and whether Android joins `check.yml` on platforms.

## Facts to keep
- **Playback**: external music plays through YouTube only; Spotify only reads playlists (`6a1c285e`). Local files and
  personal servers (Subsonic, Jellyfin, Plex) play directly.
- **Playlist sync**: a read that is cut short never removes songs (`PlaylistRead { tracks, complete }`). A refused add
  stays and is sent again at later syncs, 10 tries at most (`pending_push`, schema 24). Songs added from Legato keep the
  newest end (schema 25). Playlist edits are sent back when the direction sends.
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
