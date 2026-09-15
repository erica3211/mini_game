import { useCallback, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { type CatchmindTurnStartSignal, type CatchmindWordSignal, useCatchmindRound } from '../../hooks/useCatchmindRound'
import {
  CATCHMIND_COLORS,
  CATCHMIND_TURN_TIMEOUT_MS,
  type ClientToServerEvents,
  type PlayerId,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  turnStart: CatchmindTurnStartSignal | null
  wordSignal: CatchmindWordSignal | null
  playerId: PlayerId | null
  players: PlayerInfo[]
  howToPlay: string
}

const BRUSH_THIN = 4
const BRUSH_THICK = 10

export function CatchmindGame({ socket, roundKey, turnStart, wordSignal, playerId, players, howToPlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    status,
    startedAt,
    isDrawer,
    drawerId,
    turnIndex,
    totalTurns,
    myWord,
    hintLength,
    guessed,
    chat,
    lastTurnEnd,
    beginStroke,
    continueStroke,
    endStroke,
    clearBoard,
    submitGuess,
  } = useCatchmindRound(socket, roundKey, turnStart, wordSignal, playerId, canvasRef)

  const [color, setColor] = useState(CATCHMIND_COLORS[0])
  const [width, setWidth] = useState(BRUSH_THIN)
  const [guessInput, setGuessInput] = useState('')
  const isDraggingRef = useRef(false)

  const nicknameOf = useCallback((id: PlayerId) => players.find((p) => p.id === id)?.nickname ?? '???', [players])

  const toPoint = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return
      isDraggingRef.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op — 지원 안 하는 환경도 있음
      }
      const { x, y } = toPoint(e)
      beginStroke(color, width, x, y)
    },
    [isDrawer, beginStroke, color, width, toPoint],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      const { x, y } = toPoint(e)
      continueStroke(x, y)
    },
    [continueStroke, toPoint],
  )

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    endStroke()
  }, [endStroke])

  const onSubmitGuess = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!guessInput.trim()) return
      submitGuess(guessInput)
      setGuessInput('')
    },
    [guessInput, submitGuess],
  )

  if (!turnStart) {
    return (
      <div className="party-round-stage">
        <div className="rules">
          <p>{howToPlay}</p>
        </div>
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const showReveal = lastTurnEnd !== null && lastTurnEnd.turnIndex === turnIndex

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      <div className="party-catchmind-header">
        <span>
          턴 {turnIndex + 1} / {totalTurns}
        </span>
        <span>
          {isDrawer ? '내가 출제자예요! 🎨' : `${nicknameOf(drawerId ?? '')}님이 그리는 중`}
        </span>
      </div>

      {startedAt !== null && status === 'running' && <RemainingTime startedAt={startedAt} timeoutMs={CATCHMIND_TURN_TIMEOUT_MS} />}

      {isDrawer && myWord && <p className="party-catchmind-word">내 제시어: {myWord}</p>}

      {!isDrawer && (
        <div className="party-catchmind-hint">
          {hintLength === null ? (
            <p className="party-round-hint">30초 후 글자 수가 공개돼요</p>
          ) : (
            <div className="party-chosung-display">
              {Array.from({ length: hintLength }).map((_, i) => (
                <span key={i} className="party-chosung-cell party-catchmind-blank" />
              ))}
            </div>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`party-catchmind-board${isDrawer ? ' party-catchmind-board-drawable' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {isDrawer && (
        <div className="party-catchmind-toolbar">
          <div className="party-catchmind-palette">
            {CATCHMIND_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`party-catchmind-swatch${color === c ? ' party-catchmind-swatch-active' : ''}`}
                style={{ background: c }}
                title={c === '#ffffff' ? '지우개' : c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="party-catchmind-widths">
            <button
              type="button"
              className={`btn btn-secondary${width === BRUSH_THIN ? ' party-catchmind-width-active' : ''}`}
              onClick={() => setWidth(BRUSH_THIN)}
            >
              얇게
            </button>
            <button
              type="button"
              className={`btn btn-secondary${width === BRUSH_THICK ? ' party-catchmind-width-active' : ''}`}
              onClick={() => setWidth(BRUSH_THICK)}
            >
              굵게
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearBoard}>
              전체 지우기
            </button>
          </div>
        </div>
      )}

      {showReveal && lastTurnEnd && (
        <div className="party-catchmind-reveal">
          <p>
            정답: <strong>{lastTurnEnd.word}</strong>
          </p>
          <p>
            {lastTurnEnd.correctGuessers.length === 0
              ? '아무도 못 맞혔어요 😢'
              : `${nicknameOf(lastTurnEnd.correctGuessers[0].playerId)}님이 가장 먼저 맞혔어요!`}
          </p>
        </div>
      )}

      <div className="party-catchmind-chat">
        <ul className="party-catchmind-chat-log">
          {chat.map((entry) => {
            if (entry.kind === 'chat') {
              return (
                <li key={entry.id} className="party-catchmind-chat-line">
                  <strong>{nicknameOf(entry.playerId)}</strong>: {entry.text}
                </li>
              )
            }
            if (entry.kind === 'correct') {
              return (
                <li key={entry.id} className="party-catchmind-chat-line party-catchmind-chat-correct">
                  🎉 {nicknameOf(entry.playerId)}님 정답! (+{entry.points}점)
                </li>
              )
            }
            return (
              <li key={entry.id} className="party-catchmind-chat-line party-catchmind-chat-system">
                정답은 '{entry.word}'였습니다!
              </li>
            )
          })}
        </ul>

        {!isDrawer && status === 'running' && !guessed && (
          <form className="party-wordchain-form" onSubmit={onSubmitGuess}>
            <input
              type="text"
              className="party-wordchain-input"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              placeholder="정답을 채팅으로 입력하세요"
              autoFocus
            />
            <button type="submit" className="btn btn-primary">
              전송
            </button>
          </form>
        )}
        {!isDrawer && guessed && <p className="party-round-hint">정답! 다음 턴을 기다리는 중...</p>}
      </div>
    </div>
  )
}
