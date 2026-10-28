import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 이심전심: 채팅창에 쌓이는 한 줄 — 새로고침·재접속하면 서버가 지금까지의 기록을 다시 보내 채팅창을 복원한다
export type CatchmindChatHistoryEntry =
  | { kind: 'chat'; playerId: PlayerId; text: string }
  | { kind: 'correct'; playerId: PlayerId; points: number }
  | { kind: 'reveal'; drawerId: PlayerId; word: string }

// 이심전심 그림 맞히기: 획 하나 — 좌표는 0~1로 정규화되어 있어서 캔버스 비율(고정 aspect-ratio)만
// 맞으면 어느 클라이언트에서든 왜곡 없이 재생된다
export interface CatchmindStroke {
  color: string
  width: number
  points: { x: number; y: number }[]
}

export interface CatchmindGuesserResult {
  playerId: PlayerId
  elapsedMs: number
  points: number
}

export interface CatchmindTurnMeta {
  turnIndex: number
  drawerId: PlayerId
  word: string
  strokes: CatchmindStroke[]
  correctGuessers: CatchmindGuesserResult[]
  drawerPoints: number
}

// 팀전: 한 턴에서 한 팀의 결과 — 모든 팀이 같은 제시어를 각자 그리고 맞히므로, 먼저 맞힌 팀부터 높은 점수를 받는다
export interface CatchmindTeamTurnSummary {
  teamId: number
  drawerId: PlayerId
  solved: boolean
  /** 정답을 입력한 팀원 (못 맞혔으면 null) */
  solverId: PlayerId | null
  /** 턴 시작부터 정답까지 걸린 시간 (못 맞혔으면 null) */
  elapsedMs: number | null
  points: number
}

export interface CatchmindTeamTurnMeta {
  turnIndex: number
  word: string
  teams: (CatchmindTeamTurnSummary & { strokes: CatchmindStroke[] })[]
}

export interface CatchmindRoundMeta {
  /** 개인전의 턴 기록 (팀전에서는 빈 배열) */
  turns: CatchmindTurnMeta[]
  /** 팀전의 턴 기록 (개인전에서는 없음) */
  teamTurns?: CatchmindTeamTurnMeta[]
  teamScores?: { teamId: number; score: number }[]
}

export const CATCHMIND_TURN_TIMEOUT_MS = 60_000
export const CATCHMIND_HINT_REVEAL_MS = 30_000
export const CATCHMIND_REVEAL_MS = 4_000
export const CATCHMIND_MAX_GUESS_LENGTH = 40
export const CATCHMIND_MIN_STROKE_WIDTH = 2
export const CATCHMIND_MAX_STROKE_WIDTH = 32

// 흰색은 도화지 배경색과 같아서 지우개 역할을 겸한다
export const CATCHMIND_COLORS = [
  '#1f2937', 
  '#71717a', 
  '#ec4899', 
  '#ef4444', 
  '#f97316',
  '#f7db9f', 
  '#b45309', 
  '#78350f', 
  '#fde047', 
  '#84cc16', 
  '#22c55e', 
  '#06b6d4', 
  '#3b82f6', 
  '#1e3a8a', 
  '#a855f7', 
  '#ffffff', 
]
