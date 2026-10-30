import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 글자색 대결 (party/games/stroop) — 서버 types.ts와 모양이 같아야 한다

/**
 * 문제 유형 — ink: 글자의 색을 고른다 / word: 어떤 색으로 쓰인 글자를 누른다 /
 * chain: 어떤 글자의 칠해진 색을 찾고 그 색 이름의 글자를 누른다 / chainRev: 어떤 색으로 칠해진 글자가 말하는 색을 찾고 그 색으로 칠해진 글자를 누른다
 */
export type StroopQuestionType = 'ink' | 'word' | 'chain' | 'chainRev'

export interface StroopWord {
  /** 글자가 말하는 색의 번호 */
  nameColor: number
  /** 실제로 칠해진 색의 번호 */
  ink: number
}

export interface StroopPlayerResult {
  playerId: PlayerId
  answeredMs: number | null
  points: number
}

export interface StroopQuestionResult {
  questionIndex: number
  /** 정답 — ink 유형이면 색 번호, 그 밖의 유형이면 글자 번호 */
  answer: number
  results: StroopPlayerResult[]
  totals: Record<PlayerId, number>
}

export interface StroopQuestionSignal {
  questionIndex: number
  totalQuestions: number
  type: StroopQuestionType
  words: StroopWord[]
  /** ink·chain 유형: 물어볼 글자의 번호 / word·chainRev 유형: 시작점이 되는 칠해진 색의 번호 */
  target: number
  options: number[]
  /** 이 문제의 제한 시간 */
  timeoutMs: number
  elapsedMs: number
  answeredIds: PlayerId[]
  mine?: { answered: boolean; lockRemainingMs: number }
  reveal: StroopQuestionResult | null
  totals: Record<PlayerId, number>
}

export interface StroopRoundMeta {
  questions: StroopQuestionResult[]
}

/**
 * 색의 이름과 값 — 서버가 색을 번호로 주고받으니 순서가 서버(stroop/colors.ts)와 같아야 한다.
 * 칩 바탕이 밝은 회색이라 어떤 색이든(검정 포함) 라이트·다크 모드에서 똑같이 잘 보인다. 노랑은 밝은 바탕에서 안 보이지 않게 진한 노랑으로 한다.
 */
export const STROOP_COLORS = [
  { name: '빨간색', value: '#e11d1d' },
  { name: '파란색', value: '#1d4ed8' },
  { name: '노란색', value: '#e5b800' },
  { name: '초록색', value: '#16a34a' },
  { name: '보라색', value: '#7e22ce' },
  { name: '주황색', value: '#ea6a00' },
  { name: '검정색', value: '#111111' },
  { name: '분홍색', value: '#ec4899' },
]
