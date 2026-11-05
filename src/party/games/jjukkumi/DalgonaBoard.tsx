import { useEffect, useRef } from 'react'
import type { DalgonaPoint, JjukkumiPlayerState } from './protocol'

// 달고나 판 — 동그란 달고나에 따라 그릴 모양이 새겨져 있고, 그 위를 손가락으로 따라 그린다. 선에서 허용치보다 벗어나면 달고나가 깨진다(탈락).
// 좌표는 모두 판 너비에 대한 비율(0~1)이다. 내가 그리는 동안은 내 손가락 점을 바로 그려 주고(서버 답을 기다리지 않는다), 다른 사람을 구경할 때는 서버가 알려 준 점들을 그린다.

/** 손가락이 지나간 점들을 서버로 보내는 간격 */
const SEND_EVERY_MS = 60

interface Props {
  /** 따라 그릴 선 */
  path: DalgonaPoint[]
  /** 선에서 이만큼 벗어나면 탈락 (판 너비에 대한 비율) */
  tolerance: number
  /** 서버가 알려 준 그림 (null은 손가락을 뗀 곳) — 구경하거나 이미 끝난 뒤에 보인다 */
  points: (DalgonaPoint | null)[]
  /** 얼마나 그렸는가 (0~1) */
  progress: number
  /** 선의 끝에서부터 거꾸로 그리고 있다 — 지나온 부분을 그쪽 끝에서부터 칠한다 */
  reversed: boolean
  status: JjukkumiPlayerState
  /** 내가 지금 그릴 수 있다 (소개가 끝났고 아직 깨지지도 끝나지도 않았다) */
  interactive: boolean
  /** 손가락이 지나간 점들이 모였다 — newStroke는 손가락을 뗐다 다시 댄 뒤 첫 묶음이라는 뜻이다 */
  onTrace: (points: DalgonaPoint[], newStroke: boolean) => void
}

/** 달고나 표면의 잔무늬 — 늘 같은 자리에 찍히도록 고정된 난수로 만든다 */
const SPECKS = (() => {
  let seed = 12345
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: 70 }, () => {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * 0.46
    return { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius, r: 0.004 + random() * 0.006, a: 0.08 + random() * 0.12 }
  })
})()

function strokePath(ctx: CanvasRenderingContext2D, points: (DalgonaPoint | null)[], W: number) {
  ctx.beginPath()
  let pen = false
  for (const point of points) {
    if (!point) {
      pen = false
      continue
    }
    if (!pen) {
      ctx.moveTo(point[0] * W, point[1] * W)
      pen = true
    } else {
      ctx.lineTo(point[0] * W, point[1] * W)
    }
  }
}

