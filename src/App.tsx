import { lazy, Suspense, useMemo, useState } from 'react'
import { GROUPS, GROUP_LETTERS } from './data/groups'
import { rankGroup, groupStandings, groupComplete, groupRealComplete, incompleteGoalsTeams, thirdPlaceContenders, pointsOf, gdOf, predictedCount, nextMatchDate, minThirdPlacePoints, type ThirdGroupRow } from './standings'
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
  const resetGroups = useStore((s) => s.resetGroups)
  const resetBracket = useStore((s) => s.resetBracket)

  const { predictions, predScores } = state
  const hasGroupPicks = Object.keys(predictions).length > 0 || Object.keys(predScores).length > 0
  const hasBracketPicks = Object.keys(state.bracketPredictions).length > 0

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

  // Groups complete by real results alone — used to tell a results-finalized
  // group (solid) from one finalized only by predictions (dotted).
  const realComplete = useMemo(() => {
    const out = {} as Record<GroupLetter, boolean>
    for (const g of GROUP_LETTERS) out[g] = groupRealComplete(g)
    return out
  }, [])

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

  // One row per group for the best-third panel. Everything visible (which groups
  // are settled, the candidates, their stats) follows the user's predictions; only
  // the unsettled "min" floor is prediction-independent (real results only).
  const thirdRows = useMemo<ThirdGroupRow[]>(() => {
    const rows: ThirdGroupRow[] = []
    for (const g of GROUP_LETTERS) {
      if (groups[g].every((s) => s.played === 0)) continue // no data yet — omit
      const ranked = groupRanks[g]
      const pos3 = ranked.find((r) => r.position === 3)
      if (!pos3) continue

      // Teams that could still be this group's 3rd, predictions included. Once a
      // group is decided, exclude teams locked above third by head-to-head or
      // goal difference (a +6 side level on points can't actually be third);
      // while it is still open, anyone who can still reach 3rd is a candidate.
      const candidateTeams = complete[g]
        ? thirdPlaceContenders(groups[g], h2h, incompleteGoalsTeams(g, predictions, predScores))
        : possibleGroupPositions(g, predictions, predScores).candidates.get(3) ?? []

      if (candidateTeams.length <= 1) {
        const team = candidateTeams[0] ?? pos3.standing.team
        const standing = ranked.find((r) => r.standing.team === team)!.standing
        rows.push({ group: g, settled: true, rank: 0, sortPts: pointsOf(standing), thirdStanding: standing })
      } else {
        const candidates = candidateTeams
          .map((team) => {
            const rr = ranked.find((r) => r.standing.team === team)!
            return { standing: rr.standing, position: rr.position }
          })
          .sort((a, b) => a.position - b.position)
        const minPoints = minThirdPlacePoints(g)
        rows.push({ group: g, settled: false, rank: 0, sortPts: minPoints, minPoints, candidates })
      }
    }

    rows.sort((a, b) => {
      if (a.sortPts !== b.sortPts) return b.sortPts - a.sortPts
      // At equal points a confirmed 3rd ranks above a group whose floor is only that.
      if (a.settled !== b.settled) return a.settled ? -1 : 1
      if (a.settled && b.settled) {
        const ga = gdOf(a.thirdStanding!)
        const gb = gdOf(b.thirdStanding!)
        if (ga !== gb) return gb - ga
        if (a.thirdStanding!.goalsFor !== b.thirdStanding!.goalsFor)
          return b.thirdStanding!.goalsFor - a.thirdStanding!.goalsFor
      }
      return a.group.localeCompare(b.group)
    })
    return rows.map((r, i) => ({ ...r, rank: i + 1 }))
  }, [groups, groupRanks, complete, predictions, predScores])

  const bracketViews = useMemo(
    () => resolveBracket(state),
    [predictions, predScores, state.bracketPredictions],
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-lede">
          <h1>FIFA World Cup 2026 — Crystal Ball</h1>
          <div className="sub">See where teams stand, open any team's full situation, and explore the scenarios still in play.</div>
        </div>
        <div className="header-side">
          <TeamSearch teams={SEARCH_TEAMS} onSelect={setSearchTeam} />
        </div>
      </header>

      <div className="section-title">
        <span>Group Stage</span>
        <button
          className="reset-link"
          disabled={!hasGroupPicks}
          onClick={() => {
            if (hasGroupPicks && confirm('Reset all group-stage predictions?')) resetGroups()
          }}
        >
          Reset group picks
        </button>
      </div>
      <div className="groups-grid">
        {GROUP_LETTERS.map((g) => (
          <GroupTable
            key={g}
            group={g}
            rows={groupRanks[g]}
            complete={complete[g]}
            realComplete={realComplete[g]}
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

      <div className="section-title">
        <span>Best Third-Placed Teams <span className="section-sub">advisory ranking</span></span>
      </div>
      <div className="third-section">
        <ThirdPlacePanel rows={thirdRows} />
      </div>

      <div className="section-title">
        <span>Knockout Bracket</span>
        <button
          className="reset-link"
          disabled={!hasBracketPicks}
          onClick={() => {
            if (hasBracketPicks && confirm('Reset all bracket predictions?')) resetBracket()
          }}
        >
          Reset bracket picks
        </button>
      </div>
      <Bracket views={bracketViews} />
      <div className="legend bracket-legend">
        <span className="chip"><span className="swatch" style={{ background: 'var(--advance-bd)' }} /> Confirmed</span>
        <span className="chip"><span className="swatch" style={{ background: 'var(--third-bd)' }} /> Prediction</span>
        <span className="chip"><span className="swatch" style={{ background: 'var(--out)' }} /> Eliminated</span>
      </div>

      <footer className="app-footer">
        <time
          className="last-update"
          dateTime={LAST_RESULTS_UPDATE}
          title={new Date(LAST_RESULTS_UPDATE).toLocaleString()}
        >
          Match results updated {relativeTime(LAST_RESULTS_UPDATE)}
        </time>
        <nav className="footer-links">
          <a
            href="https://github.com/lejoe/wc26-crystalball"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              className="gh-mark"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
            Code on GitHub
          </a>
          <a href="https://lejoe.com" target="_blank" rel="noopener noreferrer">
            Built by lejoe.com
          </a>
        </nav>
      </footer>

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
