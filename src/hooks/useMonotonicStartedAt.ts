import { useEffect, useState } from 'react'

/** 'submitted'(제출 완료)와 'finished'(시간 종료)는 둘 다 "더 이상 시작 시각을 갱신하지 않는" 종료 상태다 */
type RoundStatus = 'waiting' | 'running' | 'submitted' | 'finished'

/**
 * 라운드 시작 시각(performance.now() 기준)을 계산해서 들고 있는 훅.
 * roundKey가 바뀌면(=새 라운드) 초기화하고, startSignal이 도착하면 그 시각을 계산해 반영한다.
 * 이미 알고 있는 시작 시각보다 "더 늦게 시작한 것"으로는 절대 되돌리지 않는다 — 경과 시간은 항상 늘어나기만 해야 한다
 * (백그라운드 탭에서 돌아왔을 때의 재동기화 신호가 최초 시작 신호보다 늦게 도착하는 경우 등을 방지)
 */
export function useMonotonicStartedAt(
  roundKey: string,
  startSignal: { elapsedMs: number } | null,
  status: RoundStatus,
): number | null {
  const [startedAt, setStartedAt] = useState<number | null>(null)

  useEffect(() => {
    setStartedAt(null)
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted' || status === 'finished') return
    const candidate = performance.now() - startSignal.elapsedMs
    setStartedAt((prev) => (prev !== null && candidate > prev ? prev : candidate))
  }, [startSignal, status])

  return startedAt
}
