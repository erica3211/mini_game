import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 캐릭터 설명 (party/games/characterDescribe/team.ts 참고) — 서버 types.ts와 모양이 같아야 한다

export type CharacterCategory = '한국 만화' | '일본 애니' | '디즈니·픽사' | '히어로' | '게임' | '영화' | '동화' | '인기 캐릭터' | '서구 만화'

export interface CharacterChatEntry {
  id: number
  /** desc: 설명자의 설명(같은 팀만) / guess: 오답 채팅(모든 팀) */
  kind: 'desc' | 'guess'
  playerId: PlayerId
  teamId: number
  text: string
}

export interface CharacterSelectSignal {
  elapsedMs: number
  /** 내가 "설명하고 싶다"고 체크했는지 */
  want: boolean
}

export interface CharacterStartSignal {
  category: CharacterCategory
  /** 팀마다 설명하는 사람 */
  describerIds: Record<number, PlayerId>
  /** 설명자에게만 — 설명해야 하는 캐릭터 이름 */
  word: string | null
  elapsedMs: number
  lengthHint: number | null
  chosungHint: string | null
  chat: CharacterChatEntry[]
}

export interface CharacterEndSignal {
  answer: string
  category: CharacterCategory
  winnerTeamId: number | null
  solverId: PlayerId | null
  elapsedMs: number
  teams: { teamId: number; describerId: PlayerId; descriptions: string[] }[]
}

export type CharacterRoundMeta = CharacterEndSignal

export interface CharacterRejected {
  reason: 'name' | 'series' | 'rate'
  piece?: string
}

// 서버 types.ts와 값이 같아야 한다
export const CHARACTER_SELECT_MS = 5_000
export const CHARACTER_PLAY_MS = 60_000
export const CHARACTER_MAX_LINE_LENGTH = 40
export const CHARACTER_CHAT_LIMIT = 120

/** 화면이 들고 있는 캐릭터 설명 상태 — 서버가 보내는 여러 신호를 useGameSession이 세션 내내 받아 하나로 합쳐 둔다 */
export interface CharacterViewState {
  select: CharacterSelectSignal | null
  start: CharacterStartSignal | null
  chat: CharacterChatEntry[]
  end: CharacterEndSignal | null
  /** 설명이 막혔을 때 보여줄 안내 — seq가 바뀔 때마다 새로 보여준다 */
  notice: (CharacterRejected & { seq: number }) | null
}

const EMPTY: CharacterViewState = { select: null, start: null, chat: [], end: null, notice: null }

export type CharacterAction =
  | { type: 'select'; data: CharacterSelectSignal }
  | { type: 'start'; data: CharacterStartSignal }
  | { type: 'chat'; entry: CharacterChatEntry }
  | { type: 'hint'; data: { lengthHint?: number; chosungHint?: string } }
  | { type: 'end'; data: CharacterEndSignal }
  | { type: 'rejected'; data: CharacterRejected }

/** 서버 신호 하나를 화면 상태에 합친다 */
export function reduceCharacter(prev: CharacterViewState | null, action: CharacterAction): CharacterViewState {
  const state = prev ?? EMPTY
  switch (action.type) {
    case 'select':
      return { ...EMPTY, select: action.data }
    case 'start':
      // 설명자가 바뀌어 신호가 다시 와도 이미 나온 결과(end)는 그대로 둔다
      return { select: null, start: action.data, chat: action.data.chat, end: state.end, notice: state.notice }
    case 'chat':
      if (state.chat.some((entry) => entry.id === action.entry.id)) return state
      return { ...state, chat: [...state.chat, action.entry].slice(-CHARACTER_CHAT_LIMIT) }
    case 'hint':
      return state.start ? { ...state, start: { ...state.start, ...action.data } } : state
    case 'end':
      return { ...state, end: action.data }
    case 'rejected':
      return { ...state, notice: { ...action.data, seq: (state.notice?.seq ?? 0) + 1 } }
  }
}
