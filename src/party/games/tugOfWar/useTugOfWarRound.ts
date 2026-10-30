import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { TugEndSignal, TugPower, TugStartSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * 줄다리기 한 판의 화면 상태. 시작 신호(tugOfWar:start)는 useGameSession이 세션 내내 받아 두고, 여기서는 그 뒤에 이어지는
 * 팀별 힘(progress)과 끝(end) 신호를 받는다. 내가 당긴 횟수는 눌렀을 때 바로 올려서 보여 준다 (서버 응답을 기다리지 않는다).
 */
export function useTugOfWarRound(socket: PartySocket, roundKey: string, startSignal: TugStartSignal | null) {
  const [power, setPower] = useState<TugPower>({})
  const [myPulls, setMyPulls] = useState(0)
  const [end, setEnd] = useState<TugEndSignal | null>(null)
  // 제한 시간이 지났는지 — 서버의 끝 신호보다 먼저 눌러도 소용없는 버튼을 눌리지 않게 한다
  const [timeUp, setTimeUp] = useState(false)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end ? 'finished' : 'running')
  const lastPullRef = useRef(0)

  // 새 판(또는 재접속 스냅샷)이 오면 서버가 알려 준 값으로 맞춘다
  useEffect(() => {
    if (!startSignal) return
    setPower(startSignal.power)
    setMyPulls(startSignal.myPulls)
    setTimeUp(startSignal.elapsedMs >= startSignal.durationMs)
  }, [startSignal])

  useEffect(() => {
    setEnd(null)
    setTimeUp(false)
  }, [roundKey])

  useEffect(() => {
    const onProgress = (data: { power: TugPower }) => setPower(data.power)
    const onEnd = (data: TugEndSignal) => {
      setEnd(data)
      setTimeUp(true)
      setPower(Object.fromEntries(data.teams.map((team) => [team.teamId, team.power])))
    }
    socket.on('tugOfWar:progress', onProgress)
    socket.on('tugOfWar:end', onEnd)
    return () => {
      socket.off('tugOfWar:progress', onProgress)
      socket.off('tugOfWar:end', onEnd)
    }
  }, [socket])

  // 제한 시간이 되면 버튼을 잠근다
  useEffect(() => {
    if (!startSignal || timeUp) return
    const timer = window.setTimeout(() => setTimeUp(true), Math.max(0, startSignal.durationMs - startSignal.elapsedMs))
    return () => window.clearTimeout(timer)
  }, [startSignal, timeUp])

  /** 줄을 한 번 당긴다 */
  const pull = useCallback(() => {
    if (!startSignal || timeUp || end) return
    // 서버가 무시하는 속도의 신호는 처음부터 보내지 않는다 (너무 빠른 신호가 몰려서 소켓이 바빠지는 것도 막는다)
    const now = performance.now()
    if (now - lastPullRef.current < 55) return
    lastPullRef.current = now
    setMyPulls((prev) => prev + 1)
    socket.emit('tugOfWar:pull')
  }, [socket, startSignal, timeUp, end])

  return { power, myPulls, end, timeUp, startedAt, pull }
}
