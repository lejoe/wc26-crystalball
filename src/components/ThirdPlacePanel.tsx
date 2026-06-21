import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type ThirdPlaceRow } from '../standings'
import type { GroupLetter } from '../types'

type Props = {
  rows: ThirdPlaceRow[]
  settled: Record<GroupLetter, boolean>
  contenders: Record<GroupLetter, string[]>
}

export function ThirdPlacePanel({ rows, settled, contenders }: Props) {
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
            const teams = contenders[r.group]?.length ? contenders[r.group] : [r.standing.team]
            const multi = teams.length > 1
            const gd = gdOf(r.standing)
            return (
              <tr key={r.group} className={r.rank <= 8 ? 'third-advancing' : ''}>
                <td className="num">{r.rank}</td>
                <td>{r.group}</td>
                <td className={provisional ? 'provisional' : ''}>
                  {teams.map((t, i) => (
                    <span key={t}>
                      {i > 0 && <span className="cand-sep"> / </span>}
                      <span className="flag">{flagOf(t)}</span> {t}
                    </span>
                  ))}
                  {provisional && <span className="prov-mark" title="3rd place not yet decided">?</span>}
                </td>
                <td className="num">{pointsOf(r.standing)}</td>
                <td className="num">{multi ? '—' : gd > 0 ? `+${gd}` : gd}</td>
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
