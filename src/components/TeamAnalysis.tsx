import * as HoverCard from '@radix-ui/react-hover-card'
import { type ReactNode } from 'react'
import type { StatusTone } from '../types'

const TONE_LABEL: Record<StatusTone, string> = {
  through: 'Through',
  'in-balance': 'In the balance',
  out: 'Out',
}

/**
 * Trigger: hovering the team name shows a generic hint to click; clicking opens
 * the full situation-analysis modal (owned by the parent). Touch devices, which
 * have no hover, just tap straight through to the modal.
 */
export function TeamAnalysisTrigger({
  team,
  tone,
  onOpen,
  children,
}: {
  team: string
  tone: StatusTone
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <HoverCard.Root openDelay={60} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          className={`an-name tone-${tone}`}
          onClick={onOpen}
          aria-label={`${team} — ${TONE_LABEL[tone]}, open analysis`}
        >
          {children}
          <span className={`an-dot tone-${tone}`} aria-hidden />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content className="an-teaser" side="right" align="start" sideOffset={8} collisionPadding={8}>
          <p className="an-teaser-hint">Click for the full situation analysis →</p>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
