import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  TELEPATHY_SUB_ROUND_MS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type TelepathyStartSignal,
  type TelepathySubRoundResult,
} from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'

// 화면에 보이는 15초가 다 되기 살짝 전에 자동 제출을 보낸다 (scavengerHunt와 같은 이유) —
// 서버도 TELEPATHY_SUBMIT_GRACE_MS만큼 마감을 늦춰주지만, 클라이언트도 여유를 둬서 느린 네트워크에서 미제출(0점) 처리되는 일을 줄인다
const AUTO_SUBMIT_MARGIN_MS = 500

/**
 * roundKey + subRoundIndex로 키를 고정해서, 서브라운드가 바뀔 때마다(=새 제시어가 나올 때마다) 선택 상태를 초기화한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 telepathy:roundStart 신호다 — 최초 시작과 재접속 시 재개 모두 이 신호로 전달된다.
 */
export function useTelepathyRound(socket: PartySocket, roundKey: string, startSignal: TelepathyStartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  // 제출 전에는 눌러서 바꿀 수 있는 "임시 선택", 제출 후에는 확정된 선택
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  // 전원 선택 공개 — 서브라운드가 끝나고 다음 서브라운드가 시작되기 전까지만 보여준다
  const [reveal, setReveal] = useState<TelepathySubRoundResult | null>(null)

  const subRoundKey = `${roundKey}-${startSignal?.subRoundIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(subRoundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
    setSelectedCardId(null)
    setReveal(null)
  }, [subRoundKey])

  // 재접속으로 같은 서브라운드 신호가 다시 와도(중복 startSignal) 위 리셋은 건너뛰고 running으로만 전환한다.
  // 서버가 이미 받은 선택(myCardId)이 있으면 제출 완료 상태로 복원한다
  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    if (startSignal.myCardId !== null) {
      setSelectedCardId(startSignal.myCardId)
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
    const onResult = (data: TelepathySubRoundResult) => {
      if (data.subRoundIndex !== startSignal?.subRoundIndex) return
      setReveal(data)
    }
    socket.on('telepathy:subRoundResult', onResult)
    return () => {
      socket.off('telepathy:subRoundResult', onResult)
    }
  }, [socket, startSignal])

  const select = useCallback(
    (cardId: number) => {
      if (status !== 'running') return
      setSelectedCardId(cardId)
    },
    [status],
  )

  const submit = useCallback(() => {
    if (status !== 'running' || selectedCardId === null) return
    socket.emit('telepathy:submit', { cardId: selectedCardId })
    setStatus('submitted')
  }, [socket, status, selectedCardId])

  // 마감 직전엔 카드를 골라만 놓고 확정 버튼을 안 눌렀어도 마지막 선택을 자동 제출한다.
  // 아무것도 고르지 않았다면 submit()이 아무 것도 하지 않으므로 그대로 미제출(0점) 처리된다
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  useEffect(() => {
    if (startedAt === null) return
    const delayMs = TELEPATHY_SUB_ROUND_MS - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return { status, selectedCardId, reveal, startedAt, select, submit }
}
