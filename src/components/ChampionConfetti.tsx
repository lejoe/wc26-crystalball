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
const FRICTION = 0.985

export function ChampionConfetti({ originRef, champion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const pageRef = useRef({ w: 0, h: 0 })
  const prevRef = useRef<string | null>(champion)

  useEffect(() => {
    // Only fire on a change to a new, non-empty champion (skip the initial mount).
    if (champion && champion !== prevRef.current) {
      burst()
    }
    prevRef.current = champion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

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

    const count = 300
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 11 // burst reach, between the tight and wide versions
      const [base, hi] = GOLDS[(Math.random() * GOLDS.length) | 0]
      // Per-particle gravity: light flakes drift and hang, heavy ones drop fast.
      const heavy = Math.random()
      particlesRef.current.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5, // upward bias: bursts up, then rains down
        gravity: 0.18 + heavy * 0.37,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.22,
        len: 7 + Math.random() * 9,
        thick: 2 + Math.random() * 2.5,
        base,
        hi,
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: 0.12 + Math.random() * 0.18,
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

    const live: Particle[] = []
    for (const p of particlesRef.current) {
      p.vx *= FRICTION
      p.vy = p.vy * 0.999 + p.gravity
      p.flutter += p.flutterSpeed
      p.x += p.vx + Math.sin(p.flutter) * p.sway // side-to-side flutter
      p.y += p.vy
      p.rot += p.vrot
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
