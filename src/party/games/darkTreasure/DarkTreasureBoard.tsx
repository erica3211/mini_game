import { useEffect, useRef } from 'react'
import { MARBLE_RADIUS, newMarble, stepMarble, type MarbleWorld } from '../marbleMaze/physics'
import type { TreasurePoint } from './protocol'

/** 손전등이 비추는 반지름(타일) — 한 변이 25타일이라 화면의 7분의 1 남짓만 보인다 */
const LIGHT_RADIUS = 2.1
/** 보물이 보이기 시작하는 거리(타일) — 손전등 빛이 거의 닿는 곳 */
const TREASURE_VISIBLE = LIGHT_RADIUS * 0.95
/** 구슬 가운데가 보물 가운데에서 이만큼(타일) 안으로 들어가면 모은 것이다 */
const PICKUP_RADIUS = 0.55
/**
 * 보물(보석)을 직접 그린다 — 이모지(💎)는 기기마다 모양과 색이 달라서(아이폰은 노랗게 보여 바닥색과 구분이 안 됐다) 어디서나 같은 색으로 보이게 한다.
 * (x, y)는 보석 한가운데(픽셀), size는 보석의 너비(픽셀)이다.
 */
function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const w = size / 2
  const top = y - size * 0.4
  const girdle = y - size * 0.12 // 윗면과 아랫면이 만나는 줄
  const bottom = y + size * 0.48
  const left = x - w
  const right = x + w
  const crownL = x - w * 0.55
  const crownR = x + w * 0.55
  const facet = (points: [number, number][], fill: string) => {
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  // 윗면(왕관) 세 조각 + 아랫면 두 조각 — 바닥(아이보리)과 어둠(남색) 어디서나 눈에 띄는 진한 청록·보라 계열
  facet([[crownL, top], [x, top], [x - w * 0.3, girdle], [left, girdle]], '#2fd3ff')
  facet([[x, top], [crownR, top], [right, girdle], [x + w * 0.3, girdle]], '#0e8fd6')
  facet([[x - w * 0.3, girdle], [x + w * 0.3, girdle], [x, top]], '#9be9ff')
  facet([[left, girdle], [x, bottom], [x - w * 0.3, girdle]], '#1470d0')
  facet([[x - w * 0.3, girdle], [x, bottom], [x + w * 0.3, girdle]], '#58b8ff')
  facet([[x + w * 0.3, girdle], [x, bottom], [right, girdle]], '#0b4fa8')
  // 진한 테두리 — 아이보리 바닥 위에서도 모양이 또렷하게
  ctx.beginPath()
  ctx.moveTo(crownL, top)
  ctx.lineTo(crownR, top)
  ctx.lineTo(right, girdle)
  ctx.lineTo(x, bottom)
  ctx.lineTo(left, girdle)
  ctx.closePath()
  ctx.lineWidth = Math.max(1.5, size * 0.07)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#0a2a5c'
  ctx.stroke()
  // 반짝임
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(x - w * 0.42, top + size * 0.1, size * 0.07, 0, Math.PI * 2)
  ctx.fill()
}

/** 한 프레임으로 칠 수 있는 최대 시간(초) — 탭을 다른 데 갔다 오면 구슬이 한 번에 튀지 않게 한다 */
const MAX_FRAME_S = 0.05
/** 공개될 때 어둠이 걷히는 데 걸리는 시간(ms) */
const REVEAL_FADE_MS = 400
/** 내 구슬 위치를 서버로 보내는 간격 — 다른 사람이 내 화면을 구경할 때 쓴다 */
const POSITION_EVERY_MS = 100

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
  /** 내 구슬이 움직였다 (타일 좌표) — 구경하는 사람에게 보여 주려고 서버에 알린다 */
  onPosition: (x: number, y: number) => void
  /** 다른 사람의 화면을 구경하는 중이면 그 사람의 구슬 위치와 찾은 보물 — 이때는 내 구슬을 굴리지도 서버에 알리지도 않고, 그 사람이 보는 대로 어둠과 손전등을 그린다 */
  watch: { x: number; y: number; found: number[] } | null
}

