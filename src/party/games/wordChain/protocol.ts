import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 초성 퀴즈: 정답 공개 + 플레이어별 입력 기록(입력 순서대로, 맞혔다면 마지막이 정답). guesses는 이전 버전 라운드엔 없을 수 있다
export interface WordChainRoundMeta {
  word: string
  category: string
  definition: string
  guesses?: Record<PlayerId, string[]>
}
export const WORD_CHAIN_ROUND_TIMEOUT_MS = 60_000
// 고른 카테고리의 문제 후보가 이보다 적으면 파티를 시작할 수 없다 (같은 문제 반복 방지, 서버와 같은 값)
export const WORD_CHAIN_MIN_CANDIDATES = 20
export const WORD_CHAIN_CATEGORY_REVEAL_MS = 10_000
export const WORD_CHAIN_DEFINITION_REVEAL_MS = 20_000
