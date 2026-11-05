import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 쭈꾸미 게임(개인전) (party/games/jjukkumi/) — 서버 types.ts와 모양이 같아야 한다

/** 영희가 보는 방향 — back: 뒤돌아 말하는 중(움직여도 된다), side: 옆을 본다(허용), front: 앞을 본다(완전히 멈춰야 한다) */
export type RedLightLight = 'back' | 'side' | 'front'

export interface RedLightLightSignal {
  state: RedLightLight
  /** 영희가 말하는 데 걸리는 시간(ms) — back일 때만 의미가 있다 */
  sayMs: number
  phaseMs: number
  /** 이 방향을 본 지 얼마나 지났는가(ms) — 신호를 받은 순간 기준이다 */
  phaseElapsedMs: number
}

export type JjukkumiPlayerState = 'run' | 'passed' | 'out'

export interface JjukkumiPlayerStatus {
  playerId: PlayerId
  status: JjukkumiPlayerState
  progress: number
  atMs: number | null
}

export interface JjukkumiStateSignal {
  /** 이번 판에서 몇 번째 스테이지인가(index 0부터)와 고른 스테이지 수(count), 스테이지 번호(id) */
  stage: { index: number; count: number; id: string }
  phase: 'prep' | 'run' | 'ended'
  durationMs: number
  /** 달리기가 시작된 뒤 흐른 시간 — 카운트다운 중에는 음수(-3000 → 0) */
  elapsedMs: number
  readyIds: PlayerId[]
  prepEndsInMs: number
  players: { playerId: PlayerId; character: number }[]
  /** 앞서 탈락해서 구경만 하는 사람들 */
  spectatorIds: PlayerId[]
  light: RedLightLightSignal | null
  statuses: JjukkumiPlayerStatus[]
}

export interface JjukkumiPositionsSignal {
  players: { playerId: PlayerId; progress: number; level: number; status: JjukkumiPlayerState }[]
}

export interface JjukkumiEndSignal {
  stageCount: number
  players: { playerId: PlayerId; rank: number; survived: boolean; stage: number; stageId: string; progress: number | null }[]
}

export interface JjukkumiRoundMeta {
  end: JjukkumiEndSignal
}

/** 캐릭터 번호(0~3) → 이미지 이름 (456·218·067·001) */
export const JJUKKUMI_CHARACTER_NAMES = ['p456', 'p218', 'p067', 'p001'] as const

/** 스테이지 목록 — 서버의 party/games/jjukkumi/catalog.ts와 같아야 한다. 방장이 로비에서 고르고, 고른 스테이지는 항상 이 순서(1→5)대로 진행한다 */
export interface JjukkumiStageInfo {
  id: string
  emoji: string
  title: string
  /** 만들어져 있어서 고를 수 있다 */
  ready: boolean
}

export const JJUKKUMI_STAGE_CATALOG: JjukkumiStageInfo[] = [
  { id: 'redLight', emoji: '🚦', title: '무궁화 꽃이 피었습니다', ready: true },
  { id: 'dalgona', emoji: '🍪', title: '달고나', ready: true },
  { id: 'tugOfWar', emoji: '🪢', title: '줄다리기', ready: true },
  { id: 'marbles', emoji: '🔮', title: '구슬치기', ready: true },
  { id: 'bridge', emoji: '🌉', title: '징검다리', ready: true },
]

/** 스테이지 번호로 이름 찾기 — 모르는 번호면 번호를 그대로 돌려준다 */
export const jjukkumiStageTitle = (id: string): string => JJUKKUMI_STAGE_CATALOG.find((stage) => stage.id === id)?.title ?? id

/** 로비에서 고른 스테이지(중 만들어진 것)를 진행 순서(1→5)대로 */
export const jjukkumiChosenStages = (selected: string[]): JjukkumiStageInfo[] => JJUKKUMI_STAGE_CATALOG.filter((stage) => stage.ready && selected.includes(stage.id))

// ---------------------------------------------------------------- 모든 스테이지가 같이 쓰는 신호

/** 지금 하는 스테이지 — 스테이지가 시작될 때마다 알려 준다. 화면은 id를 보고 어떤 스테이지 화면을 띄울지 정한다 */
export interface JjukkumiStageSignal {
  index: number
  count: number
  id: string
}

// ---------------------------------------------------------------- 스테이지 2: 달고나

export type DalgonaShapeId = 'circle' | 'triangle' | 'star' | 'umbrella'

/** 모양 이름과 목록·안내에 쓰는 작은 그림 */
export const DALGONA_SHAPES: Record<DalgonaShapeId, { name: string; emoji: string; /** 결과를 보여 줄 때 테두리 색 — 동그라미 초록, 세모 빨강, 별 노랑, 우산 파랑 */ color: string }> = {
  circle: { name: '동그라미', emoji: '⭕', color: '#2fbf71' },
  triangle: { name: '세모', emoji: '🔺', color: '#e5322d' },
  star: { name: '별', emoji: '⭐', color: '#f2b705' },
  umbrella: { name: '우산', emoji: '☂️', color: '#2d8cff' },
}

