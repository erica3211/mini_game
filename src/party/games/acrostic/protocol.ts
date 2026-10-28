import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 막장 행시: 투표 화면에 보이는 작품 한 편 — 작성자는 숨기고, id는 이번 투표에서만 쓰는 번호다
export interface AcrosticPoem {
  id: number
  lines: string[]
}

// 막장 행시: 결과 화면에 전원 공개하는 작품 — 작성자와 투표자가 드러난다 (party/games/acrostic/index.ts 참고)
export interface AcrosticPoemResult {
  playerId: PlayerId
  lines: string[]
  votes: number
  voterIds: PlayerId[]
}

export interface AcrosticRoundMeta {
  word: string
  /** 득표 많은 순 */
  poems: AcrosticPoemResult[]
}

export interface AcrosticWriteSignal {
  word: string
  /** 이미 낸 사람이면 true — 이때 lines는 낸 내용 */
  submitted: boolean
  lines: string[] | null
  elapsedMs: number
}

export interface AcrosticVoteSignal {
  word: string
  poems: AcrosticPoem[]
  /** 내 작품 번호(투표 불가). 제출하지 않았으면 null */
  myPoemId: number | null
  voted: boolean
  /** 투표한 작품 번호 (기권이면 null) */
  myVote: number | null
  elapsedMs: number
}

// 막장 행시: 작성 단계 / 투표 단계 제한 시간, 한 줄의 최대 글자 수 (backend/types.ts와 값이 같아야 한다)
export const ACROSTIC_WRITE_MS = 60_000
export const ACROSTIC_VOTE_MS = 20_000
export const ACROSTIC_LINE_MAX_LENGTH = 40
