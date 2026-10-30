import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 다른 글자 찾기 (party/games/findOdd) — 서버 types.ts와 모양이 같아야 한다

/** 한 사람의 한 라운드 결과 */
export interface FindOddPlayerResult {
  playerId: PlayerId
  /** 정답을 찾는 데 걸린 시간 (못 찾았으면 null) */
  foundMs: number | null
  points: number
}

/** 라운드가 끝났을 때 전원에게 공개하는 결과 */
export interface FindOddRoundResult {
  roundIndex: number
  answerIndex: number
  results: FindOddPlayerResult[]
  /** 이 라운드까지의 사람별 합산 점수 */
  totals: Record<PlayerId, number>
}

export interface FindOddRoundSignal {
  roundIndex: number
  totalRounds: number
  /** 한 줄의 칸 수 (정사각형 판) */
  cols: number
  cells: string[]
  elapsedMs: number
  foundIds: PlayerId[]
  /** 재접속 시에만: 내가 이미 찾았는지 / 틀려서 아직 누를 수 없는 남은 시간 */
  mine?: { found: boolean; lockRemainingMs: number }
  /** 재접속 시에만: 결과를 공개하는 중이었다면 그 결과 */
  reveal: FindOddRoundResult | null
  totals: Record<PlayerId, number>
}

export interface FindOddRoundMeta {
  rounds: FindOddRoundResult[]
}

// 한 라운드의 제한 시간 (backend/party/games/findOdd/types.ts와 값이 같아야 한다)
export const FIND_ODD_ROUND_MS = 15_000
