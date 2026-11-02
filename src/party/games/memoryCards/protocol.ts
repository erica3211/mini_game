import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 카드 짝 맞추기 (party/games/memoryCards/team.ts) — 서버 types.ts와 모양이 같아야 한다

/** 이번 턴이 어떻게 끝났는지 — 직전 턴의 결과를 알려 주는 용도 */
export type MemoryLastResult = 'match' | 'miss' | 'timeout' | null

export interface MemoryStateSignal {
  /** 카드마다 그림 (뒤집혀 있지 않고 짝도 못 찾은 카드는 null) */
  cards: (string | null)[]
  /** 카드마다 짝을 찾은 팀 (아직이면 null) */
  matchedBy: (number | null)[]
  /** 지금 뒤집혀 있는 카드 번호들 */
  faceUp: number[]
  turnNumber: number
  turnTeamId: number
  flipperId: PlayerId
  canFlip: boolean
  turnMs: number
  elapsedMs: number
  scores: Record<number, number>
  totalPairs: number
  columns: number
  lastResult: MemoryLastResult
  ended: boolean
}

export interface MemoryRoundMeta {
  scores: Record<number, number>
  totalPairs: number
}
