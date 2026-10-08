import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { useCanvasPointerDrawing } from '../../hooks/useCanvasPointerDrawing'
import { type CatchmindTurnStartSignal, type CatchmindWordSignal, useCatchmindRound } from '../../hooks/useCatchmindRound'
import {
  CATCHMIND_COLORS,
  CATCHMIND_TURN_TIMEOUT_MS,
  type ClientToServerEvents,
  type PlayerId,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { BRUSH_THIN, CatchmindToolbar } from '../CatchmindToolbar'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  turnStart: CatchmindTurnStartSignal | null
  wordSignal: CatchmindWordSignal | null
  playerId: PlayerId | null
  players: PlayerInfo[]
}

export function CatchmindGame({ socket, roundKey, turnStart, wordSignal, playerId, players }: Props) {
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
    toasts,
    lastTurnEnd,
    beginStroke,
    continueStroke,
    endStroke,
    clearBoard,
    undoStroke,
    submitGuess,
  } = useCatchmindRound(socket, roundKey, turnStart, wordSignal, playerId, canvasRef)

  const [color, setColor] = useState(CATCHMIND_COLORS[0])
  const [width, setWidth] = useState(BRUSH_THIN)
  const [guessInput, setGuessInput] = useState('')
  const chatLogRef = useRef<HTMLUListElement>(null)

  // 채팅이 새로 쌓일 때마다 맨 아래로 자동 스크롤 — 안 그러면 예전 메시지 위치에 그대로 멈춰 있어서
  // 새로 도착한 채팅을 보려면 매번 직접 내려야 했다
  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat])

  const nicknameOf = useCallback((id: PlayerId) => players.find((p) => p.id === id)?.nickname ?? '???', [players])

  const drawingProps = useCanvasPointerDrawing(canvasRef, isDrawer, {
    onBegin: ({ x, y }) => beginStroke(color, width, x, y),
    onMove: ({ x, y }) => continueStroke(x, y),
    onEnd: endStroke,
  })

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
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const showReveal = lastTurnEnd !== null && lastTurnEnd.turnIndex === turnIndex

  return (
    <div className="party-round-stage">
      {toasts.length > 0 && (
        <div className="party-catchmind-toasts">
          {toasts.map((t) => (
            <p key={t.id} className="party-catchmind-toast">
              🎉 {nicknameOf(t.playerId)}님 정답! (+{t.points}점)
            </p>
          ))}
        </div>
      )}

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
            <p className="party-round-hint">30초 남았을 때 글자 수가 공개돼요</p>
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
        {...drawingProps}
      />

      {isDrawer && (
        <CatchmindToolbar
          color={color}
          width={width}
          onColorChange={setColor}
          onWidthChange={setWidth}
          onUndo={undoStroke}
          onClear={clearBoard}
        />
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
        <ul ref={chatLogRef} className="party-catchmind-chat-log">
            <li className="party-catchmind-chat-line party-catchmind-chat-system">
              여기에서 채팅 로그를 확인할 수 있어요.<br />그림을 보고 정답 같으면 아래에 입력해보세요!<br />

            </li>
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
                정답은 '{entry.word}'!
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
