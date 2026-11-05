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
  { id: 'dalgona', emoji: '🍪', title: '달고나', ready: false },
  { id: 'tugOfWar', emoji: '🪢', title: '줄다리기', ready: false },
  { id: 'marbles', emoji: '🔮', title: '구슬치기', ready: false },
  { id: 'bridge', emoji: '🌉', title: '징검다리', ready: false },
]

/** 스테이지 번호로 이름 찾기 — 모르는 번호면 번호를 그대로 돌려준다 */
export const jjukkumiStageTitle = (id: string): string => JJUKKUMI_STAGE_CATALOG.find((stage) => stage.id === id)?.title ?? id

/** 로비에서 고른 스테이지(중 만들어진 것)를 진행 순서(1→5)대로 */
export const jjukkumiChosenStages = (selected: string[]): JjukkumiStageInfo[] => JJUKKUMI_STAGE_CATALOG.filter((stage) => stage.ready && selected.includes(stage.id))
