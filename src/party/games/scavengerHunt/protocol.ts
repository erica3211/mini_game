import type { PlayerId } from '../../../shared/lib/partyProtocol'

export type ScavengerHuntMode = 'object' | 'color'

// 사물 인식 모드 제시어 — cocoClass는 TensorFlow.js COCO-SSD 모델이 반환하는 영문 클래스명과 정확히 일치한다
export interface ScavengerHuntObjectTarget {
  cocoClass: string
  label: string
}

// 색상 검증 모드 제시어 — 촬영한 사진의 가이드 틀 영역 픽셀을 HSV로 변환해 이 "이상적인" 색과 얼마나
// 가까운지를 연속적인 점수로 매긴다 (하드 threshold가 아니라 거리 기반 감점). achromatic이면(검정/흰색/회색)
// hue는 무시하고 명도(value)와 낮은 채도로만 판단한다. 실제 계산은 party/games/scavengerHunt/scavengerHuntVision.ts 참고
export interface ScavengerHuntColorTarget {
  id: string
  label: string
  achromatic: boolean
  hue: number
  saturation: number
  value: number
}

export interface ScavengerHuntRoundTarget {
  mode: ScavengerHuntMode
  object?: ScavengerHuntObjectTarget
  color?: ScavengerHuntColorTarget
}

// 스캐빈저 헌트: 세부 라운드 하나가 끝났을 때 결과 화면에 전원 공개하는 참가자별 상세
export interface ScavengerHuntSubRoundResult {
  subRoundIndex: number
  target: ScavengerHuntRoundTarget
  picks: Record<
    PlayerId,
    {
      matchPercent: number
      matchScore: number
      speedScore: number
      roundScore: number
      submitted: boolean
      /** 결과 화면에서 전원에게 공개하는 작은 썸네일(dataURL) — 촬영은 했지만 사진 전송이 없었거나 미제출이면 없다 */
      photo?: string
    }
  >
}

export interface ScavengerHuntRoundMeta {
  subRounds: ScavengerHuntSubRoundResult[]
}
export const SCAVENGER_HUNT_SUB_ROUNDS = 3
export const SCAVENGER_HUNT_SUB_ROUND_MS = 30_000
export const SCAVENGER_HUNT_REVEAL_MS = 3_000
