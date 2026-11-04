import type { PlayerId } from '../../../shared/lib/partyProtocol'
import type { MazeData, MazePoint } from '../mazeEscape/protocol'

// 구슬 탈출(개인전) (party/games/marbleMaze/index.ts) — 서버 types.ts와 모양이 같아야 한다. 미로는 팀전 미로 탈출과 같은 모양(MazeData)이다

/** 구슬 미로 — 모든 사람이 같은 것을 받는다 */
export interface MarbleMazeData {
  maze: MazeData
  /** 함정 구멍이 있는 칸 (칸의 한가운데) — 정답 길 밖에만 있다 */
  holes: MazePoint[]
  /** 길목 구멍 — 정답 길의 곧은 칸 (x, y) 한가운데에서 (dx, dy)타일 벽 쪽으로 치우친 곳. 반대쪽 벽에 붙어서 지나가야 한다 */
  edgeHoles: { x: number; y: number; dx: number; dy: number }[]
  /** 칸마다 출구까지 가는 칸 수 (칸 번호 = y × width + x) */
  distance: number[]
  pathLength: number
}

export interface MarbleStateSignal {
  phase: 'prep' | 'run'
  maze: MarbleMazeData
  durationMs: number
  /** 달리기가 시작된 뒤 흐른 시간 — 카운트다운 중에는 음수(-3000 → 0) */
  elapsedMs: number
  readyIds: PlayerId[]
  prepEndsInMs: number
}

/** 모두의 진행 — progress는 지금 위치 기준이다(구멍에 빠지면 0으로 돌아간다) */
export interface MarbleProgressSignal {
  players: { playerId: PlayerId; progress: number; falls: number; finishedMs: number | null }[]
}

export interface MarbleEndSignal {
  players: { playerId: PlayerId; finishedMs: number | null; progress: number; falls: number; rank: number }[]
}

export interface MarbleRoundMeta {
  end: MarbleEndSignal
}

/** 걸린 시간을 "12.3초" / "1분 5초"처럼 */
export function formatMarbleTime(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}초`
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}분 ${total % 60}초`
}
