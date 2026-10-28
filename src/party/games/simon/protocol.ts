import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 기억력 시퀀스 (party/games/simon/index.ts 참고): 단계마다 랜덤으로 뽑히는 입력 방식
export const SIMON_INPUT_TYPE_IDS = ['color', 'arrow', 'emoji', 'grid', 'piano'] as const
export type SimonInputTypeId = (typeof SIMON_INPUT_TYPE_IDS)[number]

export interface SimonTiming {
  introMs: number
  flashMs: number
  gapMs: number
  inputMs: number
}

export interface SimonPlayerStageResult {
  answer: string[] | null
  correct: number
  wrong: number
  accuracyScore: number
  speedBonus: number
  score: number
  elapsedMs: number | null
}

export interface SimonStageResult {
  stageIndex: number
  inputType: SimonInputTypeId
  groupLabel: string | null
  alphabet: string[]
  sequence: string[]
  players: Record<PlayerId, SimonPlayerStageResult>
}

export interface SimonRoundMeta {
  stages: SimonStageResult[]
}

export interface SimonStartSignal {
  stageIndex: number
  inputType: SimonInputTypeId
  groupLabel: string | null
  alphabet: string[]
  sequence: string[]
  timing: SimonTiming
  elapsedMs: number
  myAnswer: string[] | null
  reveal: SimonStageResult | null
}

// 기억력 시퀀스: 한 라운드 안의 단계 수 (backend/types.ts와 값이 같아야 한다). 시간표는 단계 시작 신호(timing)로 받는다
export const SIMON_STAGES = 3