/** 어두운 방과 구슬 — 손전등이 비추는 곳만 보이고, 지나간 곳도 다시 어두워진다. 구슬은 매 프레임 이 안에서 굴린다 */
export function DarkTreasureBoard({ world, treasures, initialFound, running, revealed, getTilt, onFound, onPosition, watch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 매 프레임 쓰는 값은 ref에 담아서, 값이 바뀔 때마다 루프를 다시 만들지 않는다
  const live = useRef({ running, revealed, getTilt, onFound, onPosition, watch, initialFound })
  live.current = { running, revealed, getTilt, onFound, onPosition, watch, initialFound }

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
    let lastPositionAt = 0
    let sentPosition = { x: -1, y: -1 }
    /** 구경 중에 보여 주는 구슬 — 서버가 알려 준 위치로 부드럽게 따라간다 */
    const watched = { x: world.start.x, y: world.start.y, seeded: false }
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

      // 구경 중이면 내 구슬은 가만히 두고, 보는 사람의 구슬을 서버가 알려 준 위치로 부드럽게 따라간다
      if (state.watch) {
        if (!watched.seeded) {
          watched.x = state.watch.x
          watched.y = state.watch.y
          watched.seeded = true
        }
        const follow = Math.min(1, dt * 14)
        watched.x += (state.watch.x - watched.x) * follow
        watched.y += (state.watch.y - watched.y) * follow
      } else {
        watched.seeded = false
      }
      // 어둠·손전등·보물을 그릴 때 기준이 되는 구슬과 찾은 보물 — 구경 중이면 보는 사람의 것이다
      const view = state.watch ? watched : marble
      const viewFound = state.watch ? new Set(state.watch.found) : collected

      // 굴리기 — 보물을 다 모았으면 멈춘다
      const allFound = collected.size >= treasures.length
      if (state.running && !allFound && !state.revealed && !state.watch) {
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

      // 내 위치 보내기 (구경하는 사람들이 쓴다 — 움직였을 때만)
      if (state.running && !state.watch && now - lastPositionAt >= POSITION_EVERY_MS && Math.hypot(marble.x - sentPosition.x, marble.y - sentPosition.y) > 0.03) {
        lastPositionAt = now
        sentPosition = { x: marble.x, y: marble.y }
        state.onPosition(marble.x, marble.y)
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
      const cx = view.x * tile
      const cy = view.y * tile
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
      const pulse = 0.85 + 0.15 * Math.sin(now / 220)
      treasures.forEach((treasure, index) => {
        const mine = viewFound.has(index)
        // 공개 중에는 내가 찾은 보물도 흐리게 보여 주고, 놓친 보물은 반짝이게 보여 준다
        if (mine && reveal === 0) return
        const distance = Math.hypot(treasure.x - view.x, treasure.y - view.y)
        const lit = mine ? 0 : distance > TREASURE_VISIBLE ? 0 : Math.min(1, (TREASURE_VISIBLE - distance) / 0.8)
        const fade = Math.max(lit, mine ? reveal * 0.45 : reveal)
        if (fade <= 0) return
        ctx.globalAlpha = fade
        const glow = ctx.createRadialGradient(treasure.x * tile, treasure.y * tile, 0, treasure.x * tile, treasure.y * tile, tile * 1.1 * pulse)
        glow.addColorStop(0, 'rgba(80, 210, 255, 0.8)')
        glow.addColorStop(1, 'rgba(80, 210, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(treasure.x * tile, treasure.y * tile, tile * 1.1 * pulse, 0, Math.PI * 2)
        ctx.fill()
        drawGem(ctx, treasure.x * tile, treasure.y * tile, tile * 0.95)
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
