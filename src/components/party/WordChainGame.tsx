import type { Socket } from 'socket.io-client'
import { useWordChainRound } from '../../hooks/useWordChainRound'
import {
  WORD_CHAIN_ROUND_TIMEOUT_MS,
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { chosung: string[]; elapsedMs: number } | null
  category: string | null
  definition: string | null
  howToPlay: string
  players: PlayerInfo[]
}

export function WordChainGame({ socket, roundKey, startSignal, category, definition, howToPlay, players }: Props) {
  const { status, chosung, guess, setGuess, submit, isWrong, toasts, startedAt } = useWordChainRound(
    socket,
    roundKey,
    startSignal,
  )
  const nicknameOf = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '???'

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

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
              }}
            >
              <input
                type="text"
                className={`party-wordchain-input${isWrong ? ' party-wordchain-input-shake' : ''}`}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="정답을 입력하세요"
                autoFocus
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
