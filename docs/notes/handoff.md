# Handoff

Where the work stands, for a session with no history here. Read this first, then only the parts of
[plan-v2.md](plan-v2.md) you need. Rewrite it, short, when a branch, a release or the next step changes; its older
versions are in git (`git log -p -- docs/notes/handoff.md`). Updated 2026-11-25.

## Where things stand
- **Repository**: `legato-app/legato` (moved from `Clovis500c/legato` in `97485874`, `9c42a31f`, `bd364e6d`). GitHub
  redirects the old address, so installed versions still find their update feed; links in the code name `legato-app`
  only, and old share links are no longer read. Org profile repo: `legato-app/.github`.
- **master** (origin) = `27377f6a`. Latest Stable **1.2.10** (`releases/latest`). Latest Beta **v1.2.148** (2026-11-19).
- **platforms** = master + **33 local commits, none pushed** (`git log --oneline origin/master..HEAD`). Only the owner's word
  pushes ("push"). The Beta that a push releases: `node scripts/release.mjs --dry-run` gives **v1.2.182** (checked after
  this commit).
- **Never put `[skip release]` on the last commit of a push you want as a Beta**: `release.yml` reads the head commit's
  first line.
- **Version rule** (`CONTRIBUTING.md` › Version): `MAJOR.MINOR` is in `src-tauri/tauri.conf.json` (`1.2`); the patch is the
  number of commits since the base in `BASES` (`scripts/release.mjs`), with `n % 1000`. A bump of `MAJOR.MINOR` is the
  owner's decision.
- **Heavy commands** are allowed, with limits, after a local free-PC check (a private script kept outside the repo; see the
  orchestrator's notes). Limits: 4 jobs (`CARGO_BUILD_JOBS=4`), 4 test threads, below-normal priority, one heavy command at a
  time, targeted first. The full `pnpm check`, `pnpm e2e` and `pnpm build` only when a push needs them. GitHub's CI is the gate.
- **Before any push**: a clean tree; `git log --name-only --format= origin/master..HEAD | grep -i notes/report` must print
  nothing; `pnpm e2e` when the push touches startup (`setup` in `src-tauri/src/lib.rs`, anything that reads `AppState`).
- **Stable**: only on the owner's word, never on a Beta's green CI.
- **Reports** (`docs/notes/report*.md`) are git-ignored and never committed.
- **Android**: desktop-only code sits behind `#[cfg(desktop)]` or `#[cfg(windows)]`. The Android target and the Kotlin
  toolchain are not usable on the working PC: CI's android job is the check.
- **Website**: `legato-app.github.io/legato`, deployed from master, 18 languages, not yet Arabic or Hebrew. The old
  `Clovis500c/clovis500c.github.io` repo still exists; its redirect page is not checked here.
- **Landing 3D**: `scripts/landing/scene.py` (Blender, headless, Eevee). The renders and `.blend` files live outside the repo;
  the Figma frames are updated by hand. Automation at each Stable is planned, not built.
- **winget**: microsoft/winget-pkgs#474341 (Stable 1.1.681) waits for a moderator; each new Stable needs a new manifest
  (`packaging/README.md`). The winget identifier `Clovis500c.Legato` is kept on purpose.
- **Discord pings** (`CONTRIBUTING.md` › Releasing, `.github/workflows/release.yml`): MonitoRSS reads the releases feed. A
  Beta's title is "Legato vX.Y.Z beta" and gets an embed with the Beta News Ping role; the promotion renames it to
  "Legato vX.Y.Z", and the Updates Ping follows. Titles checked with `gh`; the Discord messages themselves not seen here.
- **Dependabot**: PRs #27 (npm) and #28 (Cargo) merged on GitHub; the website's `next` is 16.4.6.

## The algorithm
`docs/recommendation.md` is where it lives: the design, the weights (first guesses, never heard by ear), the measured
numbers. Candidates: the library, the YouTube Music radios of the last songs (merged, with votes), the related artists of a
mix's top song, and « New for you ». The score ranks them: fit × preference, then diversity. Session signals (skips,
replays, pairs skipped twice, radio songs' outcomes) move it. Each pick shows why (`pickWhy.ts`). Google's refusal pauses
lists, radios and artist pages for 15 minutes (`searchpace::Quiet`).

## Adaptive Sound
One steady gain per song, from its gated integrated loudness (`crates/dsp`, `live.js`); no buttons and no line under the
volume; Settings keeps the switch and the level. It replaces volume levelling while on. Not heard yet: three tries are in
the unticked plan line.

## Try first (the owner)
Only what is untried. Most of the rest is behind a setting that is **off** by default.
- **Phone, screen off**: the extras rest (visualizer, moving cover, clocks, backdrop) and the YouTube player is untouched.
  Battery not measured.
- **Phone, update**: a downloaded update waits for the end of the song (toast), and a second tap on Update installs now.
- **Songs**: a YouTube Music mix that YouTube regenerates is no longer synced into the library (`c1ec0a36`); the library's
  existing rows are not deleted.
- **Discovery**: skip two or three « new » picks at the end of Up next and see fewer new ones after.
- **Sync, the owner's three asks**: two PCs on this build change a playlist, the other has it in under 10 s; the phone's
  Home then the PC; come back to the app after a PC change, without visiting the Sync screen.
- **Lots 59 to 67**: the visualizer's menu, the TV home's Up next row, « Translate… » under sung lines, the phone's five
  bottom tabs, the blind test (one playlist, up to four players, « Guess the artist »), the Stream Deck « Like » key
  (never loaded on a real deck), « New for you ».
- **Subsonic**: rename a playlist on a Navidrome; with the server off, the old name comes back.
- **Machine translations to review**: the « video out of sight » setting, the six « why » texts, « New for you », the
  blind-test texts, the Subsonic rename message (19 languages each).
- **Right to left** (Arabic, Hebrew): never looked at on a screen.

## Open
- **Internet rooms** (plan line 17): slices 1 and 2 are in (`8318413b` to `6a94f326`): the Nostr meeting, the encrypted
  protocol over a WebRTC channel (str0m), a STUN address. Still to do: the « Par Internet » screen and its commands
  (slice 3), the privacy row and the host list (slice 4). Nothing has reached a relay or a STUN server yet, and it has never
  run across two networks or a NAT.
- **Android crackle** (`390e82fe`, `c0245823`, `21e49c24`): trials in the plan line; the Live Editor's idle parts are unwired.
- **Imported playlists and Sync**: until both PCs run a build with the live sync, a PC still on an older one can erase a song
  added to an imported playlist on re-import.
- **Discord paste and drop** (`9edf6fad`, `68638508`): a Discord link dropped on a text field starts the download instead of
  inserting text.
- **Lyrics glide** (`84ea321d`): a line arriving within 650 ms of the previous glide cuts the rest of that glide.
- **Idle YouTube embed** (`611c22c2`): not built. Measure first (Task Manager, WebView2 processes).
- **Channel picture never tried for real** (`91a7b86c`, `ab016e43`): no real YouTube call yet.
- **Not run on a device**: Android Back (`b9d175f6`), the Discord picture from the real CDN, a real QR scan, every phone
  screen of the last weeks, the widgets (`459fa71a`, `03fafe17`, `0ba6d547`).
- **Plex loudness**: not done (needs a real server and a doc). Jellyfin's −18 LUFS target is an unverified assumption.
- **Radio station metadata (ICY)**: skipped; only a real station can check it.
- **Never run for real**: plan-v2 › Check live in the real app.
- **For the owner**: the plan's remaining lines (accounts, taste, the Xbox Game Bar widget, AutoEQ, concerts, a « sans
  paroles » filter for Focus, which the library cannot support yet); the YouTube iframe sits in a 0 × 0 box on the phone
  (`fixed size-0`); the Discord bot and its signature; the Arabic and Hebrew review.

