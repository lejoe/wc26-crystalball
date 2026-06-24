import { useMemo, useRef, useState } from 'react'
import { flagOf } from '../data/groups'
import type { GroupLetter } from '../types'

export type SearchTeam = { team: string; group: GroupLetter; analyzable: boolean }

/**
 * Type-ahead team finder. Selecting a team opens its situation-analysis popup.
 * Teams whose situation is already decided (no scenario tree) show as inert.
 */
export function TeamSearch({ teams, onSelect }: { teams: SearchTeam[]; onSelect: (team: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return teams.filter((t) => t.team.toLowerCase().includes(needle)).slice(0, 8)
  }, [query, teams])

  const choose = (t: SearchTeam | undefined) => {
    if (!t || !t.analyzable) return
    onSelect(t.team)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(matches[hi])
    }
  }

  return (
    <div
      className="team-search"
      ref={boxRef}
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <span className="ts-icon" aria-hidden="true">⌕</span>
      <input
        className="ts-input"
        type="text"
        value={query}
        placeholder="Search a team…"
        aria-label="Search a team to open its analysis"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="ts-list" role="listbox">
          {matches.map((t, i) => (
            <li
              key={t.team}
              role="option"
              aria-selected={i === hi}
              className={`ts-opt ${i === hi ? 'hi' : ''} ${t.analyzable ? '' : 'disabled'}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(t)
              }}
            >
              <span className="flag">{flagOf(t.team)}</span>
              <span className="ts-team">{t.team}</span>
              <span className="ts-grp">{t.group}</span>
              {!t.analyzable && <span className="ts-tag">decided</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
