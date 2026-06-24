import { Fragment } from 'react'
import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type ThirdGroupRow } from '../standings'

// Best thirds that advance to the Round of 32.
const ADVANCE = 8

type Props = {
  rows: ThirdGroupRow[]
}

const fmtGd = (gd: number) => (gd > 0 ? `+${gd}` : `${gd}`)

export function ThirdPlacePanel({ rows }: Props) {
  return (
    <div className="third-panel">
      <table className="standings third-standings">
        <thead>
          <tr>
            <th className="qcol" aria-hidden="true"></th>
            <th className="team-col">Group · 3rd place</th>
            <th>P</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: 'var(--muted)', textAlign: 'center' }}>
                Pick group results to rank third-placed teams.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Fragment key={r.group}>
              {r.settled ? (
                <SettledRow row={r} />
              ) : (
                <>
                  <tr className="q-balance third-group-head">
                    <td className="qcol" aria-hidden="true"></td>
                    <td className="team-col">
                      <span className="third-ghead">{r.group}</span>
                    </td>
                    <td className="derived"></td>
                    <td className="derived"></td>
                    <td className="derived"></td>
                    <td className="derived min-label">min</td>
                    <td className="pts">{r.minPoints}</td>
                  </tr>
                  {r.candidates!.map((c) => {
                    const s = c.standing
                    return (
                      <tr key={s.team} className="q-balance third-candidate">
                        <td className="qcol" aria-hidden="true"></td>
                        <td className="team-col">
                          <div className="team-cell">
                            <span className="cand-pos">{c.position}</span>
                            <span className="flag">{flagOf(s.team)}</span>
                            <span className="name" title={s.team}>{s.team}</span>
                          </div>
                        </td>
                        <td className="derived">{s.played}</td>
                        <td className="derived">{s.goalsFor}</td>
                        <td className="derived">{s.goalsAgainst}</td>
                        <td className="derived">{fmtGd(gdOf(s))}</td>
                        <td className="pts">{pointsOf(s)}</td>
                      </tr>
                    )
                  })}
                </>
              )}
              {r.rank === ADVANCE && rows.length > ADVANCE && (
                <tr className="cut-row" aria-hidden="true">
                  <td colSpan={7}>
                    <div className="cut-line">Top 8 advance</div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SettledRow({ row }: { row: ThirdGroupRow }) {
  const s = row.thirdStanding!
  const status = row.rank <= ADVANCE ? 'through' : 'out'
  return (
    <tr className={`q-${status}`}>
      <td className="qcol" aria-hidden="true"></td>
      <td className="team-col">
        <div className="team-cell">
          <span className="third-grp">{row.group}</span>
          <span className="flag">{flagOf(s.team)}</span>
          <span className="name" title={s.team}>{s.team}</span>
        </div>
      </td>
      <td className="derived">{s.played}</td>
      <td className="derived">{s.goalsFor}</td>
      <td className="derived">{s.goalsAgainst}</td>
      <td className="derived">{fmtGd(gdOf(s))}</td>
      <td className="pts">{pointsOf(s)}</td>
    </tr>
  )
}
