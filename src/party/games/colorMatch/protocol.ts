import type { PlayerId, RgbColor } from '../../../shared/lib/partyProtocol'

// 절대색감: 한 라운드(게임 슬롯) 안에서 진행하는 세부 라운드 3개 각각의 결과
export interface ColorMatchSubRoundResult {
  subRoundIndex: number
  answerColor: RgbColor
  /** 전원 공개용 — 참가자별로 이번 세부 라운드에서 고른 색과 일치율 */
  picks: Record<PlayerId, { color: RgbColor; matchPercent: number }>
}

export interface ColorMatchRoundMeta {
  subRounds: ColorMatchSubRoundResult[]
}
export const COLOR_MATCH_SUB_ROUNDS = 3
export const COLOR_MATCH_SUB_ROUND_MS = 5_000
export const COLOR_MATCH_REVEAL_MS = 3_000
