import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Socket } from 'socket.io-client'
import {
  PIXEL_CANVAS_COLS,
  PIXEL_CANVAS_ROUND_TIMEOUT_MS,
  PIXEL_CANVAS_ROWS,
  type ClientToServerEvents,
  type PlayerId,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { colorOfCell, drawCell, drawFullGrid, fitCanvasToGrid } from '../lib/pixelCanvasDraw'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'finished'
type StartSignal = {
  grid: number[]
  slotColors: string[]
  slotOfPlayer: Record<PlayerId, number>
  elapsedMs: number
}

const CELL_COUNT = PIXEL_CANVAS_COLS * PIXEL_CANVAS_ROWS
// 백엔드 games/pixelCanvas.ts의 PIXEL_CANVAS_BRUSH_RADIUS와 반드시 같은 값을 유지해야 한다 —
// 내 화면에 미리 칠해보는(낙관적 반영) 모양이 서버가 실제로 칠하는 모양과 달라지면 안 된다
const BRUSH_RADIUS = 0
// 드래그 중 모아둔 붓 중심점을 서버로 보내는 주기 — 포인터 이벤트마다 보내면 소켓이 넘치고,
// 너무 길면 다른 사람 화면에 내 영토가 늦게 나타난다
const PAINT_FLUSH_MS = 40
// 칸 수 표시 갱신 주기 — 칸이 바뀔 때마다 setState하면 드래그 중 리렌더가 폭주한다
const COUNTS_REFRESH_MS = 200
// 서버가 라운드를 마감하기 전에 여유를 두고 먼저 붓을 멈춘다 — 마지막 배치가 늦게 도착해
// 집계에서 빠지면서 화면에 보이던 영토와 결과가 어긋나는 걸 막는다 (경매/절대색감과 같은 이유)
const END_MARGIN_MS = 200
// startSignal이 오기 전에도 참조 동일성이 유지되도록 빈 배열은 하나만 쓴다 (불필요한 재구독 방지)
const NO_COLORS: string[] = []

/** (x0,y0)에서 (x1,y1)까지 격자 위 직선 경로의 칸들 (Bresenham). 시작점은 이미 칠했으므로 제외한다 */
function cellsBetween(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const stepX = x0 < x1 ? 1 : -1
  const stepY = y0 < y1 ? 1 : -1
  let error = dx + dy
  let x = x0
  let y = y0

  while (x !== x1 || y !== y1) {
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += stepX
    }
    if (doubled <= dx) {
      error += dx
      y += stepY
    }
    points.push({ x, y })
  }
  return points
}

/** 붓 중심점 하나를 반경 BRUSH_RADIUS만큼 확장한 칸들의 평면 인덱스 (격자 밖은 버린다) */
function brushCells(cx: number, cy: number): number[] {
  const indices: number[] = []
  for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++) {
    const py = cy + dy
    if (py < 0 || py >= PIXEL_CANVAS_ROWS) continue
    for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
      const px = cx + dx
      if (px < 0 || px >= PIXEL_CANVAS_COLS) continue
      indices.push(py * PIXEL_CANVAS_COLS + px)
    }
  }
  return indices
}

/**
 * 공유 캔버스의 진짜 상태는 서버가 들고 있고, 이 훅은 그 사본을 유지하면서 화면에 그린다.
 * 내가 칠한 칸은 서버 응답을 기다리지 않고 곧바로 반영(낙관적)해서 드래그가 즉각 반응하게 하고,
 * 곧이어 도착하는 서버 브로드캐스트가 최종 상태를 확정한다 — 덮어쓰기에 조건이 없어서
 * 서버 값을 그대로 덮어써도 되므로 별도 되돌리기(rollback)가 필요 없다.
 *
 * 격자(1040칸)는 리렌더 비용 때문에 React state가 아니라 ref + 캔버스 직접 그리기로 다룬다.
 */
