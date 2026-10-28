import type { PlayerId } from '../../../shared/lib/partyProtocol'
import type { CatchmindStroke } from '../catchmind/protocol'

// 이어그리기: 첫 제시어를 정하는 방식 (방장이 대기실에서 고른다)
export type TelestrationWordMode = 'random' | 'custom'

// 이어그리기: 한 단계의 종류 — 그림을 그리거나(draw), 앞사람의 그림을 글로 설명한다(write)
export type TelestrationStepKind = 'draw' | 'write'

// 이어그리기: 단계 하나의 결과물 (kind가 draw면 strokes, write면 text가 채워진다)
export interface TelestrationStepRecord {
  playerId: PlayerId
  kind: TelestrationStepKind
  text?: string
  strokes?: CatchmindStroke[]
}

// 이어그리기: 투표 화면에 공개하는 체인 하나 — 첫 제시어부터 마지막 단계까지의 전달 과정
export interface TelestrationChainReveal {
  initialWord: string
  steps: TelestrationStepRecord[]
}

// 이어그리기: 결과 화면용 체인 기록 — 단계마다 받은 표 수가 붙는다 (party/games/telestration/index.ts 참고)
export interface TelestrationChainMeta {
  initialWord: string
  steps: (TelestrationStepRecord & { votes: number })[]
}

export interface TelestrationRoundMeta {
  chains: TelestrationChainMeta[]
}

// 이어그리기: 한 단계에서 본인에게 주어지는 입력물 — 첫 단계는 제시어, 이후는 앞사람의 글 또는 그림
export type TelestrationPrompt =
  | { type: 'word'; word: string }
  | { type: 'text'; text: string }
  | { type: 'drawing'; strokes: CatchmindStroke[] }

// 이어그리기: 그림 단계 / 글 단계 제한 시간 (전원이 제출하면 조기에 다음 단계로 넘어간다)
export const TELESTRATION_DRAW_TIMEOUT_MS = 60_000
export const TELESTRATION_WRITE_TIMEOUT_MS = 30_000
// 이어그리기: 직접 입력 방식에서 제시어를 적는 제한 시간 / 제시어 최대 길이
export const TELESTRATION_WORD_TIMEOUT_MS = 30_000
export const TELESTRATION_MAX_WORD_LENGTH = 20
// 이어그리기: 클라이언트가 제한 시간 끝에 자동 제출하는 것을 기다려주는 서버 유예 시간
export const TELESTRATION_SUBMIT_GRACE_MS = 2_000
// 이어그리기: 모든 단계가 끝난 뒤 체인을 돌려보며 투표하는 제한 시간
export const TELESTRATION_VOTE_TIMEOUT_MS = 240_000
// 이어그리기: 글 단계 입력 최대 길이
export const TELESTRATION_MAX_TEXT_LENGTH = 60
// 이어그리기: 시간 안에 글을 못 쓴 단계에 대신 채워 넣는 문구
export const TELESTRATION_EMPTY_TEXT = '(시간 초과)'
// 이어그리기: 제출 한 번에 담을 수 있는 획 개수 / 획당 좌표 개수 / 전체 좌표 개수 상한 — 변조 등 비정상 요청 방어용
export const TELESTRATION_MAX_STROKES = 300
export const TELESTRATION_MAX_POINTS_PER_STROKE = 2_000
export const TELESTRATION_MAX_TOTAL_POINTS = 12_000
