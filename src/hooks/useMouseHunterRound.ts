import { useCallback, useEffect, useState } from 'react'
import { MOUSE_HUNTER_ROOMS } from '../lib/mouseHunterRooms'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type Status = 'waiting' | 'active'
type StartSignal = { elapsedMs: number }

const LAST_ROOM_INDEX = MOUSE_HUNTER_ROOMS.length - 1

// 방 이동은 채점과 무관한 순수 클라이언트 상태라 서버 왕복 없이 로컬에서만 처리한다 (그래서 다른 라운드용
// 훅들과 달리 소켓을 받지 않는다 — 쥐 찾기 판정이 생기는 다음 단계에서 필요해지면 그때 추가한다)
export function useMouseHunterRound(roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<Status>('waiting')
  const [roomIndex, setRoomIndex] = useState(0)
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status === 'waiting' ? 'waiting' : 'running')

  useEffect(() => {
    setStatus('waiting')
    setRoomIndex(0)
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status !== 'waiting') return
    setStatus('active')
  }, [startSignal, status])

  const goPrev = useCallback(() => {
    setRoomIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const goNext = useCallback(() => {
    setRoomIndex((prev) => Math.min(LAST_ROOM_INDEX, prev + 1))
  }, [])

  return {
    status,
    roomIndex,
    canGoPrev: roomIndex > 0,
    canGoNext: roomIndex < LAST_ROOM_INDEX,
    goPrev,
    goNext,
    startedAt,
  }
}
