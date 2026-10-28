import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 소수의견: 양자택일의 한쪽 — id는 제시어 데이터의 options 인덱스라 사람마다 표시 순서가 달라도 같은 쪽을 가리킨다
export interface MinorityOption {
  id: 0 | 1
  label: string
}

// 소수의견: 서브라운드 하나가 끝났을 때 전원에게 공개하는 참가자별 선택과 점수 (party/games/minority/index.ts 참고)
export interface MinoritySubRoundResult {
  subRoundIndex: number
  options: MinorityOption[]
  picks: Record<PlayerId, { choice: 0 | 1 | null; score: number }>
  /** 소수 쪽 (동수이거나 한쪽에 몰렸으면 null — 이 경우 모두 0점) */
  minoritySide: 0 | 1 | null
}

export interface MinorityRoundMeta {
  subRounds: MinoritySubRoundResult[]
}

export interface MinorityStartSignal {
  subRoundIndex: number
  options: MinorityOption[]
  myChoice: 0 | 1 | null
  elapsedMs: number
  /** 재접속 시에만 채워지는 값 — 결과를 공개하는 중이었다면 그 결과 */
  reveal?: MinoritySubRoundResult | null
}

// 소수의견: 서브라운드 개수 / 서브라운드 하나의 제한 시간 (backend/types.ts와 값이 같아야 한다)
export const MINORITY_SUB_ROUNDS = 5
export const MINORITY_SUB_ROUND_MS = 10_000
