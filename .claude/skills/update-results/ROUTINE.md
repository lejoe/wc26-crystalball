# Daily results routine (Part C)

Scheduled agent that runs `update-results` each morning and opens a PR for review.
Nothing lands on `main` unattended.

- **Schedule:** `15 7 * * *` in local time (Europe/Zurich) = 07:15 local, ≈05:15 UTC.
- **Repo:** `lejoe/wc26-crystalball` (remote `origin`). Needs `gh` authenticated
  with `repo` scope and push rights in whatever environment runs the routine.

## Routine prompt (self-contained)

> You maintain the FIFA World Cup 2026 prediction app in the `lejoe/wc26-crystalball`
> repository. Each morning, bring the real match results current and open a pull
> request for human review. Steps:
>
> 1. In a clean checkout, `git checkout main && git pull`. Create a branch
>    `results/YYYY-MM-DD` using today's date (UTC).
> 2. Run the `update-results` skill. It scans `src/data/fixtures.ts` and
>    `src/data/bracketResults.ts` for unscored matches dated today-or-earlier,
>    reads scores from the ESPN scoreboard API (`site.api.espn.com`, Wikipedia
>    fallback), writes only matches ESPN marks `status.type.completed === true`
>    (group rows by date+teams; knockout by matchId with slot a/b orientation,
>    asserting feeding groups are really complete), fuzzy-flags any drifted team
>    names, gates on `npx tsc --noEmit`, and emits a summary.
> 3. If the skill reports nothing to update, or tsc fails: do **not** open a PR.
>    Notify with the reason (nothing to update / type error + details), delete the
>    throwaway branch, and stop.
> 4. Otherwise commit the edits, push the branch, and run `gh pr create` with:
>    - title `Results update YYYY-MM-DD`
>    - body: the run summary, then a **Fuzzy matches — confirm before merge**
>      section listing every `fetched → canonical` mapping, then the diff overview.
> 5. Notify with the PR link and the summary. Then `git checkout main` so the
>    working copy is left on a clean `main`, never on the results branch.
>
> Never merge to `main`. Never clear or migrate browser predictions. Never change
> bracket pick semantics or grade a prediction. The human reviews, confirms any
> fuzzy matches, and merges.

## Creating the schedule

Run `/schedule` (cloud routine) or the scheduled-tasks tool with cron `15 7 * * *`
and the prompt above. Verify the running environment has `gh` auth + push rights
to `origin` before relying on it.
