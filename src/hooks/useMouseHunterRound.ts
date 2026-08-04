import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { MOUSE_HUNTER_TOTAL_MICE, type ClientToServerEvents, type MouseHunterMouse, type ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { mice: MouseHunterMouse[]; elapsedMs: number }

export function useMouseHunterRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [mice, setMice] = useState<MouseHunterMouse[]>([])
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set())
  // 방금 찾은 쥐의 id — "찾았다!" 토스트를 잠깐 띄우는 트리거로만 쓰인다. 매번 새로운(고유한) mouseId라
  // 값이 바뀔 때마다 컴포넌트의 useEffect가 다시 실행된다
  const [justFoundId, setJustFoundId] = useState<string | null>(null)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
    setMice([])
    setFoundIds(new Set())
    setJustFoundId(null)
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setMice(startSignal.mice)
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    const onFound = (data: { mouseId: string; foundCount: number }) => {
      setFoundIds((prev) => {
        if (prev.has(data.mouseId)) return prev
        return new Set(prev).add(data.mouseId)
      })
      setJustFoundId(data.mouseId)
      if (data.foundCount === MOUSE_HUNTER_TOTAL_MICE) setStatus('submitted')
    }
    socket.on('mouseHunter:mouseFound', onFound)
    return () => {
      socket.off('mouseHunter:mouseFound', onFound)
    }
  }, [socket])

  // 클릭 즉시 서버에 알리기만 하고, 실제로 사라지는 건 mouseHunter:mouseFound 응답을 받은 뒤다 —
  // 서버가 최종 판정자이므로 낙관적으로 먼저 지우지 않는다 (오탭 신뢰 문제도 없고, 왕복이 짧아 체감 지연도 적다)
  const tap = useCallback(
    (mouseId: string) => {
      if (status !== 'running' || foundIds.has(mouseId)) return
      socket.emit('mouseHunter:tap', { mouseId })
    },
    [socket, status, foundIds],
  )

  return { status, mice, foundIds, foundCount: foundIds.size, justFoundId, tap, startedAt }
}
