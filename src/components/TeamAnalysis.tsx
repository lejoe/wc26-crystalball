import * as HoverCard from '@radix-ui/react-hover-card'
import { useState, type ReactNode } from 'react'
import { flagOf } from '../data/groups'
import type { AnalysisBlock, StatusTone } from '../types'

const TONE_LABEL: Record<StatusTone, string> = {
  through: 'Through',
  'in-balance': 'In the balance',
  out: 'Out',
}

const KNOWN_BLOCKS = new Set<AnalysisBlock['type']>([
  'verdict',
  'advancement-scenario',
  'position-scenario',
  'tiebreaker-note',
  'third-place-lean',
  'elimination',
  'nothing-left',
])

/** Render one analysis block. Unknown shapes are skipped by the caller. */
function BlockView({ block }: { block: AnalysisBlock }) {
  switch (block.type) {
    case 'verdict':
      return <p className={`an-block an-verdict tone-${block.tone}`}>{block.text}</p>
    case 'advancement-scenario':
      return (
        <div className="an-block an-advance">
          <p>{block.text}</p>
          {block.breakdown && block.breakdown.length > 0 && (
            <ul className="an-wdl">
              {block.breakdown.map((b) => (
                <li key={b.result} className={`wdl-${b.result}`}>
                  <span className="wdl-tag">{b.result}</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'position-scenario':
      return <p className="an-block an-position">{block.text}</p>
    case 'tiebreaker-note':
      return (
        <p className="an-block an-tiebreak">
          <span className="an-lever">{block.lever.toUpperCase()}</span> {block.text}
        </p>
      )
    case 'third-place-lean':
      return <p className={`an-block an-third lean-${block.lean ?? 'borderline'}`}>{block.text}</p>
    case 'elimination':
      return <p className="an-block an-elim">{block.text}</p>
    case 'nothing-left':
      return <p className="an-block an-nothing">{block.text}</p>
    default:
      return null
  }
}

/**
 * Wrap a team name (the `children`) so hovering reveals its real-results situation
 * analysis. Hover opens the card on desktop; a click pins it open so touch
 * devices, which have no hover, can tap to reveal and tap to dismiss. Pin state
 * is owned by the parent so only one team is open at a time.
 */
export function TeamAnalysisHover({
  team,
  tone,
  blocks,
  pinned,
  onTogglePin,
  children,
}: {
  team: string
  tone: StatusTone
  blocks: AnalysisBlock[]
  pinned: boolean
  onTogglePin: () => void
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const open = hovered || pinned
  const detail = blocks.filter((b) => KNOWN_BLOCKS.has(b.type))

  return (
    <HoverCard.Root open={open} onOpenChange={setHovered} openDelay={60} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <button type="button" className={`an-name tone-${tone} ${open ? 'open' : ''}`} onClick={onTogglePin}>
          {children}
          <span className={`an-dot tone-${tone}`} aria-label={TONE_LABEL[tone]} />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content className="an-pop" side="right" align="start" sideOffset={8} collisionPadding={8}>
          <div className="an-pop-head">
            <span className="flag">{flagOf(team)}</span>
            <span className="an-pop-team">{team}</span>
            <span className={`an-tone-chip tone-${tone}`}>{TONE_LABEL[tone]}</span>
          </div>
          {detail.length > 0 ? (
            detail.map((b, i) => <BlockView key={i} block={b} />)
          ) : (
            <p className="an-block an-muted">No further detail.</p>
          )}
          <div className="an-pop-foot">Based on real results so far.</div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
