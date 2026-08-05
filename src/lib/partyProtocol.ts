export type PlayerId = string

export type GameId =
  | 'humanTimer'
  | 'mouseHunter'
  // | 'reverseElection'
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
  /** 화면에 보여줄 원시 값 (예: humanTimer는 실제 정지 시각 ms, oneToFifty는 완료 시간 또는 DNF 시 진행한 개수). 게임마다 의미가 다르고, DNF일 때 비워둘지도 게임마다 다름 */
  value?: number
  rank: number
  points: number
  dnf: boolean
  /** 라운드 시작 시점에 이미 연결이 끊겨 있어서 아예 참여하지 못한 경우 (항상 0점) */
  disconnected: boolean
}

// 경매: 물품 식별자 (항상 4개, A~D 고정 라벨 — 실제 정체는 없고 미스터리 박스로 취급)
export type AuctionItemId = 'A' | 'B' | 'C' | 'D'

// 경매: 라운드 종료 후 결과 화면에 공개하는 물품별 상세 (RoundResult.meta로 전달됨)
export interface AuctionItemResult {
  itemId: AuctionItemId
  /** 물품의 실제 가치 (마이너스 가능, 단위: 만원) */
  value: number
  /** 낙찰자. 아무도 안 썼거나 최고가가 동점이면 유찰 */
  winnerPlayerId: PlayerId | null
  /** 전원 공개용 — 이 물품에 각자 얼마씩 베팅했는지 */
  bids: Record<PlayerId, number>
}

