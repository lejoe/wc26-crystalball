import { Fragment } from 'react'
import { flagOf } from '../data/groups'
import { gdOf, pointsOf, type ThirdGroupRow } from '../standings'

// Best thirds that advance to the Round of 32.
const ADVANCE = 8

type Props = {
  rows: ThirdGroupRow[]
}

const fmtGd = (gd: number) => (gd > 0 ? `+${gd}` : `${gd}`)

// A qualifying spot on the left board: either a settled 3rd (locked) or an
// open spot whose holder is still being decided in one of the right groups.
type Slot = { settled: ThirdGroupRow } | { open: true; rank: number }

export function ThirdPlacePanel({ rows }: Props) {
  // Ranking (rank, the top-8 cut) is global across all twelve groups; we only
  // split where rows are shown. Left lists every third-place spot at its global
  // rank — settled thirds slotted in, the rest shown as open spots — with the
  // cut drawn after spot 8. Right lists the groups still to decide.
  const settled = rows.filter((r) => r.settled)
  const toDecide = rows.filter((r) => !r.settled)

  const settledByRank = new Map(settled.map((r) => [r.rank, r]))
  const slots: Slot[] = []
  for (let rank = 1; rank <= rows.length; rank++) {
    const s = settledByRank.get(rank)
    slots.push(s ? { settled: s } : { open: true, rank })
  }

  return (
    <div className="third-split">
      <div className="third-col">
        <div className="third-col-head">
          Third-place spots
        </div>
        <div className="third-panel">
          <table className="standings third-standings">
            <ThirdHead />
            <tbody>
              {slots.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--muted)', textAlign: 'center' }}>
                    Pick group results to rank third-placed teams.
                  </td>
                </tr>
              )}
              {slots.map((slot, i) => {
                const rank = 'settled' in slot ? slot.settled.rank : slot.rank
                return (
                  <Fragment key={'settled' in slot ? slot.settled.group : `open-${i}`}>
                    {'settled' in slot ? (
                      <SettledRow row={slot.settled} />
                    ) : (
                      <OpenSlotRow advancing={slot.rank <= ADVANCE} />
                    )}
                    {rank === ADVANCE && slots.length > ADVANCE && (
                      <tr className="cut-row" aria-hidden="true">
                        <td colSpan={7}>
                          <div className="cut-line">Top 8 advance</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="third-col">
        <div className="third-col-head">
          To decide
        </div>
        <div className="third-panel">
          <table className="standings third-standings">
            <ThirdHead />
            <tbody>
              {toDecide.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--muted)', textAlign: 'center' }}>
                    No groups left to decide.
                  </td>
                </tr>
              )}
              {toDecide.map((r) => (
                <ToDecideGroup key={r.group} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ThirdHead() {
  return (
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
  )
}

function OpenSlotRow({ advancing }: { advancing: boolean }) {
  return (
    <tr className={`${advancing ? 'q-through' : 'q-out'} third-slot-open`}>
      <td className="qcol" aria-hidden="true"></td>
      <td className="team-col">
        <div className="team-cell">
          <span className="slot-open">To be decided</span>
        </div>
      </td>
      <td className="derived">–</td>
      <td className="derived">–</td>
      <td className="derived">–</td>
      <td className="derived">–</td>
      <td className="pts">–</td>
    </tr>
  )
}

function ToDecideGroup({ row }: { row: ThirdGroupRow }) {
  return (
    <>
      <tr className="q-balance third-group-head">
        <td className="qcol" aria-hidden="true"></td>
        <td className="team-col">
          <span className="third-ghead">{row.group}</span>
        </td>
        <td className="derived"></td>
        <td className="derived"></td>
        <td className="derived"></td>
        <td className="derived min-label">min</td>
        <td className="pts">{row.minPoints}</td>
      </tr>
      {row.candidates!.map((c) => {
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
