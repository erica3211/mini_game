import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 어둠 속 보물찾기(개인전) (party/games/darkTreasure/index.ts) — 서버 types.ts와 모양이 같아야 한다

export interface TreasurePoint {
  x: number
  y: number
}

/** 어두운 방 — 모든 사람이 같은 것을 받는다. 좌표는 타일 단위이고 왼쪽 위가 (0, 0)이다 */
export interface TreasureFieldData {
  /** 한 변의 타일 수 (가장자리 한 겹은 벽) */
  size: number
  start: TreasurePoint
  treasures: TreasurePoint[]
}

export interface TreasureStateSignal {
  phase: 'prep' | 'run'
  field: TreasureFieldData
  durationMs: number
  /** 달리기가 시작된 뒤 흐른 시간 — 카운트다운 중에는 음수(-3000 → 0) */
  elapsedMs: number
  readyIds: PlayerId[]
  prepEndsInMs: number
  /** 이 사람이 이미 찾은 보물 번호 — 재접속한 사람에게만 채워져 온다 */
  found: number[]
}

/** 모두의 진행 */
export interface TreasureProgressSignal {
  players: { playerId: PlayerId; found: number; finishedMs: number | null }[]
}

export interface TreasureEndSignal {
  total: number
  players: { playerId: PlayerId; finishedMs: number | null; found: number; rank: number }[]
}

/** 모두의 구슬 위치(타일 좌표)와 찾은 보물 번호 — 먼저 끝난 사람이 다른 사람의 화면을 구경할 때 쓴다 */
export interface TreasurePositionsSignal {
  players: { playerId: PlayerId; x: number; y: number; found: number[] }[]
}

export interface TreasureRoundMeta {
  end: TreasureEndSignal
}
