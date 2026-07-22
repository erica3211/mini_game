export type PlayerId = string

export type GameId =
  | 'humanTimer'
  | 'nightMouseHunt'
  | 'reverseElection'
  | 'balloonPop'
  | 'oneToFifty'
  | 'colorMatch'
  | 'wordChain'
  | 'auction'
  | 'scavengerHunt'
  | 'shoutRace'
  | 'pixelCanvas'

export interface GameMeta {
  id: GameId
  emoji: string
  title: string
  description: string
  comingSoon: boolean
}

export type RoomPhase = 'lobby' | 'round_countdown' | 'round_active' | 'round_results' | 'final_results'

export interface PlayerInfo {
  id: PlayerId
  nickname: string
  ready: boolean
  connected: boolean
  isHost: boolean
}

export interface SessionConfig {
  totalRounds: number
  /** 체크한 순서를 그대로 유지 → randomOrder가 꺼지면 이 순서가 곧 라운드 진행 순서 */
  selectedGames: GameId[]
  randomOrder: boolean
}

export interface RoundRankingEntry {
  playerId: PlayerId
  metric: number
  /** 화면에 보여줄 원시 값 (예: humanTimer는 실제 정지 시각 ms). 게임마다 의미가 다르고, DNF면 없음 */
  value?: number
  rank: number
  points: number
  dnf: boolean
}

export interface RoundResult {
  roundIndex: number
  gameId: GameId
  ranking: RoundRankingEntry[]
}

export interface RoomState {
  code: string
  phase: RoomPhase
  players: PlayerInfo[]
  hostId: PlayerId
  config: SessionConfig
  currentRoundIndex: number
  currentGameId: GameId | null
  scores: Record<PlayerId, number>
  roundHistory: RoundResult[]
  gameCatalog: GameMeta[]
}

export const MIN_PLAYERS_TO_START = 2
export const HUMAN_TIMER_TARGET_MS = 10_000
export const ROUND_COUNTDOWN_MS = 3_000

type CreateRoomAck = { ok: true; roomCode: string; playerId: string } | { ok: false; error: string }
type JoinRoomAck = { ok: true; playerId: string } | { ok: false; error: string }
type RejoinRoomAck = { ok: true } | { ok: false; error: string }

/** Client -> Server */
export interface ClientToServerEvents {
  'room:create': (nickname: string, ack: (result: CreateRoomAck) => void) => void
  'room:join': (data: { roomCode: string; nickname: string }, ack: (result: JoinRoomAck) => void) => void
  'room:rejoin': (data: { roomCode: string; playerId: string }, ack: (result: RejoinRoomAck) => void) => void
  'player:ready': (ready: boolean) => void
  'host:updateConfig': (config: Partial<SessionConfig>) => void
  'host:start': () => void
  'host:nextRound': () => void
  'humanTimer:submit': (data: { elapsedMs: number }) => void
}

/** Server -> Client */
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'room:error': (message: string) => void
  /** elapsedMs: 새 라운드면 0, 라운드 도중 재접속한 사람에게 다시 보낼 땐 이미 지난 시간 */
  'humanTimer:roundStart': (data: { elapsedMs: number }) => void
}
