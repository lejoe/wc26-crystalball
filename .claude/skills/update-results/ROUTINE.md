# Daily results routine (Part C)

Scheduled agent that runs `update-results` each morning and opens a PR for review.
Nothing lands on `main` unattended.

- **Schedule:** `15 7 * * *` in local time (Europe/Zurich) = 07:15 local, ≈05:15 UTC.
- **Repo:** `lejoe/wc26-crystalball` (remote `origin`). Needs `gh` authenticated
  with `repo` scope and push rights in whatever environment runs the routine.
- **Working dir:** the task's working folder is your **primary checkout**. Each
  run does its work in a **throwaway git worktree** the routine creates in a temp
  path and **removes at the end** — so your working tree is never touched and
  nothing persists. No separate clone.

## Routine prompt (self-contained)

> You maintain the FIFA World Cup 2026 prediction app in the `lejoe/wc26-crystalball`
> repository. Each morning, bring the real match results current and open a pull
> request for human review. Work in a throwaway git worktree and remove it when
> done. Never merge to `main`.
>
> **Run every shell command as its own step — never chain with `&&`, `;`, or
> `cd … &&`.** Compound commands can only be approved "once" and re-prompt every
> run; single commands can be saved as "always allow." Let `WT` be
> `/tmp/wc26-routine-YYYYMMDD-HHMMSS` and `BR` be `results/YYYY-MM-DD-HHMMSS`
> (today's UTC date + time, so same-day runs never collide).
>
> 1. `git fetch origin`
> 2. `git worktree add WT -b BR origin/main` — a fresh worktree on a new branch off
>    the latest `origin/main` (a worktree can't check out `main`; this avoids it).
> 3. Borrow the primary checkout's already-installed deps instead of reinstalling —
>    symlink them in (one command, no `npm ci`, no network, no lockfile mismatch):
>    `ln -s /Users/lejoe/Projects/lejoe/lejoe-agent/wc2026-prediction/node_modules WT/node_modules`
> 4. `cd WT` — the Bash working directory persists across the steps below. Run each
>    command **exactly as written**: do NOT wrap in `bash -c '… && …'`, `npm
>    --prefix`, or any `&&`/`;` chain. Wrapped/compound commands can't be saved as
>    "always allow" and re-prompt every run.
> 5. Run the `update-results` skill. It scans `src/data/fixtures.ts` and
>    `src/data/bracketResults.ts` for unscored matches dated today-or-earlier,
>    reads scores from the ESPN scoreboard API (`site.api.espn.com`, Wikipedia
>    fallback), writes only matches ESPN marks `status.type.completed === true`
>    (group rows by date+teams; knockout by matchId with slot a/b orientation,
>    asserting feeding groups are really complete), fuzzy-flags drifted team names,
>    and gates on `npx tsc --noEmit` (which runs in WT via the cwd from step 4 —
>    plain command, no wrapper).
> 6. If the skill reports nothing to update, or tsc fails: do **not** open a PR.
>    Run `cd -` (back to the primary repo), then `git worktree remove --force WT`,
>    then `git branch -D BR` (each its own command). Notify the reason and stop.
> 7. Otherwise, each its own command (use `git -C WT` so they never depend on cwd):
>    - `git -C WT add -A`
>    - `git -C WT commit -m "Results update YYYY-MM-DD HH:MM"`
>    - `git -C WT push -u origin BR`
>    - `gh pr create -R lejoe/wc26-crystalball --base main --head BR` with title
>      `Results update YYYY-MM-DD HH:MM` and body (via `--body-file`): the run
>      summary, then a **Fuzzy matches — confirm before merge** section listing
>      every `fetched → canonical` mapping, then the diff overview. One command — no
>      `;` preamble.
> 8. Tear down (each its own command): `cd -` (back to the primary repo),
>    `git worktree remove --force WT`, `git branch -D BR` (the branch lives on
>    `origin` via the PR). Remove any temp PR-body file you created. Notify with the
>    PR link and the summary.
>
> Never merge to `main`. Never clear or migrate browser predictions. Never change
> bracket pick semantics or grade a prediction. The human reviews, confirms any
> fuzzy matches, and merges.

## Creating the schedule

Create a **local scheduled task** (the `scheduled-tasks` tool / `/schedule`) with
cron `15 7 * * *` and the prompt above. In the task's **Edit** form set the
**working folder** to your **primary checkout** and leave the worktree toggle
**off** (the routine manages its own throwaway worktree so it can guarantee
teardown — the native toggle runs *inside* a worktree, which can't remove itself).
It runs in this app under your local `gh` auth, so it only fires while the app is
open (otherwise on next launch). Each run uses a unique `BR` branch and a unique
`WT` worktree, so same-day re-runs never collide.

**Pre-authorize once (no settings files):** click **Run now**, then select
**"always allow"** on each permission prompt. Because every command is a single,
un-chained statement, each can be saved this way; the approvals are stored on the
task (review/revoke from its detail page) and future runs are prompt-free. Per the
[docs](https://code.claude.com/docs/en/desktop-scheduled-tasks#permissions-for-scheduled-tasks),
compound `&&` commands can only be allowed once — which is why the steps above are
kept one command each. Verify `gh` has push rights to `origin`.
