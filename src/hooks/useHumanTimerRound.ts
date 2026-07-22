import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../lib/partyProtocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'

/**
 * roundKey가 바뀌면(=새 라운드) 로컬 타이머 상태를 리셋한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 humanTimer:roundStart 신호다 —
 * 이 화면이 마운트되기 전에 신호가 먼저 도착해도 놓치지 않도록 여기서 직접 구독하지 않는다.
 */
export function useHumanTimerRound(socket: PartySocket, roundKey: string, startSignal: { elapsedMs: number } | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    setStatus('waiting')
    startedAtRef.current = null
  }, [roundKey])

  useEffect(() => {
    // 이미 제출한 뒤라면 재동기화 신호가 와도 무시한다
    if (!startSignal || status === 'submitted') return
    // 재접속(백그라운드 복귀 등)마다 서버가 다시 이 이벤트를 보내준다 — 매번 서버가 보내준
    // elapsedMs를 기준으로 시작 시각을 다시 계산해야 한다. 최초 1회만 반영하면 백그라운드
    // 동안 멈춰있던 performance.now() 기준으로 시간이 어긋나 0초부터 다시 시작한 것처럼 보인다
    startedAtRef.current = performance.now() - startSignal.elapsedMs
    setStatus('running')
  }, [startSignal, status])

  const stop = useCallback(() => {
    if (status !== 'running' || startedAtRef.current === null) return
    const elapsedMs = performance.now() - startedAtRef.current
    socket.emit('humanTimer:submit', { elapsedMs })
    setStatus('submitted')
  }, [socket, status])

  return { status, stop, startedAt: startedAtRef.current }
}
