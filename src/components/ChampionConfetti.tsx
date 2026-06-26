import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** Element the burst emanates from (the champion entry). */
  originRef: React.RefObject<HTMLElement>
  /** Current champion name; a new non-empty value triggers a burst. */
  champion: string | null
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  rot: number
  vrot: number
  len: number
  thick: number
  base: string
  hi: string
  flutter: number
  flutterSpeed: number
  sway: number
}

// Gold-foil shades as [back-face, lit-highlight] pairs. Each strip flips between
// the two as it turns, mimicking metallic foil catching the light.
const GOLDS: [string, string][] = [
  ['#c79412', '#ffe9a0'], // rich gold
  ['#a9760a', '#f3cd66'], // deep gold
  ['#8c5e06', '#e0b24a'], // bronze
  ['#d9ab26', '#fff4cf'], // bright champagne gold
  ['#b8860b', '#f7d979'], // goldenrod
]
const FRICTION = 0.993
const COUNT = 1000 // flakes per burst on a full-width desktop screen
const FALL_SPEED = 0.5 // global slow-motion factor on gravity, fall, flutter, spin

// The full COUNT overwhelms phone GPUs (fill-rate) and the per-frame canvas loop,
// so the burst stutters. Scale the flake count by viewport width — narrow screens
// get proportionally fewer flakes, which keeps the animation smooth there while a
// desktop still gets the full, dense burst.
const FULL_WIDTH = 1280 // width at and above which the burst uses the full COUNT
const MIN_FRACTION = 0.25 // floor so the smallest phones still get a visible burst

function burstCount() {
  const w = document.documentElement.clientWidth || window.innerWidth || FULL_WIDTH
  const fraction = Math.min(1, Math.max(MIN_FRACTION, w / FULL_WIDTH))
  return Math.round(COUNT * fraction)
}

// Mouse influence: a moving cursor parts the flakes like a hand through feathers.
const MOUSE_RADIUS = 200 // reach around the cursor (px)
const MOUSE_PUSH = 0.04 // overall displacement strength
const MOUSE_VELO = 0.02 // how much hand speed amplifies impact (fast swipes fling harder)

export function ChampionConfetti({ originRef, champion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const pageRef = useRef({ w: 0, h: 0 })
  const prevRef = useRef<string | null>(champion)
  // Pointer position in document coordinates; null until the mouse first moves.
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  // Pointer position from the previous frame, to derive its velocity.
  const pointerPrevRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    // Only fire on a change to a new, non-empty champion (skip the initial mount).
    if (champion && champion !== prevRef.current) {
      burst()
    }
    prevRef.current = champion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Track the pointer so a moving hand can stir the flakes.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY }
    }
    function onLeave() {
      pointerRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Size the canvas to the whole document so flakes fall all the way down the page.
  function sizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    const doc = document.documentElement
    const w = doc.clientWidth
    const h = Math.max(doc.scrollHeight, window.innerHeight)
    pageRef.current = { w, h }
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function burst() {
    const canvas = canvasRef.current
    const origin = originRef.current
    if (!canvas || !origin) return

    sizeCanvas(canvas)
    if (!canvas.getContext('2d')) return

    // Origin in document coordinates (so flakes keep their place as the page scrolls).
    const r = origin.getBoundingClientRect()
    const ox = r.left + r.width / 2 + window.scrollX
    const oy = r.top + r.height / 2 + window.scrollY

    const count = burstCount()
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 10 // gentle launch; the low drag (FRICTION) carries flakes almost to the page sides
      const [base, hi] = GOLDS[(Math.random() * GOLDS.length) | 0]
      // Per-particle gravity: light flakes drift and hang, heavy ones drop fast.
      const heavy = Math.random()
      particlesRef.current.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // upward bias: bursts up, then rains down
        gravity: 0.06 + heavy * 0.16, // lighter pull so flakes hang and drift slowly
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.13,
        len: 9 + Math.random() * 11,
        thick: 2.5 + Math.random() * 3,
        base,
        hi,
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: 0.06 + Math.random() * 0.1,
        sway: (1 - heavy) * (0.6 + Math.random() * 1.4), // lighter flakes sway more
      })
    }

    if (!rafRef.current) tick()
  }

  function tick() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      rafRef.current = 0
      return
    }
    const { w, h } = pageRef.current
    ctx.clearRect(0, 0, w, h)

    // Pointer velocity this frame (px/frame); zero when the hand is still.
    const pointer = pointerRef.current
    const prev = pointerPrevRef.current
    let pvx = 0
    let pvy = 0
    if (pointer && prev) {
      pvx = pointer.x - prev.x
      pvy = pointer.y - prev.y
    }
    const handSpeed = Math.hypot(pvx, pvy)
    pointerPrevRef.current = pointer ? { x: pointer.x, y: pointer.y } : null

    const live: Particle[] = []
    for (const p of particlesRef.current) {
      p.vx *= FRICTION
      p.vy = p.vy * 0.999 + p.gravity * FALL_SPEED
      // A moving hand parts the flakes: it sweeps them along its path and shoves
      // them aside, swirling them like feathers. A still hand does nothing, and a
      // fast swipe flings them harder than a slow drift.
      if (pointer && handSpeed > 0.01) {
        const ax = p.x - pointer.x // outward (away from cursor)
        const ay = p.y - pointer.y
        const dist = Math.hypot(ax, ay)
        if (dist > 1 && dist < MOUSE_RADIUS) {
          const falloff = 1 - dist / MOUSE_RADIUS
          const gain = handSpeed * MOUSE_VELO * MOUSE_PUSH * falloff
          // carried along in the hand's wake...
          p.vx += pvx * gain
          p.vy += pvy * gain
          // ...and nudged aside so they part around it
          p.vx += (ax / dist) * handSpeed * gain * 0.5
          p.vy += (ay / dist) * handSpeed * gain * 0.5
        }
      }
      p.flutter += p.flutterSpeed * FALL_SPEED
      p.x += (p.vx + Math.sin(p.flutter) * p.sway) * FALL_SPEED // side-to-side flutter
      p.y += p.vy * FALL_SPEED
      p.rot += p.vrot * FALL_SPEED
      // Keep every flake until it has fallen off the bottom of the page — no fading.
      if (p.y - p.len > h) continue
      live.push(p)

      // Foil flip: the strip turns about its short axis, foreshortening its
      // length and switching between its lit and back faces as it spins.
      const flip = Math.cos(p.flutter)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.scale(Math.max(0.12, Math.abs(flip)), 1)
      ctx.fillStyle = flip >= 0 ? p.hi : p.base
      ctx.fillRect(-p.len / 2, -p.thick / 2, p.len, p.thick)
      ctx.restore()
    }
    particlesRef.current = live

    if (live.length > 0) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      ctx.clearRect(0, 0, w, h)
      rafRef.current = 0
    }
  }

  return createPortal(
    <canvas ref={canvasRef} className="champion-confetti" aria-hidden="true" />,
    document.body,
  )
}
