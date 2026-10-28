import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 텔레파시: 카드 한 장 — id는 제시어의 선택지 풀 안에서의 인덱스라 사람마다 카드 순서가 달라도 같은 카드를 가리킨다
export interface TelepathyCard {
  id: number
  label: string
}

// 텔레파시: 서브라운드 하나가 끝났을 때 전원에게 공개하는 참가자별 선택과 점수 (party/games/telepathy/index.ts 참고)
export interface TelepathySubRoundResult {
  subRoundIndex: number
  prompt: string
  cards: TelepathyCard[]
  picks: Record<PlayerId, { cardId: number | null; score: number }>
}

export interface TelepathyRoundMeta {
  subRounds: TelepathySubRoundResult[]
}

export interface TelepathyStartSignal {
  subRoundIndex: number
  prompt: string
  cards: TelepathyCard[]
  myCardId: number | null
  elapsedMs: number
  /** 재접속 시에만 채워지는 값 — 결과를 공개하는 중이었다면 그 결과 */
  reveal?: TelepathySubRoundResult | null
}

// 텔레파시: 서브라운드 개수 / 서브라운드 하나의 제한 시간 (backend/types.ts와 값이 같아야 한다)
export const TELEPATHY_SUB_ROUNDS = 3
export const TELEPATHY_SUB_ROUND_MS = 15_000
