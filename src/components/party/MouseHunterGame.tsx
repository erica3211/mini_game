import { useCallback, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useMouseHunterRound } from '../../hooks/useMouseHunterRound'
import { MOUSE_HUNTER_ROOMS } from '../../lib/mouseHunterRooms'
import { MOUSE_HUNTER_SKIN_IMAGES } from '../../lib/mouseHunterSkins'
import { MOUSE_HUNTER_SPOT_POSITIONS } from '../../lib/mouseHunterSpots'
import {
  MOUSE_HUNTER_ROUND_TIMEOUT_MS,
  type ClientToServerEvents,
  type MouseHunterMouse,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { mice: MouseHunterMouse[]; caughtCount: number; elapsedMs: number } | null
  howToPlay: string
  players: PlayerInfo[]
}

const LAST_ROOM_INDEX = MOUSE_HUNTER_ROOMS.length - 1

export function MouseHunterGame({ socket, roundKey, startSignal, howToPlay, players }: Props) {
  const { status, mice, myTotalCaught, toasts, tap, startedAt } = useMouseHunterRound(socket, roundKey, startSignal)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [roomIndex, setRoomIndex] = useState(0)
  const nicknameOf = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '???'

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

      {toasts.length > 0 && (
        <div className="party-mousehunter-toasts">
          {toasts.map((t) => (
            <p key={t.id} className="party-mousehunter-toast">
              {nicknameOf(t.playerId)}님, 쥐 {t.totalCaught}마리째 잡는 중!
            </p>
          ))}
        </div>
      )}

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status === 'running' && (
        <>
          <div className="party-mousehunter-status">
            {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={MOUSE_HUNTER_ROUND_TIMEOUT_MS} />}
            <span>🐭 {myTotalCaught}마리 잡음</span>
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
                      return (
                        <button
                          key={mouse.id}
                          type="button"
                          className="party-mousehunter-mouse"
                          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          onClick={() => tap(mouse.id)}
                          aria-label="숨은 쥐"
                        >
                          <img
                            className={`party-mousehunter-mouse-image${mouse.facing === 'right' ? ' party-mousehunter-mouse-facing-right' : ''}`}
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
