import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
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
// 움직인 거리가 이 값(px)을 넘기 전까지는 좌우 스와이프인지 상하 스크롤인지 판단을 미룬다 —
// 너무 작으면 손이 살짝만 떨려도 스크롤이 씹히고, 너무 크면 스와이프 반응이 굼떠 보인다
const DIRECTION_LOCK_PX = 8

type DragPhase = 'pending' | 'horizontal' | 'vertical'
// delta는 항상 ref에만 저장한다 — endDrag가 React state(dragPx)를 클로저로 읽으면, 연속된 포인터
// 이벤트가 커밋(리렌더) 없이 몰아치는 경우(예: 빠른 스와이프) 갱신 전 값을 보게 될 수 있다.
// ref는 렌더 타이밍과 무관하게 항상 최신값이라 이 문제가 없다.
type DragState = { pointerId: number; startX: number; startY: number; width: number; phase: DragPhase; delta: number }

export function MouseHunterGame({ roundKey, startSignal, howToPlay }: Props) {
  const { status, roomIndex, canGoPrev, canGoNext, goPrev, goNext, startedAt } = useMouseHunterRound(roundKey, startSignal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      // 화살표 버튼 위에서 시작한 포인터는 드래그로 가로채지 않는다 — 버튼이 캡처를 뺏기면 클릭이 아예 발생하지 않는다
      if (status !== 'active' || (e.target as HTMLElement).closest('button')) return
      // 아직 좌우/상하 어느 쪽 제스처인지 모르는 상태('pending')로 시작 — DIRECTION_LOCK_PX만큼 움직이기 전엔
      // 화면을 슬라이드시키지도, 스크롤을 막지도 않는다 (onPointerMove에서 방향을 확정)
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        width: viewportRef.current?.clientWidth ?? 0,
        phase: 'pending',
        delta: 0,
      }
    },
    [status],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      // 이미 상하 스크롤로 판정된 제스처는 끝까지 무시 — 브라우저가 알아서 스크롤하게 둔다
      if (drag.phase === 'vertical') return

      const deltaX = e.clientX - drag.startX
      const deltaY = e.clientY - drag.startY

      if (drag.phase === 'pending') {
        if (Math.abs(deltaX) < DIRECTION_LOCK_PX && Math.abs(deltaY) < DIRECTION_LOCK_PX) return
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          drag.phase = 'vertical'
          return
        }
        drag.phase = 'horizontal'
        setDragging(true)
        // 방향이 확정된 시점에야 캡처한다 — pointerdown 시점에 미리 잡아두면(특히 터치에서) 브라우저가
        // 네이티브 스크롤 판단과 충돌해 pointercancel을 곧바로 보내버리는 경우가 있었다
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // no-op
        }
      }

      // 좌우 스와이프로 확정된 뒤에는 같은 제스처 중에 페이지가 같이 스크롤되지 않도록 막는다
      e.preventDefault()
      let delta = deltaX
      // 맨 앞/맨 뒤 방에서 더 끌면 고무줄처럼 저항감을 줘서(1/3만 반영) 더 갈 곳이 없다는 걸 알려준다
      if ((delta > 0 && !canGoPrev) || (delta < 0 && !canGoNext)) delta /= 3
      drag.delta = delta
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
      if (drag.phase === 'horizontal') {
        const threshold = drag.width * SWIPE_COMMIT_RATIO
        if (drag.delta <= -threshold && canGoNext) goNext()
        else if (drag.delta >= threshold && canGoPrev) goPrev()
      }
      setDragPx(0)
    },
    [canGoNext, canGoPrev, goNext, goPrev],
  )

  // React가 JSX onTouchMove에 붙이는 리스너는 성능을 위해 항상 passive라 그 안에서 preventDefault를
  // 호출해도 무시된다 — 좌우 스와이프로 확정된 동안 터치 스크롤을 실제로 막으려면 passive:false로 직접
  // 붙인 네이티브 리스너가 필요하다 (방향 판정 자체는 위 onPointerMove가 그대로 담당)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.phase === 'horizontal') e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

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
