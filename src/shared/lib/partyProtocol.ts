import type { AcrosticVoteSignal, AcrosticWriteSignal } from '../../party/games/acrostic/protocol'
import type { AuctionItemId } from '../../party/games/auction/protocol'
import type { BalloonPopStatus } from '../../party/games/balloonPop/protocol'
import type {
  CatchmindChatHistoryEntry,
  CatchmindGuesserResult,
  CatchmindStroke,
  CatchmindTeamTurnSummary,
} from '../../party/games/catchmind/protocol'
import type {
  LiarQuizComposeSignal,
  LiarQuizGuessSignal,
  LiarQuizQuestionDraft,
  LiarQuizQuestionMode,
  LiarQuizTurnResult,
  LiarQuizWriteSignal,
} from '../../party/games/liarQuiz/protocol'
import type { MinorityStartSignal, MinoritySubRoundResult } from '../../party/games/minority/protocol'
import type { MouseHunterMouse } from '../../party/games/mouseHunter/protocol'
import type { ScavengerHuntRoundTarget } from '../../party/games/scavengerHunt/protocol'
import type {
  MazeDirection,
  MazeEndSignal,
  MazePoint,
  MazeProgressSignal,
  MazeStartSignal,
  MazeWatchSignal,
} from '../../party/games/mazeEscape/protocol'
import type {
  CharacterChatEntry,
  CharacterEndSignal,
  CharacterRejected,
  CharacterSelectSignal,
  CharacterStartSignal,
} from '../../party/games/characterDescribe/protocol'
import type {
  EmojiCharadesChatEntry,
  EmojiCharadesEndSignal,
  EmojiCharadesSelectSignal,
  EmojiCharadesStartSignal,
} from '../../party/games/emojiCharades/protocol'
import type { FourCharsTurnResult, FourCharsTurnSignal } from '../../party/games/fourChars/protocol'
import type { SimonStageResult, SimonStartSignal } from '../../party/games/simon/protocol'
import type { TelepathyStartSignal, TelepathySubRoundResult } from '../../party/games/telepathy/protocol'
import type {
  TelestrationChainReveal,
  TelestrationPrompt,
  TelestrationStepKind,
  TelestrationWordMode,
} from '../../party/games/telestration/protocol'

export type PlayerId = string

export type GameId =
  | 'humanTimer'
  | 'mouseHunter'
  // | 'reverseElection'
  | 'balloonPop'
  | 'oneToTwentyFive'
  | 'colorMatch'
  | 'wordChain'
  | 'auction'
  | 'scavengerHunt'
  | 'shoutRace'
  | 'pixelCanvas'
  | 'catchmind'
  | 'typeRace'
  | 'telestration'
  | 'telepathy'
  | 'minority'
  | 'acrostic'
  | 'liarQuiz'
  | 'simon'
  | 'fourChars'
  | 'emojiCharades'
  | 'characterDescribe'
  | 'mazeEscape'

/** 방의 진행 방식 — backend/types.ts와 같아야 한다. /party는 개인전, /teamParty는 팀전 방이다 */
export type RoomMode = 'individual' | 'team'

/** 팀전에서 한 게임(라운드) 동안의 팀 구성 — 대기실에서 직접 고른 팀이 그대로 쓰인다 (backend/types.ts와 같아야 한다) */
export interface TeamInfo {
  id: number
  name: string
  memberIds: PlayerId[]
}
// 팀 색 목록 (backend/types.ts와 같아야 한다) — 번호(0부터)마다 색 이름이 정해져 있다. 팀 번호(TeamInfo.id, PlayerInfo.teamId)가 곧 그 팀이
// 지금 쓰는 색 번호이고, 팀원은 팀 색을 다른 색으로 바꿀 수 있다. PartyTeamBanner의 색 이모지와 styles.css의 .party-team-color-N도 같은 순서다
export const TEAM_NAMES = ['파랑팀', '빨강팀', '초록팀', '노랑팀', '보라팀', '주황팀', '갈색팀', '분홍팀']
export const MIN_TEAM_COUNT = 2
export const MAX_TEAM_COUNT = 4
export const MIN_PLAYERS_PER_TEAM = 2

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
  /** 개인전 방에서 모두가 같은 점수를 받는 협동 게임 (로비 카드에 "협동"을 붙인다) */
  cooperative?: boolean
  playTimeSeconds: number
  /** 이 게임을 즐길 수 있는 방 모드 — 서버가 방 모드에 맞는 게임만 gameCatalog에 담아 보낸다 */
  modes: RoomMode[]
  mechanismCategory: MechanismCategory
  comingSoon: boolean
  /** 이 게임을 고르는 데 필요한 최소 연결 인원 (없으면 MIN_PLAYERS_TO_START) */
  minPlayers?: number
}

