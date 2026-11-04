import { TOWER_CELL, TOWER_COLORS, towerCellCenters } from './protocol'

/** 블록 하나를 (x, y)에 angle만큼 돌려서 그린다 — 게임 화면과 결과 화면의 탑 그림이 같이 쓴다 */
export function drawPiece(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, angle: number, alpha = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = alpha
  for (const [cx, cy] of towerCellCenters(kind)) {
    ctx.fillStyle = TOWER_COLORS[kind]
    ctx.fillRect(cx - TOWER_CELL / 2, cy - TOWER_CELL / 2, TOWER_CELL, TOWER_CELL)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(cx - TOWER_CELL / 2 + 1, cy - TOWER_CELL / 2 + 1, TOWER_CELL - 2, TOWER_CELL - 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(cx - TOWER_CELL / 2, cy - TOWER_CELL / 2, TOWER_CELL, TOWER_CELL)
  }
  ctx.restore()
}
