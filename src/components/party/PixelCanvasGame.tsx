import { useCallback, useRef, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { usePixelCanvasRound } from '../../hooks/usePixelCanvasRound'
import {
  PIXEL_CANVAS_COLS,
  PIXEL_CANVAS_ROUND_TIMEOUT_MS,
  PIXEL_CANVAS_ROWS,
  type ClientToServerEvents,
  type PlayerId,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: {
    grid: number[]
    slotColors: string[]
    slotOfPlayer: Record<PlayerId, number>
    elapsedMs: number
  } | null
  playerId: PlayerId | null
  players: PlayerInfo[]
  howToPlay: string
}

export function PixelCanvasGame({ socket, roundKey, startSignal, playerId, players, howToPlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { status, startedAt, counts, slotColors, mySlot, paintAt, endStroke } = usePixelCanvasRound(
    socket,
    roundKey,
    startSignal,
    playerId,
    canvasRef,
  )
  const isDraggingRef = useRef(false)

  /** 화면 좌표를 격자 좌표로 바꾼다 — 캔버스가 CSS로 확대돼 있으므로 실제 표시 크기를 기준으로 나눈다 */
  const toCell = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * PIXEL_CANVAS_COLS),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * PIXEL_CANVAS_ROWS),
    }
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true
      // 포인터가 캔버스 밖으로 나가도 드래그가 끊기지 않게 캡처 — 지원 안 하는 환경도 있으니 실패해도 무시
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op
      }
      const { x, y } = toCell(e)
      paintAt(x, y)
    },
    [paintAt, toCell],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      const { x, y } = toCell(e)
      paintAt(x, y)
    },
    [paintAt, toCell],
  )

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false
    endStroke()
  }, [endStroke])

  const nicknameOf = (id: PlayerId) => players.find((p) => p.id === id)?.nickname ?? '???'
  const slotOfPlayer = startSignal?.slotOfPlayer ?? {}
  const scoreboard = Object.entries(slotOfPlayer)
    .map(([id, slot]) => ({ id, slot, count: counts[slot] ?? 0 }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {!startSignal && <p className="party-round-hint">곧 시작합니다...</p>}

      {/* 캔버스는 startSignal이 오는 즉시 그린다 — 훅이 첫 스냅샷을 그리려면 그 시점에 이미 DOM에 있어야 한다 */}
      {startSignal && (
        <>
          {startedAt !== null && status === 'running' && (
            <RemainingTime startedAt={startedAt} timeoutMs={PIXEL_CANVAS_ROUND_TIMEOUT_MS} />
          )}

          {mySlot !== null && (
            <p className="party-pixelcanvas-mycolor">
              <span>내 색</span>
              <span className="party-pixelcanvas-chip" style={{ background: slotColors[mySlot] }} />
            </p>
          )}

          <canvas
            ref={canvasRef}
            className="party-pixelcanvas-board"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          <ul className="party-pixelcanvas-scoreboard">
            {scoreboard.map((entry) => (
              <li key={entry.id}>
                <span className="party-pixelcanvas-chip" style={{ background: slotColors[entry.slot] }} />
                <span>{nicknameOf(entry.id)}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>

          {status === 'finished' && <p className="party-round-hint">시간 종료! 집계 중...</p>}
        </>
      )}
    </div>
  )
}