export function DalgonaBoard({ path, tolerance, points, progress, reversed, status, interactive, onTrace }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 매 프레임 쓰는 값은 ref에 담아서, 값이 바뀔 때마다 루프를 다시 만들지 않는다
  const live = useRef({ path, tolerance, points, progress, reversed, status, interactive, onTrace })
  live.current = { path, tolerance, points, progress, reversed, status, interactive, onTrace }
  /** 내가 지금 그리는 중인 점들 (null은 손가락을 뗀 곳) */
  const local = useRef<(DalgonaPoint | null)[]>([])
  const pending = useRef<DalgonaPoint[]>([])
  const startsNewStroke = useRef(false)
  const touching = useRef(false)

  // 새 모양이 오면(다음 판) 내 그림을 비운다
  useEffect(() => {
    local.current = []
    pending.current = []
    touching.current = false
    startsNewStroke.current = false
  }, [path])

  // 손가락이 지나간 점들을 모아서 일정한 간격으로 서버에 보낸다
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pending.current.length === 0) return
      const batch = pending.current
      pending.current = []
      const newStroke = startsNewStroke.current
      startsNewStroke.current = false
      live.current.onTrace(batch, newStroke)
    }, SEND_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const state = live.current
      const dpr = window.devicePixelRatio || 1
      const side = Math.max(1, Math.round(canvas.clientWidth * dpr))
      if (canvas.width !== side || canvas.height !== side) {
        canvas.width = side
        canvas.height = side
      }
      const W = side
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, W)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 달고나 판
      const disc = ctx.createRadialGradient(W * 0.42, W * 0.4, W * 0.05, W / 2, W / 2, W * 0.5)
      disc.addColorStop(0, '#f6cf82')
      disc.addColorStop(1, '#d99a3f')
      ctx.fillStyle = disc
      ctx.beginPath()
      ctx.arc(W / 2, W / 2, W * 0.495, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a8691f'
      ctx.lineWidth = Math.max(2, W * 0.012)
      ctx.stroke()
      for (const speck of SPECKS) {
        ctx.fillStyle = `rgba(120, 70, 20, ${speck.a})`
        ctx.beginPath()
        ctx.arc(speck.x * W, speck.y * W, speck.r * W, 0, Math.PI * 2)
        ctx.fill()
      }

      const path = state.path
      if (path.length > 1) {
        // 허용 범위(이 안에서는 괜찮다) — 연하게 길을 깔아 준다
        strokePath(ctx, path, W)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = state.tolerance * 2 * W
        ctx.stroke()
        // 따라 그릴 선
        strokePath(ctx, path, W)
        ctx.strokeStyle = '#8a4f17'
        ctx.lineWidth = Math.max(2, W * 0.014)
        ctx.stroke()
        // 지금까지 잘 따라온 부분
        const reached = Math.round(state.progress * (path.length - 1))
        if (reached > 0) {
          // 선의 끝에서부터 거꾸로 그리고 있으면 그쪽 끝에서부터 칠한다
          strokePath(ctx, state.reversed ? path.slice(path.length - 1 - reached) : path.slice(0, reached + 1), W)
          ctx.strokeStyle = '#3ddc84'
          ctx.lineWidth = Math.max(2, W * 0.014)
          ctx.stroke()
        }
        // 시작 자리 — 아직 안 시작했으면 초록 점으로 알려 준다. 어느 방향으로 그려도 되고, 처음과 끝이 만나지 않는 모양(우산)은 양쪽 끝 어디에서 시작해도 된다
        if (state.progress < 0.02) {
          const start = path[0]
          const end = path[path.length - 1]
          const sameSpot = Math.hypot(start[0] - end[0], start[1] - end[1]) < 0.03
          const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 180)
          for (const spot of sameSpot ? [start] : [start, end]) {
            ctx.fillStyle = '#2fbf71'
            ctx.beginPath()
            ctx.arc(spot[0] * W, spot[1] * W, W * 0.032 * pulse, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = Math.max(2, W * 0.008)
            ctx.stroke()
            ctx.fillStyle = '#fff'
            ctx.font = `800 ${Math.round(W * 0.034)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('시작', spot[0] * W, spot[1] * W - W * 0.062)
          }
      }
      }

      // 손가락이 지나간 자리 — 내가 그리는 중이면 내 손가락 점을 바로, 아니면 서버가 알려 준 점을 그린다
      const trace = state.interactive ? local.current : state.points
      strokePath(ctx, trace, W)
      ctx.strokeStyle = '#3b2410'
      ctx.lineWidth = Math.max(3, W * 0.019)
      ctx.stroke()
      strokePath(ctx, trace, W)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(2, W * 0.011)
      ctx.stroke()
      const tip = [...trace].reverse().find((point) => point !== null)
      if (tip && state.status === 'run') {
        ctx.fillStyle = 'rgba(255, 70, 70, 0.9)'
        ctx.beginPath()
        ctx.arc(tip[0] * W, tip[1] * W, W * 0.018, 0, Math.PI * 2)
        ctx.fill()
      }

      if (state.status === 'out') {
        // 깨졌다 — 마지막으로 짚은 곳에서 금이 퍼진다
        const crackAt = tip ?? [0.5, 0.5]
        ctx.strokeStyle = 'rgba(60, 25, 5, 0.9)'
        ctx.lineWidth = Math.max(2, W * 0.007)
        for (let k = 0; k < 7; k++) {
          const angle = (k / 7) * Math.PI * 2 + 0.4
          let x = crackAt[0] * W
          let y = crackAt[1] * W
          ctx.beginPath()
          ctx.moveTo(x, y)
          for (let step = 1; step <= 5; step++) {
            const wobble = Math.sin(k * 7 + step * 2.3) * 0.5
            x += Math.cos(angle + wobble) * W * 0.045
            y += Math.sin(angle + wobble) * W * 0.045
            ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(40, 15, 5, 0.28)'
        ctx.beginPath()
        ctx.arc(W / 2, W / 2, W * 0.495, 0, Math.PI * 2)
        ctx.fill()
      } else if (state.status === 'passed') {
        ctx.fillStyle = 'rgba(60, 200, 110, 0.2)'
        ctx.beginPath()
        ctx.arc(W / 2, W / 2, W * 0.495, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  const pointOf = (event: { clientX: number; clientY: number }): DalgonaPoint => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 1000, Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 1000]
  }

  const addPoints = (points: DalgonaPoint[]) => {
    for (const point of points) {
      if (touching.current === false) {
        // 손가락을 뗐다 다시 댔다 — 선을 끊는다
        if (local.current.length > 0) local.current.push(null)
        startsNewStroke.current = true
        touching.current = true
      }
      local.current.push(point)
      pending.current.push(point)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="jk-dalgona-canvas"
      role="img"
      aria-label="달고나 판"
      onPointerDown={(event) => {
        if (!live.current.interactive) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        touching.current = false
        addPoints([pointOf(event)])
      }}
      onPointerMove={(event) => {
        if (!live.current.interactive || !event.currentTarget.hasPointerCapture(event.pointerId)) return
        // 손가락이 빨리 움직여도 점이 빠지지 않게, 이벤트 사이에 모인 점들까지 모두 쓴다
        const coalesced = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : []
        addPoints((coalesced.length > 0 ? coalesced : [event.nativeEvent]).map((e) => pointOf(e)))
      }}
      onPointerUp={() => {
        touching.current = false
      }}
      onPointerCancel={() => {
        touching.current = false
      }}
      onLostPointerCapture={() => {
        touching.current = false
      }}
    />
  )
}
