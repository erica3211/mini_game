import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 네글자 퀴즈 (party/games/fourChars/team.ts 참고) — 서버 types.ts와 모양이 같아야 한다

/** 팀 한 곳의 현재 상태 */
export interface FourCharsTeamState {
  teamId: number
  alive: boolean
  /** 지금까지 맞힌 문제 수 */
  correct: number
}

/** 개인전에서 한 사람이 지금까지 맞힌 문제 수 */
export interface FourCharsPlayerScore {
  playerId: PlayerId
  correct: number
}

/** 개인전(모두 같은 문제)에서 한 사람의 답 */
export interface FourCharsAnswer {
  playerId: PlayerId
  submitted: string | null
  correct: boolean
}

/** 답을 낸 사람 수 / 푸는 사람 수 */
export interface FourCharsProgress {
  submitted: number
  total: number
}

/** 한 턴이 끝났을 때 전원에게 공개하는 결과 */
export interface FourCharsTurnResult {
  turnIndex: number
  teamId: number
  answererId: PlayerId
  correct: boolean
  timedOut: boolean
  submitted: string | null
  /** 대표 정답 (가려져 있던 두 글자) */
  answer: string
  /** 대표 정답으로 완성한 네 글자 */
  word: string
  /** 대표 정답으로 완성한 낱말의 뜻 */
  meaning: string
  questionKey: string
  teamStates: FourCharsTeamState[]
  /** 개인전에서만: 사람별 맞힌 수 */
  scores?: FourCharsPlayerScore[]
  /** 개인전에서만: 사람별 답 */
  answers?: FourCharsAnswer[]
}

export interface FourCharsTurnSignal {
  turnIndex: number
  cycle: number
  maxCycles: number
  teamId: number
  answererId: PlayerId
  /** 네 글자 — 가려진 자리는 null */
  chars: (string | null)[]
  /** 문제의 분류 — 이것이 힌트다. 제한 시간이 10초 남을 때까지는 null */
  category: string | null
  elapsedMs: number
  teamStates: FourCharsTeamState[]
  /** 개인전에서만: 사람별 맞힌 수 */
  scores?: FourCharsPlayerScore[]
  /** 개인전에서만: 모두가 같은 문제를 동시에 푼다 */
  everyone?: boolean
  /** 개인전에서만: 지금까지 답을 낸 사람 수 */
  progress?: FourCharsProgress
  /** 결과를 공개하는 중이라면 그 결과 (턴이 끝나면 세션이 신호에 합쳐 둔다) */
  result: FourCharsTurnResult | null
}

export interface FourCharsRoundMeta {
  turns: FourCharsTurnResult[]
  teamStates: FourCharsTeamState[]
  eliminatedCycle: { teamId: number; cycle: number }[]
  /** 개인전에서만: 사람별 맞힌 수 */
  scores?: FourCharsPlayerScore[]
}

// 한 턴의 제한 시간 (backend/party/games/fourChars/types.ts와 값이 같아야 한다)
export const FOUR_CHARS_TURN_MS = 20_000