/** 모양을 고르는 버튼의 수 (서버의 DALGONA_BUTTONS와 같다) */
export const DALGONA_BUTTONS = 4

export type DalgonaPoint = [number, number]

export interface DalgonaStateSignal {
  stage: JjukkumiStageSignal
  /**
   * pick 버튼 네 개 중 하나를 고른다(어느 버튼에 어떤 모양이 있는지 아직 모른다) / reveal 모두 골랐다 — 버튼마다 모양을 보여 주고 누가 어느 버튼을 골랐는지 알린다 /
   * intro 내 모양을 보고 마음의 준비를 한다(3·2·1) / run 그린다 / ended 끝났다
   */
  phase: 'pick' | 'reveal' | 'intro' | 'run' | 'ended'
  durationMs: number
  /** 그리기가 시작된 뒤 흐른 시간 — intro 동안은 음수(-3000 → 0), 그 전(pick·reveal)에는 0 */
  elapsedMs: number
  /** pick·reveal 단계가 끝나기까지 남은 시간(ms) — 그 밖의 단계에서는 0 */
  phaseEndsInMs: number
  /** 이미 고른 사람들 (어느 버튼인지는 reveal 때까지 모른다) */
  chosenIds: PlayerId[]
  /** 버튼마다 숨어 있던 모양 (버튼 번호 = 목록 번호) — reveal부터 온다 */
  buttons: string[] | null
  /** 누가 어느 버튼(0~3)을 골랐는가 — reveal부터 온다 */
  choices: Record<PlayerId, number> | null
  /** 이 스테이지에서 뛰는 사람과 그 사람이 받은 모양 — reveal부터 온다 (그 전에는 shape가 null) */
  players: { playerId: PlayerId; shape: string | null }[]
  /** 모양별로 따라 그릴 선 — 점들을 순서대로 이은 것(0~1 좌표). 첫 점이 시작, 마지막 점이 끝. reveal부터 온다 */
  paths: Record<string, DalgonaPoint[]>
  /** 선에서 이만큼(판 너비에 대한 비율) 벗어나면 탈락 */
  tolerance: number
  spectatorIds: PlayerId[]
  statuses: JjukkumiPlayerStatus[]
}

/** 모두가 지금까지 그린 점들 — points에 null이 끼어 있으면 거기서 손가락을 뗐다는 뜻이다(선이 끊긴다) */
export interface DalgonaTracesSignal {
  /** true면 지금까지 그린 전부(재접속), false면 마지막으로 알린 뒤에 새로 그린 점들 */
  full: boolean
  players: { playerId: PlayerId; points: (DalgonaPoint | null)[]; progress: number; /** 선의 끝에서부터 거꾸로 그리고 있다 */ reversed: boolean; status: JjukkumiPlayerState }[]
}

/** 지금까지 받아 모은 한 사람의 그림 */
export interface DalgonaTrace {
  points: (DalgonaPoint | null)[]
  progress: number
  /** 선의 끝에서부터 거꾸로 그리고 있다 — 지나온 부분의 색을 어느 쪽 끝에서부터 칠할지 정한다 */
  reversed: boolean
  status: JjukkumiPlayerState
}

/** 받은 그림 신호를 지금까지 모은 것에 더한다 — full이면 통째로 바꾼다 */
export function mergeDalgonaTraces(previous: Record<string, DalgonaTrace>, signal: DalgonaTracesSignal): Record<string, DalgonaTrace> {
  const next: Record<string, DalgonaTrace> = signal.full ? {} : { ...previous }
  for (const row of signal.players) {
    const before = signal.full ? [] : (next[row.playerId]?.points ?? [])
    next[row.playerId] = { points: [...before, ...row.points], progress: row.progress, reversed: row.reversed, status: row.status }
  }
  return next
}

// ---------------------------------------------------------------- 스테이지 3: 줄다리기

/** 팀 색 — 팀 0은 초록, 팀 1은 빨강 */
export type TugTeamColor = 'green' | 'red'

/** 줄다리기 팀의 이름·이모지·색 (초록은 마음이 놓이는 색, 빨강은 불타는 색이라 한눈에 구분된다) */
export const TUG_TEAM_STYLE: Record<TugTeamColor, { name: string; emoji: string; color: string }> = {
  green: { name: '초록 팀', emoji: '🟢', color: '#2fa866' },
  red: { name: '빨강 팀', emoji: '🔴', color: '#e5322d' },
}

export interface TugStageResult {
  /** outcome: won 이긴 팀(통과), lost 진 팀(전원 탈락), tie 비겨서 두 팀 모두 통과 */
  teams: { teamId: number; power: number; pulls: number; outcome: 'won' | 'lost' | 'tie' }[]
  players: { playerId: PlayerId; pulls: number }[]
}

