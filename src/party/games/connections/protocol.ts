import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 커넥션스(개인전) (party/games/connections/index.ts) — 서버 types.ts와 모양이 같아야 한다

/** 판은 5×5 — 한 그룹의 단어 수이자 그룹 수 */
export const CONNECTIONS_GROUP_SIZE = 5
export const CONNECTIONS_GROUP_COUNT = 5
/** 틀릴 때마다 기록에 더해지는 시간(초) — 서버와 같다 */
export const CONNECTIONS_WRONG_PENALTY_S = 5

export interface ConnectionsSolvedGroup {
  /** 그룹 번호 — 0이 가장 쉽고 4가 가장 어렵다 (색깔이 정해진다) */
  group: number
  title: string
  cells: number[]
}

export interface ConnectionsNotice {
  seq: number
  kind: 'right' | 'wrong'
  best?: number
}

export interface ConnectionsStateSignal {
  puzzleId: string
  durationMs: number
  elapsedMs: number
  words: string[]
  solved: ConnectionsSolvedGroup[]
  wrongs: number
  finishedMs: number | null
  notice: ConnectionsNotice | null
}

export interface ConnectionsProgressSignal {
  players: { playerId: PlayerId; solved: number; wrongs: number; finishedMs: number | null }[]
}

export interface ConnectionsEndSignal {
  puzzleId: string
  answer: { group: number; title: string; words: string[] }[]
  players: { playerId: PlayerId; solved: number; wrongs: number; finishedMs: number | null; timeMs: number | null; rank: number }[]
}

export interface ConnectionsRoundMeta {
  end: ConnectionsEndSignal
}

/** 걸린 시간을 "2분 31초"처럼 — 1분이 안 되면 순위가 가려지도록 소수점 한 자리까지 */
export function formatConnectionsTime(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}초`
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}분 ${total % 60}초`
}
