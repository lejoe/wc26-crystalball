import { useState } from 'react'
import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type RankedRow } from '../standings'
import { MatchesPanel } from './MatchesPanel'
import { TeamAnalysisHover } from './TeamAnalysis'
import type { GroupAnalysis, GroupLetter, StatusTone } from '../types'

type Props = {
  group: GroupLetter
  rows: RankedRow[]
  complete: boolean
  needsScores: boolean
  /** Per-row (aligned to `rows`): is this team's final position locked in? */
  decided: boolean[]
  /** AI-composed situation analysis, present only when the group is in the ready window. */
  analysis?: GroupAnalysis
}

export function GroupTable({ group, rows, complete, needsScores, decided, analysis }: Props) {
  const [showMatches, setShowMatches] = useState(false)
  // The team whose analysis card is pinned open (tap on touch); one at a time.
  const [pinnedTeam, setPinnedTeam] = useState<string | null>(null)

  // Per-team status tone for the ready-window situation analysis, if available.
  const toneByTeam = analysis ? new Map(analysis.overview.map((o) => [o.team, o.tone])) : null

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
            // Only flag a tie once the group is finished and an exact score is needed.
            const flag = complete && r.needsScores
            return (
              <tr key={s.team} className={`${zone} ${tentative}`}>
                <td>
                  <span className="pos-badge">{r.position}</span>
                </td>
                <td className="team-col">
                  <div className="team-cell">
                    <span className="flag">{flagOf(s.team)}</span>
                    {toneByTeam?.has(s.team) ? (
                      <TeamAnalysisHover
                        team={s.team}
                        tone={toneByTeam.get(s.team) as StatusTone}
                        blocks={analysis!.teams[s.team] ?? []}
                        pinned={pinnedTeam === s.team}
                        onTogglePin={() => setPinnedTeam((p) => (p === s.team ? null : s.team))}
                      >
                        <span className="name" title={s.team}>{s.team}</span>
                      </TeamAnalysisHover>
                    ) : (
                      <span className="name" title={s.team}>{s.team}</span>
                    )}
                    {isDecided && zone && (
                      <span className="lock" title="Position decided">🔒</span>
                    )}
                    {flag && (
                      <span className="tie-flag" title="Level on points — predict exact scores to set goal difference">
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
