import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { useMouseHunterRound } from '../../hooks/useMouseHunterRound'
import { MOUSE_HUNTER_ROOMS } from '../../lib/mouseHunterRooms'
import { MOUSE_HUNTER_ROUND_TIMEOUT_MS } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  roundKey: string
  startSignal: { elapsedMs: number } | null
  howToPlay: string
}

// 이 비율(끌고 있는 방 너비 대비)만큼 끌어야 옆 방으로 넘어간 것으로 확정한다 — 못 미치면 원래 방으로 되돌아간다
const SWIPE_COMMIT_RATIO = 0.2

export function MouseHunterGame({ roundKey, startSignal, howToPlay }: Props) {
  const { status, roomIndex, canGoPrev, canGoNext, goPrev, goNext, startedAt } = useMouseHunterRound(roundKey, startSignal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; width: number } | null>(null)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      // 화살표 버튼 위에서 시작한 포인터는 드래그로 가로채지 않는다 — 버튼이 캡처를 뺏기면 클릭이 아예 발생하지 않는다
      if (status !== 'active' || (e.target as HTMLElement).closest('button')) return
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, width: viewportRef.current?.clientWidth ?? 0 }
      setDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op
      }
    },
    [status],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      let delta = e.clientX - drag.startX
      // 맨 앞/맨 뒤 방에서 더 끌면 고무줄처럼 저항감을 줘서(1/3만 반영) 더 갈 곳이 없다는 걸 알려준다
      if ((delta > 0 && !canGoPrev) || (delta < 0 && !canGoNext)) delta /= 3
      setDragPx(delta)
    },
    [canGoPrev, canGoNext],
  )

  const endDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      setDragging(false)
      const threshold = drag.width * SWIPE_COMMIT_RATIO
      if (dragPx <= -threshold && canGoNext) goNext()
      else if (dragPx >= threshold && canGoPrev) goPrev()
      setDragPx(0)
    },
    [dragPx, canGoNext, canGoPrev, goNext, goPrev],
  )

  const room = MOUSE_HUNTER_ROOMS[roomIndex]
  const viewportWidth = viewportRef.current?.clientWidth ?? 0
  const trackOffsetPx = -roomIndex * viewportWidth + dragPx

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status === 'active' && (
        <>
          {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={MOUSE_HUNTER_ROUND_TIMEOUT_MS} />}

          <p className="party-mousehunter-room-name">
            {room.name} <span className="party-mousehunter-room-index">({roomIndex + 1}/{MOUSE_HUNTER_ROOMS.length})</span>
          </p>

          <div
            className="party-mousehunter-viewport"
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
          >
            <div
              className="party-mousehunter-track"
              style={{
                transform: `translateX(${trackOffsetPx}px)`,
                transition: dragging ? 'none' : 'transform 0.3s ease',
              }}
            >
              {MOUSE_HUNTER_ROOMS.map((r) => (
                <img key={r.id} className="party-mousehunter-room-image" src={r.image} alt={r.name} draggable={false} />
              ))}
            </div>

            {canGoPrev && (
              <button
                type="button"
                className="party-mousehunter-arrow party-mousehunter-arrow-prev"
                onClick={goPrev}
                aria-label="이전 방으로"
              >
                ‹
              </button>
            )}
            {canGoNext && (
              <button
                type="button"
                className="party-mousehunter-arrow party-mousehunter-arrow-next"
                onClick={goNext}
                aria-label="다음 방으로"
              >
                ›
              </button>
            )}
          </div>

          <p className="party-round-hint">화면을 좌우로 밀거나 화살표를 눌러 다른 방을 살펴보세요.</p>
        </>
      )}
    </div>
  )
}
