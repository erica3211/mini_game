import type { SimonTiming } from './protocol'

export type SimonPhase = 'intro' | 'flash' | 'input'

// 마지막 점멸이 꺼지는(= 입력이 열리는) 시점까지의 단계 시작 기준 시간 — 서버 party/games/simon/engine.ts의 inputOpensOffsetMs와 같은 식이어야 한다
export function inputOpensOffsetMs(length: number, timing: SimonTiming): number {
  return timing.introMs + (length - 1) * (timing.flashMs + timing.gapMs) + timing.flashMs
}

export interface SimonPlaybackState {
  phase: SimonPhase
  /** 지금 켜져 있는 항목의 번호 (꺼져 있는 틈이면 null) */
  litIndex: number | null
  /** 지금까지 한 번이라도 켜진 항목 수 — 점멸 중에 입력 칸을 앞에서부터 이만큼 채워 보여준다. 점멸이 끝나(입력이 열려) 순서가 사라지면 0 */
  shownCount: number
}

/** 단계 시작 후 경과 시간만으로 지금 화면이 어떤 구간인지, 켜져 있는 항목이 몇 번째인지 계산한다.
 *  새로고침으로 점멸 도중에 합류해도 이 계산 하나로 현재 위치가 복원된다 */
export function phaseAt(elapsedMs: number, length: number, timing: SimonTiming): SimonPlaybackState {
  if (elapsedMs < timing.introMs) return { phase: 'intro', litIndex: null, shownCount: 0 }
  if (elapsedMs >= inputOpensOffsetMs(length, timing)) return { phase: 'input', litIndex: null, shownCount: 0 }
  const step = timing.flashMs + timing.gapMs
  const sinceFirst = elapsedMs - timing.introMs
  const index = Math.floor(sinceFirst / step)
  const lit = sinceFirst - index * step < timing.flashMs
  return { phase: 'flash', litIndex: lit ? index : null, shownCount: index + 1 }
}

/** 구간이 바뀌는 시점들(단계 시작 기준): 각 항목이 켜지고 꺼지는 순간과 입력이 열리는 순간 */
export function boundariesMs(length: number, timing: SimonTiming): number[] {
  const step = timing.flashMs + timing.gapMs
  const points: number[] = []
  for (let i = 0; i < length; i++) {
    points.push(timing.introMs + i * step, timing.introMs + i * step + timing.flashMs)
  }
  return points
}