export interface AuctionRoundMeta {
  items: AuctionItemResult[]
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

// 절대색감: 한 라운드(게임 슬롯) 안에서 진행하는 세부 라운드 3개 각각의 결과
export interface ColorMatchSubRoundResult {
  subRoundIndex: number
  answerColor: RgbColor
  /** 전원 공개용 — 참가자별로 이번 세부 라운드에서 고른 색과 일치율 */
  picks: Record<PlayerId, { color: RgbColor; matchPercent: number }>
}

export interface ColorMatchRoundMeta {
  subRounds: ColorMatchSubRoundResult[]
}

// 픽셀 캔버스: 결과 화면에 보여줄 최종 캔버스 스냅샷 (grid는 0=빈칸, N=슬롯(N-1)이 칠한 칸)
export interface PixelCanvasRoundMeta {
  grid: number[]
  slotColors: string[]
}

export type BalloonPopStatus = 'alive' | 'popped' | 'stopped'

// 풍선 담력 테스트: 결과 화면에서 전원 공개하는 참가자별 상세
export interface BalloonPopPlayerResult {
  playerId: PlayerId
  pumps: number
  status: BalloonPopStatus
  /** 이 참가자의 숨겨진 터짐 임계값 — 안전하게 멈춘 사람도 "사실 몇 번까지 버틸 수 있었는지" 결과 화면에서 확인 가능 */
  threshold: number
}

export interface BalloonPopRoundMeta {
  results: BalloonPopPlayerResult[]
}

// 쥐 세 끼: 방 목록 순서는 mouseHunterRooms.ts의 MOUSE_HUNTER_ROOMS와 동일하게 유지 (백엔드 types.ts 미러)
export type MouseHunterRoomId = 'livingRoom' | 'bedRoom' | 'kitchen' | 'bathRoom' | 'studyRoom' | 'dressRoom'
export type MouseHunterSkin = 'default' | 'teatime' | 'hat' | 'eyeglass' | 'bubble' | 'swimming' | 'cheese' | 'sleep' | 'scarf'
export type MouseHunterVariant = 'front' | 'side'
export type MouseHunterFacing = 'left' | 'right'

export interface MouseHunterMouse {
  id: string
  roomId: MouseHunterRoomId
  spotId: string
  skin: MouseHunterSkin
  variant: MouseHunterVariant
  facing: MouseHunterFacing
}

// 쥐 세 끼: 맵 전체에 항상 유지되는 쥐 마리 수 — 한 마리를 잡으면 곧바로 다른 방에 한 마리가 새로 스폰된다
export const MOUSE_HUNTER_TOTAL_MICE = 3

export type ScavengerHuntMode = 'object' | 'color'

// 사물 인식 모드 제시어 — cocoClass는 TensorFlow.js COCO-SSD 모델이 반환하는 영문 클래스명과 정확히 일치한다
export interface ScavengerHuntObjectTarget {
  cocoClass: string
  label: string
}

// 색상 검증 모드 제시어 — 촬영한 사진의 가이드 틀 영역 픽셀을 HSV로 변환해 이 "이상적인" 색과 얼마나
// 가까운지를 연속적인 점수로 매긴다 (하드 threshold가 아니라 거리 기반 감점). achromatic이면(검정/흰색/회색)
// hue는 무시하고 명도(value)와 낮은 채도로만 판단한다. 실제 계산은 lib/scavengerHuntVision.ts 참고
export interface ScavengerHuntColorTarget {
  id: string
  label: string
  achromatic: boolean
  hue: number
  saturation: number
  value: number
}

export interface ScavengerHuntRoundTarget {
  mode: ScavengerHuntMode
  object?: ScavengerHuntObjectTarget
  color?: ScavengerHuntColorTarget
}

// 스캐빈저 헌트: 세부 라운드 하나가 끝났을 때 결과 화면에 전원 공개하는 참가자별 상세
export interface ScavengerHuntSubRoundResult {
  subRoundIndex: number
  target: ScavengerHuntRoundTarget
  picks: Record<PlayerId, { matchPercent: number; matchScore: number; speedScore: number; roundScore: number; submitted: boolean }>
}

export interface ScavengerHuntRoundMeta {
  subRounds: ScavengerHuntSubRoundResult[]
}

export interface RoundResult {
  roundIndex: number
  gameId: GameId
  ranking: RoundRankingEntry[]
  /** 게임별 부가 결과 데이터 (예: wordChain의 정답 공개). 구조가 게임마다 다르므로 gameId로 분기해 타입을 좁혀 사용한다 */
  meta?: unknown
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
  /** 3·2·1 카운트다운이 시작된 뒤 흐른 시간(ms). round_countdown 단계가 아니면 0 */
  countdownElapsedMs: number
  scores: Record<PlayerId, number>
  roundHistory: RoundResult[]
  gameCatalog: GameMeta[]
}

export const MIN_PLAYERS_TO_START = 2
export const HUMAN_TIMER_TARGET_MS = 10_000
export const ONE_TO_FIFTY_ROUND_TIMEOUT_MS = 30_000
export const ROUND_COUNTDOWN_MS = 3_000
export const WORD_CHAIN_ROUND_TIMEOUT_MS = 60_000
export const WORD_CHAIN_CATEGORY_REVEAL_MS = 10_000
export const WORD_CHAIN_DEFINITION_REVEAL_MS = 20_000
export const AUCTION_ITEM_IDS: AuctionItemId[] = ['A', 'B', 'C', 'D']
// 화면에는 A~D 대신 사람이 말하기 쉬운 1~4번으로 물품을 표시한다
export const auctionItemNumber = (itemId: AuctionItemId) => AUCTION_ITEM_IDS.indexOf(itemId) + 1
export const AUCTION_STARTING_BUDGET = 1000
export const AUCTION_ROUND_TIMEOUT_MS = 90_000
export const COLOR_MATCH_SUB_ROUNDS = 3
export const COLOR_MATCH_SUB_ROUND_MS = 5_000
export const COLOR_MATCH_REVEAL_MS = 3_000
export const PIXEL_CANVAS_COLS = 40
export const PIXEL_CANVAS_ROWS = 26
export const PIXEL_CANVAS_ROUND_TIMEOUT_MS = 20_000
export const BALLOON_POP_MAX_PUMPS = 50
export const BALLOON_POP_ROUND_TIMEOUT_MS = 20_000
export const BALLOON_POP_REVEAL_MS = 2_000
export const MOUSE_HUNTER_ROUND_TIMEOUT_MS = 30_000
export const SCAVENGER_HUNT_SUB_ROUNDS = 3
export const SCAVENGER_HUNT_SUB_ROUND_MS = 30_000
export const SCAVENGER_HUNT_REVEAL_MS = 3_000

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
  /** 1부터 순서대로 맞게 터치할 때마다 지금까지 도달한 숫자를 가볍게 알려준다 (서버는 그대로 신뢰) */
  'oneToFifty:progress': (data: { progress: number }) => void
  /** 50까지 다 터치했을 때 완료 시간을 제출 */
  'oneToFifty:submit': (data: { elapsedMs: number }) => void
  'round:requestResync': () => void
  /** 초성 퀴즈 정답 시도. 같은 라운드 안에서 맞힐 때까지 몇 번이든 다시 시도할 수 있다 */
  'wordChain:submit': (data: { guess: string }) => void
  /** 물품별 베팅액을 한 번에 제출 (합계가 예산을 넘으면 서버가 거부). 제출 후에는 라운드가 끝날 때까지 수정 불가 */
  'auction:submit': (data: { bids: Record<AuctionItemId, number> }) => void
  /** 현재 핀이 가리키는 색. 세부 라운드가 끝날 때까지 몇 번이든 다시 보내서 덮어쓸 수 있다 (마지막 값이 채택됨) */
  'colorMatch:submit': (data: { color: RgbColor }) => void
  /** 드래그 경로 위의 격자 좌표들. 서버가 그대로(1x1) 칠하고 전원에게 브로드캐스트한다 */
  'pixelCanvas:paint': (data: { cells: { x: number; y: number }[] }) => void
  /** 풍선을 한 번 부풀림. 서버가 숨겨진 임계값과 비교해 터졌는지 판정하고 balloonPop:state로 응답한다 */
  'balloonPop:pump': () => void
  /** 지금 크기로 확정하고 더 이상 부풀리지 않음 */
  'balloonPop:stop': () => void
  /** 화면에 보이는 쥐를 탭함. 서버는 이 mouseId가 본인 맵에 지금 떠 있는 쥐인지만 확인하고 판정한다 —
   *  잡으면 그 자리에 곧바로 다른 방의 새 쥐가 스폰된다 */
  'mouseHunter:tap': (data: { mouseId: string }) => void
  /** 촬영한 사진을 온디바이스 AI(사물 인식) 또는 캔버스 픽셀 분석(색상 검증)으로 직접 계산한 일치율(0~100)을
   *  제출. 사진 자체는 서버로 전송되지 않으므로 서버는 이 값을 그대로 신뢰하고, 제출이 도착한 시각으로 속도 점수를 계산한다 */
  'scavengerHunt:submit': (data: { matchPercent: number }) => void
}