export interface TugStageStateSignal {
  stage: JjukkumiStageSignal
  /** intro 팀을 알려 준다(3·2·1) / run 줄을 당긴다 / ended 끝났다 */
  phase: 'intro' | 'run' | 'ended'
  durationMs: number
  /** 당기기가 시작된 뒤 흐른 시간 — intro 동안은 음수(-3000 → 0) */
  elapsedMs: number
  teams: { teamId: number; color: TugTeamColor; memberIds: PlayerId[] }[]
  /** 팀별 힘 — 팀이 당긴 횟수를 팀 인원으로 나눈 값(1인당 평균) */
  power: Record<number, number>
  /** 이 사람이 지금까지 당긴 횟수 — 재접속했을 때만 채워져 온다 */
  myPulls: number
  spectatorIds: PlayerId[]
  statuses: JjukkumiPlayerStatus[]
  /** 끝난 뒤의 결과 — 끝나기 전에는 null */
  result: TugStageResult | null
}

export interface TugStagePowerSignal {
  power: Record<number, number>
}

// ---------------------------------------------------------------- 스테이지 4: 구슬치기

/** 시작할 때 가진 구슬 수와 통과하는 구슬 수 (서버의 MARBLES_START·MARBLES_GOAL과 같다) */
export const MARBLES_START = 3
export const MARBLES_GOAL = 5

export type MarblesHand = 'left' | 'right'
export type MarblesParity = 'even' | 'odd'

export interface MarblesRoundResult {
  playerId: PlayerId
  /** 고른 손 (못 골랐으면 null) */
  choice: MarblesHand | null
  /** 짝수 개(2개)를 들고 있던 손 — 다른 손에는 홀수 개(1개)가 들어 있었다 */
  evenHand: MarblesHand
  correct: boolean
  /** 이 판이 끝난 뒤 가진 구슬 수 */
  marbles: number
}

export interface MarblesStateSignal {
  stage: JjukkumiStageSignal
  /** intro 규칙을 알려 준다(3·2·1) / pick 손을 고른다 / reveal 양손을 펼쳐 결과를 보여 준다 / ended 끝났다 */
  phase: 'intro' | 'pick' | 'reveal' | 'ended'
  durationMs: number
  /** 첫 판이 시작된 뒤 흐른 시간 — intro 동안은 음수(-3000 → 0) */
  elapsedMs: number
  /** 지금이 몇 번째 판인가 (1부터) */
  round: number
  /** 이번 판에서 맞혀야 하는 것 — 짝수(2개)를 든 손인가, 홀수(1개)를 든 손인가. 모두에게 같다 */
  prompt: MarblesParity | null
  phaseEndsInMs: number
  players: PlayerId[]
  /** 아직 뛰고 있는 사람 */
  active: PlayerId[]
  /** 이번 판에서 이미 고른 사람 (어느 손인지는 결과를 보여 줄 때까지 모른다) */
  chosenIds: PlayerId[]
  marbles: Record<PlayerId, number>
  /** reveal 단계에서만 — 이번 판의 결과 */
  results: MarblesRoundResult[] | null
  spectatorIds: PlayerId[]
  statuses: JjukkumiPlayerStatus[]
}

// ---------------------------------------------------------------- 스테이지 5: 징검다리

/** 다리 유리의 왼쪽·오른쪽 */
export type BridgeSide = 'left' | 'right'

/** 방금 일어난 일 — 화면이 유리가 깨지는 모습, 건너는 모습을 한 번씩만 보여 주려고 번호(seq)를 붙인다 */
export interface BridgeLastEvent {
  seq: number
  playerId: PlayerId
  /** 몇 번째 칸이었나 (0부터) */
  step: number
  /** 밟은 유리 — 시간 안에 못 골랐으면 null */
  side: BridgeSide | null
  /** 안전한 유리를 밟았다 */
  ok: boolean
}

export interface BridgeStateSignal {
  stage: JjukkumiStageSignal
  /** intro 규칙과 차례를 알려 준다 / pick 지금 차례인 사람이 유리를 고른다 / result 밟은 결과를 보여 준다 / ended 끝났다 */
  phase: 'intro' | 'pick' | 'result' | 'ended'
  durationMs: number
  /** 첫 차례가 시작된 뒤 흐른 시간 — intro 동안은 음수 */
  elapsedMs: number
  steps: number
  /** 건너는 차례 */
  order: PlayerId[]
  /** 지금 차례인 사람 — 끝났으면 null */
  current: PlayerId | null
  /** 지금 차례인 사람이 고를 칸 (0부터) */
  step: number
  phaseEndsInMs: number
  /** 사람별로 몇 칸을 건넜는가 */
  progress: Record<PlayerId, number>
  /** 칸마다 누군가 무사히 밟고 건넌 유리 — 아무도 안 밟았으면 null */
  stepped: (BridgeSide | null)[]
  /** 칸마다 이미 깨진 유리 — 누군가 틀린 유리를 밟았을 때만 있다. 깨진 채로 남는다 */
  broken: (BridgeSide | null)[]
  last: BridgeLastEvent | null
  spectatorIds: PlayerId[]
  statuses: JjukkumiPlayerStatus[]
}