## Next, in order
1. **Opus**: the internet rooms' interface and privacy rows (slices 3 and 4 of the room line).
2. **Opus**: the plugin API v2 design, with Discord Rich Presence as an external example plugin (its own repo in the
   `legato-app` org), then remove the native one. The design comes first (`docs/plugins.md`, a permission to talk to the
   local Discord client).
3. **Opus**: the Lite build design (`identity::installed()`, `rename.rs`, the updater, Sync Mode between a full and a Lite
   PC), then slices; measured against the full build with `pnpm bench`.
4. **Opus**: profiles (choices in plan-v2 under « Profiles on one PC »).
5. **Opus**: the security pass.
6. **Sonnet**: batches of small plan lines, in plan-v2's order.
7. **At each Stable**: the landing automation (README as an animated SVG built from the renders, the site in HTML/CSS).

Releasing, only on the owner's word (`CONTRIBUTING.md` › Releasing). A Beta: `/release-check`, then
`git push origin platforms:master`. Stable: `git fetch --tags`, `node scripts/promote.mjs --dry-run <version>`, then
`gh workflow run promote.yml --repo legato-app/legato --ref master -f version=<version>`; check
`releases/latest/download/latest.json` after.

## Reprendre l'orchestration
For a new orchestrating session with an empty context:
1. Read `CLAUDE.md`, this handoff, then only the useful parts of `docs/notes/plan-v2.md`. The owner's private notes
   (`docs/notes/report-asks.md`, `report-2026-11-12.md`, `report-2026-11-18.md`, `report-2026-11-19.md`,
   `report-2026-11-25.md`, `report-orchestrator-prompt.md`) are untracked: read them for what was asked and decided, never
   copy them into tracked files.
