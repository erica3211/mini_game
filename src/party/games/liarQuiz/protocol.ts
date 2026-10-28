import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 거짓말쟁이 퀴즈 문제 방식 — random: 서버가 문항 은행에서 뽑는다, custom: 라운드가 시작되면 참가자가 각자 문제를 하나씩 만든다
export type LiarQuizQuestionMode = 'random' | 'custom'

// 거짓말쟁이 퀴즈 (party/games/liarQuiz/index.ts 참고)
// 보기의 정체 — truth는 진짜 정답, lie는 플레이어가 쓴 거짓말, filler는 모자란 자리를 채운 가짜 단어
export type LiarQuizChoiceKind = 'truth' | 'lie' | 'filler'

// 맞히는 사람 화면의 보기 — 정체(kind)와 작성자는 없다. id는 이번 턴에서만 쓰는 번호이고 섞인 위치와 같다
export interface LiarQuizChoice {
  id: number
  text: string
}

// 구경하는 사람(맞히는 사람 외 전원) 화면의 보기. 이들은 작성 단계에서 이미 진짜 정답을 봤으니, 진짜 정답(kind)과 거짓말 작성자(authorIds)를
// 처음부터 다 보여준다. 맞히는 사람에게만 이 둘이 가지 않는다
export interface LiarQuizSpectatorChoice extends LiarQuizChoice {
  kind: LiarQuizChoiceKind
  authorIds: PlayerId[]
}

// 공개 때 전원에게 보여주는 보기 — 구경하는 사람이 보던 것과 같은 모양이다
export type LiarQuizRevealChoice = LiarQuizSpectatorChoice

export interface LiarQuizTurnResult {
  turnIndex: number
  guesserId: PlayerId
  /** 직접 만든 문제를 낸 사람. 문항 은행에서 뽑은 문제면 null */
  questionAuthorId: PlayerId | null
  /** 빈칸('___') 포함 원문 */
  question: string
  answer: string
  /** 화면에 보이던 순서 그대로 */
  choices: LiarQuizRevealChoice[]
  /** 맞히는 사람이 고른 보기 id. 시간 안에 고르지 못했으면 null */
  pickedId: number | null
  guesserPoints: number
  /** 속은 경우 그 거짓말 작성자들만 {작성자: 점수}. 아니면 빈 객체 */
  authorPoints: Record<PlayerId, number>
  /** 거짓말이 5개를 넘어 뽑히지 못한 거짓말 (작성자는 점수를 못 받는다) */
  droppedLies: { playerId: PlayerId; text: string }[]
}

export interface LiarQuizRoundMeta {
  turns: LiarQuizTurnResult[]
}

// 직접 문제 만들기: 각자 낸 문제 (본인에게만 돌아온다)
export interface LiarQuizQuestionDraft {
  /** 빈칸('___') 하나가 들어 있는 문제 문장 */
  text: string
  /** 빈칸에 들어갈 진짜 정답 */
  answer: string
  /** 선택 입력인 가짜 답안 (없어도 된다) */
  fakes: string[]
}

// 문제 입력 단계 신호 (직접 문제 만들기 방식에서만, 라운드 시작 직후)
export interface LiarQuizComposeSignal {
  elapsedMs: number
  /** 이미 낸 사람이면 true — 이때 mine은 낸 내용 */
  submitted: boolean
  mine: LiarQuizQuestionDraft | null
  submittedCount: number
  totalPlayers: number
}

export interface LiarQuizWriteSignal {
  turnIndex: number
  totalTurns: number
  guesserId: PlayerId
  /** 직접 만든 문제를 낸 사람. 문항 은행에서 뽑은 문제면 null */
  questionAuthorId: PlayerId | null
  question: string
  /** 거짓말을 쓰는 사람에게만 값이 있다. 맞히는 사람은 항상 null */
  answer: string | null
  /** 내가 낸 거짓말 (안 냈거나 맞히는 사람이면 null) */
  myLie: string | null
  submittedCount: number
  totalLiars: number
  elapsedMs: number
}

export interface LiarQuizGuessSignal {
  turnIndex: number
  totalTurns: number
  guesserId: PlayerId
  questionAuthorId: PlayerId | null
  question: string
  /** 맞히는 사람은 LiarQuizChoice[], 구경하는 사람은 LiarQuizSpectatorChoice[] */
  choices: (LiarQuizChoice | LiarQuizSpectatorChoice)[]
  /** 맞히는 사람의 현재 임시 선택 보기 id (없으면 null) */
  pickedId: number | null
  elapsedMs: number
  /** 결과를 공개하는 중이면 그 턴의 결과 */
  reveal?: LiarQuizTurnResult | null
}

// 거짓말쟁이 퀴즈: 거짓말 작성 / 맞히기 제한 시간, 거짓말 한 개의 최대 글자 수 (backend/types.ts와 값이 같아야 한다)
export const LIARQUIZ_WRITE_MS = 30_000
export const LIARQUIZ_GUESS_MS = 20_000
export const LIARQUIZ_LIE_MAX_LENGTH = 30
// 직접 문제 만들기: 문제 입력 단계 제한 시간, 문제 문장의 최대 글자 수, 가짜 답안 최대 개수 (backend/types.ts와 값이 같아야 한다)
export const LIARQUIZ_COMPOSE_MS = 90_000
export const LIARQUIZ_QUESTION_MAX_LENGTH = 80
export const LIARQUIZ_FAKE_MAX_COUNT = 5
