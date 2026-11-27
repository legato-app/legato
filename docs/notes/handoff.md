# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; older
versions are in git. Updated 2026-11-27 (after night window 3).

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `4de9fe17`, the Beta v1.2.333 (2026-11-26). **platforms** is
  81 commits ahead of origin/master; **origin/platforms** = `21dd300d` (pushed; `check` runs on each push). The local
  `master` checkout lags: use `origin/master`. Work goes to master by push only, on the owner's word.
- **Last Beta**: v1.2.333 = `4de9fe17`. Before it, v1.2.298 = `a4412ea1`. Stable **1.2.10** (2026-11-14).
- **Beta rule**: a Beta every 30 points (S = 1, M = 2, L = 3). Since v1.2.333: **33 points**, so the Beta is ready on the
  owner's word. Counted from the ticked lines in `plan-v2.md`; the theme `L` counts once, its slices inside it.
- **Audiobooks** (`crates/core/src/audiobooks.rs`): with Audiobooks on, a `.m4b`, a marked folder, a file of 2 h or more,
  or a tagged file of 10 min or more is a book, out of Songs, mixes, radio, blind test, Like seeds and stats. A `.m4a`
  with two or more chapters and 10 min is a book too (schema v26, `tracks.chapters`, counted at the scan). A `.m4b`
  stays out of the music with Audiobooks off. Albums, Artists, Home and search leave books out.
- **Sync Mode and Spotify disconnect**: a disconnect records each song that left (`import-left`); another PC's
  disconnect takes its songs here. A Spotify re-import, an add by hand or a like writes `import-back`, which brings
  the song back. No schema or `FORMAT` bump; an older peer keeps and resends the new kinds (`docs/sync-mode.md`).
- **Blind test**: the time to answer is 10, 20, 30 or 60 s, restarts with each game; a playlist too small for a game says
  so; plural forms per language.
- **Crossfade**: a refused embed and a stopped tail no longer keep sounding once the watch page takes over (`8ec371cc`,
  `1f7b3669`).
- **Plugin icons**: a manifest `icon` (a PNG in the plugin's folder, 256 KB, 512 px at most), checked in Rust, served
  through the `art` scheme; no icon means the card is unchanged.
- **Site**: `motion` is `^14.14.0`, one copy with `fumadocs-ui`; `pages.yml` rebuilds the site only for the documents it
  includes and `package.json` / `pnpm-lock.yaml`.
- **Library**: Songs, Albums, Artists and Playlist load on demand; the launch JS is 321 of 340 kB gzip.
- **Themes**: layout v1, slices 1-13 landed, the `L` line ticked; a theme's named plugin is a panel surface
  `plugin:<id>`, at most two, only for an installed plugin granted `ui`.
- **Spotify disconnect**: one question, a backup first; removes the imported playlists and the songs only Spotify holds;
  an older Liked Songs list stays.
- **Signing**: done. The bundled Discord Presence is signed, and `legato-app/discord-presence` is 1.0.1 signed. The card
  shows "Verified" in the next Beta.
- **pnpm**: one version, 11.9.0, pinned by `packageManager`.
- **Duplicates**: the audit's clusters 1-6, 8, 10 and 11 are done. Clusters 7, 9, 12, 13 and 14 are left on purpose.
- **Discord presence** is a plugin: the bundled copy in `examples/plugins/discord-presence` and the public repo
  `legato-app/discord-presence` (MIT, API 2).
- **Docs site**: Fumadocs, static search at `/legato/api/search`. A `site` job in `check.yml` builds it on every check.
- **Head commit**: never `[skip release]` on the last commit of a push you want as a Beta; `release.yml` reads its
  first line.
- **Stable**: only on the owner's word, never on a Beta's green CI.

## Not tried for real
- Two PCs in Sync Mode with a Spotify disconnect, and an `import-back` on the second PC.
- The blind test's timer in the installed app.
- A folder of `.m4b` and `.m4a` books, with Audiobooks on and off (the folder chip is not seen on screen; the demo has no
  folders). `.mp4` chapters are not read: scans take no video container.
- A plugin with an icon, in the installed app.
- A crossfade with real YouTube embeds.
- The site build with `motion` 14.14.0 (the next `pages` run is the proof).
- Android: `check.yml` does not compile it on platforms; the owner decides whether to add it (CI time).

## Known limits
- Sync: a PC whose clock is slower than an earlier `import-back` still loses to it; not changed.
- Sync: after an update (a restart), every file is merged again once, so the sweep runs then.

## Next, in order
1. **The owner's Beta push**, now that 33 points are reached: `git push origin platforms:master`, after a `pnpm dev`
   check (the default layout, a YouTube video through the player bar, an album, an artist, the right-click menus, a
   book folder with Audiobooks on and off, the blind test timer). On the owner's word only. **The head must not carry
   `[skip release]`**: the current head is the `[skip release]` handoff commit, so a fresh commit on top comes first.
2. **Lite build**: plan-v2's `L` line "A Lite build next to the full one". Its design waits for the owner's yes before
   any slice. CLAUDE.md's "identifier exactly `app.legato.desktop`" changes with it: the owner's wording.
3. **Plugin author's picture** (`S`, open): verified authors only; no picture file exists yet, the owner gives it.
4. **Blind test on several devices, LAN** (`M`, open): rounds, turns and scores in step; a sync design first.
5. **Crossfade**: a video refused before and reached by an overlap plays another upload (`S`, open, not reproduced).
6. **Plex album gain** (`S`, open): check on a real server whether `gain` ≈ −18 − `loudness`.
7. **Open plan lines**, by title: "Songs old mixes dropped" (`S`), "Reordering a music server's playlist" (`S`), "AutoEQ
   profiles for known headphones" (`S`, licence first), "Hide explicit songs" (`S`, untried), "Share page: no covers and
   no player yet" (`S`), "The remaining JSX moved into one component", and "Code quality" (`L`, clusters 7, 9, 12, 13 and
   14 left).
8. **Profiles on one PC**: plan-v2's `M-L` line, design first; the owner reconfirms the launch picker.
9. **Site and docs follow-ups** (plan-v2, after "The website made beautiful").

## Waiting on the owner
The Spotify legal questions, keeping the profiles launch picker, the Lite design, the AutoEQ data licence, whether Android
joins `check.yml` on platforms, and the plugin author's picture file.

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
