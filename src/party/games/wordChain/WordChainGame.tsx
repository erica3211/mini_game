import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { useWordChainRound } from './useWordChainRound'
import { type ClientToServerEvents, type PlayerInfo, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { WORD_CHAIN_ROUND_TIMEOUT_MS } from './protocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { chosung: string[]; elapsedMs: number; submitted?: boolean } | null
  category: string | null
  definition: string | null
  players: PlayerInfo[]
}

export function WordChainGame({ socket, roundKey, startSignal, category, definition, players }: Props) {
  const { status, chosung, guess, setGuess, submit, isWrong, toasts, startedAt } = useWordChainRound(
    socket,
    roundKey,
    startSignal,
  )
  const nicknameOf = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '???'

  const inputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // 라운드마다 처음 한 번만 입력창에 포커스를 주고 화면 위치를 맞춘다
  const focusedRoundRef = useRef<string | null>(null)

  // 입력창이 나타나면 포커스를 준다. 브라우저가 알아서 입력창을 화면 가운데로 끌어올리면 키보드가 올라오면서 초성이 위로 밀려
  // 안 보이게 되므로(모바일), 자동 스크롤은 끄고(preventScroll) 타이머·초성이 화면 위쪽에 오도록 직접 부드럽게 맞춘다 — 입력창은 그 아래, 키보드 위에 보인다
  useEffect(() => {
    if (status !== 'running' || focusedRoundRef.current === roundKey) return
    focusedRoundRef.current = roundKey
    inputRef.current?.focus({ preventScroll: true })
    // 스크롤은 손가락으로 쓰는 기기(모바일)에서만 한다 — 마우스로 쓰는 웹에서는 키보드가 화면을 가리지 않아서 굳이 움직이지 않는다.
    // 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다
    if (window.matchMedia('(pointer: coarse)').matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stageRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [status, roundKey])

  return (
    <div ref={stageRef} className="party-round-stage party-wordchain-stage">
      {toasts.length > 0 && (
        <div className="party-wordchain-toasts">
          {toasts.map((t) => (
            <p key={t.id} className="party-wordchain-toast">
              {nicknameOf(t.playerId)}님 정답!
            </p>
          ))}
        </div>
      )}

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && (
        <>
          {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={WORD_CHAIN_ROUND_TIMEOUT_MS} />}

          <div className="party-chosung-display">
            {chosung.map((c, i) => (
              <span key={i} className="party-chosung-cell">
                {c}
              </span>
            ))}
          </div>

          <div className="party-wordchain-hints">
            <p className="party-wordchain-hint">
              카테고리: <strong>{category ?? '???'}</strong>
            </p>
            <p className="party-wordchain-hint">
              뜻: <strong>{definition ?? '???'}</strong>
            </p>
          </div>

          {status === 'running' ? (
            <form
              className="party-wordchain-form"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
                // 제출 버튼을 누르면 모바일에서 입력창이 포커스를 잃고 키보드가 내려가므로, 누른 바로 그 순간에 다시 포커스를 줘서 키보드를 유지한다
                // (오답이면 계속 입력해야 하고, 정답이면 이 폼이 사라진다)
                inputRef.current?.focus({ preventScroll: true })
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className={`party-wordchain-input${isWrong ? ' party-wordchain-input-shake' : ''}`}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="정답을 입력하세요"
              />
              <button type="submit" className="btn btn-primary">
                제출
              </button>
            </form>
          ) : (
            <p className="party-round-hint">정답! 다른 사람들을 기다리는 중...</p>
          )}
        </>
      )}
    </div>
  )
}