/** Server -> Client */
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'room:error': (message: string) => void
  /** elapsedMs: 새 라운드면 0, 라운드 도중 재접속한 사람에게 다시 보낼 땐 이미 지난 시간 */
  'humanTimer:roundStart': (data: { elapsedMs: number }) => void
  /** board: 이 플레이어 전용으로 섞인 1~50 배치. progress/elapsedMs: 새 라운드면 0, 재접속 시엔 지금까지 진행 상황 */
  'oneToFifty:roundStart': (data: { board: number[]; progress: number; elapsedMs: number }) => void
  /** chosung: 음절별 초성 배열. elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'wordChain:roundStart': (data: { chosung: string[]; elapsedMs: number }) => void
  'wordChain:categoryRevealed': (data: { category: string }) => void
  'wordChain:definitionRevealed': (data: { definition: string }) => void
  /** 누군가 정답을 맞혔을 때 전체에게 브로드캐스트 (본인 포함). 닉네임은 room:state의 players로 조회 */
  'wordChain:correctAnswer': (data: { playerId: PlayerId }) => void
  /** 방금 제출한 사람에게만 보내는 정오답 결과 — 다른 사람에게 정답 문자열이 노출되면 안 되므로 개인 전송 */
  'wordChain:guessResult': (data: { correct: boolean }) => void
  /** 참가자 개인 전용 힌트 카드 — 다른 물품의 힌트나 다른 사람이 뭘 받았는지는 전혀 알 수 없다.
   *  elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'auction:roundStart': (data: { budget: number; hint: { itemId: AuctionItemId; text: string }; elapsedMs: number }) => void
  /** 제출한 베팅이 유효하지 않아(합계 초과 등) 반려됐을 때 제출한 사람에게만 전송 */
  'auction:submitRejected': (data: { reason: string }) => void
  /** 세부 라운드(3개 중 하나) 시작. answerColor는 전원에게 동일하게 공개된다.
   *  elapsedMs: 새 세부 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'colorMatch:roundStart': (data: { subRoundIndex: number; answerColor: RgbColor; elapsedMs: number }) => void
  /** 세부 라운드가 끝났을 때 본인에게만 보내는 결과 — 다른 사람 점수는 게임이 다 끝난 뒤 결과 화면에서 공개된다 */
  'colorMatch:subRoundResult': (data: { subRoundIndex: number; matchPercent: number; grade: string }) => void
  /** 라운드(재)시작 — grid는 현재 격자 전체 스냅샷(새 라운드면 전부 0), slotColors는 슬롯별 색상,
   *  slotOfPlayer는 참가자별 슬롯 번호. 모두 공개 정보라 전원에게 동일하게 방송된다.
   *  elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'pixelCanvas:roundStart': (data: {
    grid: number[]
    slotColors: string[]
    slotOfPlayer: Record<PlayerId, number>
    elapsedMs: number
  }) => void
  /** 누군가 칠한 칸들의 변경분만 전달 (i: y*cols+x 평면 인덱스, slot: 새로 칠한 사람의 슬롯) */
  'pixelCanvas:update': (data: { cells: { i: number; slot: number }[] }) => void
  /** elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'balloonPop:roundStart': (data: { elapsedMs: number }) => void
  /** 본인의 pump/stop 요청에 대한 응답 — 다른 사람 진행 상황은 라운드 중엔 비공개이므로 본인에게만 전송 */
  'balloonPop:state': (data: { pumps: number; status: BalloonPopStatus }) => void
  /** mice: 이 참가자 전용으로 맵에 떠 있는 쥐 3마리(위치/스킨/모습) — 다른 참가자에게는 전혀 노출되지 않는다.
   *  caughtCount: 지금까지 이 참가자가 잡은 누적 마리 수 (재접속 시 개인 카운터 복원용).
   *  elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'mouseHunter:roundStart': (data: { mice: MouseHunterMouse[]; caughtCount: number; elapsedMs: number }) => void
  /** 쥐를 잡아서 그 자리가 다른 방의 새 쥐로 교체된 뒤의 최신 3마리 — 본인에게만 전송 */
  'mouseHunter:miceUpdate': (data: { mice: MouseHunterMouse[] }) => void
  /** 누군가 쥐를 잡을 때마다 전체에게 브로드캐스트 (본인 포함) — 어디서 잡았는지는 비공개, "몇 마리째"만 공개된다.
   *  닉네임은 room:state의 players로 조회 */
  'mouseHunter:playerCaught': (data: { playerId: PlayerId; totalCaught: number }) => void
  /** 세부 라운드(3개 중 하나) 시작. target(사물/색상 제시어)은 전원에게 동일하게 공개된다.
   *  elapsedMs: 새 세부 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'scavengerHunt:roundStart': (data: { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number }) => void
  /** 세부 라운드가 끝났을 때 본인에게만 보내는 결과 — 다른 사람 점수는 게임이 다 끝난 뒤 결과 화면에서 공개된다 */
  'scavengerHunt:subRoundResult': (data: {
    subRoundIndex: number
    matchPercent: number
    matchScore: number
    speedScore: number
    roundScore: number
  }) => void
}
