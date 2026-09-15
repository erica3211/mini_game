import type { CatchmindStroke } from './partyProtocol'

/** 캔버스 백킹 스토어의 논리 해상도 — 도화지는 항상 흰 배경, 화면 크기는 CSS(aspect-ratio)가 담당한다 */
export const CATCHMIND_CANVAS_WIDTH = 640
export const CATCHMIND_CANVAS_HEIGHT = 480
export const CATCHMIND_CANVAS_BG = '#ffffff'

export function fitCatchmindCanvas(canvas: HTMLCanvasElement) {
  canvas.width = CATCHMIND_CANVAS_WIDTH
  canvas.height = CATCHMIND_CANVAS_HEIGHT
}

export function clearCatchmindCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = CATCHMIND_CANVAS_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

/** 정규화(0~1) 좌표 점들을 캔버스 실제 픽셀 좌표의 선으로 잇는다. 점이 하나뿐이어도 작은 점으로 보이게 한다 */
function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  width: number,
) {
  if (points.length === 0) return
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x * w, points[0].y * h)
  if (points.length === 1) {
    ctx.lineTo(points[0].x * w + 0.01, points[0].y * h + 0.01)
  }
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * w, points[i].y * h)
  }
  ctx.stroke()
}

/** 획 하나를 통째로 그린다 (전체 다시 그리기용) */
export function drawStroke(canvas: HTMLCanvasElement, stroke: CatchmindStroke) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  strokePolyline(ctx, stroke.points, stroke.color, stroke.width)
}

/** 저장된 획 전체를 흰 도화지 위에 순서대로 다시 그린다 — 새 턴 시작/재접속 스냅샷/결과 화면 재생에 쓴다 */
export function drawFullBoard(canvas: HTMLCanvasElement, strokes: CatchmindStroke[]) {
  clearCatchmindCanvas(canvas)
  for (const stroke of strokes) drawStroke(canvas, stroke)
}

/** 진행 중인 획에 이어지는 구간만 그린다 (실시간 스트리밍용) — fromPoint는 직전까지 그려진 마지막 점 */
export function strokeSegment(
  canvas: HTMLCanvasElement,
  color: string,
  width: number,
  fromPoint: { x: number; y: number } | null,
  toPoints: { x: number; y: number }[],
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const points = fromPoint ? [fromPoint, ...toPoints] : toPoints
  strokePolyline(ctx, points, color, width)
}
