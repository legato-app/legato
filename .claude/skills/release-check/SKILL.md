---
name: release-check
description: Checks a branch before the owner pushes it to master (every green push to master is a Beta release and can deploy the website) or promotes a beta to Stable. Use when the owner asks whether something is ready to push, release or promote, or types /release-check. It only reads and runs local checks; it never pushes, merges or promotes.
---

# Release check

A push to `master` that passes `check` becomes a Beta prerelease on its own (`release.yml`); `site/` changes deploy the
website (`pages.yml`); Stable is promoted by hand (Actions › promote). So the check happens before the push. Pushing,
merging and promoting are the owner's, said in the session: report, don't do them.

Run each step and report it in one line, in French for the owner, with what failed and why.

1. **Where things stand**: `git status` (nothing uncommitted that should go), the branch, and what would go out:
   `git log --oneline origin/master..HEAD`. A branch other than `master` is merged by the owner.
   The owner's private session reports never go out, not even in a commit that a later one deletes:
   `git log --name-only --format= origin/master..HEAD | grep -i notes/report` prints nothing (`.gitignore` keeps
   `docs/notes/report*.md` out; a commit that took one is rewritten before the push, never just undone after).
2. **The suite**: `pnpm check` green (types written and committed: `git status` clean after it,
   `ui/src/shared/generated` included). Long: run it in the background. It runs on Windows only; GitHub also builds the
   shell on macOS (Linux: the crates only), where clippy denies warnings: a `src-tauri` import or function used only
   under `#[cfg(windows)]` needs the gate too (a path in the gated block, or `cfg_attr(not(windows), allow(dead_code))`).
   A changed workflow file: no `: ` in an unquoted value (GitHub refuses the whole file: no jobs, no beta).
3. **The smoke test**: `pnpm e2e` when the commits touch playback, the welcome, search, the library scan, or how the app
   starts and ends (`docs/development.md`). It blocks `check` on GitHub since 2026-11-01, so a failure here holds the
   beta back.
4. **What users will read**: `node scripts/release.mjs --dry-run` prints the next version and the update card's notes
   (the `feat` / `fix` / `perf` subjects since the last `v*` tag, 20 at most). Each should make sense to a listener; a
   commit that shouldn't release at all says `[skip release]` in its first line.
5. **Version**: `MAJOR.MINOR` alike in `src-tauri/tauri.conf.json`, `package.json` and the workspace `Cargo.toml`
   (the patch number is CI's). The updater's Stable URL in `tauri.conf.json` stays
   `releases/latest/download/latest.json`: installed versions read it.
6. **Side effects**: anything new that a release build does on the PC outside the app's own folders (the Run key,
   folders, keychain moves, updates) sits behind `identity::installed()` (`src-tauri/src/identity.rs`).
7. **Privacy**: if the commits make the app reach a new host or send something new, the website's rows
   (`site/components/content.tsx` › `PRIVACY`, `SERVICES`) say so. With `site/` changed: `pnpm build` in `site/` passes.
8. **Docs**: `docs/notes/plan-v2.md` ticked for what landed, `docs/notes/handoff.md` current; the "Check live in the real
   app" lines name what was never tried for real, so the owner knows what a beta brings untested.
9. **Promoting a beta to Stable**: `node scripts/promote.mjs --dry-run` (needs `gh` signed in) shows which version and
   which notes; the betas since the last Stable should have run a while on the owner's PCs.

End with: ready or not, the blocking items first, then what stays untested.

## Stable gate (the owner's ask, 2026-11-26: "un test ultra strict")

Before any promotion to Stable, every item below, in order. One red item = **NO-GO**; no item is skipped, waived or
"probably fine": a step that cannot run is red until the owner says otherwise in the session. This is the only time
the heavy commands run without a separate ask: asking for the Stable gate is that ask. Low priority, 4 jobs
(`CARGO_BUILD_JOBS=4`, `RUST_TEST_THREADS=4`), one heavy command at a time, never while the owner's PC is busy.

1. **The candidate is exact**: `node scripts/promote.mjs --dry-run <version>` names the beta; its tag's commit is what
   gets tested, checked out apart (`git worktree add ../legato-stable v<version>`), never the working branch.
2. **GitHub was green for that commit**: `gh run list --repo legato-app/legato --commit <sha>`: `check` (e2e
   included), `release` (every job: Windows, Android, APK) and `pages` all success; no red or cancelled rerun hidden
   under a green one. CodeQL: no open alert of severity high or above.
3. **The full local gate in that worktree**: `pnpm install --frozen-lockfile`, `pnpm check` (then `git status` clean:
   types already committed), `pnpm e2e`, `pnpm vite build` + `node scripts/budget.mjs` (under budget), `pnpm build` in
   `site/`, then `pnpm build` (the installer builds). Any warning that clippy or the build turns into an error is red.
4. **It ran for real**: the beta was out at least 3 days, installed on the owner's PCs (and the phone if Android
   changed), with no newer `fix` commit on master that touches what this beta brought. The owner says so in the
   session; a beta nobody ran is red.
5. **Nothing untested ships switched on**: every plan-v2 line ticked since the last Stable with "not tried for real" or
   "Never seen" is either tried by the owner now (listed for them, one line each, what to do and what to see) or behind
   a setting that is off by default. List each one with its state.
6. **Data is safe**: if `SCHEMA_VERSION` (`crates/core/src/library.rs`) or `DEFAULTS_VERSION` (`theme.ts`) moved since
   the last Stable tag (`git diff v<stable>..v<version> -- <file>`), each migration has its test, and the owner's
   library survives it: a copy of their library opened read-only by the candidate in `pnpm dev` (never the installed
   app's own folder), songs, playlists, likes and history counted before and after.
7. **The update works**: the beta's `latest.json` has a signature for every platform it lists, and an update from the
   current Stable to the candidate was done for real on one PC (the owner's), settings and sign-ins kept.
8. **What users read is true**: `promote.mjs --dry-run`'s notes read by a listener's eyes (no internal word, nothing
   that isn't in this build); the website's `PRIVACY` rows match every host the app reaches; `docs/notes/handoff.md`
   and the release notes agree.
9. **Leak check on the whole range**: `git log --name-only --format= v<stable>..v<version> | grep -i notes/report`
   prints nothing; no personal data in the commits or the files they changed.

Report in French, one line per item with its proof (the command and what it printed), then the verdict: **GO** (all
green) or **NO-GO** with the blocking items first. A GO is never a promotion: `promote.yml` is run on the owner's
word only.
