# Handoff

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; its older
versions are in git (`git log -p -- docs/notes/handoff.md`). Updated 2026-11-26.

## Where things stand
- **Repository**: `legato-app/legato`, moved from the owner's personal account (`97485874`, `9c42a31f`, `bd364e6d`). GitHub
  redirects the old address, so installed versions still find their update feed. Links in the code name `legato-app`
  only; old share links are no longer read. Org profile repo: `legato-app/.github`.
- **master** (origin) = `27377f6a`. Latest Stable **1.2.10**. Latest Beta **v1.2.148** (2026-11-19).
- **platforms** = master + **71 local commits, none pushed** (`git rev-list --count origin/master..HEAD`; with this
  handoff's commit, 72). The next push is a Beta only, on the owner's word. `node scripts/release.mjs --dry-run` gives
  **v1.2.219** before this commit, so **v1.2.220** after it.
- **Never put `[skip release]` on the last commit of a push you want as a Beta**: `release.yml` reads the head commit's
  first line.
- **Stable**: only on the owner's word, never on a Beta's green CI.
- **Version rule** (`CONTRIBUTING.md` › Version): `MAJOR.MINOR` is in `src-tauri/tauri.conf.json`; the patch is the number
  of commits since the base in `BASES` (`scripts/release.mjs`), with `n % 1000`. A `MAJOR.MINOR` bump is the owner's call.
- **Before any push**: a clean tree; `git log --name-only --format= origin/master..HEAD | grep -i notes/report` prints
  nothing; `pnpm e2e` when the push touches startup (`setup` in `src-tauri/src/lib.rs`, anything that reads `AppState`).
- **Heavy commands** (`pnpm check`, `pnpm e2e`, `pnpm build`): only after the local free-PC check, at most 4 jobs
  (`CARGO_BUILD_JOBS=4`), 4 test threads, below-normal priority, one at a time, targeted first. GitHub's CI is the gate.
- **Reports** (`docs/notes/report*.md`) are git-ignored and never committed. Reports stay private: no owner data in tracked files.
- **CodeQL**: 31 alerts dismissed; 2 fixed in code on `platforms`, still open on GitHub until the fix reaches master.
- **Android**: desktop-only code sits behind `#[cfg(desktop)]` or `#[cfg(windows)]`. The Android toolchain is not usable on the
  working PC: CI's android job is the check.
- **Website**: `legato-app.github.io/legato`, deployed from master, 18 languages. Next is 16.4.6 (Dependabot PR #28 and #27
  merged on GitHub).
- **Landing**: `node scripts/landing/render.mjs` renders the hero's camera moves and the README picture (Blender, headless,
  from `scripts/landing/scene.py`; `docs/landing.md`). The renders stay outside the repo. Automation at each Stable is planned.
- **winget**: microsoft/winget-pkgs#474341 (Stable 1.1.681) waits for a moderator; each new Stable needs a new manifest
  (`packaging/README.md`). The identifier `Clovis500c.Legato` is kept on purpose.
- **Discord pings** (`CONTRIBUTING.md` › Releasing, `.github/workflows/release.yml`): a Beta's title is "Legato vX.Y.Z beta"
  and gets an embed; the promotion renames it to "Legato vX.Y.Z".

## What this range changed (origin/master..HEAD)
- **Playback**: external music plays through YouTube only; Apple Music previews are the last resort and never block the
  YouTube search (`cd941244`). Spotify only reads playlists: its playback is gone (`6a1c285e`), its web-player entry too
  (`2db97139`). Local files and personal servers (Subsonic, Jellyfin, Plex) play directly.
- **Playlist sync**: a refused add stays in the local playlist and is sent again at later syncs, 10 tries at most; tries made
  while signed out don't count (`pending_push`, schema 24, `3c6fe498`, `81ab4d75`). A refused removal puts the song back with
  its mark (`f952c6bf`); a refused like leaves its list only once it is kept (`1747f828`).
- **Songs added from Legato** keep the newest end of an imported playlist, and removing one drops its mark (schema 25,
  `playlist_added` with `sent`: `3fb6e3e4`, `25d949ca`).
- **Complete-read guard**: `PlaylistRead { tracks, complete }` (`model.rs`). A short read never removes songs, for YouTube,
  Subsonic, Apple and Spotify page reads (`ceab5c49`, `ed9056b2`, `d622baf0`).
- **Play counts** are never read as an artist (`f7dd6359`, `c0e7a2cf`, `a53dab20`, `b0f1bb70`).
- **Apple**: a shared id alone no longer merges two songs (`2f6e6d58`); a hit of unknown length is no match when the song's
  length is known (`dd7a0200`); a one-time repair undoes wrong Apple links (`f6b822ff`, `appleRepair1` in
  `crates/connectors/src/itunes.rs`).
