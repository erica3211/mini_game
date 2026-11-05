import { useEffect, useRef } from 'react'
import { MARBLE_RADIUS, newMarble, stepMarble, type MarbleWorld } from '../marbleMaze/physics'
import type { TreasurePoint } from './protocol'

/** 손전등이 비추는 반지름(타일) — 한 변이 25타일이라 화면의 7분의 1 남짓만 보인다 */
const LIGHT_RADIUS = 1.8
/** 보물이 보이기 시작하는 거리(타일) — 손전등 빛이 거의 닿는 곳 */
const TREASURE_VISIBLE = LIGHT_RADIUS * 0.95
/** 구슬 가운데가 보물 가운데에서 이만큼(타일) 안으로 들어가면 모은 것이다 */
const PICKUP_RADIUS = 0.55
/** 한 프레임으로 칠 수 있는 최대 시간(초) — 탭을 다른 데 갔다 오면 구슬이 한 번에 튀지 않게 한다 */
const MAX_FRAME_S = 0.05
/** 공개될 때 어둠이 걷히는 데 걸리는 시간(ms) */
const REVEAL_FADE_MS = 400

interface Props {
  world: MarbleWorld
  /** 보물 한가운데(타일 좌표) — 번호는 서버가 준 순서이다 */
  treasures: TreasurePoint[]
  /** 이미 찾은 보물 번호 (새로고침으로 돌아온 경우 서버가 알려 준다) */
  initialFound: number[]
  /** 달리는 중이다 (카운트다운이 끝났고, 다 찾지 않았고, 라운드가 끝나지 않았다) */
  running: boolean
  /** 라운드가 끝났다 — 어둠을 걷어 내고 보물이 어디 있었는지 모두 보여 준다 */
  revealed: boolean
  /** 지금 기울인 정도(-1~1) — 센서·방향키 중 쓰는 쪽에서 읽어 온다 */
  getTilt: () => { x: number; y: number }
  /** 보물을 모았다 (번호) */
  onFound: (index: number) => void
}

