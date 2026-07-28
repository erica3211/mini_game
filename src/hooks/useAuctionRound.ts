import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  AUCTION_ITEM_IDS,
  AUCTION_ROUND_TIMEOUT_MS,
  type AuctionItemId,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { budget: number; hint: { itemId: AuctionItemId; text: string }; elapsedMs: number }

const ZERO_BIDS: Record<AuctionItemId, number> = { A: 0, B: 0, C: 0, D: 0 }
// 서버가 실제로 타임아웃 처리하기 전에 여유를 두고 먼저 자동 제출해서, 네트워크 지연으로
// 서버 마감 이후에 도착해 미제출(DNF) 처리되는 일이 없도록 한다
const AUTO_SUBMIT_MARGIN_MS = 800

/**
 * roundKey가 바뀌면(=새 라운드) 로컬 상태를 리셋한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 auction:roundStart 신호다 —
 * 최초 시작과 재접속 시 재개 모두 이 신호로 전달되며, 서버가 배정한 개인 힌트를 그대로 반영한다.
 */
export function useAuctionRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [budget, setBudget] = useState(0)
  const [hint, setHint] = useState<{ itemId: AuctionItemId; text: string } | null>(null)
  const [bids, setBids] = useState<Record<AuctionItemId, number>>(ZERO_BIDS)
  const [rejection, setRejection] = useState<string | null>(null)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
    setBudget(0)
    setHint(null)
    setBids(ZERO_BIDS)
    setRejection(null)
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setBudget(startSignal.budget)
    setHint(startSignal.hint)
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    const onRejected = ({ reason }: { reason: string }) => {
      setRejection(reason)
      setStatus('running')
    }
    socket.on('auction:submitRejected', onRejected)
    return () => {
      socket.off('auction:submitRejected', onRejected)
    }
  }, [socket])

  const spent = AUCTION_ITEM_IDS.reduce((sum, id) => sum + bids[id], 0)
  const remaining = budget - spent

  // 다른 물품에 이미 배정된 금액을 넘지 않도록, 이 물품에 넣을 수 있는 최대치로 자동으로 눌러준다
  const setBid = useCallback(
    (itemId: AuctionItemId, amount: number) => {
      if (status !== 'running') return
      setRejection(null)
      setBids((prev) => {
        const spentOnOthers = AUCTION_ITEM_IDS.filter((id) => id !== itemId).reduce((sum, id) => sum + prev[id], 0)
        const capped = Math.min(Math.max(0, Math.floor(amount)), Math.max(0, budget - spentOnOthers))
        return { ...prev, [itemId]: capped }
      })
    },
    [status, budget],
  )

  const submit = useCallback(() => {
    if (status !== 'running') return
    socket.emit('auction:submit', { bids })
    setStatus('submitted')
  }, [socket, status, bids])

  // 베팅 확정을 누르지 않고 시간이 다 돼도, 마지막으로 조절해둔 금액 그대로 자동 제출한다
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  useEffect(() => {
    if (startedAt === null) return
    const delayMs = AUCTION_ROUND_TIMEOUT_MS - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return { status, budget, hint, bids, setBid, spent, remaining, submit, rejection, startedAt }
}
