# Handoff

**Start here:** CLAUDE.md, then this file, then [workflow.md](workflow.md) (how the work runs), then the plan-v2 sections
you need. Private notes are `docs/notes/report*.md`, on the PC that wrote them only; they are not in git.

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; older
versions are in git. Updated 2026-11-26.

## Where things stand
- **Repository**: `legato-app/legato`. **master** on origin = `aaab322c` (docs only since the last Beta). `platforms` is
  that commit plus 28 local ones (head `5b1eb8ad`), not pushed. The local `master` checkout lags: use `origin/master`.
  Work goes to master by push only, on the owner's word.
- **Last Beta**: v1.2.298 = `a4412ea1` (2026-11-26: the Discord artist picture comes with the presence; plugin authors
  verified by signature, the trusted list empty). Before it, v1.2.288 = `69fb248c`. Stable **1.2.10** (2026-11-14).
- **Next Beta**: the 28 local commits, once CI is green and the owner has checked the default layout with `pnpm dev` (a
  YouTube video playing through the player bar, the sidebar's resize, an album, an artist, a playlist, the right-click
  menus). The shell, the player bar and every page header changed for everyone; only the browser demo has shown them.
- **Theme layout**: slices 1-8 landed (`75ce0116` to `3109e269`, with fixes); 9-13 open. Not tried for real: a real YouTube
  video with a moved player bar, right-to-left, the installed app.
- **Discord presence** is a plugin: the bundled copy in `examples/plugins/discord-presence` (1.0.1; the app refreshes
  older installed copies at launch) and the public repo `legato-app/discord-presence` (MIT, API 2), still at 1.0.0.
- **Docs site**: Fumadocs (`fumadocs-core` / `fumadocs-ui` 16.19, `fumadocs-mdx` 15.6), its own `(docs)` root layout,
  static search at `/legato/api/search`. Pushed as `[skip release]` (`c382ba3d..0e7acc6b`). A `site` job in `check.yml`
  builds it on every check, so a broken site holds back the Beta. Developer pages come from `docs/architecture.md`,
  `docs/plugins.md` and `CONTRIBUTING.md` (`site/components/repoDocs.ts`).
- **Head commit**: never `[skip release]` on the last commit of a push you want as a Beta; `release.yml` reads its
  first line.
- **Stable**: only on the owner's word, never on a Beta's green CI.

## Next, in order
1. **The owner's Beta push**, on the owner's word only: `git push origin platforms:master` (see Where things stand).
2. **Theme layout, slices 9-13**: plan-v2's `L` line "A theme file alone can change the app's whole layout". Next is
   slice 9 (library lists and their column order), then 10 Home, 11 Now Playing parts, 12 `.theme` export and import
   keep `layout`, with docs and site copy, 13 after v1 (a theme's named plugin). No theme scripts in v1 (the owner's word).
3. **Plugin pictures and signing**, after the 2 Dec reset: (a) the bundled Discord Presence copy refresh is done and
   ticked; (b) optional plugin pictures, verified authors only; (c) Legato's signing key, Discord Presence signed,
   `discord_move::FILES` carrying the signature files. Then `legato-app/discord-presence` to 1.0.1 (an external repo: the
   owner's call).
4. **Lite build**: plan-v2's `L` line "A Lite build next to the full one", with its design and slices under it.
5. **Profiles on one PC**: plan-v2's `M-L` line, with its design under it.
6. **Open plan lines**, by title (numbers move): "Right-click › Hide", "Normal videos (a story web series) counted as
   music", "Much fuller diagnostics", "Playlist edits sent back to the server", "Server songs levelled", "The remaining
   JSX moved into one component".
7. **Site and docs follow-ups** (plan-v2, after "The website made beautiful").

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
