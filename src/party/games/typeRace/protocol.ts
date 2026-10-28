import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 타자 질주: 라운드 종료 후 결과 화면에 전원 공개하는 참가자별 평균 타자 속도(분당 실제 키보드 입력 횟수, 한컴타자연습식)
export interface TypeRaceRoundMeta {
  avgCpm: Record<PlayerId, number>
}
export const TYPE_RACE_ROUND_TIMEOUT_MS = 90_000
export const TYPE_RACE_FINISH_PROGRESS = 100
