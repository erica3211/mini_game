import type { PlayerId } from '../../../shared/lib/partyProtocol'

export type BalloonPopStatus = 'alive' | 'popped' | 'stopped'

// 풍선 담력 테스트: 결과 화면에서 전원 공개하는 참가자별 상세
export interface BalloonPopPlayerResult {
  playerId: PlayerId
  pumps: number
  status: BalloonPopStatus
  /** 이 참가자의 숨겨진 터짐 임계값 — 안전하게 멈춘 사람도 "사실 몇 번까지 버틸 수 있었는지" 결과 화면에서 확인 가능 */
  threshold: number
}

export interface BalloonPopRoundMeta {
  results: BalloonPopPlayerResult[]
}
export const BALLOON_POP_MAX_PUMPS = 50
export const BALLOON_POP_ROUND_TIMEOUT_MS = 20_000
export const BALLOON_POP_REVEAL_MS = 2_000
