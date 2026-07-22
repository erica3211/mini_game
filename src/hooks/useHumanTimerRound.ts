import { useCallback, useEffect, useState } from 'react'
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
  // ref가 아니라 state로 둬야 재동기화로 값이 바뀔 때 화면(FadingTimer 등)이 새 값을 받는다.
  // ref만 바꾸면 status가 이미 'running'이라 리렌더가 안 일어나서 갱신된 시작 시각이 반영되지 않는다
  const [startedAt, setStartedAt] = useState<number | null>(null)

  useEffect(() => {
    setStatus('waiting')
    setStartedAt(null)
  }, [roundKey])

  useEffect(() => {
    // 이미 제출한 뒤라면 재동기화 신호가 와도 무시한다
    if (!startSignal || status === 'submitted') return
    const candidate = performance.now() - startSignal.elapsedMs
    // 백그라운드에 있던 동안 서버가 보낸 최신 재동기화 신호보다, 라운드 시작 때 뿌려진
    // elapsedMs:0 브로드캐스트가 더 늦게(뒤늦은 큐잉 등으로) 도착할 수 있다. 이미 알고 있는
    // 시작 시각보다 "더 늦게 시작한 것"으로는 절대 되돌리지 않는다 — 경과 시간은 항상 늘어나기만 해야 한다
    setStartedAt((prev) => (prev !== null && candidate > prev ? prev : candidate))
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
