import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 미로 탈출 (party/games/mazeEscape/team.ts 참고) — 서버 types.ts와 모양이 같아야 한다

export type MazeDirection = 'up' | 'down' | 'left' | 'right'

export interface MazePoint {
  x: number
  y: number
}

/** cells[y * width + x]는 그 칸에서 뚫려 있는 방향의 비트 합이다 (MAZE_OPEN 참고) */
export interface MazeData {
  width: number
  height: number
  cells: number[]
  start: MazePoint
  exit: MazePoint
}

export type MazePhase = 'run' | 'ended'

export interface MazeStartSignal {
  maze: MazeData
  phase: MazePhase
  phaseElapsedMs: number
  teamId: number
  /** 내가 지금 움직일 수 있는 방향 (자리를 비운 팀원의 몫을 넘겨받은 것 포함) */
  myDirections: MazeDirection[]
  /** 우리 팀원마다 처음에 배정된 담당 방향 */
  roles: Record<PlayerId, MazeDirection[]>
  absentIds: PlayerId[]
  pos: MazePoint
  visited: number[]
  progress: Record<number, number>
  finished: Record<number, number>
}

export interface MazeProgressSignal {
  progress: Record<number, number>
  finished: Record<number, number>
}

/** 탈출을 끝낸 뒤에만 오는 다른 팀의 위치와 지나온 길 (구경용) */
export interface MazeWatchSignal {
  teams: { teamId: number; pos: MazePoint; visited: number[] }[]
}

export interface MazeEndSignal {
  teams: { teamId: number; finishedMs: number | null; progress: number; steps: number }[]
}

export type MazeRoundMeta = MazeEndSignal

// 서버 types.ts와 값이 같아야 한다
export const MAZE_RUN_MS = 120_000
/** 버튼을 꾹 누르고 있을 때 이동 신호를 보내는 간격 — 서버의 팀 쿨다운(90ms)보다 약간 길게 잡아 거절되는 신호를 줄인다 */
export const MAZE_REPEAT_MS = 110

/** 칸에서 뚫려 있는 방향을 나타내는 비트 */
export const MAZE_OPEN: Record<MazeDirection, number> = { up: 1, right: 2, down: 4, left: 8 }
export const MAZE_DIRECTION_LABEL: Record<MazeDirection, string> = { up: '위', down: '아래', left: '왼쪽', right: '오른쪽' }
export const MAZE_DIRECTION_ARROW: Record<MazeDirection, string> = { up: '⬆', down: '⬇', left: '⬅', right: '➡' }

/** 화면이 들고 있는 미로 탈출 상태 — 서버가 보내는 여러 신호를 useGameSession이 세션 내내 받아 하나로 합쳐 둔다 */
export interface MazeViewState {
  start: MazeStartSignal | null
  pos: MazePoint | null
  visited: number[]
  progress: Record<number, number>
  finished: Record<number, number>
  /** 구경 중인 다른 팀들의 위치와 지나온 길 — 우리 팀이 탈출한 뒤에만 채워진다 */
  watch: Record<number, { pos: MazePoint; visited: number[] }>
  end: MazeEndSignal | null
}

const EMPTY: MazeViewState = { start: null, pos: null, visited: [], progress: {}, finished: {}, watch: {}, end: null }

export type MazeAction =
  | { type: 'start'; data: MazeStartSignal }
  | { type: 'pos'; pos: MazePoint }
  | { type: 'progress'; data: MazeProgressSignal }
  | { type: 'watch'; data: MazeWatchSignal }
  | { type: 'end'; data: MazeEndSignal }

/** 서버 신호 하나를 화면 상태에 합친다 */
export function reduceMaze(prev: MazeViewState | null, action: MazeAction): MazeViewState {
  const state = prev ?? EMPTY
  switch (action.type) {
    case 'start':
      return {
        start: action.data,
        pos: action.data.pos,
        visited: action.data.visited,
        progress: action.data.progress,
        finished: action.data.finished,
        // 담당 방향이 바뀌어 신호가 다시 와도 이미 받은 구경 화면은 그대로 둔다
        watch: state.watch,
        end: state.end,
      }
    case 'pos': {
      if (!state.start) return state
      const index = action.pos.y * state.start.maze.width + action.pos.x
      return { ...state, pos: action.pos, visited: state.visited.includes(index) ? state.visited : [...state.visited, index] }
    }
    case 'progress':
      return { ...state, progress: action.data.progress, finished: action.data.finished }
    case 'watch':
      return { ...state, watch: Object.fromEntries(action.data.teams.map((team) => [team.teamId, { pos: team.pos, visited: team.visited }])) }
    case 'end':
      return { ...state, end: action.data, start: state.start ? { ...state.start, phase: 'ended' } : state.start }
  }
}
