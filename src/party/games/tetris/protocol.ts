import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 테트리스 팀전 (party/games/tetris/team.ts) — 서버 types.ts와 모양이 같아야 한다

export const TETRIS_COLS = 10
export const TETRIS_ROWS = 20

// down은 "빠르게 내리기를 누르고 있다"는 신호(누르는 동안 계속 보낸다), stop은 "손을 뗐다"
export type TetrisAction = 'left' | 'right' | 'rotate' | 'down' | 'stop'
export type TetrisRole = 'move' | 'left' | 'right' | 'rotate' | 'spin' | 'down' | 'all'

export interface TetrisAssignment {
  playerId: PlayerId
  role: TetrisRole
}

export interface TetrisActive {
  piece: number
  rot: number
  x: number
  y: number
}

export interface TetrisStateSignal {
  durationMs: number
  elapsedMs: number
  board: string[]
  /** 줄이 가득 차서 깜박이는 중이면 그 줄들 (이때는 내려오는 블록이 없다) */
  clearing: number[]
  active: TetrisActive | null
  next: number[]
  score: number
  lines: number
  roles: TetrisAssignment[]
  topouts: number
}

export interface TetrisProgressSignal {
  scores: Record<number, number>
  boards: Record<number, string[]>
}

export interface TetrisEndSignal {
  teams: { teamId: number; score: number; lines: number; topouts: number; rank: number }[]
  players: { playerId: PlayerId; inputs: number }[]
}

export interface TetrisRoundMeta {
  end: TetrisEndSignal
}

/** 이 역할이 할 수 있는 조작 */
export function roleAllows(role: TetrisRole, action: TetrisAction): boolean {
  const can = action === 'stop' ? 'down' : action
  if (role === 'all' || role === can) return true
  if (role === 'move') return can === 'left' || can === 'right'
  return role === 'spin' && (can === 'rotate' || can === 'down')
}

export const TETRIS_ROLE_LABEL: Record<TetrisRole, string> = {
  move: '◀ ▶ 이동',
  left: '◀ 왼쪽',
  right: '▶ 오른쪽',
  rotate: '⟳ 회전',
  spin: '⟳ 회전 · ▼ 빠르게',
  down: '▼ 빠르게 내리기',
  all: '전부 혼자',
}

export const TETRIS_ACTION_LABEL: Record<TetrisAction, string> = {
  left: '◀',
  right: '▶',
  rotate: '⟳',
  down: '▼',
  stop: ''
}
