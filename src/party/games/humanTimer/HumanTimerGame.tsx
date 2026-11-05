import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useHumanTimerRound } from './useHumanTimerRound'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'

// 몇 초 인지 보여주는 시간 (3초)
const FADE_DURATION_MS = 3000

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { elapsedMs: number; targetMs: number; submitted?: boolean } | null
}

export function HumanTimerGame({ socket, roundKey, startSignal }: Props) {
  const { status, stop, startedAt, stoppedMs } = useHumanTimerRound(socket, roundKey, startSignal)

  return (
    <div className="party-round-stage">
      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}
      {startSignal && status !== 'waiting' && (
        <div className="party-timer-target">
          <span className="party-timer-target-label">목표 시간</span>
          <span className="party-timer-target-value">{startSignal.targetMs / 1000}초</span>
        </div>
      )}
      <div className="party-timer-display">
        {status === 'running' && startedAt !== null && <FadingTimer startedAt={startedAt} />}
        {status === 'submitted' && stoppedMs !== null && (
          <>
            <span className="party-timer-display-label">내가 멈춘 시간</span>
            <span className="party-timer-display-value">{(stoppedMs / 1000).toFixed(2)}초</span>
          </>
        )}
      </div>
      <div className="party-timer-action">
        {status === 'running' && (
          <button type="button" className="btn btn-primary party-stop-btn" onClick={stop}>
            정지!
          </button>
        )}
        {status === 'submitted' && <p className="party-round-hint">제출 완료! 다른 사람들을 기다리는 중...</p>}
      </div>
    </div>
  )
}

/** 라운드 시작 후 처음 3초만 경과 시간을 보여주다가 서서히 사라지는 눈금 — 그 뒤로는 감으로 맞혀야 한다 */
function FadingTimer({ startedAt }: { startedAt: number }) {
  const [elapsedMs, setElapsedMs] = useState(() => performance.now() - startedAt)

  useEffect(() => {
    let frame: number
    const tick = () => {
      const elapsed = performance.now() - startedAt
      setElapsedMs(elapsed)
      if (elapsed < FADE_DURATION_MS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [startedAt])

  return (
    <div className="party-fading-timer" style={{ opacity: Math.max(0, 1 - elapsedMs / FADE_DURATION_MS) }}>
      {(elapsedMs / 1000).toFixed(2)}
    </div>
  )
}
