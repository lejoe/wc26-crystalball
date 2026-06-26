import { useState } from 'react'
import { abbrOf, flagOf } from '../data/groups'
import { FIXTURES, resultKey, type Fixture } from '../data/fixtures'
import { useStore } from '../store'
import type { GroupLetter, Outcome } from '../types'
import { formatKickoff, useNow } from '../utils/datetime'

function FxDate({ kickoff, hasResult, now }: { kickoff: string; hasResult: boolean; now: Date }) {
  const d = formatKickoff(kickoff, hasResult, now)
  return (
    <span className={`fx-date status-${d.status} ${d.isToday ? 'is-today' : ''}`}>
      {d.status === 'upcoming' ? (
        <>
          <span className="fx-day">{d.dateText}</span>
          <span className="fx-time">{d.time}</span>
        </>
      ) : (
        <span className="fx-state">
          {d.status === 'live' && <span className="live-dot" aria-hidden="true" />}
          {d.text}
        </span>
      )}
    </span>
  )
}

function PredictRow({
  group,
  index,
  fixture,
  scoreTeams,
  now,
}: {
  group: GroupLetter
  index: number
  fixture: Fixture
  scoreTeams: Set<string>
  now: Date
}) {
  const key = resultKey(group, index)
  const outcome = useStore((s) => s.predictions[key])
  const score = useStore((s) => s.predScores[key])
  const setPrediction = useStore((s) => s.setPrediction)
  const setScore = useStore((s) => s.setScore)

  // Only offer an exact score when goal difference is needed for these teams
  // (or when a score has already been entered).
  const showScore = !!score || scoreTeams.has(fixture.home) || scoreTeams.has(fixture.away)

  const [a, setA] = useState(score ? String(score.hs) : '')
  const [b, setB] = useState(score ? String(score.as) : '')

  const current: Outcome | undefined = score
    ? score.hs > score.as ? 'home' : score.hs < score.as ? 'away' : 'draw'
    : outcome

  const cls = (side: 'home' | 'draw' | 'away') =>
    `pick ${side} ${current === side ? 'sel' : ''} ${current && current !== side ? 'dim' : ''}`

  const pick = (side: Outcome) => {
    setA('')
    setB('')
    setPrediction(group, index, side)
  }

  const onScore = (na: string, nb: string) => {
    setA(na)
    setB(nb)
    if (na !== '' && nb !== '') {
      setScore(group, index, { hs: parseInt(na, 10), as: parseInt(nb, 10) })
    } else if (na === '' && nb === '') {
      // Clearing the score keeps the predicted result (as an outcome-only pick).
      if (current) setPrediction(group, index, current)
      else setScore(group, index, null)
    }
  }

  const num = (e: { target: { value: string } }) => e.target.value.replace(/[^0-9]/g, '')
  const sel = (e: { currentTarget: HTMLInputElement }) => {
    const t = e.currentTarget
    setTimeout(() => t.select(), 0)
  }

  return (
    <div className="match-row predict">
      <FxDate kickoff={fixture.kickoff} hasResult={false} now={now} />
      <div className="pick-group">
        <button className={cls('home')} title={fixture.home} onClick={() => pick('home')}>
          <span className="ab">{abbrOf(fixture.home)}</span>
          <span className="flag">{flagOf(fixture.home)}</span>
        </button>
        <button className={cls('draw')} title="Draw" onClick={() => pick('draw')}>X</button>
        <button className={cls('away')} title={fixture.away} onClick={() => pick('away')}>
          <span className="flag">{flagOf(fixture.away)}</span>
          <span className="ab">{abbrOf(fixture.away)}</span>
        </button>
      </div>
      {showScore && (
        <div className="score-group" title="Exact score — needed to break a tie on goal difference">
          <input className="score" inputMode="numeric" value={a} onFocus={sel} onChange={(e) => onScore(num(e), b)} />
          <span className="dash">–</span>
          <input className="score" inputMode="numeric" value={b} onFocus={sel} onChange={(e) => onScore(a, num(e))} />
        </div>
      )}
    </div>
  )
}

export function MatchesPanel({ group, scoreTeams }: { group: GroupLetter; scoreTeams: Set<string> }) {
  const now = useNow()
  return (
    <div className="match-list">
      {FIXTURES[group].map((f, i) => {
        const past = f.hs !== null && f.as !== null
        if (past) {
          const homeWon = (f.hs as number) > (f.as as number)
          const awayWon = (f.as as number) > (f.hs as number)
          return (
            <div className="match-row played" key={i}>
              <FxDate kickoff={f.kickoff} hasResult={true} now={now} />
              <span className={`m-team home ${homeWon ? 'won' : ''}`} title={f.home}>
                <span className="ab">{abbrOf(f.home)}</span>
                <span className="flag">{flagOf(f.home)}</span>
              </span>
              <span className="m-score">{f.hs}–{f.as}</span>
              <span className={`m-team away ${awayWon ? 'won' : ''}`} title={f.away}>
                <span className="flag">{flagOf(f.away)}</span>
                <span className="ab">{abbrOf(f.away)}</span>
              </span>
            </div>
          )
        }
        return <PredictRow key={i} group={group} index={i} fixture={f} scoreTeams={scoreTeams} now={now} />
      })}
    </div>
  )
}