- **Signed-out notice**: one calm notice, and refused adds are said to be kept (`b2909f8f`).
- **Recommendation**: a radio song's outcome counts in the session (`446cd734`); a replayed song counts as a like at once
  (`d04cbfb3`); explore picks learn from the session (`70994c03`).
- **Release jobs** have no Rust or pnpm cache (`c967f2c4`, `f50f2838`). CSS cleaning holds when a removal joins pieces (`8e93910e`).
- **Landing**: the hero's 3D scene zooms on the visitor's device (`f87c4d18`) and stays small, hidden on short screens
  (`0f269604`); the README picture is an animated SVG (`2da0cdf7`).
- **Docs**: code is written for a human contributor (`c2369538`); the website's privacy rows are `PRIVACY` alone (`4fbd67b0`).

## Next, in order
1. **Opus**: the old YouTube mix rows. Rows from a YouTube Music mix (id `RD…`, not `RDCLAK…`) that sit in no other playlist,
   were never played, rated or liked: the fix stops new ones, not these. Design first, with a library backup and a test on a
   fixture. The owner has asked for it to run by itself; they still have to confirm that.
2. **Opus**: review the open items of `f7dd6359..ff820ac2`: the audit of the `?` that drop a row in `rows()` and
   `row_track_with`. Also a check that the review's HIGH and MEDIUM fixes landed (`ceab5c49`, `81ab4d75`, `1747f828`, `f952c6bf`).
3. **Opus**: Last.fm's signed-out case (`src-tauri/src/lastfm.rs`), the same calm notice and a retry after reconnecting;
   confirm the account badge for YouTube Music.
4. **Opus**: a clause-by-clause audit of Spotify's Developer Policy (sections III and VI) for what Legato still does with
   Spotify: the sidebar's look, a game with Spotify (blind test), listening rooms, crossfades, analysis of Spotify content.
   No legal advice here; the realistic risk is Spotify cutting API access.
5. **Opus, then Sonnet**: the sidebar's layout, differentiated where the audit says so.
6. **Opus**: the plugin API v2 design (`docs/plugins.md`): a plugin's manifest lives in its own repo; a registry repo
   `legato-app/plugins` lists each plugin's repo, pinned version and hash. Updates install alone when no new permission
   is asked. Discord Rich Presence becomes an external example plugin, then the native one is removed.
7. **Opus**: profiles on one PC (plan-v2 › Profiles on one PC; the choices are there).
8. **Sonnet**: a listening history page, local only (plan-v2, the line about it).
9. **Owner's choices**: the landing's light frame and its subtitle (Spotify only imports playlists now); the phone's YouTube
   iframe is 0 × 0 (`fixed size-0`), and the YouTube embed rules want at least 200 × 200 visible; the organisation name
   `legato-app`; the Lite build's design (Opus first).
10. **Sonnet**: batches of small plan lines, in plan-v2's order. A targeted readability pass on the files a newcomer reads
    first (CONTRIBUTING, `shared/api.ts`, the store), after the owner agrees.
11. **At each Stable**: the release note line for the end of Spotify playback; the landing automation.

## Adaptive Sound
One steady gain per song, from its gated integrated loudness (`crates/dsp`, `live.js`); no buttons and no line under the
volume; Settings keeps the switch and the level. Not heard yet: three tries are in the unticked plan line.

## Try first (the owner)
Only what is untried. Most of the rest is behind a setting that is **off** by default.
- **Phone, screen off**: the extras rest and the YouTube player is untouched. Battery not measured.
- **Phone, update**: a downloaded update waits for the end of the song (toast); a second tap on Update installs now.
- **Songs**: a YouTube Music mix that YouTube regenerates is no longer synced into the library (`c1ec0a36`); existing rows stay.
- **Discovery**: skip two or three « new » picks at the end of Up next and see fewer new ones after.
- **Sync**: two PCs on this build change a playlist, the other has it in under 10 s.
- **Imported playlists**: a song added here stays at the newest end through the next import.
- **Machine translations to review**: the « video out of sight » setting, the « why » texts, « New for you », the blind-test
  texts, the Subsonic rename message.
- **Right to left** (Arabic, Hebrew): never looked at on a screen.

## Open
- **Internet rooms** (plan line 17): slices 1 and 2 are in (`8318413b` to `6a94f326`): the Nostr meeting, the encrypted
  protocol over a WebRTC data channel (str0m), a STUN address. Still to do: the « Par Internet » screen (slice 3), the privacy
  row and the host list (slice 4). Nothing has reached a relay or a STUN server yet, and it has never run across two networks.
- **Android crackle** (`390e82fe`, `c0245823`, `21e49c24`): trials in the plan line; the Live Editor's idle parts are unwired.
- **Imported playlists and Sync**: until both PCs run a build with the live sync, an older PC can erase a song added to an
  imported playlist on re-import.
