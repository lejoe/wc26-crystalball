import { lazy, Suspense, useMemo } from 'react'
import { GROUP_LETTERS } from './data/groups'
import { rankGroup, rankThirdPlace, groupStandings, groupComplete, incompleteGoalsTeams, pointsOf } from './standings'
import { resolveBracket } from './bracketResolve'
import { possibleGroupPositions } from './scenarios'
import { effectiveH2H } from './h2h'
import { useStore } from './store'
import { LAST_RESULTS_UPDATE } from './data/lastUpdate'
import { GroupTable } from './components/GroupTable'
import { ThirdPlacePanel } from './components/ThirdPlacePanel'
import { Bracket, ThirdPlacePlayoff } from './components/Bracket'
import { analysisReady, groupAnalysisFacts } from './groupAnalysis'
import { buildGroupScenarios, type Node } from './scenarioTree'
import type { GroupLetter, StatusTone, TeamStanding } from './types'

// Interactive situation analysis (per-team modal trees), built once from the
// deterministic engine for the ready groups only. Independent of predictions.
const ANALYSIS = (() => {
  const tones: Partial<Record<GroupLetter, Map<string, StatusTone>>> = {}
  const scenarios: Partial<Record<GroupLetter, Record<string, Node>>> = {}
  for (const g of GROUP_LETTERS) {
    if (!analysisReady(g)) continue
    tones[g] = new Map(groupAnalysisFacts(g).teams.map((t) => [t.team, t.status]))
    scenarios[g] = buildGroupScenarios(g)
  }
  return { tones, scenarios }
})()

// Dev-only feedback/annotation widget. Lazy + DEV-gated so it is excluded from
// the production bundle entirely.
const DevFeedback = import.meta.env.DEV
  ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
  : null

const UPDATE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
]

/** "2 hours ago", "yesterday", etc. for a past ISO timestamp. */
function relativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, secs] of UPDATE_UNITS) {
    if (Math.abs(diffSec) >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSec / secs), unit)
    }
  }
  return rtf.format(0, 'second')
}

