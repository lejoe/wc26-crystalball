import { useMemo } from 'react'
import { GROUP_LETTERS } from './data/groups'
import { rankGroup, groupStandings, groupComplete, incompleteGoalsTeams, pointsOf, gdOf, predictedCount, nextMatchDate, minThirdPlacePoints, type ThirdGroupRow } from './standings'
import { resolveBracket } from './bracketResolve'
import { possibleGroupPositions, qualificationStatus, type QualStatus } from './scenarios'
import { effectiveH2H } from './h2h'
import { useStore } from './store'
import { LAST_RESULTS_UPDATE } from './data/lastUpdate'
import { GroupTable } from './components/GroupTable'
import { ThirdPlacePanel } from './components/ThirdPlacePanel'
import { Bracket } from './components/Bracket'
import type { GroupLetter, TeamStanding } from './types'

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

      // Teams that could still be this group's 3rd, predictions included.
      let candidateTeams: string[]
      if (complete[g]) {
        if (pos3.needsScores || pos3.unresolved) {
          const p = pointsOf(pos3.standing)
          candidateTeams = ranked.filter((r) => pointsOf(r.standing) === p).map((r) => r.standing.team)
        } else {
          candidateTeams = [pos3.standing.team]
        }
      } else {
        candidateTeams = possibleGroupPositions(g, predictions, predScores).candidates.get(3) ?? []
      }

      if (candidateTeams.length <= 1) {
        const team = candidateTeams[0] ?? pos3.standing.team
        const standing = ranked.find((r) => r.standing.team === team)!.standing
        rows.push({ group: g, settled: true, rank: 0, sortPts: pointsOf(standing), thirdStanding: standing })
      } else {
        const candidates = candidateTeams.map((team) => {
          const rr = ranked.find((r) => r.standing.team === team)!
          return { standing: rr.standing, position: rr.position }
        })
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
            predicted={predicted[g]}
            nextDate={nextDates[g]}
            qual={qualStatus[g]}
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
        <ThirdPlacePanel rows={thirdRows} />
      </div>

      <div className="section-title">Knockout Bracket</div>
      <Bracket views={bracketViews} />
    </div>
  )
}