export type RoomPhase = 'lobby' | 'round_countdown' | 'round_active' | 'round_results' | 'final_results'

export interface PlayerInfo {
  id: PlayerId
  nickname: string
  ready: boolean
  connected: boolean
  isHost: boolean
  /** 팀전 방에서 대기실에 정해져 있는 팀 번호 (개인전이면 null) */
  teamId: number | null
}

export interface SessionConfig {
  totalRounds: number
  /** 체크한 순서를 그대로 유지 → randomOrder가 꺼지면 이 순서가 곧 라운드 진행 순서 */
  selectedGames: GameId[]
  randomOrder: boolean
  /** 초성 퀴즈에서 출제할 카테고리. null이면 전체 (빈 배열은 "하나도 안 고름"이라 null과 다르다) */
  wordChainCategories: string[] | null
  /** 이어그리기 제시어 방식 — random: 서버가 단어 은행에서 뽑는다, custom: 라운드 시작 전 참가자가 각자 하나씩 적는다 */
  telestrationWordMode: TelestrationWordMode
  /** 거짓말쟁이 퀴즈 문제 방식 — random: 서버가 문항 은행에서 뽑는다, custom: 라운드 시작 직후 참가자가 각자 문제를 하나씩 만든다 */
  liarQuizQuestionMode: LiarQuizQuestionMode
  /** 팀전의 팀 수 (2~4) — 방장이 정한다 */
  teamCount: number
  /** 팀전에서 지금 쓰는 팀 색 번호들 (순서가 팀 순서). 다른 팀이 쓰는 색은 고를 수 없다 */
  teamColors: number[]
}

