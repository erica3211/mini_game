import { useEffect, useRef } from 'react'
import { TOWER_CELL, TOWER_PLATFORM_CELLS, TOWER_PX_PER_CM, type TowerBodySignal } from './protocol'
import { drawPiece } from './drawPiece'

// 보여 줄 세계의 너비(받침대 양옆에 여유를 둔다)와 그림이 차지할 수 있는 크기(css px)
const WORLD_W = 260
const MAX_W = 180
const MAX_H = 300
// 탑 꼭대기 위·받침대 아래 여유(px)
const TOP_PAD = 40
const BOTTOM_PAD = 50

interface Props {
  /** 끝난 시점의 블록들 */
  bodies: TowerBodySignal[]
  /** 그때의 탑 높이(cm) — 그림 크기를 정하는 데 쓴다 */
  height: number
  /** 높이 선과 숫자를 그린다 (블록 수로 겨루는 판에서는 그리지 않는다) */
  showHeight: boolean
}

/** 끝난 시점의 탑 모습 — 움직이지 않는 그림이다. 탑 높이에 맞춰 크기를 줄여서 꼭대기까지 다 보이게 하고, 높이 선과 숫자를 함께 그린다 */
export function TowerSnapshot({ bodies, height, showHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const topY = -height * TOWER_PX_PER_CM - TOP_PAD
  const worldH = BOTTOM_PAD - topY
  const scale = Math.min(MAX_W / WORLD_W, MAX_H / worldH)
  const cssW = Math.round(WORLD_W * scale)
  const cssH = Math.round(worldH * scale)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const k = (canvas.width / WORLD_W)
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.clearRect(0, 0, WORLD_W, worldH)
    ctx.translate(WORLD_W / 2, -topY)

    const platformW = TOWER_PLATFORM_CELLS * TOWER_CELL
    ctx.fillStyle = '#b08968'
    ctx.fillRect(-platformW / 2, 0, platformW, 40)
    ctx.fillStyle = '#c9a07a'
    ctx.fillRect(-platformW / 2, 0, platformW, 8)

    for (const [, kind, x, y, angle] of bodies) drawPiece(ctx, kind, x, y, angle)

    // 탑 꼭대기 높이 선
    if (showHeight && height > 0) {
      const y = -height * TOWER_PX_PER_CM
      ctx.strokeStyle = '#e0a000'
      ctx.fillStyle = '#c28a00'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.moveTo(-WORLD_W / 2, y)
      ctx.lineTo(WORLD_W / 2, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '700 16px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${height}cm`, WORLD_W / 2 - 4, y - 6)
    }
  }, [bodies, height, showHeight, cssW, cssH, worldH, topY])

  return <canvas ref={canvasRef} className="party-tw-snapshot" style={{ width: cssW, height: cssH }} role="img" aria-label={showHeight ? `끝난 때의 탑, 높이 ${height}cm` : '끝난 때의 탑'} />
}
