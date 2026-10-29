import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 이모티콘 퀴즈 (party/games/emojiCharades/team.ts 참고) — 서버 types.ts와 모양이 같아야 한다

export type EmojiPromptCategory = '영화' | '노래' | '드라마' | '직업' | '브랜드' | '캐릭터' | '음식'

export interface EmojiCharadesChatEntry {
  id: number
  playerId: PlayerId
  text: string
}

export interface EmojiCharadesSelectSignal {
  elapsedMs: number
  /** 내가 "이모티콘으로 표현하고 싶다"고 체크했는지 */
  want: boolean
}

export interface EmojiCharadesStartSignal {
  category: EmojiPromptCategory
  /** 팀마다 이모티콘으로 표현하는 사람 */
  expresserIds: Record<number, PlayerId>
  /** 표현자에게만 — 표현해야 하는 제시어 */
  word: string | null
  emojis: string[]
  maxEmojis: number
  elapsedMs: number
  lengthHint: number | null
  chosungHint: string | null
  chat: EmojiCharadesChatEntry[]
}

export interface EmojiCharadesEndSignal {
  answer: string
  winnerTeamId: number | null
  solverId: PlayerId | null
  elapsedMs: number
  teams: { teamId: number; expresserId: PlayerId; emojis: string[] }[]
}

export interface EmojiCharadesRoundMeta extends EmojiCharadesEndSignal {
  category: EmojiPromptCategory
}

/** 화면이 들고 있는 이모티콘 퀴즈 상태 — 서버가 보내는 여러 신호를 useGameSession이 세션 내내 받아 하나로 합쳐 둔다 */
export interface EmojiCharadesViewState {
  select: EmojiCharadesSelectSignal | null
  start: EmojiCharadesStartSignal | null
  /** 내 팀이 지금 쌓은 이모티콘 (실시간) */
  emojis: string[]
  chat: EmojiCharadesChatEntry[]
  end: EmojiCharadesEndSignal | null
}

// 서버 types.ts와 값이 같아야 한다
export const EMOJI_CHARADES_SELECT_MS = 5_000
export const EMOJI_CHARADES_PLAY_MS = 60_000
export const EMOJI_CHARADES_CHAT_LIMIT = 100

const EMPTY: EmojiCharadesViewState = { select: null, start: null, emojis: [], chat: [], end: null }

export type EmojiCharadesAction =
  | { type: 'select'; data: EmojiCharadesSelectSignal }
  | { type: 'start'; data: EmojiCharadesStartSignal }
  | { type: 'emojis'; emojis: string[] }
  | { type: 'chat'; entry: EmojiCharadesChatEntry }
  | { type: 'hint'; data: { lengthHint?: number; chosungHint?: string } }
  | { type: 'end'; data: EmojiCharadesEndSignal }

/** 서버 신호 하나를 화면 상태에 합친다 */
export function reduceEmojiCharades(prev: EmojiCharadesViewState | null, action: EmojiCharadesAction): EmojiCharadesViewState {
  const state = prev ?? EMPTY
  switch (action.type) {
    case 'select':
      return { ...EMPTY, select: action.data }
    case 'start':
      // 표현자가 바뀌어 신호가 다시 와도 이미 나온 결과(end)는 그대로 둔다
      return { select: null, start: action.data, emojis: action.data.emojis, chat: action.data.chat, end: state.end }
    case 'emojis':
      return { ...state, emojis: action.emojis }
    case 'chat':
      if (state.chat.some((entry) => entry.id === action.entry.id)) return state
      return { ...state, chat: [...state.chat, action.entry].slice(-EMOJI_CHARADES_CHAT_LIMIT) }
    case 'hint':
      return state.start ? { ...state, start: { ...state.start, ...action.data } } : state
    case 'end':
      return { ...state, end: action.data }
  }
}
