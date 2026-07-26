import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { board: number[]; progress: number; elapsedMs: number }

const SHAKE_DURATION_MS = 300

/**
 * roundKey가 바뀌면(=새 라운드) 로컬 상태를 리셋한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 oneToFifty:roundStart 신호다 —
 * 최초 시작과 재접속 시 재개 모두 이 신호로 전달되며, 서버가 들고 있는 게임판/진행률을 그대로 반영한다.
 */
export function useOneToFiftyRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [board, setBoard] = useState<number[]>([])
  const [next, setNext] = useState(1)
  const [shakeValue, setShakeValue] = useState<number | null>(null)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
    setBoard([])
    setNext(1)
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setBoard(startSignal.board)
    setNext((prev) => Math.max(prev, startSignal.progress + 1))
    setStatus('running')
  }, [startSignal, status])

  const tap = useCallback(
    (value: number) => {
      if (status !== 'running' || startedAt === null) return
      if (value !== next) {
        setShakeValue(value)
        window.setTimeout(() => setShakeValue((prev) => (prev === value ? null : prev)), SHAKE_DURATION_MS)
        return
      }

      if (next === board.length) {
        const elapsedMs = performance.now() - startedAt
        socket.emit('oneToFifty:submit', { elapsedMs })
        setStatus('submitted')
      } else {
        socket.emit('oneToFifty:progress', { progress: next })
      }
      setNext((prev) => prev + 1)
    },
    [socket, status, next, board.length, startedAt],
  )

  return { status, board, next, tap, shakeValue, startedAt }
}
