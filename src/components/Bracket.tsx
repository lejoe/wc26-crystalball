import * as HoverCard from '@radix-ui/react-hover-card'
import { abbrOf, flagOf, groupCandidatesByGroup } from '../data/groups'
import { MATCH_BY_ID } from '../data/bracket'
import { BRACKET_RESULTS } from '../data/bracketResults'
import type { MatchView, SlotView } from '../bracketResolve'
import { useStore } from '../store'
import type { Side } from '../types'
import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import { ChampionConfetti } from './ChampionConfetti'
import { kickoffParts, useNow } from '../utils/datetime'

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

  // Advancing: real knockout result → solid; user prediction → dotted.
  const winnerCls = isWinner ? (locked ? 'winner winner-real' : 'winner winner-pred') : ''
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
        </>
      ) : (
        <div className="slot-unknown">
          <span className="slot-label">{view.label}</span>
          {hasCands && <span className="q-badge">?</span>}
        </div>
      )}
    </div>
  )

  if (!hasCands) return box

  // Group the candidate teams by their group for a readable popover.
  const grouped = groupCandidatesByGroup(view.candidates)

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
          {grouped.map(({ g, teams }) => (
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

// Shared canvas for measuring text against the card width without reflow.
let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string, font: string): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

/**
 * Kickoff strip sized for the narrow bracket card: the full date (with weekday)
 * and compact time on one line when they fit, otherwise stacked on two lines.
 * Connectors anchor to the equal-height cells, so varying card heights stay aligned.
 */
function BracketDate({ kickoff, hasResult, now }: { kickoff: string; hasResult: boolean; now: Date }) {
  const parts = kickoffParts(kickoff, hasResult, now)
  const ref = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLSpanElement>(null)
  const [oneLine, setOneLine] = useState(false)

  useLayoutEffect(() => {
    if (parts.status !== 'upcoming') return
    const el = ref.current
    const dateEl = dateRef.current
    if (!el || !dateEl) return
    const measure = () => {
      const elCs = getComputedStyle(el)
      // Small margin absorbs the separator padding and weight differences between lines.
      const avail = el.clientWidth - parseFloat(elCs.paddingLeft) - parseFloat(elCs.paddingRight) - 3
      const dCs = getComputedStyle(dateEl)
      const font = `${dCs.fontWeight} ${dCs.fontSize} ${dCs.fontFamily}`
      setOneLine(textWidth(`${parts.weekdayDate} · ${parts.time}`, font) <= avail)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [parts.weekdayDate, parts.time, parts.status])

  if (parts.status !== 'upcoming') {
    return (
      <div ref={ref} className={`match-date status-${parts.status}`}>
        {parts.status === 'live' && <span className="live-dot" aria-hidden="true" />}
        {parts.stateText}
      </div>
    )
  }
  return (
    <div ref={ref} className={`match-date status-upcoming ${parts.isToday ? 'is-today' : ''} ${oneLine ? 'oneline' : ''}`}>
      <span ref={dateRef} className="md-date">{parts.weekdayDate}</span>
      <span className="md-sep" aria-hidden="true">·</span>
      <span className="md-time">{parts.time}</span>
    </div>
  )
}

function MatchCard({ matchView, final, popSide, now }: { matchView: MatchView; final?: boolean; popSide: PopSide; now: Date }) {
  const def = MATCH_BY_ID[matchView.def.id]
  return (
    <div className={`match ${final ? 'match-final' : ''}`}>
      <BracketDate kickoff={def.kickoff} hasResult={def.id in BRACKET_RESULTS} now={now} />
      <Slot view={matchView.a} matchId={def.id} side="a" matchView={matchView} popSide={popSide} />
      <Slot view={matchView.b} matchId={def.id} side="b" matchView={matchView} popSide={popSide} />
    </div>
  )
}

function BracketColumn({ col, side, views, now }: { col: Col; side: 'left' | 'right'; views: Record<number, MatchView>; now: Date }) {
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
            <MatchCard matchView={views[id]} popSide={popSide} now={now} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PodiumSpot({
  rank,
  matchView,
  side,
  locked,
  innerRef,
}: {
  rank: 1 | 2 | 3
  matchView?: MatchView
  side: Side | null
  locked: boolean
  innerRef?: Ref<HTMLDivElement>
}) {
  const slot = side ? (side === 'a' ? matchView?.a : matchView?.b) : null
  const team = slot?.team ?? null
  const decided = side != null // this placement's match has a chosen winner
  const unknown = decided && !team // winner picked along a path but team not yet known
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
  const entryCls = team ? (slot?.confirmed ? 'entry-real' : 'entry-pred') : ''
  const resultCls = decided ? (locked ? 'winner-real' : 'winner-pred') : ''

  return (
    <div className={`podium-spot podium-${rank}`}>
      <div ref={innerRef} className={`podium-team ${entryCls} ${resultCls}`}>
        {team ? (
          <>
            <span className="flag">{flagOf(team)}</span>
            <span className="slot-team" title={team}>{abbrOf(team)}</span>
          </>
        ) : unknown ? (
          <span className="slot-label">?</span>
        ) : (
          <span className="slot-label">TBD</span>
        )}
      </div>
      <div className="podium-step">
        <span className="podium-medal">{medal}</span>
      </div>
    </div>
  )
}

function Podium({ views, championRef }: { views: Record<number, MatchView>; championRef: Ref<HTMLDivElement> }) {
  const final = views[104]
  const third = views[103]
  const champSide = final?.winnerSide ?? null
  const runnerSide: Side | null = champSide ? (champSide === 'a' ? 'b' : 'a') : null
  const thirdSide = third?.winnerSide ?? null
  const finalLocked = 104 in BRACKET_RESULTS
  const thirdLocked = 103 in BRACKET_RESULTS

  return (
    <div className="podium-box">
      <div className="podium">
        <PodiumSpot rank={2} matchView={final} side={runnerSide} locked={finalLocked} />
        <PodiumSpot rank={1} matchView={final} side={champSide} locked={finalLocked} innerRef={championRef} />
        <PodiumSpot rank={3} matchView={third} side={thirdSide} locked={thirdLocked} />
      </div>
    </div>
  )
}

export function ThirdPlacePlayoff({ views, now }: Props & { now: Date }) {
  return (
    <div className="third-play-off">
      <div className="col-label">Third-place</div>
      <MatchCard matchView={views[103]} popSide="right" now={now} />
    </div>
  )
}

export function Bracket({ views }: Props) {
  const final = views[104]
  const champSlot = final?.winnerSide === 'a' ? final.a : final?.winnerSide === 'b' ? final.b : null
  const champion = champSlot?.team ?? null
  const championRef = useRef<HTMLDivElement>(null)
  const now = useNow()
  return (
    <div className="bracket-scroll">
      <div className="bracket2">
        <ChampionConfetti originRef={championRef} champion={champion} />
        <div className="bhalf bhalf-left">
          {LEFT.map((col) => (
            <BracketColumn key={`L-${col.round}`} col={col} side="left" views={views} now={now} />
          ))}
        </div>

        <div className="bcol bcol-center">
          <div className="col-label final-label" aria-hidden="true">{' '}</div>
          <div className="final-stack">
            <ThirdPlacePlayoff views={views} now={now} />
            <div className="final-block">
              <div className="col-label final-match-label">Final</div>
              <MatchCard matchView={views[104]} final popSide="right" now={now} />
            </div>
            <Podium views={views} championRef={championRef} />
          </div>
        </div>

        <div className="bhalf bhalf-right">
          {RIGHT.map((col) => (
            <BracketColumn key={`R-${col.round}`} col={col} side="right" views={views} now={now} />
          ))}
        </div>
      </div>
    </div>
  )
}
