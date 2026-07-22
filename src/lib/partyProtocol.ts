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

export interface ModeCategory {
  id: 'INDIVIDUAL' | 'TEAM' | 'COOP'
  name: string
  icon: string
}

export interface MechanismCategory {
  id: 'TIMING' | 'TAP' | 'DRAG' | 'TEXT' | 'VOTE' | 'VOICE' | 'CAMERA' | 'CLICK_SPEED'
  name: string
  icon: string
}

export interface GameMeta {
  id: GameId
  emoji: string
  title: string
  description: string
  /** 라운드 시작 전 카운트다운 화면과 게임 화면에 보여줄 플레이 방법 설명 */
  howToPlay: string
  /** 사용법을 보여줄 gif/이미지 (아직 없으면 undefined) */
  howToPlayMediaUrl?: string
  playTimeSeconds: number
  modeCategory: ModeCategory
  mechanismCategory: MechanismCategory
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
  /** 라운드 시작 시점에 이미 연결이 끊겨 있어서 아예 참여하지 못한 경우 (항상 0점) */
  disconnected: boolean
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
  /** 이번 라운드에 실제로 참여 중인 사람들 (라운드 시작 이후 접속/재접속한 사람은 다음 라운드부터 포함) */
  currentRoundPlayerIds: PlayerId[]
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
  /** 방에서 완전히 나감. 나간 사람이 방장이었다면 가장 먼저 들어온 남은 사람이 새 방장이 됨 */
  'player:leave': () => void
  'host:updateConfig': (config: Partial<SessionConfig>) => void
  'host:start': () => void
  'host:nextRound': () => void
  /** 최종결과 화면에서 아무나 눌러서 같은 방으로 대기실로 돌아간다 (설정은 유지, 점수/준비상태는 초기화) */
  'room:playAgain': () => void
  'humanTimer:submit': (data: { elapsedMs: number }) => void
  'round:requestResync': () => void
}

/** Server -> Client */
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'room:error': (message: string) => void
  /** elapsedMs: 새 라운드면 0, 라운드 도중 재접속한 사람에게 다시 보낼 땐 이미 지난 시간 */
  'humanTimer:roundStart': (data: { elapsedMs: number }) => void
}
