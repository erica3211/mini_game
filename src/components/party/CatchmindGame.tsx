import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
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
    undoStroke,
    submitGuess,
  } = useCatchmindRound(socket, roundKey, turnStart, wordSignal, playerId, canvasRef)

  const [color, setColor] = useState(CATCHMIND_COLORS[0])
  const [width, setWidth] = useState(BRUSH_THIN)
  const [guessInput, setGuessInput] = useState('')
  const isDraggingRef = useRef(false)
  const chatLogRef = useRef<HTMLUListElement>(null)

  // 채팅이 새로 쌓일 때마다 맨 아래로 자동 스크롤 — 안 그러면 예전 메시지 위치에 그대로 멈춰 있어서
  // 새로 도착한 채팅을 보려면 매번 직접 내려야 했다
  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat])

  const nicknameOf = useCallback((id: PlayerId) => players.find((p) => p.id === id)?.nickname ?? '???', [players])

  const toPoint = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  // 아이폰 사파리는 캔버스가 touch-action: none이어도, 문서 자체가 뷰포트보다 길면
  // 드래그 제스처를 감지해서 주소창/뒤로가기 바를 접었다 폈다 한다 — 그림은 안 밀리는데 바만 깜빡이는 이유.
  // 획을 긋는 동안만 문서 스크롤 자체를 잠가서 사파리가 반응할 거리를 없앤다.
  const lockPageScroll = useCallback(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }, [])

  const unlockPageScroll = useCallback(() => {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  }, [])

  useEffect(() => unlockPageScroll, [unlockPageScroll])

  // 삼성인터넷 등 일부 안드로이드 브라우저는 Pointer Event 쪽 preventDefault만으로는 터치 스크롤이
  // 안 막히고 실제 touchmove 이벤트를 막아야 한다. React가 JSX onTouchMove는 passive 리스너로 등록해버려서
  // 그 안에서 preventDefault를 불러도 씹히니(경고만 뜸), useEffect에서 캔버스에 직접 non-passive로 붙인다
  useEffect(() => {
    if (!isDrawer) return
    const canvas = canvasRef.current
    if (!canvas) return
    const preventTouchScroll = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchstart', preventTouchScroll, { passive: false })
    canvas.addEventListener('touchmove', preventTouchScroll, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', preventTouchScroll)
      canvas.removeEventListener('touchmove', preventTouchScroll)
    }
  }, [isDrawer])

  // 데스크톱(마우스)엔 스크롤바가 있어서 overflow: hidden을 걸었다 풀 때마다 스크롤바가
  // 사라졌다 나타나며 화면 폭이 흔들린다 — 터치/펜(모바일 사파리 주소창 문제)일 때만 잠근다
  const scrollLockedRef = useRef(false)

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawer) return
      // 모바일 웹뷰 중에는 touch-action: none만으로 스크롤/확대 제스처가 안 막히는 경우가 있어 직접 막는다
      e.preventDefault()
      isDraggingRef.current = true
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        lockPageScroll()
        scrollLockedRef.current = true
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op — 지원 안 하는 환경도 있음
      }
      const { x, y } = toPoint(e)
      beginStroke(color, width, x, y)
    },
    [isDrawer, beginStroke, color, width, toPoint, lockPageScroll],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      const { x, y } = toPoint(e)
      continueStroke(x, y)
    },
    [continueStroke, toPoint],
  )

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (scrollLockedRef.current) {
      unlockPageScroll()
      scrollLockedRef.current = false
    }
    endStroke()
  }, [endStroke, unlockPageScroll])

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
        style={isDrawer ? { touchAction: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={isDrawer ? (e) => e.preventDefault() : undefined}
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
            <button type="button" className="btn btn-secondary" onClick={undoStroke}>
              되돌리기
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
