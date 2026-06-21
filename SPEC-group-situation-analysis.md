# Group Situation Analysis — Feature Spec

## Goal

Explain each group in plain language, so the reader instantly knows, per team:

- who is **through** (already qualified)
- who is **in the balance** (still alive, fate not settled)
- who is **out** (mathematically eliminated)
- what the final match would change, and when a tiebreaker or another match matters

The standings table stays the detailed source of truth. This feature explains what the standings *mean*.

## Data Basis

- Runs on **real results only**, read from `FIXTURES` ([src/data/fixtures.ts](src/data/fixtures.ts)). It does **not** use the user's predictions.
- In code terms: every computation runs in "real-results-only mode" — i.e. as if predictions were empty, so only played fixtures count and remaining matches are treated as undecided.
- Because real fixtures carry actual scores, goal difference is real here (unlike the scoreless prediction model).
- There is no inconsistent-data case to handle.

## Availability

Per group, independently. Each group is a fixed 6-fixture array in round order: indices 0–1 = round 1, 2–3 = round 2, 4–5 = round 3.

- A group is **ready when fixtures 0–3 have real scores and fixtures 4–5 do not** (first two rounds in, final round unplayed).
- Fewer than 4 scored: not available.
- **Final round played (fixture 4 or 5 scored): no analysis** for that group.

Real fixtures are statically ordered by round and the tournament plays in order, so there is no out-of-order risk; readiness is derived purely from which fixtures carry scores, not from the calendar date.

## Status Tones

Three semantic buckets, labelled by outcome: **Through / In the balance / Out**.

| Label | Meaning |
|-------|---------|
| **Through** | Advancement is **mathematically clinched**, certified by **points + head-to-head only** (see Certainty Basis). |
| **In the balance** | Still mathematically alive but not certified through. |
| **Out** | Advancement is **mathematically impossible** (cannot reach a top-2 or 3rd-place finish in any remaining outcome). |

Rules:

- **Through** = clinched only. "Very likely" or "just needs a draw" is still *In the balance*.
- **Out** = mathematically eliminated only. A long-shot needing an absurd scoreline stays *In the balance* with honest copy.
- A team that can **no longer finish top 2 but is still alive for a best-3rd-place spot** is **In the balance**. The group overview notes only that it can't finish top 2; the full 3rd-place path lives in the expanded team detail.

## Certainty Basis (strict math)

In this feature's window every team has played 2 and has **one match left**, and the goals in an unplayed match are unbounded. So goal difference between two teams that still play **cannot be mathematically certified** — there is always a scoreline that flips it.

Therefore:

- **Through / Out are certified by points + head-to-head locks only.** GD never upgrades a team to Through or Out.
- When only goal difference (or another lower tiebreaker) separates teams, the situation is **In the balance**, and the **AI names GD (or H2H) as the decider** in the copy.
- This is a deliberate strict-mathematical stance: no "likely through / all but out" probabilistic tier.

## Position (1st vs 2nd)

Group position is in scope **everywhere**, including the short per-team line:

- A team can be **Through** and still "need a result" — to win the group rather than finish 2nd.
- Copy may add a **light opponent hint** about what the position leads to, and **may name the opponent group when it is determinable** (e.g. "winning the group likely means facing the runner-up of Group X"). It must not go deeper into the bracket than this.

## Third-Place Dependence

Best-3rd-place qualification is cross-group, so a group-local view cannot resolve it. Copy must:

- **State the dependence plainly** — say the outcome depends on other groups.
- **Add a soft lean** when warranted — e.g. "3 points is often enough", "likely short". The lean is the AI's judgment, informed by the cross-group 3rd-place table (real results) plus its own sense of historical thresholds. It is explicitly a lean, never stated as certainty.

## Final-Match Result Breakdown

When showing Win / Draw / Lose for the selected team:

- Show it **only when the three results lead to genuinely different fates.** Hide it when the result doesn't change the outcome.
- When a team's own result is **not self-sufficient** (the parallel same-group match also matters), **state the condition explicitly** — e.g. "a win guarantees advancement; a draw advances only if the other match isn't a high-scoring win." Honesty over brevity here.

## Engine & Architecture

### Compute split (facts vs AI)

- A **deterministic engine computes the facts**; the **AI writes the prose and composes the display.**
- The engine's facts are **passed to the AI and the AI's output is trusted** — no separate code-side validation pass. The engine's job is to give the AI correct, complete inputs.
- **AI input scope:** all 12 groups' real fixtures/results plus the cross-group 3rd-place table (needed for a credible lean), but the AI produces analysis for **one group at a time**.

### Dedicated engine

