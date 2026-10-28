import { useEffect, useState } from 'react'
import type { SimonTiming } from './protocol'
import { boundariesMs, inputOpensOffsetMs, phaseAt, type SimonPlaybackState } from './simonRules'

const INTRO: SimonPlaybackState = { phase: 'intro', litIndex: null, shownCount: 0 }

/**
 * startedAt(performance.now() 기준 단계 시작 시각)을 기준으로 점멸을 재생한다.
 * 구간이 바뀌는 순간마다 타이머를 걸고, 그때마다 경과 시간에서 현재 상태를 다시 계산한다 — 타이머가 늦게 불려도 상태가 어긋나지 않는다.
 * 소켓은 모른다: 시작 시각과 시퀀스 길이/시간표만 받는 순수 재생 훅이다.
 */
export function useSimonPlayback(startedAt: number | null, length: number, timing: SimonTiming | null): SimonPlaybackState {
  const [playback, setPlayback] = useState<SimonPlaybackState>(INTRO)

  useEffect(() => {
    if (startedAt === null || timing === null) {
      setPlayback(INTRO)
      return
    }
    const sync = () => {
      const next = phaseAt(performance.now() - startedAt, length, timing)
      setPlayback((prev) => (prev.phase === next.phase && prev.litIndex === next.litIndex && prev.shownCount === next.shownCount ? prev : next))
    }
    sync()
    const elapsed = performance.now() - startedAt
    const timers = [...boundariesMs(length, timing), inputOpensOffsetMs(length, timing)]
      .filter((at) => at > elapsed)
      // 경계 직후(+1ms)에 동기화해서 floor 계산이 직전 구간으로 떨어지지 않게 한다
      .map((at) => window.setTimeout(sync, at - elapsed + 1))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [startedAt, length, timing])

  return playback
}
