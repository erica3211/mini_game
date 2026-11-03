import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { RecyclingEndSignal, RecyclingEventSignal, RecyclingItemState, RecyclingStartSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** 치우거나 놓친 쓰레기 — 사라지는 연출을 하려고 그때의 시각(performance.now)을 같이 들고 있다 */
export interface ResolvedItem {
  state: RecyclingItemState
  at: number
}

/**
 * 분리수거 한 판의 화면 상태. 시작 신호(recycling:start)는 useGameSession이 세션 내내 받아 두고, 여기서는 그 뒤에 이어지는
 * 우리 팀의 일(event)·팀별 점수(progress)·끝(end) 신호를 받는다. 내 담당을 누르면 서버 응답을 기다리지 않고 바로 치운 것으로 보여 준다.
 */
export function useRecyclingRound(socket: PartySocket, roundKey: string, startSignal: RecyclingStartSignal | null, playerId: string | null) {
  const [resolved, setResolved] = useState<Record<number, ResolvedItem>>({})
  // 담당이 아닌 걸 눌러서 흔들리는 쓰레기 (id → 누른 시각)
  const [wrongAt, setWrongAt] = useState<Record<number, number>>({})
  const [scores, setScores] = useState<Record<number, number>>({})
  const [end, setEnd] = useState<RecyclingEndSignal | null>(null)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end ? 'finished' : 'running')
  const wrongTappedRef = useRef(new Set<number>())
  const lastTapRef = useRef(0)

  const myKinds = startSignal?.roles.find((role) => role.playerId === playerId)?.kinds ?? []

  // 새 판(또는 재접속 스냅샷)이 오면 서버가 알려 준 값으로 맞춘다
  useEffect(() => {
    if (!startSignal) return
    const now = performance.now()
    setResolved(Object.fromEntries(Object.entries(startSignal.states).map(([id, state]) => [id, { state, at: now - 10_000 }])))
    setScores(startSignal.scores)
  }, [startSignal])

  useEffect(() => {
    setEnd(null)
    setWrongAt({})
    wrongTappedRef.current = new Set()
  }, [roundKey])

  useEffect(() => {
    const onEvent = (data: RecyclingEventSignal) => {
      const now = performance.now()
      if (data.kind === 'wrong') setWrongAt((prev) => ({ ...prev, [data.itemId]: now }))
      else setResolved((prev) => (prev[data.itemId] ? prev : { ...prev, [data.itemId]: { state: data.kind as RecyclingItemState, at: now } }))
    }
    const onProgress = (data: { scores: Record<number, number> }) => setScores((prev) => ({ ...prev, ...data.scores }))
    const onEnd = (data: RecyclingEndSignal) => {
      setEnd(data)
      setScores(Object.fromEntries(data.teams.map((team) => [team.teamId, team.score])))
    }
    socket.on('recycling:event', onEvent)
    socket.on('recycling:progress', onProgress)
    socket.on('recycling:end', onEnd)
    return () => {
      socket.off('recycling:event', onEvent)
      socket.off('recycling:progress', onProgress)
      socket.off('recycling:end', onEnd)
    }
  }, [socket])

  /** 쓰레기를 누른다 */
  const tap = useCallback(
    (itemId: number) => {
      if (!startSignal || end) return
      const item = startSignal.items[itemId]
      if (!item || resolved[itemId]) return
      const now = performance.now()
      // 서버가 무시하는 속도의 신호는 처음부터 보내지 않는다 (서버 간격 30ms보다 넉넉히 — 지터로 도착이 붙어도 버려지지 않게)
      if (now - lastTapRef.current < 55) return
      lastTapRef.current = now
      if (myKinds.includes(item.kind)) {
        setResolved((prev) => ({ ...prev, [itemId]: { state: 'done', at: now } }))
      } else {
        if (wrongTappedRef.current.has(itemId)) return
        wrongTappedRef.current.add(itemId)
        setWrongAt((prev) => ({ ...prev, [itemId]: now }))
      }
      socket.emit('recycling:tap', { itemId })
    },
    [socket, startSignal, end, resolved, myKinds],
  )

  return { resolved, wrongAt, scores, end, startedAt, myKinds, tap }
}
