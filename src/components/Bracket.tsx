import * as HoverCard from '@radix-ui/react-hover-card'
import { abbrOf, flagOf, groupOf } from '../data/groups'
import type { GroupLetter } from '../types'
import { MATCH_BY_ID } from '../data/bracket'
import { BRACKET_RESULTS } from '../data/bracketResults'
import type { MatchView, SlotView } from '../bracketResolve'
import { useStore } from '../store'
import type { Side } from '../types'

type PopSide = 'left' | 'right'

type Props = {
  views: Record<number, MatchView>
}

type Col = { round: string; label: string; ids: number[] }

// Two mirrored halves fanning out from the central Final.
const LEFT: Col[] = [
  { round: 'R32', label: 'Round of 32', ids: [74, 77, 73, 75, 83, 84, 81, 82] },
  { round: 'R16', label: 'Round of 16', ids: [89, 90, 93, 94] },
  { round: 'QF', label: 'Quarter-finals', ids: [97, 98] },
  { round: 'SF', label: 'Semi-finals', ids: [101] },
]
const RIGHT: Col[] = [
  { round: 'SF', label: 'Semi-finals', ids: [102] },
  { round: 'QF', label: 'Quarter-finals', ids: [99, 100] },
  { round: 'R16', label: 'Round of 16', ids: [91, 92, 95, 96] },
  { round: 'R32', label: 'Round of 32', ids: [76, 78, 79, 80, 86, 88, 85, 87] },
]

function Slot({
  view,
  matchId,
  side,
  matchView,
  popSide,
}: {
  view: SlotView
  matchId: number
  side: Side
  matchView: MatchView
  popSide: PopSide
}) {
  const setWinner = useStore((s) => s.setWinner)

  const isWinner = matchView.winnerSide === side
  const isEliminated = matchView.winnerSide != null && !isWinner
  const hasCands = !view.team && view.candidates.length > 0
  const locked = matchId in BRACKET_RESULTS // real result decided this match

  const winnerCls = isWinner ? 'winner' : ''
  // Mark a filled entry: green when real results lock the team, orange when it's prediction-based.
  const entryCls = view.team ? (view.confirmed ? 'entry-real' : 'entry-pred') : ''

  const box = (
    <div
      className={`slot ${locked ? '' : 'clickable'} ${winnerCls} ${entryCls} ${isEliminated ? 'eliminated' : ''}`}
      onClick={() => {
        if (locked) return
        setWinner(matchId, isWinner ? null : side)
      }}
      title={locked ? 'Decided by result' : isWinner ? 'Advancing — click to undo' : 'Click to advance'}
    >
      {view.team ? (
        <>
          <span className="flag">{flagOf(view.team)}</span>
          <span className="slot-team">{abbrOf(view.team)}</span>
          {isWinner && <span className="slot-label">✓</span>}
        </>
      ) : (
        <div className="slot-unknown">
          <span className="slot-label">{view.label}</span>
          {hasCands && <span className="q-badge">?</span>}
          {isWinner && <span className="slot-label">✓</span>}
        </div>
      )}
    </div>
  )

  if (!hasCands) return box

  // Group the candidate teams by their group for a readable popover.
  const byGroup = new Map<GroupLetter, string[]>()
  for (const t of view.candidates) {
    const g = groupOf(t)
    if (!g) continue
    const arr = byGroup.get(g)
    if (arr) arr.push(t)
    else byGroup.set(g, [t])
  }
  const grouped = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <HoverCard.Root openDelay={60} closeDelay={150}>
      <HoverCard.Trigger asChild>{box}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="cand-pop"
          side={popSide}
          align="start"
          sideOffset={6}
          collisionPadding={8}
        >
          <div className="cand-pop-title">Possible teams</div>
          {grouped.map(([g, teams]) => (
            <div className="cand-pop-group" key={g}>
              <div className="cand-pop-glabel">Group {g}</div>
              {teams.map((t) => (
                <div className="cand-pop-row" key={t}>
                  <span className="flag">{flagOf(t)}</span> {t}
                </div>
              ))}
            </div>
          ))}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

function MatchCard({ matchView, final, popSide }: { matchView: MatchView; final?: boolean; popSide: PopSide }) {
  const def = MATCH_BY_ID[matchView.def.id]
  return (
    <div className={`match ${final ? 'match-final' : ''}`}>
      <div className="match-id">Match {def.id}</div>
      <Slot view={matchView.a} matchId={def.id} side="a" matchView={matchView} popSide={popSide} />
      <Slot view={matchView.b} matchId={def.id} side="b" matchView={matchView} popSide={popSide} />
    </div>
  )
}

function BracketColumn({ col, side, views }: { col: Col; side: 'left' | 'right'; views: Record<number, MatchView> }) {
  const popSide: PopSide = side === 'left' ? 'right' : 'left'
  return (
    <div className={`bcol half-${side} ${col.ids.length > 1 ? 'multi' : ''}`}>
      <div className="col-label">
        <span className="lbl-full">{col.label}</span>
        <span className="lbl-short">{col.round}</span>
      </div>
      <div className="bcol-matches">
        {col.ids.map((id) => (
          <div className="bcell" key={id}>
            <MatchCard matchView={views[id]} popSide={popSide} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ThirdPlacePlayoff({ views }: Props) {
  return (
    <div className="third-play-off">
      <div className="col-label">Third-place play-off</div>
      <MatchCard matchView={views[103]} popSide="right" />
    </div>
  )
}

export function Bracket({ views }: Props) {
  const final = views[104]
  const champSlot = final?.winnerSide === 'a' ? final.a : final?.winnerSide === 'b' ? final.b : null
  const champion = champSlot?.team ?? null
  const champUnknown = !!final?.winnerSide && !champion
  return (
    <div className="bracket-scroll">
      <div className="bracket2">
        <div className="bhalf bhalf-left">
          {LEFT.map((col) => (
            <BracketColumn key={`L-${col.round}`} col={col} side="left" views={views} />
          ))}
        </div>

        <div className="bcol bcol-center">
          <div className="col-label final-label">Final</div>
          <div className="bcol-matches">
            <div className="bcell">
              <MatchCard matchView={views[104]} final popSide="right" />
            </div>
            <div className="champion-box">
              <div className="champion-label">Champion</div>
              <div className="match match-final">
                <div
                  className={`slot winner ${champion ? (champSlot?.confirmed ? 'entry-real' : 'entry-pred') : ''}`}
                  style={{ justifyContent: 'center' }}
                >
                  {champion ? (
                    <>
                      <span className="flag">{flagOf(champion)}</span>
                      <span className="slot-team" style={{ flex: 'unset' }} title={champion}>{abbrOf(champion)}</span>
                      🏆
                    </>
                  ) : champUnknown ? (
                    <span className="slot-label">? 🏆</span>
                  ) : (
                    <span className="slot-label">TBD</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bhalf bhalf-right">
          {RIGHT.map((col) => (
            <BracketColumn key={`R-${col.round}`} col={col} side="right" views={views} />
          ))}
        </div>
      </div>
    </div>
  )
}
