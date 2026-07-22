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
    if (!startSignal || startedAtRef.current !== null) return
    // elapsedMs > 0이면 라운드 도중 재접속한 경우 — 이미 지난 시간만큼 시작 시각을 앞당겨서
    // 재접속 전후로 흘러간 시간이 그대로 이어지게 한다
    startedAtRef.current = performance.now() - startSignal.elapsedMs
    setStatus('running')
  }, [startSignal])

  const stop = useCallback(() => {
    if (status !== 'running' || startedAtRef.current === null) return
    const elapsedMs = performance.now() - startedAtRef.current
    socket.emit('humanTimer:submit', { elapsedMs })
    setStatus('submitted')
  }, [socket, status])

  return { status, stop, startedAt: startedAtRef.current }
}
