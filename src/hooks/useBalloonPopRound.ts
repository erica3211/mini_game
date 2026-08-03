import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { BalloonPopStatus, ClientToServerEvents, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | BalloonPopStatus
type StartSignal = { elapsedMs: number }

// 꾹 누르고 있는 동안 이 간격(ms)마다 한 번씩 부풀린다 — 너무 짧으면 소켓 메시지가 과도하게 쌓이고,
// 너무 길면 "꾹 누르는" 손맛이 안 산다
const PUMP_TICK_MS = 120

/** useMonotonicStartedAt이 기대하는 4단계 상태로 좁혀준다 — popped/stopped 둘 다 "더 이상 진행 안 함"이므로 submitted로 취급 */
function toRoundStatus(status: LocalStatus): 'waiting' | 'running' | 'submitted' {
  if (status === 'waiting') return 'waiting'
  if (status === 'alive') return 'running'
  return 'submitted'
}

export function useBalloonPopRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [pumps, setPumps] = useState(0)
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, toRoundStatus(status))
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    setPumps(0)
    setStatus('waiting')
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status !== 'waiting') return
    setStatus('alive')
  }, [startSignal, status])

  useEffect(() => {
    const onState = (data: { pumps: number; status: BalloonPopStatus }) => {
      setPumps(data.pumps)
      setStatus(data.status)
    }
    socket.on('balloonPop:state', onState)
    return () => {
      socket.off('balloonPop:state', onState)
    }
  }, [socket])

  // 더 이상 부풀릴 수 없게 되면(서버가 터짐/시간종료로 확정) 손을 떼지 않았어도 홀드 인터벌을 강제로 정리한다
  useEffect(() => {
    if (status === 'alive' || intervalRef.current === null) return
    window.clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [status])

  // 컴포넌트가 언마운트될 때도 인터벌이 남아있지 않도록 정리
  useEffect(
    () => () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    },
    [],
  )

  // 홀드 반응성을 위해 즉시 한 칸 키워서 보여주고, 뒤이어 도착하는 balloonPop:state로 서버 판정값(터짐 여부 포함)을 덮어써 확정한다
  const pump = useCallback(() => {
    if (status !== 'alive') return
    setPumps((prev) => prev + 1)
    socket.emit('balloonPop:pump')
  }, [socket, status])

  // "그만하기" 버튼 전용 — 이때만 실제로 라운드를 확정짓는다 (시간 초과 시엔 서버가 알아서 확정)
  const stop = useCallback(() => {
    if (status !== 'alive') return
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    socket.emit('balloonPop:stop')
  }, [socket, status])

  // 누르기 시작: 바로 한 번 부풀리고(=클릭 한 번은 1회로 인식), 계속 누르고 있으면 일정 간격으로 계속 부풀린다
  const startPumping = useCallback(() => {
    if (intervalRef.current !== null) return
    pump()
    intervalRef.current = window.setInterval(pump, PUMP_TICK_MS)
  }, [pump])

  // 손을 떼면 더 부풀리기만 잠깐 멈춘다 — 아직 확정된 게 아니라서, 다시 누르면 이어서 커진다
  const pausePumping = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  return { status, pumps, startPumping, pausePumping, stop, startedAt }
}
