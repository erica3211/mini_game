import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'

/**
 * roundKey가 바뀌면(=새 라운드) 로컬 상태를 리셋한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 humanTimer:roundStart 신호다 —
 * 이 화면이 마운트되기 전에 신호가 먼저 도착해도 놓치지 않도록 여기서 직접 구독하지 않는다.
 */
export function useHumanTimerRound(socket: PartySocket, roundKey: string, startSignal: { elapsedMs: number } | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setStatus('running')
  }, [startSignal, status])

  const stop = useCallback(() => {
    if (status !== 'running' || startedAt === null) return
    const elapsedMs = performance.now() - startedAt
    socket.emit('humanTimer:submit', { elapsedMs })
    setStatus('submitted')
  }, [socket, status, startedAt])

  return { status, stop, startedAt }
}
