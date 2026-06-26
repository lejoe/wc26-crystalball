import { useEffect, useState } from 'react'

/**
 * Kickoff formatting in the viewer's own time zone.
 *
 * Each match carries an ISO 8601 instant with the venue's UTC offset
 * (e.g. 2026-06-28T12:00:00-07:00). `new Date()` resolves it to the correct
 * instant, and Intl renders it in the browser's local zone — so a late kickoff
 * can legitimately read as the next calendar day for a viewer abroad.
 */

// How long after kickoff a match is considered live (covers 90' + stoppage,
// plus knockout extra time and penalties).
const LIVE_MS = 165 * 60 * 1000

export type MatchStatus = 'upcoming' | 'live' | 'over'

export type KickoffDisplay = {
  status: MatchStatus
  /** Joined one-line label: "Today · 21:00", "Sun 28 Jun · 21:00", "LIVE", "FT". */
  text: string
  /** Date portion alone: "Today", "Tomorrow", "Sun 28 Jun" (empty for live/over). */
  dateText: string
  /** Local kickoff time alone: "21:00" (empty for live/over). */
  time: string
  isToday: boolean
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const weekdayDateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

/** Compact local time: "9PM" on the hour, "10:30PM" otherwise (24h locales: "21" / "21:30"). */
function compactTime(d: Date): string {
  const s = d.getMinutes() === 0 ? hourFmt.format(d) : timeFmt.format(d)
  return s.replace(/\s+([AP]M)$/i, '$1') // drop the space before AM/PM
}

/** Local YYYY-MM-DD for a Date, using the viewer's zone. */
function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function matchStatus(kickoff: string, hasResult: boolean, now: Date): MatchStatus {
  if (hasResult) return 'over'
  const start = new Date(kickoff).getTime()
  const t = now.getTime()
  if (t < start) return 'upcoming'
  if (t < start + LIVE_MS) return 'live'
  return 'over'
}

export function formatKickoff(kickoff: string, hasResult: boolean, now: Date): KickoffDisplay {
  const status = matchStatus(kickoff, hasResult, now)
  if (status === 'live') return { status, text: 'LIVE', dateText: '', time: '', isToday: true }
  if (status === 'over') return { status, text: 'FT', dateText: '', time: '', isToday: false }

  const d = new Date(kickoff)
  const day = localDay(d)
  const todayStr = localDay(now)
  const tomorrowStr = localDay(new Date(now.getTime() + 86_400_000))

  const dateText = day === todayStr ? 'Today' : day === tomorrowStr ? 'Tomorrow' : dateFmt.format(d)
  const time = compactTime(d)
  return { status, text: `${dateText} · ${time}`, dateText, time, isToday: day === todayStr }
}

export type KickoffParts = {
  status: MatchStatus
  isToday: boolean
  /** 'LIVE' | 'FT' for those states, otherwise ''. */
  stateText: string
  /** Date with weekday: "Mon, Jul 6", or "Today" / "Tomorrow". */
  weekdayDate: string
  /** Date without weekday: "Jul 6", or "Today" / "Tomorrow" (relative days have no weekday to drop). */
  dateOnly: string
  /** Compact local time: "9PM" / "10:30PM". */
  time: string
}

/** Like formatKickoff, but exposes the pieces a width-constrained card needs (compact time, droppable weekday). */
export function kickoffParts(kickoff: string, hasResult: boolean, now: Date): KickoffParts {
  const status = matchStatus(kickoff, hasResult, now)
  const base = { status, isToday: status === 'live', stateText: '', weekdayDate: '', dateOnly: '', time: '' }
  if (status === 'live') return { ...base, stateText: 'LIVE' }
  if (status === 'over') return { ...base, stateText: 'FT' }

  const d = new Date(kickoff)
  const day = localDay(d)
  const todayStr = localDay(now)
  const tomorrowStr = localDay(new Date(now.getTime() + 86_400_000))
  const relative = day === todayStr ? 'Today' : day === tomorrowStr ? 'Tomorrow' : null

  return {
    status,
    isToday: day === todayStr,
    stateText: '',
    weekdayDate: relative ?? weekdayDateFmt.format(d),
    dateOnly: relative ?? monthDayFmt.format(d),
    time: compactTime(d),
  }
}

/** Re-renders the caller on an interval so Live/FT flip without a manual refresh. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
