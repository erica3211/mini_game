import { PIXEL_CANVAS_COLS, PIXEL_CANVAS_ROWS } from './partyProtocol'

/** 아직 아무도 칠하지 않은 칸의 색 — 빈 도화지처럼 흰색으로 둔다 */
export const PIXEL_CANVAS_EMPTY_COLOR = '#ffffff'

/**
 * 캔버스의 백킹 스토어를 격자 크기(40x26)와 1:1로 맞춘다 — 즉 캔버스 픽셀 하나가 곧 격자 한 칸이다.
 * 화면 크기는 CSS(width/height)가 확대해서 담당하고, image-rendering: pixelated로 또렷하게 보이게 한다.
 * 1040칸을 DOM 요소로 만들면 드래그마다 리렌더 비용이 커지므로 캔버스에 직접 그린다.
 */
export function fitCanvasToGrid(canvas: HTMLCanvasElement) {
  canvas.width = PIXEL_CANVAS_COLS
  canvas.height = PIXEL_CANVAS_ROWS
}

export function colorOfCell(cell: number, slotColors: string[]): string {
  return cell === 0 ? PIXEL_CANVAS_EMPTY_COLOR : (slotColors[cell - 1] ?? PIXEL_CANVAS_EMPTY_COLOR)
}

/** 평면 인덱스(i = y*cols + x) 한 칸만 다시 칠한다 */
export function drawCell(ctx: CanvasRenderingContext2D, i: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(i % PIXEL_CANVAS_COLS, Math.floor(i / PIXEL_CANVAS_COLS), 1, 1)
}

/** 격자 전체를 다시 그린다 (라운드 시작·재접속 스냅샷·결과 화면에서 사용) */
export function drawFullGrid(canvas: HTMLCanvasElement, grid: ArrayLike<number>, slotColors: string[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = PIXEL_CANVAS_EMPTY_COLOR
  ctx.fillRect(0, 0, PIXEL_CANVAS_COLS, PIXEL_CANVAS_ROWS)
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue
    drawCell(ctx, i, colorOfCell(grid[i], slotColors))
  }
}
