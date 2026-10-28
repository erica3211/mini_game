// 픽셀 캔버스: 결과 화면에 보여줄 최종 캔버스 스냅샷 (grid는 0=빈칸, N=슬롯(N-1)이 칠한 칸)
export interface PixelCanvasRoundMeta {
  grid: number[]
  slotColors: string[]
}
export const PIXEL_CANVAS_COLS = 40
export const PIXEL_CANVAS_ROWS = 26
export const PIXEL_CANVAS_ROUND_TIMEOUT_MS = 20_000
