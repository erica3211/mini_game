import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { FindOddRoundResult, FindOddRoundSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * 다른 글자 찾기 한 라운드의 화면 상태. 라운드 시작 신호(findOdd:roundStart)는 useGameSession이 세션 내내 받아 두고,
 * 여기서는 그 뒤에 이어지는 "누가 찾았다 / 내가 틀렸다 / 라운드 결과"를 받아 합친다.
 */
export function useFindOddRound(socket: PartySocket, roundKey: string, signal: FindOddRoundSignal | null, playerId: PlayerId | null) {
  const roundId = signal ? `${roundKey}-${signal.roundIndex}` : 'none'
  const [foundIds, setFoundIds] = useState<PlayerId[]>([])
  const [lockedUntil, setLockedUntil] = useState(0)
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)
  const [result, setResult] = useState<FindOddRoundResult | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const lastTapRef = useRef<number | null>(null)
  const startedAt = useMonotonicStartedAt(roundId, signal, result ? 'finished' : 'running')

  // 새 라운드(또는 재접속 스냅샷)가 오면 이번 라운드 전용 상태를 서버가 알려 준 값으로 맞춘다
  useEffect(() => {
    if (!signal) return
    setFoundIds(signal.foundIds)
    setLockedUntil(signal.mine && signal.mine.lockRemainingMs > 0 ? Date.now() + signal.mine.lockRemainingMs : 0)
    setWrongIndex(null)
    setResult(signal.reveal)
    lastTapRef.current = null
  }, [signal])

  useEffect(() => {
    const onFound = (data: { roundIndex: number; playerId: PlayerId }) => {
      if (data.roundIndex !== signal?.roundIndex) return
      setFoundIds((prev) => (prev.includes(data.playerId) ? prev : [...prev, data.playerId]))
    }
    const onWrong = (data: { lockMs: number }) => {
      setLockedUntil(Date.now() + data.lockMs)
      setWrongIndex(lastTapRef.current)
    }
    const onResult = (data: FindOddRoundResult) => {
      if (data.roundIndex === signal?.roundIndex) setResult(data)
    }
    socket.on('findOdd:found', onFound)
    socket.on('findOdd:wrong', onWrong)
    socket.on('findOdd:roundResult', onResult)
    return () => {
      socket.off('findOdd:found', onFound)
      socket.off('findOdd:wrong', onWrong)
      socket.off('findOdd:roundResult', onResult)
    }
  }, [socket, signal?.roundIndex])

  // 잠금이 풀리는 순간 화면을 다시 그린다
  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    setNow(Date.now())
    const timer = window.setTimeout(() => setNow(Date.now()), lockedUntil - Date.now() + 20)
    return () => window.clearTimeout(timer)
  }, [lockedUntil])

  const locked = lockedUntil > now
  // 내가 찾았는지 — 서버가 "누가 찾았다"를 전원에게 알려 주므로 그 목록에 내가 들어 있는지로 안다
  const iFound = playerId !== null && foundIds.includes(playerId)
  const canTap = signal !== null && result === null && !iFound && !locked

  const tap = useCallback(
    (index: number) => {
      if (!canTap) return
      lastTapRef.current = index
      socket.emit('findOdd:tap', { index })
    },
    [socket, canTap],
  )

  return { startedAt, foundIds, iFound, locked, wrongIndex, result, canTap, tap }
}
