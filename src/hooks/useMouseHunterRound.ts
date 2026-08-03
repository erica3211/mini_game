import { useEffect, useState } from 'react'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type Status = 'waiting' | 'active'
type StartSignal = { elapsedMs: number }

// 방 이동(스크롤 위치)은 채점과 무관한 순수 DOM 상태라 이 훅이 아니라 MouseHunterGame 컴포넌트가
// 직접 관리한다 (그래서 다른 라운드용 훅들과 달리 소켓을 받지 않는다 — 쥐 찾기 판정이 생기는 다음
// 단계에서 필요해지면 그때 추가한다)
export function useMouseHunterRound(roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<Status>('waiting')
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status === 'waiting' ? 'waiting' : 'running')

  useEffect(() => {
    setStatus('waiting')
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status !== 'waiting') return
    setStatus('active')
  }, [startSignal, status])

  return { status, startedAt }
}
