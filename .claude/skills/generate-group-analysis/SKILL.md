---
name: generate-group-analysis
description: Regenerate the plain-language group situation analysis (Through / In the balance / Out) from real results. Use after group-stage results change — i.e. once issue #2's daily results PR merges — or when asked to refresh src/data/groupAnalysis.json. Composes AI prose from deterministic engine facts and opens a PR.
---

# Generate Group Situation Analysis

Produce `src/data/groupAnalysis.json` — the AI-composed, plain-language explanation of every
**ready** group, cached against the real results. A deterministic engine computes the facts; this
skill writes the prose and composes the display blocks. Trust the engine facts; do not recompute them.

## When this runs

A group is **ready** only when its first two rounds are played and the final round is not (fixtures
0–3 scored, 4–5 unscored). The engine enforces this — `dumpFacts.ts` emits only ready groups. The
artifact is cached per group via a `fingerprint` of that group's real scores: regenerate a group only
when its fingerprint changed.

## Steps

1. **Get the facts.** Run the deterministic engine:
   ```
   npm run analysis:facts > /tmp/analysis-facts.json
   ```
   Output: `{ groups: GroupFacts[], thirdPlaceTable: ThirdPlaceFacts[] }`. Read the whole file —
   all ready groups plus the cross-group third-place table are the AI input.

2. **Read the current artifact** `src/data/groupAnalysis.json`. For each group in the facts whose
   `fingerprint` already matches the artifact, **skip it** (no-op, keep existing prose). Only
   (re)generate groups that are new or whose fingerprint changed.

3. **Compose blocks per group** (one group at a time, but with all 12 groups' facts + the
   third-place table in context for a credible lean). For each group emit a `GroupAnalysis`:
   - `overview`: one `ToneLine` per team, in `teams[]` order (already standings order), `tone` =
     the team's `status`.
   - `teams`: map of team name → ordered `AnalysisBlock[]`, chosen from the closed vocabulary below.
     Choose which blocks appear, in what order, and what to emphasise, per situation.

4. **Write** `src/data/groupAnalysis.json` as `{ "groups": { "A": GroupAnalysis, ... } }`, only
   ready groups present, each carrying its `fingerprint` from the facts.

5. **Validate:** `npm run analysis:validate` (render-safe shape + fingerprint check), then
   `npx tsc --noEmit` (rest of the app still compiles). Abort and report on any error.

6. **Deliver** (see Routine below).

## Facts → meaning (do not recompute; read these fields)

Per team in `groups[].teams[]`:

- `status`: `through` | `in-balance` | `out` — the tone. **Through** = top two mathematically
  clinched on points + head-to-head only. **Out** = cannot reach the top three. Else **in-balance**.
- `reachable`: positions still possible (points + H2H only; goal difference never certifies).
- `canWinGroup`, `guaranteedTop2`, `cantTop2But3rdAlive` — booleans for position/3rd-place copy.
- `remaining`: the final match.
  - `opponent`, `isHome`, `parallel` (the other same-group match).
  - `results.{win,draw,lose}`: `{ positions, guaranteedTop2, top2Impossible, dependsOnParallel }`.
  - `selfSufficient`: a win alone guarantees top two with no dependence on the parallel match.
  - `resultsDiffer`: win/draw/lose lead to genuinely different fates — **show the W/D/L breakdown
    only when this is true.**

Per group: `bracketSlots[1]` / `[2]` give the winner's / runner-up's R32 match and the raw
`opponentSlot` (`pos` / `third` / `winner`). Infer the opponent-group hint from this; name the group
only when `opponentSlot.kind === 'pos'` (determinable). Never go deeper into the bracket than this.

`thirdPlaceTable` (cross-group, real results): rank/points/GD of each group's third team. Use it to
inform the 3rd-place **lean** — never as certainty.

## Closed block vocabulary (`AnalysisBlock` in src/types.ts)

| `type` | Fields | Use |
|--------|--------|-----|
| `verdict` | `tone`, `text` | the team's one-line answer |
| `advancement-scenario` | `text`, `breakdown?` (`{result,text}[]`) | what it must do; add `breakdown` only when `resultsDiffer`; state the parallel-match condition when not `selfSufficient` |
| `position-scenario` | `text` | what decides 1st vs 2nd, plus the light opponent hint |
| `tiebreaker-note` | `lever` (`h2h`/`gd`/`goals`), `text` | only when a tiebreaker is the operative lever |
| `third-place-lean` | `text`, `lean?` (`favourable`/`borderline`/`unfavourable`) | cross-group dependence + soft lean |
| `elimination` | `text` | why an `out` team is out |
| `nothing-left` | `text` | in-group places fully settled (dead rubbers) |

The group-overview is rendered structurally from `overview`; it is not a per-team block.

## Copy rules

- Neutral third person. No "you", "your", "we", "us".
- Short sentences. Tailor to the group's exact numbers and matchups — never templated.
- Mention a **tiebreaker only when it changes the answer**, and name **whichever is operative**
  (H2H → GD → goals), not just goal difference. GD never certifies Through/Out — when only GD
  separates teams the situation is in-balance and GD is named as the decider.
- Mention another match **only when it affects the team** — mainly the parallel same-group match.
  Cross-group results enter only via the 3rd-place dependence note.
- Say plainly when 3rd-place qualification depends on other groups, and add a lean.
- **Through** = clinched only. "Very likely" or "just needs a draw" is still in-balance.
- **Out** = mathematically eliminated only. A long shot needing an absurd scoreline stays
  in-balance with honest copy.

## Routine (PR delivery)

Standalone, decoupled from issue #2, but **triggered after #2's daily results PR merges** (results
changed → analysis may be stale). Once #2 exists, wire a cloud routine that, on that merge:

1. fresh branch `analysis/YYYY-MM-DD`
2. run this skill (steps 1–5)
3. commit `src/data/groupAnalysis.json`
4. `gh pr create` with the diff and a summary (groups regenerated, groups skipped as unchanged)
5. notify

Nothing lands on `main` unattended; the human reviews the prose and merges.