- **Discord paste and drop** (`9edf6fad`, `68638508`): a Discord link dropped on a text field starts the download instead of
  inserting text.
- **Idle YouTube embed** (`611c22c2`): not built. Measure first (Task Manager, WebView2 processes).
- **Not run on a device**: Android Back (`b9d175f6`), the Discord picture from the real CDN, a real QR scan, every phone
  screen of the last weeks, the widgets (`459fa71a`, `03fafe17`, `0ba6d547`), the sign-out notice on a real account.
- **Plex loudness**: not done (needs a real server and a doc). Jellyfin's −18 LUFS target is an unverified assumption.
- **Never run for real**: plan-v2 › Check live in the real app.

## Releasing
Only on the owner's word (`CONTRIBUTING.md` › Releasing). A Beta: `/release-check`, then `git push origin platforms:master`.
Stable: `git fetch --tags`, `node scripts/promote.mjs --dry-run <version>`, then
`gh workflow run promote.yml --repo legato-app/legato --ref master -f version=<version>`; check
`releases/latest/download/latest.json` after.

## Reprendre l'orchestration
For a new orchestrating session with an empty context:
1. Read `CLAUDE.md`, this handoff, then only the useful parts of `docs/notes/plan-v2.md`. The owner's private notes
   (`docs/notes/report*.md`) are untracked: read them for what was asked and decided, never copy them into tracked files.
2. **Sessions**: one per model, reused rather than restarted. Sonnet (builds, `claude-sonnet-5-5`):
   `local_1f865683-e7e7-4c1e-b422-4199295d93b4`. Opus (reviews and designs, `claude-opus-5-5`):
   `local_c797dcef-a048-4ede-adbe-a2b52134a564`. Haiku (docs, handoff, reports, checks, no code):
   `local_56454edc-071e-4ca5-84df-c4b643800e1f`.
3. **Briefs**: verify each fact against the code or git before writing it, with file and doc references.
4. One writer at a time on the checkout. Stage by name (`git add <file>`), never `git add -A` or `.`. Commit only what the
   task names. No push without the owner's word.
5. End markers go in `docs/notes/report-inbox.md` (`Clôture N finie : <hash>`); the orchestrator merges them into the
   private report and empties the inbox.

## Two PCs
The owner works on two Windows PCs, each with the repository in its own folder, kept alike through GitHub. One holds the
signing keys and the Android tools. Each PC's own setup is in Claude Code's private memory on that PC, not in the repo.

## Traps not written elsewhere
- `[skip release]` in a push's head commit skips that push's Beta.
- Google refuses lists, radios and artist pages for 15 minutes after a refusal (`searchpace::Quiet`): never retry in a loop,
  never route around it. Expect it in any search test.
- `app.state()` before `app.manage()` panics at launch (`36785ec2`, fixed in `468c51ab`): only the CI's e2e caught it.
- Tauri 2.12's `focused`, `focusable` and `skip_taskbar` exist only on desktop: keep them behind `#[cfg(desktop)]`.
- A new setting's id is never changed (it is the `data-setting`, the locale key and the search key); a renamed setting's
  spoken name goes through `labelOf`, not `tr('<id>')`.
- **CRLF / LF**: a working copy in CRLF fails `no_sync_command_locks_the_library` (it wants LF). Convert `src-tauri/src/*.rs`
  to LF locally; git sees no real change, so an empty-diff `M` in `git status` is that artefact: never commit it.
- `scripts/promote.mjs --dry-run` needs the release tags locally: `git fetch --tags` first.
- Android builds rewrite `src-tauri/gen/android/app/tauri.properties`: restore it after.
- The website: `npx tsc -p site` shows stale `.next/types` errors until `npx next build` rewrites them. The first `pnpm build`
  of `site/` can stop on Next's own update check (`SecurityFatalError`): a second run passes.
- `pnpm install` after a merge that changes a lockfile: run it at the root, and `pnpm add` inside `site/` for the website.
- Ad-hoc Python edits of CRLF files through `open()` keep CRLF on Windows; write JS or TS with the edit tool instead.

## History
Releases 0.1 to 1.0 (the redesign), the rename to Legato (2026-10-29, finished 2026-11-13), 1.1 and the v2 plan (Stable
1.1.479, 2026-10-31), Stable 1.1.681 (2026-11-05), Beta 1.2.1 (the first on the 1.2 line), Stable 1.2.10 (2026-11-14). Betas
1.2.41 (2026-11-15), 1.2.95 and 1.2.101 (2026-11-18), 1.2.120 and 1.2.143 (2026-11-19), 1.2.148 (2026-11-19). The
organization moved to `legato-app` on 2026-11-25. The recommendation algorithm, the lots 39 to 67 and the Discord pings are
in the release notes and in `git log`.