This feature has its **own dedicated engine**, separate from the prediction-oriented functions in [src/standings.ts](src/standings.ts) / [src/scenarios.ts](src/scenarios.ts). It may mirror their proven logic (the tiebreaker cascade: points → H2H pts/gd/gf → overall GD → GF; and the remaining-outcome enumeration) but is not coupled to the prediction state.

Engine responsibilities:

- Current standings per group, with real goal difference.
- Per-team classification: Through / In the balance / Out, plus the can't-finish-top-2-but-3rd-alive case — certified by **points + head-to-head only**.
- Reachable positions per team (enumerate remaining outcomes), used for advancement & position scenarios and the W/D/L breakdown.
- Each team's remaining opponent and what each W/D/L can yield.
- The cross-group 3rd-place table (real results) as factual input for the lean.

### Goal difference handling

- GD is used **only to order the current standings.**
- The engine does **not** flag which tiebreaker is the lever in a scenario. **The AI infers and names the operative tiebreaker** (H2H → GD → goals) from the raw numbers it is given.

## Display Model

The display **adapts to the situation** rather than using one fixed template:

- The AI emits **structured output composed from a closed vocabulary of block types.** The UI knows how to render each block type; the AI openly chooses **which blocks appear, in what order, and what to emphasise** per situation.
- This reconciles "named, well-designed layouts" with "open / AI-driven" — the *block types* are a closed, designed set; the *composition* is open-ended.

### Closed block vocabulary

| Block | Purpose |
|-------|---------|
| **Group overview** | Per-team tone lines (Through / In the balance / Out), the at-a-glance summary |
| **Verdict** | The selected team's direct one-line answer |
| **Advancement scenario** | What the team must do to qualify; includes the W/D/L breakdown when outcomes differ, and states conditions referencing the parallel match when the team's own result isn't self-sufficient |
| **Position scenario** | What decides 1st vs 2nd, plus the light opponent hint |
| **Tiebreaker note** | When a tiebreaker is the operative lever (for advancement or position): the AI names which one (H2H → GD → goals) and what it requires |
| **3rd-place dependence + lean** | Cross-group dependence and the soft lean |
| **Elimination explanation** | Why a team is out |
| **Nothing-left-to-decide** | When in-group places are fully settled (final matches are dead rubbers) |

### Generation & caching

- Block composition is **cached per data state**: generated once per real-results update, reused until the real results change. Situation-specific, but stable and cheap between updates.

## Copy Rules

- neutral third-person — no "you", "your", "we", "us"
- short sentences
- mention a **tiebreaker only when it changes the answer**, and name **whichever is operative** (H2H → GD → goals), not just goal difference
- mention another match **only when it affects the team** — mainly the parallel same-group match; cross-group results are referenced only via the 3rd-place dependence note
- say plainly when 3rd-place qualification depends on other groups, and add a lean
- wording is **tailored to the specific situation**, not templated — the AI personalises copy to each group's exact numbers and matchups

## Product Feel

A readable assistant, not a stats panel. The standings table remains the detailed source of truth; this feature interprets it.

## Out of Scope

- The user's predictions (this feature is real-results only)
- Any group not in the ready window (fixtures 0–3 scored, 4–5 not)
- Full bracket reasoning beyond a light opponent hint
- A global cross-group dashboard or team scanner
- A probabilistic "likely through / all but out" tier (strict math only)
- Exposing the engine's raw reasoning data by default

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Fewer than 4 fixtures scored | Feature not available for that group |
| Final round played | No analysis for that group |
| All four teams still mathematically alive for top 2 | All read **In the balance** |
| Team clinched advancement (points + H2H) | **Through**; copy notes whether 1st place is also secured or still contested |
| Advancement/1st locked except for GD | **In the balance**; AI names GD as the decider (GD never certifies) |
| Team eliminated | **Out**; brief elimination explanation in detail view |
| Top 2 impossible, 3rd place still alive | **In the balance**; group line notes "can't finish top 2", detail explains the 3rd-place path + cross-group dependence + lean |
| Own W/D/L not self-sufficient | Advancement scenario states the condition referencing the parallel same-group match |
| Two teams could finish level | AI names the operative tiebreaker (H2H → GD → goals) from the numbers, only when it changes the answer — covers 1st place decided on GD or head-to-head |
| In-group settled (dead rubbers) but a 3rd-placed team still pends cross-group | **3rd-place dependence + lean leads** the display; not framed as "nothing to decide" |
| Default expanded team | None expanded by default; the reader selects a team (possibly on hover) |

## Notes / Follow-ups

- The top-level **SPEC.md is stale** relative to the code (it describes manual standings entry; the real app is fixtures + outcome-based predictions). Worth reconciling separately — not part of this feature.
- The AI's 3rd-place lean leans more on historical sense early in the window, when few other groups have completed two rounds, and sharpens as the cross-group 3rd-place table fills in.
