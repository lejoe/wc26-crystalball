import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type ThirdPlaceRow } from '../standings'
import type { GroupLetter } from '../types'

type Props = {
  rows: ThirdPlaceRow[]
  settled: Record<GroupLetter, boolean>
}

export function ThirdPlacePanel({ rows, settled }: Props) {
  const anyProvisional = rows.some((r) => !settled[r.group])
  return (
    <div className="third-panel">
      <table className="third-table">
        <thead>
          <tr>
            <th className="num">Rank</th>
            <th>Group</th>
            <th>Team</th>
            <th className="num">Pts</th>
            <th className="num">GD</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: 'var(--muted)', textAlign: 'center' }}>
                Pick group results to rank third-placed teams.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const provisional = !settled[r.group]
            return (
              <tr key={r.group} className={r.rank <= 8 ? 'third-advancing' : ''}>
                <td className="num">{r.rank}</td>
                <td>{r.group}</td>
                <td className={provisional ? 'provisional' : ''}>
                  <span className="flag">{flagOf(r.standing.team)}</span> {r.standing.team}
                  {provisional && <span className="prov-mark" title="3rd place not yet decided">?</span>}
                </td>
                <td className="num">{pointsOf(r.standing)}</td>
                <td className="num">{gdOf(r.standing) > 0 ? `+${gdOf(r.standing)}` : gdOf(r.standing)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {anyProvisional && (
        <div className="third-note">
          <span className="prov-mark">?</span> provisional — that group's 3rd place isn't decided yet.
        </div>
      )}
    </div>
  )
}
