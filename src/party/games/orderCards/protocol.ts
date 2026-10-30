import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 순서 맞추기 (party/games/orderCards/team.ts) — 서버 types.ts와 모양이 같아야 한다

/** 팀의 지금 상태 — playing: 라운드 진행 중, between: 결과를 보여주는 중, done: 모든 라운드를 마쳤다, out: 목숨이 다 떨어졌다 */
export type OrderCardsPhase = 'playing' | 'between' | 'done' | 'out'

export interface OrderCardsPlayed {
  playerId: PlayerId
  card: number
  /** 더 큰 카드가 먼저 나가서 어쩔 수 없이 버려진 카드 */
  discarded?: boolean
}

export interface OrderCardsRoundResult {
  round: number
  cleared: boolean
  timedOut: boolean
  mistakes: number
}

/** 내가 받는 팀 상태 (내 카드만 담긴다) */
export interface OrderCardsStateSignal {
  round: number
  totalRounds: number
  phase: OrderCardsPhase
  hand: number[]
  played: OrderCardsPlayed[]
  handCounts: Record<PlayerId, number>
  lives: number
  maxLives: number
  roundMs: number
  elapsedMs: number
  roundResult: OrderCardsRoundResult | null
}

export interface OrderCardsStanding {
  teamId: number
  round: number
  lives: number
  clearedRounds: number
  phase: OrderCardsPhase
}

export interface OrderCardsStandingsSignal {
  standings: OrderCardsStanding[]
}

export interface OrderCardsTeamRecord {
  teamId: number
  clearedRounds: number
  lives: number
  finishedMs: number
  phase: 'done' | 'out'
  rounds: OrderCardsRoundResult[]
}

export interface OrderCardsEndSignal {
  teams: OrderCardsTeamRecord[]
}

export interface OrderCardsRoundMeta {
  teams: OrderCardsTeamRecord[]
}
