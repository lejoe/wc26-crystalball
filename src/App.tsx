import { lazy, Suspense, useMemo, useState } from 'react'
import { GROUPS, GROUP_LETTERS } from './data/groups'
import { rankGroup, rankThirdPlace, groupStandings, groupComplete, incompleteGoalsTeams, pointsOf, predictedCount, nextMatchDate } from './standings'
import { resolveBracket } from './bracketResolve'
import { possibleGroupPositions, qualificationStatus, type QualStatus } from './scenarios'
import { effectiveH2H } from './h2h'
import { useStore } from './store'
import { LAST_RESULTS_UPDATE } from './data/lastUpdate'
import { GroupTable } from './components/GroupTable'
import { ThirdPlacePanel } from './components/ThirdPlacePanel'
import { Bracket } from './components/Bracket'
import { AnalysisModal } from './components/AnalysisModal'
import { TeamSearch, type SearchTeam } from './components/TeamSearch'
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

// Every team, flagged with whether it has an open situation to analyse.
const SEARCH_TEAMS: SearchTeam[] = GROUP_LETTERS.flatMap((g) =>
  GROUPS[g].map((team) => ({ team, group: g, analyzable: !!ANALYSIS.scenarios[g]?.[team] })),
)

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

  // Team picked from the header search — opens its situation-analysis popup.
  const [searchTeam, setSearchTeam] = useState<string | null>(null)
  const searchGroup = searchTeam ? SEARCH_TEAMS.find((t) => t.team === searchTeam)?.group : undefined
  const searchRoot = searchTeam && searchGroup ? ANALYSIS.scenarios[searchGroup]?.[searchTeam] : undefined
  const searchTone = searchTeam && searchGroup ? ANALYSIS.tones[searchGroup]?.get(searchTeam) : undefined

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

  // Per group: how many matches the user has predicted, and the next match date.
  const predicted = useMemo(() => {
    const out = {} as Record<GroupLetter, number>
    for (const g of GROUP_LETTERS) out[g] = predictedCount(g, predictions, predScores)
    return out
  }, [predictions, predScores])

  const nextDates = useMemo(() => {
    const out = {} as Record<GroupLetter, string | null>
    for (const g of GROUP_LETTERS) out[g] = nextMatchDate(g)
    return out
  }, [])

  // Per group, per ranked row: Through / In the balance / Out outlook.
  const qualStatus = useMemo(() => {
    const out = {} as Record<GroupLetter, QualStatus[]>
    for (const g of GROUP_LETTERS) {
      const status = qualificationStatus(g, predictions, predScores)
      out[g] = groupRanks[g].map((r) => status.get(r.standing.team) ?? 'open')
    }
    return out
  }, [groupRanks, predictions, predScores])

  const thirdRanked = useMemo(() => rankThirdPlace(groups, h2h), [groups, h2h])

  // Teams that could be a group's third-placed team. More than one when the
  // 2nd/3rd order is a tie whose decider (goal difference) isn't pinned down.
  const thirdContenders = useMemo(() => {
    const m = {} as Record<GroupLetter, string[]>
    for (const g of GROUP_LETTERS) {
      if (!complete[g]) {
        // Group still has matches: anyone who can still finish 3rd is a contender.
        m[g] = possibleGroupPositions(g, predictions, predScores).candidates.get(3) ?? []
        continue
      }
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
  }, [groupRanks, complete, predictions, predScores])

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
        <div className="header-lede">
          <h1>FIFA World Cup 2026 — Crystal Ball</h1>
          <div className="sub">Set results, explore the scenarios that decide who advances.</div>
        </div>
        <div className="header-side">
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
          <TeamSearch teams={SEARCH_TEAMS} onSelect={setSearchTeam} />
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
            predicted={predicted[g]}
            nextDate={nextDates[g]}
            qual={qualStatus[g]}
            tones={ANALYSIS.tones[g]}
            scenarios={ANALYSIS.scenarios[g]}
          />
        ))}
      </div>
      <div className="legend">
        <span className="chip"><span className="swatch" style={{ background: 'var(--advance-bd)' }} /> Through</span>
        <span className="chip"><span className="swatch" style={{ background: 'var(--third-bd)' }} /> In the balance</span>
        <span className="chip"><span className="swatch" style={{ background: 'var(--out)' }} /> Out</span>
        <span className="chip"><span className="tie-flag">*</span> level — predict exact scores</span>
      </div>

      <div className="section-title">Best Third-Placed Teams (advisory ranking)</div>
      <div className="third-section">
        <ThirdPlacePanel rows={thirdRanked} settled={thirdSettled} contenders={thirdContenders} />
      </div>

      <div className="section-title">Knockout Bracket</div>
      <Bracket views={bracketViews} />

      {searchTeam && searchRoot && (
        <AnalysisModal
          team={searchTeam}
          tone={(searchTone ?? 'in-balance') as StatusTone}
          root={searchRoot}
          onClose={() => setSearchTeam(null)}
        />
      )}

      {DevFeedback && (
        <Suspense fallback={null}>
          <DevFeedback />
        </Suspense>
      )}
    </div>
  )
}
