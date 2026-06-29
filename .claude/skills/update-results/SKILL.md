---
name: update-results
description: "Fetch newly-finished real World Cup 2026 match results and write them into the data files. Use when the user says \"update results\", \"pull yesterday's scores\", \"refresh match results\", or when the daily results agent runs. Edits src/data/fixtures.ts (group stage) and src/data/bracketResults.ts (knockout), gates on tsc, and emits a summary with fuzzy-match flags."
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
- `src/data/bracketResults.ts` — knockout.
  `BRACKET_RESULTS: Record<matchId, { hs; as; aet?; pens? }>`.
  Key = matchId 73–104 (see `src/data/bracket.ts`). **`hs` = score of the team in
  slot `a`, `as` = score of the team in slot `b`** — oriented to the bracket
  slots, not raw home/away. Empty until the knockout stage starts.
  - `hs`/`as` hold the score **after extra time** (ET goals included).
  - Extra time: add `aet: true` (e.g. `{ hs: 3, as: 2, aet: true }`).
  - Shootout: a knockout can't end level, so put the (level) 120' score in
    `hs`/`as` and the shootout in `pens: { a, b }` — slot-oriented the same way
    (`pens.a` = slot a's shootout score), e.g.
    `{ hs: 2, as: 2, aet: true, pens: { a: 4, b: 3 } }`. The advancing side is
    **derived** from these (higher `hs`/`as`, or higher `pens` when level) — never
    pick the winner by hand. A level `hs`/`as` with no `pens` is treated as not yet
    decided.

Files you read for mapping/orientation, never edit here:
`src/data/groups.ts` (canonical team spellings + groups), `src/data/bracket.ts`
(knockout structure: each match's slot `a`/`b` sources).

## Steps

### 1. Find what's missing
- Read today's date.
- Scan `FIXTURES` (all 12 groups) for rows dated **today-or-earlier** with
  `hs === null || as === null`. (Today's matches are in scope, but only get
  written if they're confirmed **final** — see step 2. Future-dated rows are
  never candidates: a match that hasn't kicked off cannot have a result, and
  treating one as fetchable invites a fabricated score from a preview/odds page.)
- Scan `BRACKET_RESULTS` for knockout matches that should have been played by now
  but have no entry. (Knockout match dates are not in the codebase; use your
  knowledge of the real 2026 schedule and the sources you fetch.)
- If nothing is missing, stop: emit a "nothing to update" summary and do not edit.

### 2. Fetch real results

**Primary source — ESPN scoreboard (free, no API key, structured).** For each
match-day you need a result for, fetch the whole day in one call:

    https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD

For each `event` read `competitions[0].competitors[]` — each has `team.displayName`,
`score`, and `homeAway` (`'home'`/`'away'`) — plus `status.type`.

**The finality gate is a field read, not a judgment.** Write a match **only if
`status.type.completed === true`**. Anything with `state` `'pre'` (not kicked
off) or `'in'` (in progress) is skipped → "still upcoming", picked up next run.
This replaces eyeballing live blogs: ESPN tells you finished-vs-live directly.

**Fallback — Wikipedia.** If ESPN is unreachable, has no event for a match you
expect, or returns a score you want to second-source, use the per-group article
`https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_X` (knockout:
`https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage`); judge
freshness from its last-edited UTC timestamp. If ESPN and Wikipedia disagree and
you cannot reconcile, leave the match unwritten and note the conflict. Do not guess.

**Do not** open-endedly web-search and fetch arbitrary domains. The two sources
above are the entire allowlist (`site.api.espn.com`, `en.wikipedia.org`); fetch
their known URLs directly so every run hits the same domains.

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
   Knockout only: if the match went to extra time, write the after-ET score and
   add `aet: true`; if it went to a shootout, the (level) ET score goes in
   `hs`/`as` and the shootout in `pens: { a, b }` (slot-oriented like `hs`/`as`).

### 4. Fuzzy-match team names
- Every fetched team name that does **not exactly** match the `groups.ts`
  spelling: fuzzy-match it to the canonical spelling, write the canonical form,
  and record `fetched → canonical` for the PR/summary so a human can confirm.
  (Examples of canonical spellings that often drift: `Türkiye`, `Côte d'Ivoire`,
  `Korea Republic`, `Bosnia and Herzegovina`, `Congo DR`, `Curaçao`.)

### 5. Write the edits
- Group stage: replace the two trailing `null`s in the `F(...)` row (or the
  explicit `hs`/`as`) with the real scores.
- Knockout: add `id: { hs, as }` entries to `BRACKET_RESULTS` (plus `aet`/`pens`
  for extra-time/shootout matches).
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
- **Still upcoming**: matches dated today-or-earlier left unwritten because
  not yet final (still to kick off or in progress).

## Constraints
- Never clear or migrate browser predictions.
- Never change bracket pick semantics (picks stay path-based).
- Never grade a prediction right/wrong.
- Never merge to `main`. Writing the data files + reporting is the whole job; PR
  delivery and review happen in the scheduled flow.
