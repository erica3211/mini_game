import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 타워쌓기 팀전 (party/games/towerStack/team.ts) — 서버 types.ts와 모양이 같아야 한다

/** 세계 크기(px) — 서버와 같다. 가운데가 x=0, 받침대 윗면이 y=0이고 위로 갈수록 y가 작아진다 */
export const TOWER_CELL = 30
export const TOWER_PLATFORM_CELLS = 6
export const TOWER_PX_PER_CM = 3
/** 화면에 보이는 세계의 너비·높이 */
export const TOWER_VIEW_W = 400
export const TOWER_VIEW_H = 520
/** 저절로 떨어지기까지 남은 시간이 이만큼 이하면 주황색, 더 줄면 빨간색으로 흔들린다 (초) */
export const TOWER_DROP_WARN_S = 5
export const TOWER_DROP_DANGER_S = 3

/** 점수를 매기는 방식 — height: 끝난 순간의 탑 높이(타워쌓기) / count: 탑에 남아 있는 블록 수(타워쌓기2) */
export type TowerMode = 'height' | 'count'

export type TowerAction = 'left' | 'right' | 'stopLeft' | 'stopRight' | 'rotate' | 'drop'
export type TowerRole = 'move' | 'left' | 'right' | 'rotate' | 'spin' | 'drop' | 'all'

export interface TowerAssignment {
  playerId: PlayerId
  role: TowerRole
}

/** [번호, 종류 1~7, x, y, 각도(라디안)] */
export type TowerBodySignal = [number, number, number, number, number]

export interface TowerHover {
  kind: number
  x: number
  y: number
  rot: number
  /** 이 신호를 받은 때부터 저절로 떨어질 때까지 남은 시간(ms) */
  dropInMs: number
}

export interface TowerStateSignal {
  mode: TowerMode
  durationMs: number
  elapsedMs: number
  bodies: TowerBodySignal[]
  hover: TowerHover | null
  next: number[]
  /** 기회를 다 써서 끝나기까지 남은 시간(ms) — 이 신호를 받은 때 기준. 카운트다운 중이 아니면 null */
  endsInMs: number | null
  /** 팀마다 받는 블록 수(0이면 제한 없음)와 지금까지 떨어뜨린 블록 수, 탑에 남아 있는 블록 수 */
  maxBlocks: number
  dropped: number
  placed: number
  height: number
  chances: number
  falls: number
  over: boolean
  roles: TowerAssignment[]
}

export interface TowerProgressSignal {
  scores: Record<number, number>
  chances: Record<number, number>
}

export interface TowerEndSignal {
  mode: TowerMode
  /** score는 끝난 시점의 점수(height: 탑 높이 cm, count: 탑에 남은 블록 수), height는 그때의 탑 높이(cm) */
  teams: { teamId: number; score: number; height: number; chances: number; falls: number; rank: number; bodies: TowerBodySignal[] }[]
  players: { playerId: PlayerId; inputs: number }[]
}

export interface TowerRoundMeta {
  end: TowerEndSignal
}

/** 이 역할이 할 수 있는 조작 */
export function roleAllows(role: TowerRole, action: TowerAction): boolean {
  const can = action === 'stopLeft' ? 'left' : action === 'stopRight' ? 'right' : action
  if (role === 'all' || role === can) return true
  if (role === 'move') return can === 'left' || can === 'right'
  return role === 'spin' && (can === 'rotate' || can === 'drop')
}

export const TOWER_ROLE_LABEL: Record<TowerRole, string> = {
  move: '◀ ▶ 이동',
  left: '◀ 왼쪽',
  right: '▶ 오른쪽',
  rotate: '⟳ 돌리기',
  spin: '⟳ 돌리기 · ⬇ 떨어뜨리기',
  drop: '⬇ 떨어뜨리기',
  all: '전부 혼자',
}

/** 블록 모양(칸 좌표) — 서버 physics.ts와 같다. 인덱스는 종류 1~7 (I O T S Z J L) */
export const TOWER_SHAPES: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0], [1, 0], [2, 0], [3, 0]],
  2: [[0, 0], [1, 0], [0, 1], [1, 1]],
  3: [[1, 0], [0, 1], [1, 1], [2, 1]],
  4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [1, 1], [2, 1]],
  6: [[0, 0], [0, 1], [1, 1], [2, 1]],
  7: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

/** 블록 색 — 종류 1~7 */
export const TOWER_COLORS: Record<number, string> = {
  1: '#5ec8e0',
  2: '#f3d34a',
  3: '#b783e0',
  4: '#6cc96f',
  5: '#ee6f6f',
  6: '#5b8def',
  7: '#f0993f',
}

/** 블록의 칸들을 무게중심이 (0, 0)이 되게 옮긴 칸 중심 좌표(px) — 서버가 블록을 만드는 방식과 같다 */
export function towerCellCenters(kind: number): [number, number][] {
  const cells = TOWER_SHAPES[kind]
  const cx = cells.reduce((sum, [c]) => sum + c + 0.5, 0) / cells.length
  const cy = cells.reduce((sum, [, r]) => sum + r + 0.5, 0) / cells.length
  return cells.map(([c, r]) => [(c + 0.5 - cx) * TOWER_CELL, (r + 0.5 - cy) * TOWER_CELL])
}
