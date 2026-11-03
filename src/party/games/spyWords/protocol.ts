import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 스파이 단어판 (party/games/spyWords/team.ts) — 서버 types.ts와 모양이 같아야 한다

export const SPY_COLS = 5
export const SPY_MIN_COUNT = 1
export const SPY_MAX_COUNT = 9
export const SPY_HINT_MAX_LENGTH = 10

/** 칸의 주인 — 팀 번호, 중립, 함정(암살자) */
export type SpyOwner = number | 'neutral' | 'assassin'

export type SpyPhase = 'hint' | 'guess' | 'ended'

export type SpyEvent =
  | { kind: 'hint'; teamId: number; word: string; count: number }
  | { kind: 'reveal'; teamId: number; index: number; owner: SpyOwner }
  | { kind: 'pass'; teamId: number; reason: 'chosen' | 'timeout' | 'absent' }
  | { kind: 'eliminated'; teamId: number }

export interface SpyCard {
  word: string
  revealed: SpyOwner | null
  /** 스파이 마스터(또는 끝난 뒤 모두)에게만 오는, 안 열린 칸의 주인 */
  key?: SpyOwner
}

export interface SpyTeamStatus {
  teamId: number
  remaining: number
  eliminated: boolean
  spymasterId: PlayerId
}

export interface SpyWordsStateSignal {
  phaseNo: number
  phase: SpyPhase
  turnTeamId: number
  phaseElapsedMs: number
  phaseMs: number
  totalElapsedMs: number
  totalMs: number
  hint: { word: string; count: number } | null
  maxPicks: number
  cards: SpyCard[]
  candidates: number[]
  teams: SpyTeamStatus[]
  events: SpyEvent[]
}

export interface SpyWordsEndSignal {
  reason: 'completed' | 'lastTeam' | 'time'
  teams: { teamId: number; remaining: number; eliminated: boolean; rank: number }[]
  owners: SpyOwner[]
}

export interface SpyWordsRoundMeta {
  end: SpyWordsEndSignal
  words: string[]
  revealed: boolean[]
}

/** 힌트를 서버에 보내기 전에 확인한다 — 서버(checkSpyHint)와 같은 기준이고, 안 되는 까닭을 알려 준다. 통과하면 null */
export function spyHintError(rawWord: string, boardWords: readonly string[]): string | null {
  const word = rawWord.trim()
  if (word.length === 0) return '힌트 단어를 써 주세요.'
  if (/\s/.test(word)) return '힌트는 한 단어만 쓸 수 있어요.'
  if (word.length > SPY_HINT_MAX_LENGTH) return `힌트는 ${SPY_HINT_MAX_LENGTH}글자까지예요.`
  for (const board of boardWords) {
    if (word === board || board.includes(word) || (board.length >= 2 && word.includes(board))) return `판에 있는 "${board}"와 겹치는 말은 쓸 수 없어요.`
  }
  return null
}