export function App() {
  const state = useStore()
  const resetAll = useStore((s) => s.resetAll)

  const { predictions, predScores } = state

  const h2h = useMemo(() => effectiveH2H(predictions, predScores), [predictions, predScores])

  const groups = useMemo(() => {
    const out = {} as Record<GroupLetter, TeamStanding[]>
    for (const g of GROUP_LETTERS) out[g] = groupStandings(g, predictions, predScores)
    return out
  }, [predictions, predScores])

  const groupRanks = useMemo(() => {
    const out = {} as Record<GroupLetter, ReturnType<typeof rankGroup>>
    for (const g of GROUP_LETTERS) {
      out[g] = rankGroup(groups[g], h2h, incompleteGoalsTeams(g, predictions, predScores))
    }
    return out
  }, [groups, h2h, predictions, predScores])

  const complete = useMemo(() => {
    const out = {} as Record<GroupLetter, boolean>
    for (const g of GROUP_LETTERS) out[g] = groupComplete(g, predictions, predScores)
    return out
  }, [predictions, predScores])

  // Groups where the order is decided by goal difference that isn't pinned down
  // yet — the user should predict exact scores for a match.
  const needsScores = useMemo(() => {
    const out = {} as Record<GroupLetter, boolean>
    for (const g of GROUP_LETTERS) out[g] = complete[g] && groupRanks[g].some((r) => r.needsScores)
    return out
  }, [groupRanks, complete])

  // Per group, per ranked row: is that team's final position locked in?
  const decided = useMemo(() => {
    const out = {} as Record<GroupLetter, boolean[]>
    for (const g of GROUP_LETTERS) {
      const ranked = groupRanks[g]
      if (groups[g].every((s) => s.played === 0)) {
        out[g] = ranked.map(() => false)
      } else if (complete[g]) {
        // Complete group: every position is set unless it's an unbroken tie.
        out[g] = ranked.map((r) => !r.unresolved && !r.needsScores)
      } else {
        // In progress: a team is locked only if it can reach a single position.
        const cand = possibleGroupPositions(g, predictions, predScores).candidates
        const reach = new Map<string, number>()
        for (const teams of cand.values()) for (const t of teams) reach.set(t, (reach.get(t) ?? 0) + 1)
        out[g] = ranked.map((r) => (reach.get(r.standing.team) ?? 9) === 1)
      }
    }
    return out
  }, [groupRanks, groups, complete, predictions, predScores])

  const thirdRanked = useMemo(() => rankThirdPlace(groups, h2h), [groups, h2h])

  // Teams that could be a group's third-placed team. More than one when the
  // 2nd/3rd order is a tie whose decider (goal difference) isn't pinned down.
  const thirdContenders = useMemo(() => {
    const m = {} as Record<GroupLetter, string[]>
    for (const g of GROUP_LETTERS) {
      const ranked = groupRanks[g]
      const pos3 = ranked.find((r) => r.position === 3)
      if (!pos3) {
        m[g] = []
      } else if (pos3.needsScores || pos3.unresolved) {
        const p = pointsOf(pos3.standing)
        m[g] = ranked.filter((r) => pointsOf(r.standing) === p).map((r) => r.standing.team)
      } else {
        m[g] = [pos3.standing.team]
      }
    }
    return m
  }, [groupRanks])

  const thirdSettled = useMemo(() => {
    const m = {} as Record<GroupLetter, boolean>
    for (const g of GROUP_LETTERS) {
      if (groups[g].every((s) => s.played === 0)) {
        m[g] = false
      } else if (complete[g]) {
        m[g] = (thirdContenders[g]?.length ?? 0) <= 1
      } else {
        m[g] = (possibleGroupPositions(g, predictions, predScores).candidates.get(3) ?? []).length === 1
      }
    }
    return m
  }, [groups, complete, thirdContenders, predictions, predScores])

  const bracketViews = useMemo(
    () => resolveBracket(state),
    [predictions, predScores, state.bracketPredictions],
  )

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>FIFA World Cup 2026 — Prediction Tool</h1>
          <div className="sub">Pick each match result, then predict the knockout bracket. Everything saves locally.</div>
        </div>
        <div className="header-actions">
          <time
            className="last-update"
            dateTime={LAST_RESULTS_UPDATE}
            title={new Date(LAST_RESULTS_UPDATE).toLocaleString()}
          >
            Results updated {relativeTime(LAST_RESULTS_UPDATE)}
          </time>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('Reset all predictions and results?')) resetAll()
            }}
          >
            Reset all
          </button>
        </div>
      </header>

      <div className="section-title">Group Stage</div>
      <div className="groups-grid">
        {GROUP_LETTERS.map((g) => (
          <GroupTable
            key={g}
            group={g}
            rows={groupRanks[g]}
            complete={complete[g]}
            needsScores={needsScores[g]}
            decided={decided[g]}
            tones={ANALYSIS.tones[g]}
            scenarios={ANALYSIS.scenarios[g]}
          />
        ))}
      </div>
      <div className="legend">
        <span className="chip"><span className="swatch" style={{ background: 'var(--advance-bd)' }} /> Top 2 advance</span>
        <span className="chip"><span className="swatch" style={{ background: 'var(--third-bd)' }} /> 3rd (8 best advance)</span>
        <span className="chip"><span className="tie-flag">*</span> level — predict exact scores</span>
      </div>

      <div className="section-title">Best Third-Placed Teams (advisory ranking)</div>
      <div className="third-section">
        <ThirdPlacePanel rows={thirdRanked} settled={thirdSettled} contenders={thirdContenders} />
        <ThirdPlacePlayoff views={bracketViews} />
      </div>

      <div className="section-title">Knockout Bracket</div>
      <Bracket views={bracketViews} />

      {DevFeedback && (
        <Suspense fallback={null}>
          <DevFeedback />
        </Suspense>
      )}
    </div>
  )
}
