import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { StroopQuestionResult, StroopQuestionSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * 글자색 대결 한 문제의 화면 상태. 문제 신호(stroop:question)는 useGameSession이 세션 내내 받아 두고,
 * 여기서는 그 뒤에 이어지는 "누가 맞혔다 / 내가 틀렸다 / 문제 결과"를 받아 합친다.
 */
export function useStroopRound(socket: PartySocket, roundKey: string, signal: StroopQuestionSignal | null, playerId: PlayerId | null) {
  const questionId = signal ? `${roundKey}-${signal.questionIndex}` : 'none'
  const [answeredIds, setAnsweredIds] = useState<PlayerId[]>([])
  const [lockedUntil, setLockedUntil] = useState(0)
  const [wrongChoice, setWrongChoice] = useState<number | null>(null)
  const [result, setResult] = useState<StroopQuestionResult | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const lastChoiceRef = useRef<number | null>(null)
  const startedAt = useMonotonicStartedAt(questionId, signal, result ? 'finished' : 'running')

  // 새 문제(또는 재접속 스냅샷)가 오면 이번 문제 전용 상태를 서버가 알려 준 값으로 맞춘다
  useEffect(() => {
    if (!signal) return
    setAnsweredIds(signal.answeredIds)
    setLockedUntil(signal.mine && signal.mine.lockRemainingMs > 0 ? Date.now() + signal.mine.lockRemainingMs : 0)
    setWrongChoice(null)
    setResult(signal.reveal)
    lastChoiceRef.current = null
  }, [signal])

  useEffect(() => {
    const onAnswered = (data: { questionIndex: number; playerId: PlayerId }) => {
      if (data.questionIndex !== signal?.questionIndex) return
      setAnsweredIds((prev) => (prev.includes(data.playerId) ? prev : [...prev, data.playerId]))
    }
    const onWrong = (data: { lockMs: number }) => {
      setLockedUntil(Date.now() + data.lockMs)
      setWrongChoice(lastChoiceRef.current)
    }
    const onResult = (data: StroopQuestionResult) => {
      if (data.questionIndex === signal?.questionIndex) setResult(data)
    }
    socket.on('stroop:answered', onAnswered)
    socket.on('stroop:wrong', onWrong)
    socket.on('stroop:result', onResult)
    return () => {
      socket.off('stroop:answered', onAnswered)
      socket.off('stroop:wrong', onWrong)
      socket.off('stroop:result', onResult)
    }
  }, [socket, signal?.questionIndex])

  // 잠금이 풀리는 순간 화면을 다시 그린다
  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    setNow(Date.now())
    const timer = window.setTimeout(() => setNow(Date.now()), lockedUntil - Date.now() + 20)
    return () => window.clearTimeout(timer)
  }, [lockedUntil])

  const locked = lockedUntil > now
  // 내가 맞혔는지 — 서버가 "누가 맞혔다"를 전원에게 알려 주므로 그 목록에 내가 들어 있는지로 안다
  const iAnswered = playerId !== null && answeredIds.includes(playerId)
  const canChoose = signal !== null && result === null && !iAnswered && !locked

  const choose = useCallback(
    (choice: number) => {
      if (!canChoose) return
      lastChoiceRef.current = choice
      socket.emit('stroop:choose', { choice })
    },
    [socket, canChoose],
  )

  return { startedAt, answeredIds, iAnswered, locked, wrongChoice, result, canChoose, choose }
}
