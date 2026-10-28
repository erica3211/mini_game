import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import type { SimonStageResult, SimonStartSignal } from './protocol'
import { inputOpensOffsetMs } from './simonRules'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { useSimonPlayback } from './useSimonPlayback'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'

// 화면에 보이는 입력 제한이 다 되기 살짝 전에 자동 제출을 보낸다 (telepathy/scavengerHunt와 같은 이유)
const AUTO_SUBMIT_MARGIN_MS = 500

/**
 * roundKey + stageIndex로 키를 고정해서, 단계가 바뀔 때마다 입력 상태를 초기화한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 simon:stageStart 신호다 — 최초 시작과 재접속 시 재개 모두 이 신호로 전달된다.
 */
export function useSimonRound(socket: PartySocket, roundKey: string, startSignal: SimonStartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  // 제출 전에는 누르는 대로 쌓이는 입력, 제출 후에는 확정된 답. 입력 중에는 맞았는지 알려주지 않는다
  const [answer, setAnswer] = useState<string[]>([])
  // 단계가 끝나고 다음 단계가 시작되기 전까지만 보여주는 정답과 전원 채점 결과
  const [reveal, setReveal] = useState<SimonStageResult | null>(null)

  const stageKey = `${roundKey}-${startSignal?.stageIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(stageKey, startSignal, status)
  const length = startSignal?.sequence.length ?? 0
  const { phase, litIndex, shownCount } = useSimonPlayback(startedAt, length, startSignal?.timing ?? null)

  useEffect(() => {
    setStatus('waiting')
    setAnswer([])
    setReveal(null)
  }, [stageKey])

  // 재접속으로 같은 단계 신호가 다시 와도(중복 startSignal) 위 리셋은 건너뛰고 running으로만 전환한다.
  // 서버가 이미 받은 답(myAnswer)이 있으면 제출 완료 상태로 복원한다
  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    if (startSignal.myAnswer !== null) {
      setAnswer(startSignal.myAnswer)
      setStatus('submitted')
      return
    }
    setStatus('running')
  }, [startSignal, status])

  // 결과 공개 중에 새로고침·재접속했다면 서버가 보내준 공개 결과를 바로 보여준다
  useEffect(() => {
    if (startSignal?.reveal) setReveal(startSignal.reveal)
  }, [startSignal])

  useEffect(() => {
    const onResult = (data: SimonStageResult) => {
      if (data.stageIndex !== startSignal?.stageIndex) return
      setReveal(data)
    }
    socket.on('simon:stageResult', onResult)
    return () => {
      socket.off('simon:stageResult', onResult)
    }
  }, [socket, startSignal])

  const canInput = status === 'running' && phase === 'input' && reveal === null

  const press = useCallback(
    (key: string) => {
      if (!canInput) return
      setAnswer((prev) => (prev.length < length ? [...prev, key] : prev))
    },
    [canInput, length],
  )

  const undo = useCallback(() => {
    if (!canInput) return
    setAnswer((prev) => prev.slice(0, -1))
  }, [canInput])

  // 제출 버튼은 전체 길이를 채웠을 때만 열린다. 마감 직전 자동 제출만 일부만 입력한 답도 보낸다 (점수를 아예 잃지 않게)
  const submit = useCallback(
    (allowPartial = false) => {
      if (!canInput || !startSignal || answer.length === 0) return
      if (!allowPartial && answer.length < length) return
      socket.emit('simon:submit', { stageIndex: startSignal.stageIndex, answer })
      setStatus('submitted')
    },
    [canInput, socket, startSignal, answer, length],
  )

  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  const timing = startSignal?.timing
  useEffect(() => {
    if (startedAt === null || !timing) return
    const deadline = inputOpensOffsetMs(length, timing) + timing.inputMs
    const delayMs = deadline - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(true), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt, timing, length])

  // 입력이 열리는 순간부터 제한 시간을 센다 (RemainingTime에 넘길 시작 시각)
  const inputStartedAt = startedAt !== null && timing ? startedAt + inputOpensOffsetMs(length, timing) : null

  return { status, phase, litIndex, shownCount, answer, reveal, canInput, inputStartedAt, press, undo, submit }
}
