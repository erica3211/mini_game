import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 분리수거 대작전 (party/games/recycling/team.ts) — 서버 types.ts와 모양이 같아야 한다

/** 떨어지는 쓰레기 하나 — 모든 팀이 같은 목록을 받는다 */
export interface RecyclingItem {
  id: number
  kind: number
  variant: number
  lane: number
  spawnMs: number
  fallMs: number
}

export interface RecyclingRole {
  playerId: PlayerId
  kinds: number[]
}

export type RecyclingItemState = 'done' | 'missed'

export interface RecyclingStartSignal {
  durationMs: number
  elapsedMs: number
  items: RecyclingItem[]
  roles: RecyclingRole[]
  states: Record<number, RecyclingItemState>
  scores: Record<number, number>
}

export interface RecyclingEventSignal {
  itemId: number
  kind: 'done' | 'wrong' | 'missed'
  playerId?: PlayerId
  score: number
}

export interface RecyclingProgressSignal {
  scores: Record<number, number>
}

export interface RecyclingEndSignal {
  teams: { teamId: number; score: number; done: number; wrong: number; missed: number; rank: number }[]
  players: { playerId: PlayerId; done: number; wrong: number }[]
}

export interface RecyclingRoundMeta {
  end: RecyclingEndSignal
}

/** 서버의 RECYCLING_LANES와 같아야 한다 */
export const RECYCLING_LANES = 4

/** 쓰레기 종류 — 이름·그림·테두리 색. 서버의 종류 번호(0~3)와 순서가 같다 */
export const RECYCLING_KINDS: { name: string; emojis: string[]; color: string }[] = [
  { name: '음식물', emojis: ['🍌', '🍎', '🍕'], color: '#f97316' },
  { name: '병', emojis: ['🍾', '🫙', '🍶'], color: '#0ea5e9' },
  { name: '종이', emojis: ['📰', '📦', '📄'], color: '#ca8a04' },
  { name: '플라스틱', emojis: ['🧴', '🍼', '🥤'], color: '#a855f7' },
]

export const recyclingEmoji = (item: Pick<RecyclingItem, 'kind' | 'variant'>): string => {
  const kind = RECYCLING_KINDS[item.kind]
  return kind.emojis[item.variant % kind.emojis.length]
}
