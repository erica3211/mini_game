import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, MouseHunterMouse, PlayerId, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running'
type StartSignal = { mice: MouseHunterMouse[]; caughtCount: number; elapsedMs: number }

const TOAST_DURATION_MS = 1500
// 여러 명이 짧은 시간에 몰아서 잡으면 토스트가 화면을 가릴 만큼 쌓일 수 있어서, 동시에 보이는 개수를 제한한다 —
// 넘치면 가장 오래된 것부터 밀어내고 최신 소식만 남긴다
const MAX_VISIBLE_TOASTS = 4

export interface CatchToast {
  id: number
  playerId: PlayerId
  totalCaught: number
}

/**
 * 계속 쥐가 리필되는 연속 동작이라 "제출 완료" 상태가 없다 — status는 waiting/running뿐이고
 * 라운드가 끝나는 건(round_results로의 phase 전환) 언제나 30초 타임아웃뿐이다.
 */
export function useMouseHunterRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [mice, setMice] = useState<MouseHunterMouse[]>([])
  const [myTotalCaught, setMyTotalCaught] = useState(0)
  const [toasts, setToasts] = useState<CatchToast[]>([])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status === 'waiting' ? 'waiting' : 'running')

  useEffect(() => {
    setStatus('waiting')
    setMice([])
    setMyTotalCaught(0)
    setToasts([])
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status !== 'waiting') return
    setMice(startSignal.mice)
    setMyTotalCaught(startSignal.caughtCount)
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    // mouseHunter:miceUpdate는 본인 전용 이벤트라, 이게 오면 그 자체가 "방금 내가 한 마리 잡았다"는 확인이다
    const onMiceUpdate = (data: { mice: MouseHunterMouse[] }) => {
      setMice(data.mice)
      setMyTotalCaught((prev) => prev + 1)
    }
    const onPlayerCaught = (data: { playerId: PlayerId; totalCaught: number }) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => {
        const next = [...prev, { id, playerId: data.playerId, totalCaught: data.totalCaught }]
        return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next
      })
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS)
    }
    socket.on('mouseHunter:miceUpdate', onMiceUpdate)
    socket.on('mouseHunter:playerCaught', onPlayerCaught)
    return () => {
      socket.off('mouseHunter:miceUpdate', onMiceUpdate)
      socket.off('mouseHunter:playerCaught', onPlayerCaught)
    }
  }, [socket])

  const tap = useCallback(
    (mouseId: string) => {
      if (status !== 'running') return
      socket.emit('mouseHunter:tap', { mouseId })
    },
    [socket, status],
  )

  return { status, mice, myTotalCaught, toasts, tap, startedAt }
}
