import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 팀 대항 올림픽 (party/games/olympics/team.ts) — 서버 types.ts와 모양이 같아야 한다

export interface OlympicsSportInfo {
  id: string
  name: string
  emoji: string
  rule: string
  /** sequential: 대표가 한 명씩 차례로 / simultaneous: 모든 대표가 동시에 */
  mode: 'sequential' | 'simultaneous' | 'duel'
  /** 차례로 하는 종목에서 팀마다 하는 시도 횟수 (육상은 0) */
  attempts: number
}

export interface OlympicsAttempt {
  hit: boolean
  score: number
  error: number
  /** 농구는 게이지 위치(x, 0~1), 양궁는 화살이 꽂힌 좌표 (미스면 null) */
  at: { x: number; y: number } | null
  /** 역도: 이 시도의 무게 */
  weight?: number
  /** 볼링: 힘 게이지의 초록 영역 중심 */
  zone?: number
}

export interface OlympicsGauge {
  kind: 'basketball' | 'archery' | 'bowling' | 'weightlifting'
  teamId: number
  attempt: number
  elapsedMs: number
  maxMs: number
  /** 볼링: 0 방향, 1 힘 */
  stage?: number
  aimAt?: number
  /** 역도: 고른 무게 */
  weight?: number
  speed?: number
  zoneCenter?: number
  zoneHalf?: number
  fx?: number
  fy?: number
  px?: number
  py?: number
}

export type BaseballPitchType = 'fastball' | 'curve' | 'changeup' | 'slider'
export type BaseballSwingType = 'row' | 'column' | 'down' | 'up'
export type BaseballOutcome = 'strike' | 'foul' | 'hit' | 'homerun'

/** 한 구의 결과 — 공개 단계에서만 온다 */
export interface BaseballReveal {
  pitchType: BaseballPitchType
  target: number
  zone: number[]
  swingType: BaseballSwingType
  swingCell: number
  swing: number[]
  outcome: BaseballOutcome
  strikeAdded: boolean
  batterOut: boolean
  limitReached: boolean
  points: number
}

export interface OlympicsBaseball {
  phase: 'pick' | 'reveal'
  pitchNo: number
  batterTeamId: number
  pitcherTeamId: number
  pitcherReady: boolean
  batterReady: boolean
  score: Record<number, number>
  hits: Record<number, number>
  homeruns: Record<number, number>
  strikes: Record<number, number>
  pitches: Record<number, number>
  out: number[]
  elapsedMs: number
  maxMs: number
  reveal: BaseballReveal | null
}

export type ZoneDuelKind = 'soccer' | 'pingpong'

/** 축구 승부차기·탁구: 한 번의 결과 — 공개 단계에서만 온다 */
export interface ZoneDuelReveal {
  attackZone: number
  defendZone: number
  result: 'goal' | 'saved' | 'return' | 'point'
  scorerTeamId: number | null
  rally: number
}

export interface OlympicsZoneDuel {
  kind: ZoneDuelKind
  phase: 'pick' | 'reveal'
  step: number
  attackerTeamId: number
  defenderTeamId: number
  attackerReady: boolean
  defenderReady: boolean
  score: Record<number, number>
  kicks: Record<number, boolean[]>
  target: number
  suddenDeath: boolean
  rally: number
  elapsedMs: number
  maxMs: number
  reveal: ZoneDuelReveal | null
}

/** 역도: 무게를 고르는 중 */
export interface OlympicsChoice {
  teamId: number
  attempt: number
  weights: number[]
  elapsedMs: number
  maxMs: number
}

export interface OlympicsRoundTeamResult {
  teamId: number
  rank: number
  points: number
  detail: string
}

export interface OlympicsRoundResult {
  roundIndex: number
  sportId: string
  teams: OlympicsRoundTeamResult[]
  totals: Record<number, number>
}

export type OlympicsPhase = 'intro' | 'play' | 'result' | 'ended'

export interface OlympicsStateSignal {
  roundIndex: number
  totalRounds: number
  phase: OlympicsPhase
  sport: OlympicsSportInfo
  teamOrder: number[]
  reps: Record<number, PlayerId>
  turnTeamId: number | null
  attempts: Record<number, OlympicsAttempt[]>
  gauge: OlympicsGauge | null
  choice: OlympicsChoice | null
  baseball: OlympicsBaseball | null
  zoneDuel: OlympicsZoneDuel | null
  track: { positions: Record<number, number>; finishTaps: number; durationMs: number; elapsedMs: number } | null
  totals: Record<number, number>
  roundResult: OlympicsRoundResult | null
}

export interface OlympicsTrackSignal {
  positions: Record<number, number>
}

export interface OlympicsRoundMeta {
  rounds: OlympicsRoundResult[]
  history: { sportId: string; reps: Record<number, PlayerId> }[]
}
