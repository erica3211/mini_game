import type { Socket } from 'socket.io-client'
import { useOneToTwentyFiveRound } from '../../hooks/useOneToTwentyFiveRound'
import { ONE_TO_TWENTY_FIVE_ROUND_TIMEOUT_MS, type ClientToServerEvents, type ServerToClientEvents } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { board: number[]; progress: number; elapsedMs: number; submitted?: boolean } | null
}

export function OneToTwentyFiveGame({ socket, roundKey, startSignal }: Props) {
  const { status, board, next, tap, shakeValue, startedAt } = useOneToTwentyFiveRound(socket, roundKey, startSignal)

  return (
    <div className="party-round-stage">
      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && (
        <>
          <div className="party-onetotwentyfive-status">
            <span>다음 숫자: {status === 'submitted' ? '완료! 🎉' : next}</span>
            {status === 'running' && startedAt !== null && (
              <RemainingTime startedAt={startedAt} timeoutMs={ONE_TO_TWENTY_FIVE_ROUND_TIMEOUT_MS} />
            )}
          </div>

          {/* 완료하면 숫자가 모두 눌려 사라져 빈 칸만 남으니, 숫자판은 진행 중에만 그리고 완료 안내를 상태 줄 바로 아래에 보여준다 */}
          {status === 'submitted' ? (
            <p className="party-round-hint">제출 완료! 다른 사람들을 기다리는 중...</p>
          ) : (
            <div className="party-number-grid">
              {board.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`party-number-cell${value < next ? ' party-number-cell-done' : ''}${
                    shakeValue === value ? ' party-number-cell-shake' : ''
                  }`}
                  disabled={value < next}
                  onClick={() => tap(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
