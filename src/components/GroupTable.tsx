import { useState } from 'react'
import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type RankedRow } from '../standings'
import { AnalysisModal } from './AnalysisModal'
import { MatchesPanel } from './MatchesPanel'
import type { GroupLetter, StatusTone } from '../types'
import type { QualStatus } from '../scenarios'
import type { Node } from '../scenarioTree'

type Props = {
  group: GroupLetter
  rows: RankedRow[]
  complete: boolean
  /** True when every match has a real result (not just predictions). */
  realComplete: boolean
  needsScores: boolean
  /** How many of the group's matches the user has predicted. */
  predicted: number
  /** ISO date of the group's next not-yet-played match, or null. */
  nextDate: string | null
  /** Per-row (aligned to `rows`): Through / In the balance / Out outlook. */
  qual: QualStatus[]
  /** Per-team status tone for the interactive modal (ready groups only). */
  tones?: Map<string, StatusTone>
  /** Per-team interactive scenario tree, opened in the modal (ready groups only). */
  scenarios?: Record<string, Node>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-06-24" → "24 Jun". */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/** Local YYYY-MM-DD for a date (matches the timezone-less fixture dates). */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** "Today" / "Tomorrow" for the next two days, otherwise "24 Jun". */
function relativeMatchDate(iso: string): { text: string; isToday: boolean } {
  const now = new Date()
  if (iso === localISO(now)) return { text: 'Today', isToday: true }
  if (iso === localISO(new Date(now.getTime() + 86_400_000))) return { text: 'Tomorrow', isToday: false }
  return { text: shortDate(iso), isToday: false }
}

export function GroupTable({ group, rows, complete, realComplete, needsScores, predicted, nextDate, qual, tones, scenarios }: Props) {
  const [showMatches, setShowMatches] = useState(false)
  // The team whose interactive analysis modal is open.
  const [modalTeam, setModalTeam] = useState<string | null>(null)

  // Interactive modal: a team has a trigger when it has both a tone and a tree.
  const modalTone = (team: string): StatusTone | null =>
    scenarios?.[team] ? tones?.get(team) ?? null : null

  // Teams whose goal difference must be pinned down with an exact score.
  const scoreTeams = complete
    ? new Set(rows.filter((r) => r.needsScores).map((r) => r.standing.team))
    : new Set<string>()
  const next = nextDate ? relativeMatchDate(nextDate) : null

  return (
    <div className={`group-card ${complete ? 'finalized' : ''} ${complete && !realComplete ? 'predicted-final' : ''}`}>
      <div className="gc-head">
        <span className="gc-title">
          Group <b>{group}</b>
        </span>
        {predicted > 0 && (
          <span className="gc-status">{predicted} predicted</span>
        )}
      </div>

      <table className="standings">
        <thead>
          <tr>
            <th className="qcol" aria-hidden="true"></th>
            <th className="team-col">Team</th>
            <th>P</th>
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
            const status = qual[i] ?? 'open'
            const gd = gdOf(s)
            // Only flag a tie once the group is finished and an exact score is needed.
            const flag = complete && r.needsScores
            // Rows with a tone + tree open the situation-analysis modal on click.
            const tone = modalTone(s.team)
            const open = tone ? () => setModalTeam(s.team) : undefined
            return (
              <tr
                key={s.team}
                className={`q-${status}${tone ? ' row-analyzable' : ''}`}
                role={tone ? 'button' : undefined}
                tabIndex={tone ? 0 : undefined}
                aria-label={tone ? `${s.team} — open situation analysis` : undefined}
                onClick={open}
                onKeyDown={
                  open
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          open()
                        }
                      }
                    : undefined
                }
              >
                <td className="qcol" aria-hidden="true"></td>
                <td className="team-col">
                  <div className="team-cell">
                    <span className="flag">{flagOf(s.team)}</span>
                    <span className="name" title={s.team}>{s.team}</span>
                    {flag && (
                      <span className="tie-flag" title="Level on points — predict exact scores to set goal difference">
                        *
                      </span>
                    )}
                  </div>
                </td>
                <td className="derived">{s.played}</td>
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

      <div className="gc-foot">
        <span className="gc-next">
          {next && (
            <>
              Next · <span className={next.isToday ? 'gc-today' : ''}>{next.text}</span>
            </>
          )}
        </span>
        <button
          className={`gc-link ${needsScores ? 'scores-needed' : ''} ${showMatches ? 'active' : ''}`}
          onClick={() => setShowMatches((v) => !v)}
          title={
            needsScores
              ? 'Order decided by goal difference — predict exact scores'
              : 'View / predict matches'
          }
        >
          {needsScores ? 'Scores needed' : showMatches ? 'Hide matches' : 'Matches'} ›
        </button>
      </div>

      {showMatches && <MatchesPanel group={group} scoreTeams={scoreTeams} />}

      {modalTeam && scenarios?.[modalTeam] && (
        <AnalysisModal
          team={modalTeam}
          tone={modalTone(modalTeam) as StatusTone}
          root={scenarios[modalTeam]}
          onClose={() => setModalTeam(null)}
        />
      )}
    </div>
  )
}