2. **Sessions**: one per model, reused rather than restarted. Sonnet (builds, `claude-sonnet-5-5`):
   `local_1f865683-e7e7-4c1e-b422-4199295d93b4`. Opus (reviews and designs, `claude-opus-5-5`):
   `local_c797dcef-a048-4ede-adbe-a2b52134a564`. Haiku (docs, handoff, reports, checks, no code):
   `local_56454edc-071e-4ca5-84df-c4b643800e1f`. The builder works in small slices; the reviewer rereads each batch and does
   the delicate parts (startup, security, the release).
3. **Briefs**: verify each fact against the code or git before writing it, and give file and doc references.
4. One writer at a time on the checkout. Stage by name (`git add <file>`), never `git add -A` or `.`. Commit only what the task
   names. No push without the owner's word.
5. **Heavy checks**: only after the local free-PC check, with the limits in « Where things stand »; targeted first.
6. End markers go in `docs/notes/report-inbox.md` (`Clôture N finie : <hash>`); the orchestrator merges them into the private
   report and empties the inbox. The weekly usage cap is 75 %: plan the work to fit under it.

## Two PCs
The owner works on two Windows PCs, each with the repository in its own folder, kept alike through GitHub. One holds the
signing keys and the Android tools. Each PC's own setup is in Claude Code's private memory on that PC, not in the repo.

## Traps not written elsewhere
- `[skip release]` in a push's head commit skips that push's Beta: keep it off the commit that ends a push you want released.
- Google refuses lists, radios and artist pages for 15 minutes after a refusal (`searchpace::Quiet`): never retry in a loop,
  never route around it. Expect it in any search test.
- `app.state()` before `app.manage()` panics at launch (`36785ec2`, fixed in `468c51ab`): only the CI's e2e caught it.
- Tauri 2.12's `focused`, `focusable` and `skip_taskbar` exist only on desktop: keep them behind `#[cfg(desktop)]`.
- macOS has only 127.0.0.1 on its loopback: a test that binds 127.0.0.2 must skip there.
- Node 22's `node --test` wants its glob in quotes.
- Settings labels: an `id` is never changed (it is the `data-setting`, the locale key while there is no label, and the search
  key); a renamed setting's spoken name goes through `labelOf`, not `tr('<id>')`.
- **CRLF / LF**: a working copy in CRLF fails `no_sync_command_locks_the_library` (it wants LF). Convert `src-tauri/src/*.rs`
  to LF locally; git sees no real change, so an empty-diff `M src-tauri/src/servers.rs` in `git status` is that artefact:
  never commit it.
- The bench's cold start is noisy: run `pnpm bench --quick --skip-build` twice more before believing a regression.
- `scripts/promote.mjs --dry-run` needs the release tags locally: `git fetch --tags` first.
- `git worktree remove` can stop at "Filename too long": `cmd /c rd /s /q "\?\<full path>"`; a Bash `cd` into a worktree
  moves the session's working folder.
- Android builds rewrite `src-tauri/gen/android/app/tauri.properties`: restore it after. PowerShell 5.1 mangles inline JSON:
  give `--config` a file. The page's `fetch` to the `art` scheme fails on Android (CSP): covers go through an `<img>` and a
  canvas (`phoneCover`). `MainActivity.kt` empties wry's `mWebView` field so YouTube is not paused behind other apps.
- Headless emulator: `emulator -avd legato36 -no-window -gpu swiftshader_indirect -no-snapshot -no-audio -no-boot-anim`; stop
  it after a test. Never answer Windows' firewall or any system prompt.
- `pnpm notices` (cargo-about) once on a new PC: a release build stops without `src-tauri/third-party-licenses.html`.
- The website: `app/[lang]`'s static export needs one language besides English in `COPIES`; `npx tsc -p site` shows stale
  `.next/types` errors until `npx next build` rewrites them. The first `pnpm build` of `site/` can stop on Next's own update
  check (`SecurityFatalError`): a second run passes; upgrading Next is the owner's call.
- `pnpm install` after a merge that changes a lockfile: run it at the root, and `pnpm add` inside `site/` for the website.
- Ad-hoc Python edits of CRLF files through `open()` keep CRLF on Windows; a `\n` typed inside a non-raw string in a script
  that writes JS or TS becomes a real newline: write those with the edit tool.

## History
Releases 0.1 to 1.0 (the redesign), the rename to Legato (2026-10-29, finished 2026-11-13), 1.1 and the v2 plan (Stable
1.1.479, 2026-10-31), Stable 1.1.681 (2026-11-05), Beta 1.2.1 (the first on the 1.2 line), Stable 1.2.10 (2026-11-14). Betas
1.2.41 (2026-11-15), 1.2.95 and 1.2.101 (2026-11-18), 1.2.120 and 1.2.143 (2026-11-19), 1.2.148 (2026-11-19). The
organization moved to `legato-app` on 2026-11-25. The recommendation algorithm, the lots 39 to 67 and the Discord pings are
in the release notes and in `git log`. Reviews 23 to 25 were run by Sonnet in the Opus session; that session was switched to
Opus 5.5 only afterwards.
