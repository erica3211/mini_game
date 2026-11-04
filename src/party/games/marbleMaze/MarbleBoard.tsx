import { useEffect, useRef } from 'react'
import { EXIT_RADIUS, HOLE_RADIUS, MARBLE_RADIUS, fellInHole, newMarble, progressOf, reachedExit, stepMarble, type MarbleWorld } from './physics'

/** 구멍에 빠지는 모습을 보여 주는 시간 — 그동안 구슬은 조종되지 않고, 끝나면 처음 자리로 돌아간다 */
const FALL_MS = 450
/** 진행 상황을 서버로 보내는 간격 */
const PROGRESS_EVERY_MS = 250
/** 한 프레임으로 칠 수 있는 최대 시간(초) — 탭을 다른 데 갔다 오면 구슬이 한 번에 튀지 않게 한다 */
const MAX_FRAME_S = 0.05

interface Props {
  world: MarbleWorld
  /** 달리는 중이다 (카운트다운이 끝났고, 탈출하지 않았고, 라운드가 끝나지 않았다) */
  running: boolean
  /** 이미 탈출했다 (새로고침으로 돌아온 경우에도 구슬은 출구에 있다) */
  done: boolean
  /** 지금 기울인 정도(-1~1) — 센서·터치·방향키 중 쓰는 쪽에서 읽어 온다 */
  getTilt: () => { x: number; y: number }
  onFall: (falls: number) => void
  onFinish: (falls: number) => void
  onProgress: (progress: number, falls: number) => void
}

/** 미로와 구슬 — 구슬은 매 프레임 이 안에서 굴리고, 서버에는 진행·구멍에 빠진 횟수·탈출만 알린다 */
export function MarbleBoard({ world, running, done, getTilt, onFall, onFinish, onProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 매 프레임 쓰는 값은 ref에 담아서, 값이 바뀔 때마다 루프를 다시 만들지 않는다
  const live = useRef({ running, done, getTilt, onFall, onFinish, onProgress })
  live.current = { running, done, getTilt, onFall, onFinish, onProgress }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const marble = newMarble(world)
    let falls = 0
    let fallingSince: { at: number; x: number; y: number } | null = null
    let finished = false
    // 지금 위치가 출구까지 길의 몇 %인지 — 최고 기록이 아니라 지금 위치다 (구멍에 빠지면 0%로 돌아간다)
    let current = 0
    let reported = { progress: -1, falls: -1 }
    let lastReportAt = 0
    let lastFrame = performance.now()
    let frame = 0

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const dt = Math.min(MAX_FRAME_S, (now - lastFrame) / 1000)
      lastFrame = now
      const state = live.current

      // 굴리기
      if (finished || state.done) {
        marble.x += (world.exit.x - marble.x) * Math.min(1, dt * 12)
        marble.y += (world.exit.y - marble.y) * Math.min(1, dt * 12)
      } else if (fallingSince) {
        if (now - fallingSince.at >= FALL_MS) {
          fallingSince = null
          Object.assign(marble, newMarble(world))
        }
      } else if (state.running) {
        const tilt = state.getTilt()
        stepMarble(world, marble, tilt.x, tilt.y, dt)
        if (fellInHole(world, marble)) {
          falls += 1
          const hole = world.holes.reduce((nearest, h) => (Math.hypot(h.x - marble.x, h.y - marble.y) < Math.hypot(nearest.x - marble.x, nearest.y - marble.y) ? h : nearest))
          fallingSince = { at: now, x: hole.x, y: hole.y }
          current = 0
          marble.vx = 0
          marble.vy = 0
          state.onFall(falls)
        } else if (reachedExit(world, marble)) {
          finished = true
          marble.vx = 0
          marble.vy = 0
          state.onFinish(falls)
        }
        if (!fallingSince && !finished) current = progressOf(world, marble)
      }

      // 진행 상황 보내기 (바뀐 게 있을 때만, 너무 자주는 말고)
      if (state.running && now - lastReportAt >= PROGRESS_EVERY_MS && (Math.abs(current - reported.progress) > 0.004 || falls !== reported.falls)) {
        lastReportAt = now
        reported = { progress: current, falls }
        state.onProgress(current, falls)
      }

      // 그리기
      const dpr = window.devicePixelRatio || 1
      const side = Math.max(1, Math.round(canvas.clientWidth * dpr))
      if (canvas.width !== side || canvas.height !== side) {
        canvas.width = side
        canvas.height = side
      }
      const tile = side / world.size
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, side, side)
      ctx.fillStyle = '#ece6d6'
      ctx.fillRect(0, 0, side, side)
      // 벽
      ctx.fillStyle = '#4b5470'
      for (let ty = 0; ty < world.size; ty++) {
        for (let tx = 0; tx < world.size; tx++) if (world.solid[ty][tx]) ctx.fillRect(tx * tile - 0.5, ty * tile - 0.5, tile + 1, tile + 1)
      }
      // 출구
      ctx.fillStyle = '#7ccf8b'
      ctx.beginPath()
      ctx.arc(world.exit.x * tile, world.exit.y * tile, EXIT_RADIUS * 1.6 * tile, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `${Math.round(tile * 0.8)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🏁', world.exit.x * tile, world.exit.y * tile)
      // 출발
      ctx.strokeStyle = '#8a93ad'
      ctx.lineWidth = Math.max(1, tile * 0.08)
      ctx.beginPath()
      ctx.arc(world.start.x * tile, world.start.y * tile, tile * 0.38, 0, Math.PI * 2)
      ctx.stroke()
      // 구멍
      for (const hole of world.holes) {
        const gradient = ctx.createRadialGradient(hole.x * tile, hole.y * tile, 0, hole.x * tile, hole.y * tile, HOLE_RADIUS * 1.5 * tile)
        gradient.addColorStop(0, '#05060a')
        gradient.addColorStop(0.65, '#12141d')
        gradient.addColorStop(1, 'rgba(18, 20, 29, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(hole.x * tile, hole.y * tile, HOLE_RADIUS * 1.5 * tile, 0, Math.PI * 2)
        ctx.fill()
      }
      // 구슬 — 구멍에 빠지는 중이면 구멍 한가운데로 빨려 들어가며 작아진다
      let drawX = marble.x
      let drawY = marble.y
      let scale = 1
      if (fallingSince) {
        const t = Math.min(1, (now - fallingSince.at) / FALL_MS)
        drawX = marble.x + (fallingSince.x - marble.x) * t
        drawY = marble.y + (fallingSince.y - marble.y) * t
        scale = 1 - t
      }
      if (scale > 0.02) {
        const r = MARBLE_RADIUS * tile * scale
        const shine = ctx.createRadialGradient(drawX * tile - r * 0.35, drawY * tile - r * 0.35, r * 0.1, drawX * tile, drawY * tile, r)
        shine.addColorStop(0, '#ffffff')
        shine.addColorStop(0.35, '#7fb4ff')
        shine.addColorStop(1, '#2457c5')
        ctx.fillStyle = shine
        ctx.beginPath()
        ctx.arc(drawX * tile, drawY * tile, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.lineWidth = Math.max(1, tile * 0.04)
        ctx.stroke()
      }
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [world])

  return <canvas ref={canvasRef} className="party-mb-canvas" role="img" aria-label="구슬 미로" />
}