/** 어두운 방과 구슬 — 손전등이 비추는 곳만 보이고, 지나간 곳도 다시 어두워진다. 구슬은 매 프레임 이 안에서 굴린다 */
export function DarkTreasureBoard({ world, treasures, initialFound, running, revealed, getTilt, onFound }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 매 프레임 쓰는 값은 ref에 담아서, 값이 바뀔 때마다 루프를 다시 만들지 않는다
  const live = useRef({ running, revealed, getTilt, onFound, initialFound })
  live.current = { running, revealed, getTilt, onFound, initialFound }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dark = document.createElement('canvas')
    const darkCtx = dark.getContext('2d')
    if (!darkCtx) return
    const marble = newMarble(world)
    const collected = new Set<number>()
    let lastFrame = performance.now()
    /** 정답 공개가 시작된 시각 — 어둠이 걷히는 애니메이션에 쓴다 */
    let revealStart: number | null = null
    let frame = 0

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const dt = Math.min(MAX_FRAME_S, (now - lastFrame) / 1000)
      lastFrame = now
      const state = live.current
      if (state.revealed && revealStart === null) revealStart = now
      // 공개되면 0.4초에 걸쳐 어둠이 걷힌다 (0 = 아직 어둡다, 1 = 다 밝다)
      const reveal = revealStart === null ? 0 : Math.min(1, (now - revealStart) / REVEAL_FADE_MS)
      for (const index of state.initialFound) collected.add(index)

      // 굴리기 — 보물을 다 모았으면 멈춘다
      const allFound = collected.size >= treasures.length
      if (state.running && !allFound && !state.revealed) {
        const tilt = state.getTilt()
        stepMarble(world, marble, tilt.x, tilt.y, dt)
        treasures.forEach((treasure, index) => {
          if (collected.has(index)) return
          if (Math.hypot(treasure.x - marble.x, treasure.y - marble.y) < PICKUP_RADIUS) {
            collected.add(index)
            state.onFound(index)
          }
        })
      }

      // 그리기
      const dpr = window.devicePixelRatio || 1
      const side = Math.max(1, Math.round(canvas.clientWidth * dpr))
      if (canvas.width !== side || canvas.height !== side) {
        canvas.width = side
        canvas.height = side
      }
      // 어둠을 그리는 보조 캔버스는 효과가 다시 실행될 때마다 새로 만들어지므로(크기 300×150) 화면 캔버스와 따로 크기를 맞춘다
      if (dark.width !== side || dark.height !== side) {
        dark.width = side
        dark.height = side
      }
      const tile = side / world.size
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, side, side)
      ctx.fillStyle = '#ece6d6'
      ctx.fillRect(0, 0, side, side)
      ctx.fillStyle = '#4b5470'
      for (let ty = 0; ty < world.size; ty++) {
        for (let tx = 0; tx < world.size; tx++) if (world.solid[ty][tx]) ctx.fillRect(tx * tile - 0.5, ty * tile - 0.5, tile + 1, tile + 1)
      }

      // 어둠 — 온통 어둡게 덮고 손전등이 비추는 곳만 걷어 낸다 (지나간 곳은 기억하지 않고 바로 다시 어두워진다)
      darkCtx.setTransform(1, 0, 0, 1, 0, 0)
      darkCtx.globalCompositeOperation = 'source-over'
      darkCtx.clearRect(0, 0, side, side)
      darkCtx.fillStyle = 'rgb(6, 8, 18)'
      darkCtx.fillRect(0, 0, side, side)
      darkCtx.globalCompositeOperation = 'destination-out'
      const cx = marble.x * tile
      const cy = marble.y * tile
      const light = darkCtx.createRadialGradient(cx, cy, 0, cx, cy, LIGHT_RADIUS * tile)
      light.addColorStop(0, 'rgba(0, 0, 0, 1)')
      light.addColorStop(0.6, 'rgba(0, 0, 0, 0.95)')
      light.addColorStop(1, 'rgba(0, 0, 0, 0)')
      darkCtx.fillStyle = light
      darkCtx.beginPath()
      darkCtx.arc(cx, cy, LIGHT_RADIUS * tile, 0, Math.PI * 2)
      darkCtx.fill()
      ctx.globalAlpha = 1 - reveal
      ctx.drawImage(dark, 0, 0)
      ctx.globalAlpha = 1

      // 보물 — 손전등이 닿는 곳에서만 보인다 (어둠 위에 그린다)
      ctx.font = `${Math.round(tile * 0.9)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const pulse = 0.85 + 0.15 * Math.sin(now / 220)
      treasures.forEach((treasure, index) => {
        const mine = collected.has(index)
        // 공개 중에는 내가 찾은 보물도 흐리게 보여 주고, 놓친 보물은 반짝이게 보여 준다
        if (mine && reveal === 0) return
        const distance = Math.hypot(treasure.x - marble.x, treasure.y - marble.y)
        const lit = mine ? 0 : distance > TREASURE_VISIBLE ? 0 : Math.min(1, (TREASURE_VISIBLE - distance) / 0.8)
        const fade = Math.max(lit, mine ? reveal * 0.45 : reveal)
        if (fade <= 0) return
        ctx.globalAlpha = fade
        const glow = ctx.createRadialGradient(treasure.x * tile, treasure.y * tile, 0, treasure.x * tile, treasure.y * tile, tile * 1.1 * pulse)
        glow.addColorStop(0, 'rgba(255, 224, 102, 0.85)')
        glow.addColorStop(1, 'rgba(255, 224, 102, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(treasure.x * tile, treasure.y * tile, tile * 1.1 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillText('💎', treasure.x * tile, treasure.y * tile)
        ctx.globalAlpha = 1
      })

      // 구슬
      const r = MARBLE_RADIUS * tile
      const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
      shine.addColorStop(0, '#ffffff')
      shine.addColorStop(0.35, '#ffe08a')
      shine.addColorStop(1, '#d98a00')
      ctx.fillStyle = shine
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = Math.max(1, tile * 0.04)
      ctx.stroke()
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [world, treasures])

  return <canvas ref={canvasRef} className="party-mb-canvas" role="img" aria-label="어두운 방" />
}
