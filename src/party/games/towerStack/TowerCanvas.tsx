import { useEffect, useRef } from 'react'
import { TOWER_CELL, TOWER_PLATFORM_CELLS, TOWER_PX_PER_CM, TOWER_VIEW_H, TOWER_VIEW_W, type TowerStateSignal } from './protocol'
import { drawPiece } from './drawPiece'

// 서버가 보내는 위치 사이를 이 시간 동안 부드럽게 이어서 그린다 (서버는 50ms마다 보낸다)
const LERP_MS = 60
// 처음 화면: 받침대가 아래쪽에 오도록 위로 얼마나 보이는지
const GROUND_MARGIN = 70
// 카메라가 목표를 따라가는 빠르기 (클수록 빠르다)
const CAMERA_SPEED = 5

/** 보간 중인 블록 하나 — from(이전에 그리던 값)에서 to(서버가 알려 준 값)로 간다 */
interface Anim {
  kind: number
  fx: number
  fy: number
  fa: number
  tx: number
  ty: number
  ta: number
}

interface HoverAnim extends Anim {
  /** 90도씩 돌린 횟수 (서버가 알려 준 값) */
  rot: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const mix = (from: number, to: number, t: number) => from + (to - from) * t

const at = (anim: Anim, t: number) => ({ x: mix(anim.fx, anim.tx, t), y: mix(anim.fy, anim.ty, t), a: mix(anim.fa, anim.ta, t) })

interface Props {
  state: TowerStateSignal
}

/** 탑 그림 — 서버가 알려 주는 블록 위치를 캔버스에 그린다. 위치 사이는 이어서 그리고, 카메라는 탑이 높아지면 따라 올라간다 */
export function TowerCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const arrivedRef = useRef(performance.now())
  const bodiesRef = useRef(new Map<number, Anim>())
  const hoverRef = useRef<HoverAnim | null>(null)
  const cameraRef = useRef<number | null>(null)

  // 새 상태가 오면, 지금 그리고 있는 위치에서 새 위치로 가도록 목표를 바꾼다
  useEffect(() => {
    const now = performance.now()
    const t = clamp01((now - arrivedRef.current) / LERP_MS)

    const bodies = new Map<number, Anim>()
    for (const [id, kind, x, y, a] of state.bodies) {
      const prev = bodiesRef.current.get(id)
      const from = prev ? at(prev, t) : { x, y, a }
      bodies.set(id, { kind, fx: from.x, fy: from.y, fa: from.a, tx: x, ty: y, ta: a })
    }
    bodiesRef.current = bodies

    const hover = state.hover
    const prevHover = hoverRef.current
    if (!hover) {
      hoverRef.current = null
    } else if (!prevHover || prevHover.kind !== hover.kind) {
      // 새 블록이 떴다 — 그 자리에 바로 나타난다
      const angle = (hover.rot * Math.PI) / 2
      hoverRef.current = { kind: hover.kind, rot: hover.rot, fx: hover.x, fy: hover.y, fa: angle, tx: hover.x, ty: hover.y, ta: angle }
    } else {
      const from = at(prevHover, t)
      // 돌릴 때는 늘 같은 방향(시계 방향)으로 돌아간다
      const turns = (hover.rot - prevHover.rot + 4) % 4
      hoverRef.current = { kind: hover.kind, rot: hover.rot, fx: from.x, fy: from.y, fa: from.a, tx: hover.x, ty: hover.y, ta: prevHover.ta + (turns * Math.PI) / 2 }
    }

    arrivedRef.current = now
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let frame = 0
    let lastFrame = performance.now()

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const dt = Math.min(0.1, (now - lastFrame) / 1000)
      lastFrame = now

      // 화면 크기에 맞춰 캔버스 해상도를 정한다
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.round((width * TOWER_VIEW_H) / TOWER_VIEW_W)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const scale = width / TOWER_VIEW_W
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, TOWER_VIEW_W, TOWER_VIEW_H)

      const current = stateRef.current
      const t = clamp01((now - arrivedRef.current) / LERP_MS)

      // 카메라 — 떠 있는 블록과 탑 꼭대기가 보이도록 위로 따라간다
      const towerTop = -current.height * TOWER_PX_PER_CM
      const hoverNow = hoverRef.current ? at(hoverRef.current, t) : null
      const desired = Math.min(-(TOWER_VIEW_H - GROUND_MARGIN), hoverNow ? hoverNow.y - 100 : towerTop - 330)
      const camera = cameraRef.current === null ? desired : mix(cameraRef.current, desired, 1 - Math.exp(-dt * CAMERA_SPEED))
      cameraRef.current = camera
      ctx.translate(TOWER_VIEW_W / 2, -camera)

      const ink = getComputedStyle(canvas).color
      const platformW = TOWER_PLATFORM_CELLS * TOWER_CELL

      // 받침대 아래 — 떨어지면 기회가 줄어드는 곳
      const abyss = ctx.createLinearGradient(0, 40, 0, 40 + 120)
      abyss.addColorStop(0, 'rgba(238, 111, 111, 0.05)')
      abyss.addColorStop(1, 'rgba(238, 111, 111, 0.28)')
      ctx.fillStyle = abyss
      ctx.fillRect(-TOWER_VIEW_W / 2, 40, TOWER_VIEW_W, 400)

      // 받침대
      ctx.fillStyle = '#b08968'
      ctx.fillRect(-platformW / 2, 0, platformW, 40)
      ctx.fillStyle = '#c9a07a'
      ctx.fillRect(-platformW / 2, 0, platformW, 8)

      // 지금 탑 꼭대기 선 — 높이로 겨루는 판에서만 보여 준다 (블록 수로 겨루는 판에는 높이가 필요 없다)
      if (current.mode === 'height' && current.height > 0) {
        const y = -current.height * TOWER_PX_PER_CM
        ctx.save()
        ctx.strokeStyle = '#e0a000'
        ctx.fillStyle = '#c28a00'
        ctx.lineWidth = 2
        ctx.setLineDash([8, 6])
        ctx.beginPath()
        ctx.moveTo(-TOWER_VIEW_W / 2, y)
        ctx.lineTo(TOWER_VIEW_W / 2, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = '700 13px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`${current.height}cm`, TOWER_VIEW_W / 2 - 6, y - 6)
        ctx.restore()
      }

      // 떠 있는 블록이 떨어질 곳을 알려 주는 세로 점선
      if (hoverNow) {
        ctx.save()
        ctx.strokeStyle = ink
        ctx.globalAlpha = 0.25
        ctx.lineWidth = 2
        ctx.setLineDash([4, 8])
        ctx.beginPath()
        ctx.moveTo(hoverNow.x, hoverNow.y)
        ctx.lineTo(hoverNow.x, camera + TOWER_VIEW_H)
        ctx.stroke()
        ctx.restore()
      }

      for (const anim of bodiesRef.current.values()) {
        const p = at(anim, t)
        drawPiece(ctx, anim.kind, p.x, p.y, p.a)
      }
      if (hoverRef.current && hoverNow) drawPiece(ctx, hoverRef.current.kind, hoverNow.x, hoverNow.y, hoverNow.a, 0.92)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={canvasRef} className="party-tw-canvas" width={TOWER_VIEW_W} height={TOWER_VIEW_H} aria-label="탑" />
}
