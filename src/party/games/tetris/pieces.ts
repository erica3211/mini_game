import { TETRIS_COLS, TETRIS_ROWS, type TetrisActive } from './protocol'

// 블록 모양 — 서버 engine.ts와 같다 (화면에서 블록·착지 그림자를 그리는 데 쓴다)
const SHAPES: Record<number, { box: number; cells: readonly (readonly [number, number])[] }> = {
  1: { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  2: { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  3: { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  4: { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  5: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  6: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  7: { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
}

export function pieceCells(piece: number, rot: number, x: number, y: number): [number, number][] {
  const { box, cells } = SHAPES[piece]
  return cells.map(([cx, cy]) => {
    let px = cx
    let py = cy
    for (let i = 0; i < ((rot % 4) + 4) % 4; i++) [px, py] = [box - 1 - py, px]
    return [x + px, y + py]
  })
}

const blocked = (board: string[], x: number, y: number) => x < 0 || x >= TETRIS_COLS || y >= TETRIS_ROWS || (y >= 0 && board[y][x] !== '0')

/** 지금 자리에서 곧장 떨어지면 닿는 자리 (착지 그림자) */
export function ghostOf(board: string[], active: TetrisActive): TetrisActive {
  let y = active.y
  while (!pieceCells(active.piece, active.rot, active.x, y + 1).some(([x, cy]) => blocked(board, x, cy))) y += 1
  return { ...active, y }
}

/** 다음 블록 미리보기용 4x4 모양 */
export function previewCells(piece: number): [number, number][] {
  const cells = pieceCells(piece, 0, 0, 0)
  const minX = Math.min(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  return cells.map(([x, y]) => [x - minX, y - minY])
}
