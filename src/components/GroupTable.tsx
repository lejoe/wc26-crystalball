import { useState } from 'react'
import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type RankedRow } from '../standings'
import { MatchesPanel } from './MatchesPanel'
import type { GroupLetter } from '../types'

type Props = {
  group: GroupLetter
  rows: RankedRow[]
  complete: boolean
  needsScores: boolean
  /** Per-row (aligned to `rows`): is this team's final position locked in? */
  decided: boolean[]
}

export function GroupTable({ group, rows, complete, needsScores, decided }: Props) {
  const [showMatches, setShowMatches] = useState(false)

  // Teams whose goal difference must be pinned down with an exact score.
  const scoreTeams = complete
    ? new Set(rows.filter((r) => r.needsScores).map((r) => r.standing.team))
    : new Set<string>()

  return (
    <div className={`group-card ${complete ? 'finalized' : ''}`}>
      <h3>
        <span className="group-name">
          Group {group}
          {complete && <span className="final-badge" title="All matches decided">✓ Final</span>}
        </span>
        <span className="group-controls">
          <button
            className={`ctl ${needsScores ? 'scores-needed' : ''} ${showMatches ? 'active' : ''}`}
            onClick={() => setShowMatches((v) => !v)}
            title={
              needsScores
                ? 'Order decided by goal difference — predict exact scores'
                : 'View / predict matches'
            }
          >
            {needsScores ? '⚖ Scores' : '📅 Matches'}
          </button>
        </span>
      </h3>

      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th className="team-col">Team</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const s = r.standing
            const zone = r.position <= 2 ? 'row-advance' : r.position === 3 ? 'row-third' : ''
            const isDecided = decided[i]
            const tentative = isDecided ? '' : 'tentative'
            const gd = gdOf(s)
            const flag = r.needsScores || r.unresolved
            return (
              <tr key={s.team} className={`${zone} ${tentative}`}>
                <td>
                  <span className="pos-badge">{r.position}</span>
                </td>
                <td className="team-col">
                  <div className="team-cell">
                    <span className="flag">{flagOf(s.team)}</span>
                    <span className="name" title={s.team}>{s.team}</span>
                    {isDecided && zone && (
                      <span className="lock" title="Position decided">🔒</span>
                    )}
                    {flag && (
                      <span
                        className="tie-flag"
                        title={
                          r.needsScores
                            ? 'Level on points — predict exact scores to set goal difference'
                            : 'Level on points — undecided (fair play / drawing of lots)'
                        }
                      >
                        *
                      </span>
                    )}
                  </div>
                </td>
                <td className="derived">{s.won}</td>
                <td className="derived">{s.drawn}</td>
                <td className="derived">{s.lost}</td>
                <td className="derived">{s.goalsFor}</td>
                <td className="derived">{s.goalsAgainst}</td>
                <td className="derived">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="pts">{pointsOf(s)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {showMatches && <MatchesPanel group={group} scoreTeams={scoreTeams} />}
    </div>
  )
}
