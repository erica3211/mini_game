import type { ScavengerHuntColorTarget } from './partyProtocol'

// 카메라 화면 중앙 가이드 틀이 프레임의 짧은 변 기준 몇 %를 차지하는지 — 색상 검증 모드는 이 비율 그대로
// 크롭한 영역만 분석한다. 카메라 UI(ScavengerHuntGame.tsx)의 가이드 틀 오버레이도 반드시 같은 값을 써야 한다.
// 너무 넓게 크롭하면(예: 예전 0.7) 물건이 화면을 다 못 채웠을 때 배경이 많이 섞여 들어와 점수가 부당하게
// 낮아지므로, 물건에 더 바짝 붙여서 찍도록 유도하기 위해 0.5로 좁혔다
export const SCAVENGER_HUNT_GUIDE_FRAME_RATIO = 0.5

// coco-ssd/tfjs는 번들 크기가 커서(수 MB) 사물 인식 라운드를 실제로 만났을 때만 지연 로딩한다.
// 모듈 스코프 싱글턴 프로미스로 캐싱해 여러 번 호출해도 한 번만 다운로드/초기화된다
let cocoSsdModelPromise: Promise<import('@tensorflow-models/coco-ssd').ObjectDetection> | null = null

export function preloadCocoSsdModel() {
  if (!cocoSsdModelPromise) {
    cocoSsdModelPromise = (async () => {
      const [tf, cocoSsd] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')])
      await tf.ready()
      return cocoSsd.load({ base: 'lite_mobilenet_v2' })
    })()
  }
  return cocoSsdModelPromise
}

// 사물 인식 모드: 촬영된 캔버스에서 목표 클래스가 검출된 신뢰도(0~1)를 0~100 일치율로 변환.
// 검출 자체가 안 됐거나(=완전히 다른 물건) 목표 클래스가 전혀 없으면 0을 반환한다
export async function detectObjectMatch(canvas: HTMLCanvasElement, targetCocoClass: string): Promise<number> {
  const model = await preloadCocoSsdModel()
  // 기본 minScore(0.5)는 실내 조명/각도가 안 좋은 캐주얼한 사진에는 다소 엄격해서 0.2로 낮춰
  // 약하게라도 검출되면 부분 점수를 받을 수 있게 한다
  const predictions = await model.detect(canvas, 10, 0.2)
  const bestScore = predictions
    .filter((p) => p.class === targetCocoClass)
    .reduce((max, p) => Math.max(max, p.score), 0)
  return Math.round(bestScore * 100)
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  if (h < 0) h += 360

  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

// 색상각은 원형이라 0도와 360도가 사실 같은 색이므로, 두 각도의 "짧은 쪽" 거리를 구한다 (0~180)
function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// 색상각/채도/명도 각각에서 목표값과 얼마나 가까운지를 0(전혀 다름)~1(완전 일치)로 환산 —
// 하드 threshold 대신 거리에 비례해 완만하게 감점되므로, 예를 들어 빨강이 제시어일 때 진한 빨강은
// 100%에 가깝게, 분홍처럼 색상각은 비슷하지만 채도가 낮은 색도 어느 정도 점수를 받는다.
// 색조 톨러런스는 이웃한 제시어끼리(예: 빨강 vs 주황, 30도 간격) 너무 많이 겹치지 않을 정도로 좁혔다
const HUE_TOLERANCE_DEG = 30
const SAT_TOLERANCE = 0.45
const VAL_TOLERANCE = 0.4
// 무채색(검정/흰색/회색)은 색상각이 의미가 없으므로 명도가 목표에 얼마나 가까운지가 점수를 곱셈으로
// 좌우하고(명도가 완전히 틀리면 채도가 아무리 낮아도 점수가 나지 않는다), 채도가 낮을수록(=색이 안
// 섞였을수록) 최대 30%까지 보너스를 얹는다
const ACHROMATIC_VAL_TOLERANCE = 0.4
const ACHROMATIC_SAT_MAX = 0.35

function pixelCloseness(h: number, s: number, v: number, target: ScavengerHuntColorTarget): number {
  if (target.achromatic) {
    const valScore = Math.max(0, 1 - Math.abs(v - target.value) / ACHROMATIC_VAL_TOLERANCE)
    const satPenalty = Math.max(0, 1 - s / ACHROMATIC_SAT_MAX)
    return valScore * (0.7 + 0.3 * satPenalty)
  }
  const hueScore = Math.max(0, 1 - circularHueDistance(h, target.hue) / HUE_TOLERANCE_DEG)
  const satScore = Math.max(0, 1 - Math.abs(s - target.saturation) / SAT_TOLERANCE)
  const valScore = Math.max(0, 1 - Math.abs(v - target.value) / VAL_TOLERANCE)
  // hueScore를 곱셈으로 걸어서(가중합이 아니라) 색조가 완전히 다르면 채도/명도가 아무리 좋아도(예: 새파란
  // 물건도 채도·명도만 보면 "vivid"하다) 점수가 나지 않게 한다 — 채도/명도는 어디까지나 "색조는 맞는데
  // 얼마나 선명/밝은가"를 보정하는 역할이지, 그 자체로 점수의 바닥을 깔아주면 안 된다
  return hueScore * (0.4 + 0.3 * satScore + 0.3 * valScore)
}

// 가이드 틀 안에서 물건이 차지하는 면적이 작아도(=배경이 많이 섞여도) 억울하게 낮은 점수를 받지 않도록,
// 전체 픽셀 평균이 아니라 "가장 목표 색에 가까운 상위 N%"만 평균 낸다 — 배경이 목표색과 안 비슷하면
// 어차피 상위권에 못 들어 자연히 걸러진다
const TOP_FRACTION = 0.3

// 색상 검증 모드: 촬영된 캔버스의 중앙 가이드 틀 영역만 크롭해서, 픽셀별 목표색 근접도의 상위 30% 평균을
// 0~100 일치율로 반환한다
export function analyzeColorMatch(canvas: HTMLCanvasElement, target: ScavengerHuntColorTarget): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0

  const cropSize = Math.round(Math.min(canvas.width, canvas.height) * SCAVENGER_HUNT_GUIDE_FRAME_RATIO)
  const cropX = Math.round((canvas.width - cropSize) / 2)
  const cropY = Math.round((canvas.height - cropSize) / 2)
  const { data } = ctx.getImageData(cropX, cropY, cropSize, cropSize)

  // 픽셀 전체를 다 보면 큰 사진에서 느려질 수 있어 4픽셀 간격으로 샘플링한다
  const strideBytes = 4 * 4
  const scores: number[] = []
  for (let i = 0; i < data.length; i += strideBytes) {
    const { h, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2])
    scores.push(pixelCloseness(h, s, v, target))
  }
  if (scores.length === 0) return 0

  scores.sort((a, b) => b - a)
  const topCount = Math.max(1, Math.round(scores.length * TOP_FRACTION))
  const topAverage = scores.slice(0, topCount).reduce((sum, score) => sum + score, 0) / topCount
  return Math.round(Math.min(1, Math.max(0, topAverage)) * 100)
}

// 촬영 모드에 맞춰 사물 인식/색상 검증 중 하나를 실행하는 공통 진입점
export async function analyzeScavengerHuntCapture(
  canvas: HTMLCanvasElement,
  target: { mode: 'object' | 'color'; object?: { cocoClass: string }; color?: ScavengerHuntColorTarget },
): Promise<number> {
  if (target.mode === 'object' && target.object) return detectObjectMatch(canvas, target.object.cocoClass)
  if (target.mode === 'color' && target.color) return analyzeColorMatch(canvas, target.color)
  return 0
}
