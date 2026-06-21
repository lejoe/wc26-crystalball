---
name: update-results
description: "Fetch the prior day's real World Cup 2026 match results and write them into the data files. Use when the user says \"update results\", \"pull yesterday's scores\", \"refresh match results\", or when the daily results agent runs. Edits src/data/fixtures.ts (group stage) and src/data/bracketResults.ts (knockout), gates on tsc, and emits a summary with fuzzy-match flags."
---

# update-results

Bring the app's real results current. Find matches that have been played but
have no score in the data files, fetch the real scores from trustworthy current
(2026) sources, write them, type-check, and report. This skill only writes
reality into the data files — it never scores or grades a user's prediction, and
it never touches browser predictions (those live in `localStorage` and are
deliberately preserved; a real result overrides only its own match at runtime).

## Files you edit

- `src/data/fixtures.ts` — group stage. `FIXTURES[group][index]` rows. A match
  is "played" when both `hs` (home score) and `as` (away score) are non-null.
  Updating = filling those two numbers.
- `src/data/bracketResults.ts` — knockout. `BRACKET_RESULTS: Record<matchId, { hs; as }>`.
  Key = matchId 73–104 (see `src/data/bracket.ts`). **`hs` = score of the team in
  slot `a`, `as` = score of the team in slot `b`** — oriented to the bracket
  slots, not raw home/away. Empty until the knockout stage starts.

Files you read for mapping/orientation, never edit here:
`src/data/groups.ts` (canonical team spellings + groups), `src/data/bracket.ts`
(knockout structure: each match's slot `a`/`b` sources).

## Steps

### 1. Find what's missing
- Read today's date.
- Scan `FIXTURES` (all 12 groups) for rows dated **yesterday-or-earlier** with
  `hs === null || as === null`.
- Scan `BRACKET_RESULTS` for knockout matches that should have been played by now
  but have no entry. (Knockout match dates are not in the codebase; use your
  knowledge of the real 2026 schedule and the sources you fetch.)
- If nothing is missing, stop: emit a "nothing to update" summary and do not edit.

### 2. Fetch real results
- For each missing match, fetch the final score from trustworthy, current (2026)
  sources. Cross-check at least two when feasible.
- A match dated yesterday that was **not yet final** at fetch time: skip it. It
  stays "still upcoming" and is picked up on the next run.
- Sources disagree and you cannot reconcile: leave that match unwritten and note
  the conflict in the summary. Do not guess.

### 3. Map each result to its row

**Group stage** — match the fetched fixture by **date + both team names** to a
`FIXTURES[group][index]` row. The home team in the data is slot `home`; write the
real home score to `hs`, away to `as`.

**Knockout** — identify the matchId, then orient to slot a/b:
1. Determine the matchId. Knockout matches have no stored teams; resolve which
   matchId a played fixture belongs to using `src/data/bracket.ts` (the slot
   sources) together with the **real, complete group standings** you compute from
   `FIXTURES`.
2. **Assert the relevant groups are complete in reality** before writing: every
   group feeding this match's slots must have all 6 of its `FIXTURES` rows with
   non-null `hs`/`as` (real scores). Do **not** use the app's `groupComplete()`
   helper — it counts predictions as completeness; you need a raw null-check over
   the real `FIXTURES` data. If a feeding group isn't really complete, the
   assertion fails: skip the write and report (should never happen in a standard
   WC, since groups always finish before knockout).
3. Orient: figure out which fetched team sits in slot `a` vs slot `b` (from the
   bracket structure + real standings). Write that team's score to `hs`, the
   other to `as`. **Wrong orientation inverts the bracket** — double-check.

### 4. Fuzzy-match team names
- Every fetched team name that does **not exactly** match the `groups.ts`
  spelling: fuzzy-match it to the canonical spelling, write the canonical form,
  and record `fetched → canonical` for the PR/summary so a human can confirm.
  (Examples of canonical spellings that often drift: `Türkiye`, `Côte d'Ivoire`,
  `Korea Republic`, `Bosnia and Herzegovina`, `Congo DR`, `Curaçao`.)

### 5. Write the edits
- Group stage: replace the two trailing `null`s in the `F(...)` row (or the
  explicit `hs`/`as`) with the real scores.
- Knockout: add `id: { hs, as }` entries to `BRACKET_RESULTS`.
- If you wrote at least one result, set `LAST_RESULTS_UPDATE` in
  `src/data/lastUpdate.ts` to the current UTC time as ISO 8601 (e.g.
  `2026-06-21T14:27:30Z`). Leave it unchanged on a no-op run.

### 6. Type-check gate
- Run `npx tsc --noEmit`.
- On any type error, **abort**: report the error, do not consider the run
  successful (and in the scheduled flow, do not open the PR).
- Also abort/flag if any fetched result could not be matched to a row.

### 7. Summary
Emit a concise report:
- **Updated**: N matches (list group/knockout + score).
- **Fuzzy-flagged**: M (each as `fetched → canonical`, needs human confirmation).
- **Unmatched / unwritten**: K (with reason: conflict, assertion failed, no row).
- **Still upcoming**: matches dated yesterday-or-earlier left unwritten because
  not yet final.

## Constraints
- Never clear or migrate browser predictions.
- Never change bracket pick semantics (picks stay path-based).
- Never grade a prediction right/wrong.
- Never merge to `main`. Writing the data files + reporting is the whole job; PR
  delivery and review happen in the scheduled flow.
