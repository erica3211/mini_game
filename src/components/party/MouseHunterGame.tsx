import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useMouseHunterRound } from '../../hooks/useMouseHunterRound'
import { MOUSE_HUNTER_ROOMS } from '../../lib/mouseHunterRooms'
import { MOUSE_HUNTER_SKIN_IMAGES } from '../../lib/mouseHunterSkins'
import { MOUSE_HUNTER_SPOT_POSITIONS } from '../../lib/mouseHunterSpots'
import {
  MOUSE_HUNTER_ROUND_TIMEOUT_MS,
  MOUSE_HUNTER_TOTAL_MICE,
  type ClientToServerEvents,
  type MouseHunterMouse,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { mice: MouseHunterMouse[]; elapsedMs: number } | null
  howToPlay: string
}

const LAST_ROOM_INDEX = MOUSE_HUNTER_ROOMS.length - 1
// "찾았다!" 토스트를 보여주는 시간
const FOUND_TOAST_MS = 1200

export function MouseHunterGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const { status, mice, foundIds, foundCount, justFoundId, tap, startedAt } = useMouseHunterRound(socket, roundKey, startSignal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [roomIndex, setRoomIndex] = useState(0)
  const [showToast, setShowToast] = useState(false)

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

  useEffect(() => {
    if (!justFoundId) return
    setShowToast(true)
    const timeout = window.setTimeout(() => setShowToast(false), FOUND_TOAST_MS)
    return () => window.clearTimeout(timeout)
  }, [justFoundId])

  const room = MOUSE_HUNTER_ROOMS[roomIndex]

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status === 'submitted' && (
        <div className="party-mousehunter-complete">
          <p className="party-mousehunter-complete-emoji">🐭🎉</p>
          <p className="party-mousehunter-complete-title">쥐 3마리 모두 찾았다!</p>
          <p className="party-round-hint">다른 플레이어를 기다리는 중...</p>
        </div>
      )}

      {status === 'running' && (
        <>
          <div className="party-mousehunter-status">
            {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={MOUSE_HUNTER_ROUND_TIMEOUT_MS} />}
            <span>
              🐭 {foundCount}/{MOUSE_HUNTER_TOTAL_MICE} 찾음
            </span>
          </div>

          <p className="party-mousehunter-room-name">
            {room.name} <span className="party-mousehunter-room-index">({roomIndex + 1}/{MOUSE_HUNTER_ROOMS.length})</span>
          </p>

          <div className="party-mousehunter-viewport">
            <div className="party-mousehunter-scroller" ref={viewportRef} onScroll={onScroll}>
              {MOUSE_HUNTER_ROOMS.map((r) => (
                <div key={r.id} className="party-mousehunter-room">
                  <img className="party-mousehunter-room-image" src={r.image} alt={r.name} draggable={false} />

                  {mice
                    .filter((mouse) => mouse.roomId === r.id)
                    .map((mouse) => {
                      const pos = MOUSE_HUNTER_SPOT_POSITIONS[mouse.roomId][mouse.spotId]
                      const found = foundIds.has(mouse.id)
                      return (
                        <button
                          key={mouse.id}
                          type="button"
                          className="party-mousehunter-mouse"
                          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          onClick={() => tap(mouse.id)}
                          disabled={found}
                          aria-label="숨은 쥐"
                        >
                          <img
                            className={[
                              'party-mousehunter-mouse-image',
                              `party-mousehunter-mouse-visibility-${mouse.visibility}`,
                              mouse.facing === 'right' && 'party-mousehunter-mouse-facing-right',
                              found && 'party-mousehunter-mouse-found',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            src={MOUSE_HUNTER_SKIN_IMAGES[mouse.skin][mouse.variant]}
                            alt=""
                            draggable={false}
                          />
                        </button>
                      )
                    })}
                </div>
              ))}
            </div>

            {showToast && <p className="party-mousehunter-toast">찾았다! 🐭</p>}

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
