import { useCallback, useRef, useState } from 'react'
import { useMouseHunterRound } from '../../hooks/useMouseHunterRound'
import { MOUSE_HUNTER_ROOMS } from '../../lib/mouseHunterRooms'
import { MOUSE_HUNTER_ROUND_TIMEOUT_MS } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  roundKey: string
  startSignal: { elapsedMs: number } | null
  howToPlay: string
}

const LAST_ROOM_INDEX = MOUSE_HUNTER_ROOMS.length - 1

export function MouseHunterGame({ roundKey, startSignal, howToPlay }: Props) {
  const { status, startedAt } = useMouseHunterRound(roundKey, startSignal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [roomIndex, setRoomIndex] = useState(0)

  // 스크롤 위치 자체가 "지금 어느 방인지"의 근거다 — 스와이프든 화살표든 결국 scrollLeft를 바꾸는
  // 것으로 귀결되고, 실제 좌우/상하 제스처 판별은 브라우저의 네이티브 스크롤 엔진이 해준다.
  // (직접 pointer 이벤트로 스와이프를 흉내내던 이전 구현은 실기기 터치에서 계속 깨졌다 — 브라우저가
  // 이미 잘하는 걸 JS로 재발명하려던 게 문제였다)
  const onScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el || el.clientWidth === 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setRoomIndex((prev) => (prev === idx ? prev : idx))
  }, [])

  const scrollToRoom = useCallback((idx: number) => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }, [])

  const goPrev = useCallback(() => scrollToRoom(Math.max(0, roomIndex - 1)), [roomIndex, scrollToRoom])
  const goNext = useCallback(() => scrollToRoom(Math.min(LAST_ROOM_INDEX, roomIndex + 1)), [roomIndex, scrollToRoom])

  const room = MOUSE_HUNTER_ROOMS[roomIndex]

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

          <div className="party-mousehunter-viewport">
            <div className="party-mousehunter-scroller" ref={viewportRef} onScroll={onScroll}>
              {MOUSE_HUNTER_ROOMS.map((r) => (
                <img key={r.id} className="party-mousehunter-room-image" src={r.image} alt={r.name} draggable={false} />
              ))}
            </div>

            {roomIndex > 0 && (
              <button
                type="button"
                className="party-mousehunter-arrow party-mousehunter-arrow-prev"
                onClick={goPrev}
                aria-label="이전 방으로"
              >
                ‹
              </button>
            )}
            {roomIndex < LAST_ROOM_INDEX && (
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
