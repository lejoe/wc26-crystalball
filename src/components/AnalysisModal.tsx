import { useEffect } from 'react'
import { flagOf } from '../data/groups'
import { ScenarioFlow } from './ScenarioFlow'
import type { Node } from '../scenarioTree'
import type { StatusTone } from '../types'

const TONE_LABEL: Record<StatusTone, string> = {
  through: 'Through',
  'in-balance': 'In the balance',
  out: 'Out',
}

/**
 * Full situation analysis for one team, shown as a modal over the group grid.
 * The interactive drill-down (ScenarioFlow) is the content.
 * Closes on backdrop click, the close button, or Escape.
 */
export function AnalysisModal({
  team,
  tone,
  root,
  onClose,
}: {
  team: string
  tone: StatusTone
  root: Node
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="an2-overlay" onClick={onClose} role="presentation">
      <div
        className="an2-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${team} situation analysis`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="an2-head">
          <span className="flag">{flagOf(team)}</span>
          <span className="an2-team">{team}</span>
          <span className={`an2-tone-chip tone-${tone}`}>{TONE_LABEL[tone]}</span>
          <button type="button" className="an2-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="an2-body an2-body--flow">
          <ScenarioFlow root={root} />
        </div>
      </div>
    </div>
  )
}
