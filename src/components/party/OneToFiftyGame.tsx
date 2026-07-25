import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useOneToFiftyRound } from '../../hooks/useOneToFiftyRound'
import { ONE_TO_FIFTY_ROUND_TIMEOUT_MS, type ClientToServerEvents, type ServerToClientEvents } from '../../lib/partyProtocol'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { board: number[]; progress: number; elapsedMs: number } | null
  howToPlay: string
}

export function OneToFiftyGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const { status, board, next, tap, shakeValue, startedAt } = useOneToFiftyRound(socket, roundKey, startSignal)

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && (
        <>
          <div className="party-onetofifty-status">
            <span>다음 숫자: {status === 'submitted' ? '완료! 🎉' : next}</span>
            {status === 'running' && startedAt !== null && <RemainingTime startedAt={startedAt} />}
          </div>

          <div className="party-number-grid">
            {board.map((value) => (
              <button
                key={value}
                type="button"
                className={`party-number-cell${value < next ? ' party-number-cell-done' : ''}${
                  shakeValue === value ? ' party-number-cell-shake' : ''
                }`}
                disabled={value < next || status === 'submitted'}
                onClick={() => tap(value)}
              >
                {value}
              </button>
            ))}
          </div>

          {status === 'submitted' && <p className="party-round-hint">제출 완료! 다른 사람들을 기다리는 중...</p>}
        </>
      )}
    </div>
  )
}

/** 제한시간 중 남은 시간을 1초 단위로 보여준다 */
function RemainingTime({ startedAt }: { startedAt: number }) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, ONE_TO_FIFTY_ROUND_TIMEOUT_MS - (performance.now() - startedAt)))

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(Math.max(0, ONE_TO_FIFTY_ROUND_TIMEOUT_MS - (performance.now() - startedAt)))
    }, 250)
    return () => window.clearInterval(interval)
  }, [startedAt])

  return <span className="party-onetofifty-remaining">⏳ {Math.ceil(remainingMs / 1000)}초</span>
}
