import { useEffect } from 'react'
import { abbrOf, flagOf } from '../data/groups'
import { gdOf, pointsOf, type RankedRow, type ThirdGroupRow } from '../standings'
import { ROUND_NAME, type FinishedView } from '../finishedAnalysis'
import { BRACKET_RESULTS } from '../data/bracketResults'
import { ThirdPlacePanel } from './ThirdPlacePanel'
import { kickoffParts, useNow } from '../utils/datetime'
import type { MatchView, SlotView } from '../bracketResolve'
import type { GroupLetter, StatusTone } from '../types'

const fmtGd = (gd: number) => (gd > 0 ? `+${gd}` : `${gd}`)

/** Tone + label for the header chip, derived from the team's finished state. */
function headChip(view: FinishedView): { tone: StatusTone; label: string } {
  if (view.kind === 'third-undecided')
    return { tone: 'in-balance', label: 'Best-third race open' }
  if (view.kind === 'out-group')
    return { tone: 'out', label: view.position === 3 ? 'Out · 3rd place' : 'Out · group stage' }
  if (view.knockedOut)
    return { tone: 'out', label: `Out · ${ROUND_NAME[view.anchorRound!]}` }
  return { tone: 'through', label: `Through · ${ROUND_NAME[view.anchorRound!]}` }
}

/**
 * Post-group board for one team: a final group-table recap on top, and below it
 * a stage-aware slice of where the team goes next — a mini-bracket path, the
 * best-third ranking, or nothing when the team is out in the group phase.
 */
export function FinishedAnalysisModal({
  team,
  group,
  finalRanking,
  view,
  thirdRows,
  onClose,
}: {
  team: string
  group: GroupLetter
  finalRanking: RankedRow[]
  view: FinishedView
  thirdRows: ThirdGroupRow[]
  onClose: () => void
}) {
  const now = useNow()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const chip = headChip(view)
  const wide = view.kind === 'advanced' && view.path.length >= 3

  return (
    <div className="an2-overlay" onClick={onClose} role="presentation">
      <div
        className={`an2-modal ${wide ? 'an2-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${team} group result`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="an2-head">
          <span className="flag">{flagOf(team)}</span>
          <span className="an2-team">{team}</span>
          <span className={`an2-tone-chip tone-${chip.tone}`}>{chip.label}</span>
          <button type="button" className="an2-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="an2-body fin-body">
          <section className="fin-section">
            <h3 className="fin-title">Group {group} · final standings</h3>
            <FinalGroupTable rows={finalRanking} focus={team} />
          </section>

          {view.kind === 'advanced' && view.path.length > 0 && (
            <section className="fin-section">
              <h3 className="fin-title">Knockout path</h3>
              <MiniBracket path={view.path} focus={team} now={now} />
            </section>
          )}

          {view.kind === 'third-undecided' && (
            <section className="fin-section">
              <h3 className="fin-title">Best third-placed teams</h3>
              <p className="fin-note">
                {team} finished 3rd. Qualification depends on the best-third race across all groups.
              </p>
              <ThirdPlacePanel rows={thirdRows} />
            </section>
          )}

          {view.kind === 'out-group' && (
            <p className="fin-note">
              {team} finished {ordinal(view.position)} and did not advance to the knockout stage.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}

function FinalGroupTable({ rows, focus }: { rows: RankedRow[]; focus: string }) {
  return (
    <table className="standings fin-table">
      <thead>
        <tr>
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
        {rows.map((r) => {
          const s = r.standing
          const gd = gdOf(s)
          const advances = r.position <= 2
          return (
            <tr key={s.team} className={`${advances ? 'q-through' : 'q-out'} ${s.team === focus ? 'fin-focus' : ''}`}>
              <td className="team-col">
                <div className="team-cell">
                  <span className="fin-pos">{r.position}</span>
                  <span className="flag">{flagOf(s.team)}</span>
                  <span className="name" title={s.team}>{s.team}</span>
                </div>
              </td>
              <td className="derived">{s.played}</td>
              <td className="derived">{s.won}</td>
              <td className="derived">{s.drawn}</td>
              <td className="derived">{s.lost}</td>
              <td className="derived">{s.goalsFor}</td>
              <td className="derived">{s.goalsAgainst}</td>
              <td className="derived">{fmtGd(gd)}</td>
              <td className="pts">{pointsOf(s)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MiniBracket({ path, focus, now }: { path: MatchView[]; focus: string; now: Date }) {
  return (
    <div className="mini-bracket">
      {path.map((mv, i) => {
        const parts = kickoffParts(mv.def.kickoff, mv.def.id in BRACKET_RESULTS, now)
        return (
          <div className="mb-col" key={mv.def.id}>
            {i > 0 && <span className="mb-arrow" aria-hidden="true">→</span>}
            <div className="mb-round">{ROUND_NAME[mv.def.round]}</div>
            <div className="mb-date">
              {parts.status === 'upcoming' ? parts.weekdayDate : parts.stateText}
            </div>
            <div className="mb-match">
              <MiniSlot slot={mv.a} won={mv.winnerSide === 'a'} decided={mv.winnerSide != null} focus={focus} />
              <MiniSlot slot={mv.b} won={mv.winnerSide === 'b'} decided={mv.winnerSide != null} focus={focus} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MiniSlot({
  slot,
  won,
  decided,
  focus,
}: {
  slot: SlotView
  won: boolean
  decided: boolean
  focus: string
}) {
  const isFocus = slot.team === focus
  const lost = decided && !won
  return (
    <div className={`mb-slot ${won ? 'mb-won' : ''} ${lost ? 'mb-lost' : ''} ${isFocus ? 'mb-focus' : ''}`}>
      {slot.team ? (
        <>
          <span className="flag">{flagOf(slot.team)}</span>
          <span className="slot-team">{abbrOf(slot.team)}</span>
        </>
      ) : (
        <span className="slot-label">{slot.label || '?'}</span>
      )}
    </div>
  )
}
