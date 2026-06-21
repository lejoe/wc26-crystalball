# Daily Results Update — Feature Spec

## Goal

Keep the app's real results current with one low-effort daily action. A scheduled agent fetches the prior day's match results, writes them into the data files, and opens a pull request for review. Merging the PR is the only manual step.

Two outcomes the user cares about:

- **Group stage and knockout real results stay up to date** with minimal effort.
- **User predictions in the browser are preserved**: a newly-played match's real result overrides only that one match's prediction; every other prediction stays live.

## Implementation status (not yet built)

None of this is built. What already exists and is reused:

- **Group-stage results model**: `FIXTURES` in [src/data/fixtures.ts](src/data/fixtures.ts). A match is "played" when both `hs` and `as` are non-null; updating a result is filling those two scores.
- **Real-over-prediction priority (group stage)**: `knownScore` / `decidedOutcome` in [src/standings.ts](src/standings.ts) already prefer a real score over a prediction, and `isUpcoming` in [src/store.ts](src/store.ts:15) blocks predicting a played match. This is the exact "newly-resulted matches ignored, others stay alive" behavior, already free for the group stage.
- **Bracket resolution**: `resolveBracket` in [src/bracketResolve.ts](src/bracketResolve.ts). Picks are **path-based** (stored by side `'a'`/`'b'`, not by team).

Still to build: a real-result model for the knockout stage (it has none today), the update skill, and the scheduled PR delivery.

## Decisions

| Topic | Decision |
|-------|----------|
| **Results source** | Not hardcoded. The skill is instructed to use trustworthy, current (2026) sources and reconcile them itself. The PR review is the safety net. |
| **Schedule** | Daily at 07:15 GMT+2 (05:15 UTC). |
| **Name drift** | Fuzzy-match a fetched team name to the codebase spelling, and flag every fuzzy match in the PR body for human confirmation before merge. |
| **Knockout orientation** | Groups always complete before knockout, so slot a/b teams are certain. The skill still asserts the relevant groups are complete before writing a knockout result (cheap safety). |
| **Bracket pick semantics** | Stay **path-based** (current behavior). A pick means "the team that wins this matchup" and rides along when the slot's team changes. Not cleared on group-result changes. |
| **Delivery** | Scheduled agent opens a PR each morning. Nothing touches `main` unattended. |

## Browser Predictions (preserved, not cleared)

- Predictions live in `localStorage` under key `wc2026-prediction` and are **never cleared** by an update.
- When a match gets a real result, that result overrides **only that match's** prediction (group stage already does this; Part A extends it to knockout). All other predictions stay live.
- Bracket picks are path-based, so a group-result change re-binds the pick to whichever team now fills the slot rather than invalidating it.

## Part A — Knockout Result Model (build first)

The knockout `MatchDef` ([src/data/bracket.ts](src/data/bracket.ts:41)) has no result field. Add one, mirroring the group-stage pattern.

- **New file** `src/data/bracketResults.ts`: `export const BRACKET_RESULTS: Record<number, { hs: number; as: number }> = {}`. Key = matchId (73–104). `hs` = score of the team in **slot a**, `as` = slot b. Empty until knockout starts.
- **`resolveBracket`** ([src/bracketResolve.ts:200](src/bracketResolve.ts:200)): when `BRACKET_RESULTS[id]` exists, derive `realWinnerSide = hs > as ? 'a' : 'b'` and let it **supersede** the stored pick for (1) downstream slot filling via `advancing()`/`losing()` and (2) the rendered `winnerSide`. The user's pick stays stored, just ignored for that match. Mirrors group-stage `knownScore` priority.
- **Lock played matches**: guard `setWinner` ([src/store.ts:59](src/store.ts:59)) to refuse a matchId present in `BRACKET_RESULTS`, and no-op the click in [src/components/Bracket.tsx:52](src/components/Bracket.tsx:52).
- **Fix stale docstring** at [src/bracketResolve.ts:144](src/bracketResolve.ts:144): the "Winners that no longer match a current participant are dropped (cascade reset)" claim is false — the code does no such validation. Replace it with an accurate description of path-based behavior plus the real-result override added here.

### Orientation

Result is stored oriented to slot a/b, not raw home/away. The skill resolves which fetched team sits in slot a (from the complete, real group standings) before writing, and asserts the relevant groups are complete. Wrong orientation inverts the bracket.

## Part B — `update-results` Skill

Steps:

1. Read today's date. Scan `FIXTURES` and `BRACKET_RESULTS` for matches dated yesterday-or-earlier still missing scores.
2. Fetch results for those matches from trustworthy current sources (skill's judgment; cross-check).
3. Map each result to its row:
   - **Group stage**: date + both team names → `${group}:${index}`.
   - **Knockout**: date + teams → matchId, then resolve a/b orientation against the complete standings, asserting the groups are complete.
4. Fuzzy-match any team name that doesn't exactly match the `groups.ts` spelling; record each fuzzy match for the PR body.
5. Edit `src/data/fixtures.ts` (null → scores) and/or `src/data/bracketResults.ts`.
6. `npx tsc` gate. Abort and report on a type error or an unmatched result.
7. Emit a summary: updated N, fuzzy-flagged M (with the guessed mapping), unmatched K, still upcoming.

## Part C — Scheduled Delivery (PR each morning)

- Scheduled cloud agent, daily at 05:15 UTC.
- Flow: fresh branch `results/YYYY-MM-DD` → run the skill → commit → `gh pr create` with the diff, the run summary, and every fuzzy-match flag in the body → notify.
- The human reviews, confirms any fuzzy matches, and merges. Nothing lands on `main` unattended.

## Out of Scope

- Clearing or migrating browser predictions (they are deliberately preserved).
- Team-based bracket picks / clearing picks on group-result changes (kept path-based).
- Grading or scoring a user's prediction as right/wrong (the app only overrides with reality, it does not score).
- Automatic merge to `main` (review is mandatory).
- A fixed/blessed results source (left to the skill's judgment).

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Match dated yesterday but not yet final at fetch time | Skip; remains "still upcoming" in the summary, picked up next run |
| Fetched team name doesn't match codebase spelling | Fuzzy-match, write the guess, flag it in the PR for confirmation |
| Sources disagree on a score | Skill reconciles; if unresolved, leave the match unwritten and note it in the summary |
| Knockout result before its groups are complete | Assertion fails; skip the write and report (should never happen in a standard WC) |
| Type error after edits | `tsc` gate fails the run; PR not opened, error reported |
| No new results since last run | No-op run; summary states nothing to update (optionally skip the PR) |
| A user's bracket pick's slot team changes after a group update | Pick stays (path-based), re-binds to the new slot team; no clearing |

## Notes / Follow-ups

- Part A is the foundation and is verifiable with `tsc` plus the browser preview; build it before the skill, and wire the schedule last.
- The fuzzy-match confirmation flow depends on the PR review step, so Parts B and C are coupled by that human checkpoint.