export function usePixelCanvasRound(
  socket: PartySocket,
  roundKey: string,
  startSignal: StartSignal | null,
  playerId: PlayerId | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  // 시간이 다 된 라운드의 roundKey. 상태를 따로 저장하지 않고 startSignal/roundKey에서 파생시켜야
  // "라운드 초기화"와 "시작 신호 도착"이 같은 렌더에 겹쳐도 서로 덮어쓰지 않는다
  const [finishedRoundKey, setFinishedRoundKey] = useState<string | null>(null)
  const [counts, setCounts] = useState<number[]>([])

  const gridRef = useRef(new Uint8Array(CELL_COUNT))
  const countsRef = useRef<number[]>([])
  // 아직 서버로 보내지 않은 붓 중심점들 (PAINT_FLUSH_MS마다 한 번에 전송)
  const pendingRef = useRef<{ x: number; y: number }[]>([])
  // 직전 포인터 이벤트의 격자 좌표 — 포인터가 한 번에 여러 칸을 건너뛰어도 선으로 이어 칠하기 위해 기억한다
  const lastCellRef = useRef<{ x: number; y: number } | null>(null)

  let status: LocalStatus = 'waiting'
  if (startSignal) status = finishedRoundKey === roundKey ? 'finished' : 'running'

  const slotColors = startSignal?.slotColors ?? NO_COLORS
  const mySlot = playerId !== null ? (startSignal?.slotOfPlayer[playerId] ?? null) : null
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  /** 칸 하나를 slot 소유로 바꾸고 화면과 집계에 반영한다. 이미 그 슬롯 것이면 아무 것도 하지 않는다 */
  const applyCell = useCallback(
    (ctx: CanvasRenderingContext2D, i: number, slot: number, colors: string[]) => {
      const grid = gridRef.current
      const previous = grid[i]
      if (previous === slot + 1) return
      if (previous > 0) countsRef.current[previous - 1] -= 1
      grid[i] = slot + 1
      countsRef.current[slot] = (countsRef.current[slot] ?? 0) + 1
      drawCell(ctx, i, colorOfCell(slot + 1, colors))
    },
    [],
  )

  // 라운드 시작 / 재접속 스냅샷 — 서버가 보낸 격자로 통째로 맞춘다
  useEffect(() => {
    const canvas = canvasRef.current
    if (!startSignal || !canvas) return

    fitCanvasToGrid(canvas)
    gridRef.current = Uint8Array.from(startSignal.grid)
    countsRef.current = startSignal.slotColors.map(() => 0)
    for (const cell of gridRef.current) {
      if (cell > 0) countsRef.current[cell - 1] += 1
    }
    drawFullGrid(canvas, gridRef.current, startSignal.slotColors)
    setCounts([...countsRef.current])
  }, [startSignal, canvasRef])

  // roundKey가 바뀌면(=새 라운드) 이전 라운드에서 남은 붓 상태를 비운다
  useEffect(() => {
    setCounts([])
    pendingRef.current = []
    lastCellRef.current = null
  }, [roundKey])

  // 다른 사람(그리고 내 붓의 서버 확정본)이 칠한 변경분
  useEffect(() => {
    const onUpdate = (data: { cells: { i: number; slot: number }[] }) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      for (const { i, slot } of data.cells) applyCell(ctx, i, slot, slotColors)
    }
    socket.on('pixelCanvas:update', onUpdate)
    return () => {
      socket.off('pixelCanvas:update', onUpdate)
    }
  }, [socket, canvasRef, applyCell, slotColors])

  // 화면이 붙기 전에 지나간 변경분을 놓쳤을 수 있으니, 붙자마자 현재 격자 스냅샷을 다시 받아 맞춘다.
  // 소켓은 순서를 보장하므로 스냅샷보다 나중에 일어난 변경분은 스냅샷 뒤에 도착해 그대로 반영된다
  useEffect(() => {
    socket.emit('round:requestResync')
  }, [socket, roundKey])

  // 모아둔 붓 중심점을 주기적으로 서버에 전송
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (pendingRef.current.length === 0) return
      socket.emit('pixelCanvas:paint', { cells: pendingRef.current })
      pendingRef.current = []
    }, PAINT_FLUSH_MS)
    return () => window.clearInterval(interval)
  }, [socket])

  // 칸 수 표시는 따로 주기적으로만 갱신한다
  useEffect(() => {
    if (status !== 'running') return
    const interval = window.setInterval(() => setCounts([...countsRef.current]), COUNTS_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [status])

  // 제한 시간이 끝나면 붓을 멈추고, 아직 안 보낸 마지막 배치를 즉시 전송한다
  useEffect(() => {
    if (startedAt === null || status !== 'running') return
    const delayMs = PIXEL_CANVAS_ROUND_TIMEOUT_MS - (performance.now() - startedAt) - END_MARGIN_MS
    const timer = window.setTimeout(() => {
      if (pendingRef.current.length > 0) {
        socket.emit('pixelCanvas:paint', { cells: pendingRef.current })
        pendingRef.current = []
      }
      setCounts([...countsRef.current])
      setFinishedRoundKey(roundKey)
    }, Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt, status, socket, roundKey])

  /** 포인터가 지나간 격자 좌표. 직전 좌표와 떨어져 있으면 그 사이를 직선으로 이어 칠한다 */
  const paintAt = useCallback(
    (x: number, y: number) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || mySlot === null || status !== 'running') return
      if (x < 0 || x >= PIXEL_CANVAS_COLS || y < 0 || y >= PIXEL_CANVAS_ROWS) return

      const last = lastCellRef.current
      if (last?.x === x && last?.y === y) return
      const centers = last ? cellsBetween(last.x, last.y, x, y) : [{ x, y }]
      lastCellRef.current = { x, y }

      // 서버가 각 중심점을 그대로 칠하므로, 화면에도 똑같이 미리 반영해둔다
      for (const center of centers) {
        for (const i of brushCells(center.x, center.y)) applyCell(ctx, i, mySlot, slotColors)
      }
      pendingRef.current.push(...centers)
    },
    [canvasRef, mySlot, slotColors, applyCell, status],
  )

  /** 드래그를 뗐을 때 호출 — 다음 드래그가 이전에 뗀 지점과 직선으로 이어지지 않게 한다 */
  const endStroke = useCallback(() => {
    lastCellRef.current = null
  }, [])

  return { status, startedAt, counts, slotColors, mySlot, paintAt, endStroke }
}