export interface RoundRankingEntry {
  playerId: PlayerId
  metric: number
  /** 화면에 보여줄 원시 값 (예: humanTimer는 실제 정지 시각 ms, oneToTwentyFive는 완료 시간 또는 DNF 시 진행한 개수). 게임마다 의미가 다르고, DNF일 때 비워둘지도 게임마다 다름 */
  value?: number
  rank: number
  points: number
  dnf: boolean
  /** 라운드 시작 시점에 이미 연결이 끊겨 있어서 아예 참여하지 못한 경우 (항상 0점) */
  disconnected: boolean
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface RoundResult {
  roundIndex: number
  gameId: GameId
  ranking: RoundRankingEntry[]
  /** 게임별 부가 결과 데이터 (예: wordChain의 정답 공개). 구조가 게임마다 다르므로 gameId로 분기해 타입을 좁혀 사용한다 */
  meta?: unknown
  /** 팀전이었다면 이 라운드의 팀 배정 (개인전이면 없음) */
  teams?: TeamInfo[]
}

export interface RoomState {
  code: string
  /** 방 모드 — gameCatalog에는 이 모드에서 할 수 있는 게임만 들어 있다 */
  mode: RoomMode
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
  /** 팀전 라운드(카운트다운·진행·결과 단계)의 팀 배정 — 그 밖의 단계와 개인전에서는 빈 배열 */
  teams: TeamInfo[]
}

// backend/types.ts와 값이 같아야 한다 — 시작 최소 인원은 방 전체 조건이고, 게임별 제한은 GameMeta.minPlayers가 있는 게임에만 건다
export const MIN_PLAYERS_TO_START = 2
export const DEFAULT_GAME_MIN_PLAYERS = 1

/** 방 모드별 게임 시작 최소 인원 — 팀전은 최소 팀 수 × 팀당 최소 인원 */
export function minPlayersToStart(mode: RoomMode): number {
  return mode === 'team' ? MIN_TEAM_COUNT * MIN_PLAYERS_PER_TEAM : MIN_PLAYERS_TO_START
}
export const ROUND_COUNTDOWN_MS = 3_000

type CreateRoomAck = { ok: true; roomCode: string; playerId: string } | { ok: false; error: string }
type JoinRoomAck = { ok: true; playerId: string } | { ok: false; error: string }
type RejoinRoomAck = { ok: true } | { ok: false; error: string }

/** Client -> Server */
export interface ClientToServerEvents {
  /** 대기실에서 다른 팀으로 옮기기 (팀전 방의 대기실에서만) */
  'player:setTeam': (teamId: number) => void
  /** 대기실에서 내 팀의 색 바꾸기 (팀전 방의 대기실에서만). 다른 팀이 쓰는 색은 고를 수 없다 */
  'player:setTeamColor': (colorId: number) => void
  'room:create': (nickname: string, mode: RoomMode, ack: (result: CreateRoomAck) => void) => void
  'room:join': (data: { roomCode: string; nickname: string }, ack: (result: JoinRoomAck) => void) => void
  'room:rejoin': (data: { roomCode: string; playerId: string }, ack: (result: RejoinRoomAck) => void) => void
  'player:ready': (ready: boolean) => void
  /** 방에서 완전히 나감. 나간 사람이 방장이었다면 가장 먼저 들어온 남은 사람이 새 방장이 됨 */
  'player:leave': () => void
  'host:updateConfig': (config: Partial<SessionConfig>) => void
  /** 대기실에서 방장이 연결되어 있는 다른 참가자에게 방장 권한을 넘긴다 */
  'host:transferHost': (targetPlayerId: string) => void
  'host:start': () => void
  'host:nextRound': () => void
  /** 게임 도중(카운트다운/라운드 진행/결과 공개 중) 방장이 눌러서 즉시 중단하고 대기실로 돌아간다.
   *  설정은 유지, 점수/기록/진행 중이던 라운드는 모두 초기화된다 */
  'host:returnToLobby': () => void
  /** 최종결과 화면에서 아무나 눌러서 같은 방으로 대기실로 돌아간다 (설정은 유지, 점수/준비상태는 초기화) */
  'room:playAgain': () => void
  'humanTimer:submit': (data: { elapsedMs: number }) => void
  /** 1부터 순서대로 맞게 터치할 때마다 지금까지 도달한 숫자를 가볍게 알려준다 (서버는 그대로 신뢰) */
  'oneToTwentyFive:progress': (data: { progress: number }) => void
  /** 25까지 다 터치했을 때 완료 시간을 제출 */
  'oneToTwentyFive:submit': (data: { elapsedMs: number }) => void
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
  /** photo: 결과 화면에서 다른 참가자에게 공개할 작은 썸네일(dataURL, 결과 공개용으로 압축된 저화질 사본).
   *  사진 분석/일치율 계산 자체는 이미 클라이언트에서 끝난 뒤라 서버는 이 문자열을 그대로 저장·재배포만 한다 */
  'scavengerHunt:submit': (data: { matchPercent: number; photo?: string }) => void
  /** 캘리브레이션 단계에서 측정한 주변 소음 기준(dBFS, 클수록 시끄러움 — 보통 음수)을 서버에 보고.
   *  서버는 이 값 자체를 쓰지 않고(가속 곡선 계산은 클라이언트 몫), 전원이 보고를 마쳤는지만 확인해 레이스 시작 시점을 정한다 */
  'shoutRace:calibrated': (data: { noiseFloor: number }) => void
  /** 목소리 크기로 계산한 현재 진행률(0~100)을 주기적으로 보고. 서버는 역행 방지 클램프만 적용해 그대로 신뢰한다 */
  'shoutRace:progress': (data: { progress: number }) => void
  /** 진행률이 100에 도달해 결승선을 통과했을 때, 레이스 시작 시각 기준 경과 시간과 함께 전송 */
  'shoutRace:finish': (data: { elapsedMs: number }) => void
  /** 출제자가 새 획을 시작. x/y는 0~1 정규화 좌표. 출제자가 아니거나 이미 턴이 끝났으면 서버가 무시한다 */
  'catchmind:strokeStart': (data: { color: string; width: number; x: number; y: number }) => void
  /** 진행 중인 획에 좌표를 이어붙임 — 포인터 이동을 짧게 배치로 모아 보낸다 */
  'catchmind:strokePoints': (data: { points: { x: number; y: number }[] }) => void
  /** 진행 중이던 획을 확정 */
  'catchmind:strokeEnd': () => void
  /** 캔버스 전체 지우기 */
  'catchmind:clear': () => void
  /** 마지막으로 확정된 획 하나를 취소. 그리는 중(획 진행 중)이거나 취소할 획이 없으면 서버가 무시한다 */
  'catchmind:undo': () => void
  /** 정답 시도. 오답이면 채팅 메시지로 전체 공개되고, 정답이면 텍스트는 공개되지 않고 "정답!" 표시만 방송된다 */
  'catchmind:guess': (data: { text: string }) => void
  /** 지금까지 정확하게 입력을 확정한 누적 글자수(confirmedChars)와, 관전용으로 보여줄 현재 문장 인덱스/입력값을 주기적으로 보고.
   *  keystrokes: Backspace 등 제어키를 제외한 실제 키보드 입력 누적 횟수(평균 타수 계산용, 완성 글자가 아니라 자판 입력 횟수 기준).
   *  activeMs: 첫 입력부터 지금까지 경과한 시간 */
  'typeRace:progress': (data: {
    confirmedChars: number
    sentenceIndex: number
    typed: string
    keystrokes: number
    activeMs: number
  }) => void
  /** 문장 시퀀스 전체를 다 쳤을 때, 레이스 시작 시각 기준 경과 시간과 실제 키보드 입력 누적 횟수(keystrokes)와 함께 전송 */
  'typeRace:finish': (data: { elapsedMs: number; keystrokes: number }) => void
  /** 현재 단계 결과 제출. draw 단계면 strokes, write 단계면 text. stepIndex가 현재 단계와 다르거나 이미 제출했으면 서버가 무시한다 */
  'telestration:submit': (data: { stepIndex: number; strokes?: CatchmindStroke[]; text?: string }) => void
  /** 체인의 한 단계에 투표하거나(voted: true) 취소한다(false) — 전체에서 개수 제한 없이 고를 수 있고, 그림 단계에만, 본인이 그린 것이 아닌 장면에만 할 수 있다 */
  'telestration:vote': (data: { chainIndex: number; stepIndex: number; voted: boolean }) => void
  /** 직접 입력 방식에서 라운드 시작 전 내가 낼 제시어 하나를 제출. 이미 냈거나 단계가 지났으면 서버가 무시한다 */
  'telestration:submitWord': (data: { text: string }) => void
  /** 투표를 마치고 결과를 기다리겠다는 신호. 표를 하나도 안 줘도(기권) 보낼 수 있으며, 전원이 보내거나 제한 시간이 지나면 라운드가 끝난다 */
  'telestration:voteDone': () => void
  /** 카드 한 장 선택. cardId는 TelepathyCard.id (표시 위치가 아님) */
  'telepathy:submit': (data: { cardId: number }) => void
  /** 양자택일 한쪽 선택. choice는 MinorityOption.id (표시 위치가 아님) */
  'minority:submit': (data: { choice: 0 | 1 }) => void
  /** 행시 제출. lines는 제시어 글자 수만큼의 줄(각 줄은 제시어의 해당 글자로 시작) */
  'acrostic:submit': (data: { lines: string[] }) => void
  /** 투표 한 표. poemId는 AcrosticPoem.id, null이면 기권 */
  'acrostic:vote': (data: { poemId: number | null }) => void
  /** 거짓말 제출. 정답과 같은 말이면 liarQuiz:submitRejected로 되돌아온다 */
  'liarQuiz:submit': (data: { turnIndex: number; text: string }) => void
  /** 직접 문제 만들기에서 내 문제를 낸다. 형식이 틀리면 liarQuiz:questionRejected로 되돌아온다 */
  'liarQuiz:submitQuestion': (data: LiarQuizQuestionDraft) => void
  /** 맞히는 사람의 보기 선택. confirm=false면 임시 선택(바꿀 수 있고 구경하는 사람에게 실시간 중계), true면 이 보기로 확정 */
  'liarQuiz:pick': (data: { turnIndex: number; choiceId: number; confirm: boolean }) => void
  /** 기억력 시퀀스 답 제출. answer는 alphabet의 심볼을 입력 순서대로 담은 배열 */
  'simon:submit': (data: { stageIndex: number; answer: string[] }) => void
  /** 네글자 퀴즈 답 제출 — 지금 답할 차례인 사람만 낼 수 있고, 한 턴에 한 번뿐이다 */
  'fourChars:submit': (data: { text: string }) => void
  /** 답할 사람이 입력창에 쓰고 있는 글자 (다른 사람들에게 실시간으로 보여주기용) */
  'fourChars:typing': (data: { text: string }) => void
  /** 이모티콘 퀴즈: 표현자 지원 단계(5초)에서 "내가 이모티콘으로 표현하고 싶다"를 체크하거나 해제한다 */
  'emojiCharades:volunteer': (data: { want: boolean }) => void
  /** 표현자가 이모티콘 하나를 맨 뒤에 붙인다 (최대 12개) */
  'emojiCharades:add': (data: { emoji: string }) => void
  /** 표현자가 마지막 이모티콘을 지운다 */
  'emojiCharades:undo': () => void
  /** 표현자가 이모티콘을 모두 지운다 */
  'emojiCharades:clear': () => void
  /** 표현자가 아닌 사람이 정답을 채팅으로 입력한다 */
  'emojiCharades:guess': (data: { text: string }) => void
  /** 캐릭터 설명: 설명자 지원 단계(5초)에서 "내가 설명하고 싶다"를 체크하거나 해제한다 */
  'characterDescribe:volunteer': (data: { want: boolean }) => void
  /** 캐릭터 설명: 설명자가 캐릭터의 생김새·성격·특징을 한 줄 설명한다 (이름·작품 이름이 들어 있거나 너무 빨리 보내면 서버가 거절한다) */
  'characterDescribe:describe': (data: { text: string }) => void
  /** 캐릭터 설명: 설명자가 아닌 사람이 이름을 채팅으로 맞힌다 */
  'characterDescribe:guess': (data: { text: string }) => void
  /** 미로 탈출: 내 담당 방향으로 팀 캐릭터를 한 칸 움직이려고 한다 (내 방향이 아니거나 벽이 있거나 너무 빠르면 서버가 무시한다) */
  'mazeEscape:move': (data: { dir: MazeDirection }) => void
}

/** Server -> Client */
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'room:error': (message: string) => void
  /** elapsedMs: 새 라운드면 0, 라운드 도중 재접속한 사람에게 다시 보낼 땐 이미 지난 시간 */
  'humanTimer:roundStart': (data: { elapsedMs: number; submitted?: boolean }) => void
  /** board: 이 플레이어 전용으로 섞인 1~25 배치. progress/elapsedMs: 새 라운드면 0, 재접속 시엔 지금까지 진행 상황 */
  'oneToTwentyFive:roundStart': (data: { board: number[]; progress: number; elapsedMs: number; submitted?: boolean }) => void
  /** chosung: 음절별 초성 배열. elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'wordChain:roundStart': (data: { chosung: string[]; elapsedMs: number; submitted?: boolean }) => void
  'wordChain:categoryRevealed': (data: { category: string }) => void
  'wordChain:definitionRevealed': (data: { definition: string }) => void
  /** 누군가 정답을 맞혔을 때 전체에게 브로드캐스트 (본인 포함). 닉네임은 room:state의 players로 조회 */
  'wordChain:correctAnswer': (data: { playerId: PlayerId }) => void
  /** 방금 제출한 사람에게만 보내는 정오답 결과 — 다른 사람에게 정답 문자열이 노출되면 안 되므로 개인 전송 */
  'wordChain:guessResult': (data: { correct: boolean }) => void
  /** 참가자 개인 전용 힌트 카드 — 다른 물품의 힌트나 다른 사람이 뭘 받았는지는 전혀 알 수 없다.
   *  elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'auction:roundStart': (data: {
    budget: number
    hint: { itemId: AuctionItemId; text: string }
    elapsedMs: number
    /** 재접속 시에만 의미 있는 값 — 이미 베팅을 확정했는지와 낸 금액 */
    submitted?: boolean
    bids?: Record<AuctionItemId, number> | null
  }) => void
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
  'balloonPop:roundStart': (data: { elapsedMs: number; pumps?: number; status?: BalloonPopStatus }) => void
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
  'scavengerHunt:roundStart': (data: { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number; submitted?: boolean }) => void
  /** 세부 라운드가 끝났을 때 본인에게만 보내는 결과 — 다른 사람 점수는 게임이 다 끝난 뒤 결과 화면에서 공개된다 */
  'scavengerHunt:subRoundResult': (data: {
    subRoundIndex: number
    matchPercent: number
    matchScore: number
    speedScore: number
    roundScore: number
  }) => void
  /** 캘리브레이션 단계 시작(또는 재접속 시 재전송). elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'shoutRace:roundStart': (data: { elapsedMs: number }) => void
  /** 전원 캘리브레이션 완료(또는 타임아웃) 직후 신호등(빨→주→초 Start!) 연출 시작 — 이 신호가 끝나야
   *  shoutRace:go로 진짜 레이스가 시작된다. 차량 색(slotColors/slotOfPlayer)은 여기서 확정되어 shoutRace:go와
   *  동일한 값을 그대로 유지한다(화면에 차가 보이기 시작하는 순간부터 자기 색을 알 수 있어야 하므로).
   *  elapsedMs: 새로 시작이면 0, 재접속 시엔 이미 지난 시간 */
  'shoutRace:countdown': (data: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number }) => void
  /** 전원 캘리브레이션 완료(또는 타임아웃)로 진짜 레이스가 시작됨 — slotColors/slotOfPlayer로 참가자별
   *  차량 색이 정해진다(모두 공개 정보). elapsedMs: 새로 시작이면 0, 재접속 시엔 레이스 시작 후 이미 지난 시간 */
  'shoutRace:go': (data: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number; finished?: boolean; myProgress?: number }) => void
  /** 전체 참가자의 현재 진행률(0~100) 스냅샷을 주기적으로 방송 — 상단 트랙 게이지의 상대방 위치 표시에 쓰인다 */
  'shoutRace:update': (data: { progress: Record<PlayerId, number> }) => void
  /** 턴(출제자 한 명) 시작 — 공개 정보만 담겨 있고 제시어는 없다(별도로 catchmind:word를 출제자에게만 전송).
   *  strokes: 새 턴이면 빈 배열, 재접속 시엔 지금까지 그려진 획 전체(스냅샷). elapsedMs: 새 턴이면 0, 재접속 시엔 이미 지난 시간 */
  'catchmind:turnStart': (data: {
    turnIndex: number
    totalTurns: number
    drawerId: PlayerId
    strokes: CatchmindStroke[]
    elapsedMs: number
    /** 재접속 시에만 채워지는 값 — 이 사람이 이번 턴 정답을 이미 맞혔는지 */
    guessed?: boolean
    /** 재접속 시에만 채워지는 값 — 지금까지의 채팅/정답/공개 기록 (최근 50줄) */
    history?: CatchmindChatHistoryEntry[]
  }) => void
  /** 이번 턴의 제시어 — 출제자 본인에게만 전송(재접속 시에도 다시 전송) */
  'catchmind:word': (data: { turnIndex: number; word: string }) => void
  /** 턴 시작 30초 후 글자 수 공개. 전원 동일하게 공개되므로 방송 */
  'catchmind:hintRevealed': (data: { length: number }) => void
  /** 오답을 포함해 채팅창에 그대로 노출되는 메시지 — 본인 것도 포함해서 전체에게 방송된다 */
  'catchmind:chatMessage': (data: { playerId: PlayerId; text: string }) => void
  /** 누군가 정답을 맞혔을 때 전체에게 방송 (본인 포함) — 실제 정답 텍스트는 공개하지 않는다.
   *  points는 이번 턴에서 이 사람이 받은 점수 */
  /** 팀전에서만: 다른 팀이 정답을 맞혔다는 소식 (점수와 정답은 알리지 않는다) */
  'catchmind:rivalSolved': (data: { teamId: number; playerId: PlayerId }) => void
  'catchmind:correctGuess': (data: {
    playerId: PlayerId
    points: number
    /** 팀전에서만: 이 팀이 정답을 맞혀 팀원 모두의 이번 턴이 끝났다 */
    teamSolved?: boolean
  }) => void
  /** 턴이 끝났을 때(전원 정답 또는 타임아웃) 정답과 이번 턴 결과를 전체 공개 */
  'catchmind:turnEnd': (data: {
    turnIndex: number
    drawerId: PlayerId
    word: string
    correctGuessers: CatchmindGuesserResult[]
    drawerPoints: number
    /** 팀전에서만: 이번 턴의 팀별 결과 (정답 순서/시간/점수) */
    teams?: CatchmindTeamTurnSummary[]
  }) => void
  /** 출제자의 draw 이벤트를 그대로 전원에게 중계(출제자 본인 포함) */
  'catchmind:strokeStart': (data: { color: string; width: number; x: number; y: number }) => void
  'catchmind:strokePoints': (data: { points: { x: number; y: number }[] }) => void
  'catchmind:strokeEnd': () => void
  'catchmind:clear': () => void
  /** 마지막 획을 취소한 뒤 남은 획 전체 — 래스터 캔버스라 부분 삭제가 안 되니 받는 쪽은 이걸로 전체를 다시 그린다 */
  'catchmind:undo': (data: { strokes: CatchmindStroke[] }) => void
  /** 라운드(재)시작 — sentences는 이번 라운드에 이어붙여 타이핑할 문장 시퀀스 전체(전원 동일). slotColors/slotOfPlayer로
   *  참가자별 차량 색이 정해진다(모두 공개 정보). myConfirmedChars: 새 라운드면 0, 재접속 시엔 본인이 지금까지 확정한 글자수.
   *  elapsedMs: 새 라운드면 0, 재접속 시엔 이미 지난 시간 */
  'typeRace:roundStart': (data: {
    sentences: string[]
    slotColors: string[]
    slotOfPlayer: Record<PlayerId, number>
    myConfirmedChars: number
    elapsedMs: number
  }) => void
  /** 전체 참가자의 현재 진행률(0~100)과, 관전 모드에서 보여줄 각자의 실시간 타이핑 상태(현재 문장 인덱스 + 입력값)를 주기적으로 방송 */
  'typeRace:update': (data: {
    progress: Record<PlayerId, number>
    live: Record<PlayerId, { sentenceIndex: number; typed: string }>
  }) => void
  /** 직접 입력 방식에서 제시어 작성 단계 시작(재접속 시에도 다시 전송). 제출 현황은 telestration:progress의 stepIndex -1로 온다 */
  'telestration:wordPrompt': (data: { submitted: boolean; elapsedMs: number; progress?: { submitted: number; total: number } }) => void
  /** 이어그리기 단계 시작 — 사람마다 다른 체인을 받으므로 emitToPlayer로 본인에게만 전송(재접속 시에도 다시 전송).
   *  submitted: 재접속한 사람이 이미 이번 단계를 제출한 상태인지. elapsedMs: 새 단계면 0, 재접속 시엔 이미 지난 시간 */
  'telestration:task': (data: {
    stepIndex: number
    totalSteps: number
    kind: TelestrationStepKind
    prompt: TelestrationPrompt
    submitted: boolean
    elapsedMs: number
    progress?: { submitted: number; total: number }
  }) => void
  /** 현재 단계를 제출한 사람 수 — 기다리는 화면의 진행 표시용 */
  'telestration:progress': (data: { stepIndex: number; submitted: number; total: number }) => void
  /** 모든 단계가 끝나 체인 전체를 공개하고 투표를 받기 시작. myVotes: 내가 지금까지 투표한 장면들(재접속 복원용) */
  'telestration:reveal': (data: {
    chains: TelestrationChainReveal[]
    myVotes: { chainIndex: number; stepIndex: number }[]
    /** 체인별 단계별로 지금까지 받은 표 수 (counts[chainIndex][stepIndex]) */
    counts: number[][]
    voteDone: boolean
    elapsedMs: number
  }) => void
  /** 누군가 투표하거나 취소할 때마다 전체에게 방송하는 최신 표 수 — 투표 화면의 👍 숫자를 실시간으로 갱신한다 */
  'telestration:voteCounts': (data: { counts: number[][] }) => void
  /** 서브라운드 시작(재접속 시 재전송). cards는 플레이어마다 순서가 섞여 있고, myCardId는 이미 골랐던 카드(없으면 null) */
  'telepathy:roundStart': (data: TelepathyStartSignal) => void
  /** 서브라운드가 끝났을 때 전원에게 방송하는 선택 공개 */
  'telepathy:subRoundResult': (data: TelepathySubRoundResult) => void
  /** 기억력 시퀀스 단계 시작(재접속 시 재전송). 시퀀스는 전원 동일 */
  'simon:stageStart': (data: SimonStartSignal) => void
  /** 단계가 끝났을 때 전원에게 방송하는 정답과 참가자별 채점 결과 */
  'simon:stageResult': (data: SimonStageResult) => void
  /** 네글자 퀴즈 턴 시작(재접속 시 재전송, 답할 사람이 바뀔 때도 다시 보낸다). 문제는 전원에게 똑같이 보인다 */
  'fourChars:turn': (data: FourCharsTurnSignal) => void
  /** 제한 시간이 10초 남았을 때 열리는 힌트 — 문제의 분류 */
  'fourChars:hint': (data: { turnIndex: number; category: string }) => void
  /** 답할 사람이 지금 쓰고 있는 글자 — 답할 사람 본인을 뺀 모두에게 중계한다 */
  'fourChars:typing': (data: { turnIndex: number; text: string }) => void
  /** 턴이 끝났을 때 전원에게 방송하는 정답과 결과 */
  'fourChars:turnResult': (data: FourCharsTurnResult) => void
  /** 이모티콘 퀴즈 표현자 지원 단계(재접속 시 재전송) */
  'emojiCharades:select': (data: EmojiCharadesSelectSignal) => void
  /** 이모티콘 퀴즈 표현 단계 시작(재접속·표현자가 바뀔 때도 다시 보낸다). word는 표현자에게만 담긴다 */
  'emojiCharades:start': (data: EmojiCharadesStartSignal) => void
  /** 표현자가 이모티콘을 바꿀 때마다 같은 팀에게만 오는 최신 이모티콘 목록 */
  'emojiCharades:emojis': (data: { emojis: string[] }) => void
  /** 오답 채팅 — 모든 팀이 함께 본다 */
  'emojiCharades:chat': (data: EmojiCharadesChatEntry) => void
  /** 시간이 지나 열리는 힌트(글자 수 또는 초성) */
  'emojiCharades:hint': (data: { lengthHint?: number; chosungHint?: string }) => void
  /** 정답이 나오거나 시간이 끝났을 때 — 정답과 팀별 이모티콘 공개 */
  'emojiCharades:end': (data: EmojiCharadesEndSignal) => void
  /** 캐릭터 설명 설명자 지원 단계(재접속 시 재전송) */
  'characterDescribe:select': (data: CharacterSelectSignal) => void
  /** 캐릭터 설명 설명 단계 시작(재접속·설명자가 바뀔 때도 다시 보낸다). word는 설명자에게만 담긴다 */
  'characterDescribe:start': (data: CharacterStartSignal) => void
  /** 설명(같은 팀에게만) · 오답 채팅(모든 팀) */
  'characterDescribe:chat': (data: CharacterChatEntry) => void
  /** 시간이 지나 열리는 힌트(글자 수 또는 초성) */
  'characterDescribe:hint': (data: { lengthHint?: number; chosungHint?: string }) => void
  /** 설명이 막혔을 때 설명자에게만 오는 이유 */
  'characterDescribe:rejected': (data: CharacterRejected) => void
  /** 정답이 나오거나 시간이 끝났을 때 — 정답과 팀별 설명 공개 */
  'characterDescribe:end': (data: CharacterEndSignal) => void
  /** 미로 탈출 시작(재접속·담당 방향이 바뀔 때도 다시 보낸다) — 내 팀 기준으로 개인화되어 있다 */
  'mazeEscape:start': (data: MazeStartSignal) => void
  /** 팀 캐릭터가 움직일 때마다 같은 팀에게만 오는 새 위치 */
  'mazeEscape:pos': (data: MazePoint) => void
  /** 팀별 진행률(%)과 탈출한 팀의 걸린 시간 — 다른 팀의 위치는 알려주지 않는다 */
  'mazeEscape:progress': (data: MazeProgressSignal) => void
  /** 탈출을 끝낸 팀에게만 — 다른 팀의 위치와 지나온 길을 구경용으로 보낸다 */
  'mazeEscape:watch': (data: MazeWatchSignal) => void
  /** 끝났을 때 팀별 결과 */
  'mazeEscape:end': (data: MazeEndSignal) => void
  /** 소수의견 서브라운드 시작(재접속 시 재전송). options는 플레이어마다 순서가 섞여 있고, myChoice는 이미 골랐던 쪽(없으면 null) */
  'minority:roundStart': (data: MinorityStartSignal) => void
  /** 서브라운드가 끝났을 때 전원에게 방송하는 선택 공개 */
  'minority:subRoundResult': (data: MinoritySubRoundResult) => void
  /** 막장 행시 작성 단계 시작(재접속 시 재전송) */
  'acrostic:writeStart': (data: AcrosticWriteSignal) => void
  /** 작성 중 제출이 반려됐을 때 본인에게만 오는 이유 */
  'acrostic:submitRejected': (data: { reason: string }) => void
  /** 막장 행시 투표 단계 시작(재접속 시 재전송) */
  'acrostic:voteStart': (data: AcrosticVoteSignal) => void
  /** 거짓말쟁이 퀴즈 문제 입력 단계 시작(직접 문제 만들기 방식, 재접속 시 재전송) */
  'liarQuiz:composeStart': (data: LiarQuizComposeSignal) => void
  /** 문제 입력 현황(몇 명이 냈는지) */
  'liarQuiz:composeProgress': (data: { submitted: number; total: number }) => void
  /** 내가 낸 문제가 반려됐을 때 본인에게만 오는 이유 */
  'liarQuiz:questionRejected': (data: { reason: string }) => void
  /** 거짓말쟁이 퀴즈 작성 단계 시작(턴마다, 재접속 시 재전송) */
  'liarQuiz:writeStart': (data: LiarQuizWriteSignal) => void
  /** 거짓말 제출이 반려됐을 때 본인에게만 오는 이유 */
  'liarQuiz:submitRejected': (data: { turnIndex: number; reason: string }) => void
  /** 거짓말 작성 현황(몇 명이 냈는지) */
  'liarQuiz:progress': (data: { turnIndex: number; submitted: number }) => void
  /** 거짓말쟁이 퀴즈 맞히기 단계 시작(재접속 시 재전송) */
  'liarQuiz:guessStart': (data: LiarQuizGuessSignal) => void
  /** 맞히는 사람의 임시 선택 실시간 중계 (맞히는 사람 본인은 받지 않는다) */
  'liarQuiz:picked': (data: { turnIndex: number; choiceId: number }) => void
  /** 한 턴이 끝났을 때 전원에게 오는 공개 */
  'liarQuiz:turnResult': (data: LiarQuizTurnResult) => void
}
