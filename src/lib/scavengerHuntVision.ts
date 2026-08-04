import type { ScavengerHuntColorTarget } from './partyProtocol'

// 카메라 화면 중앙 가이드 틀이 프레임의 짧은 변 기준 몇 %를 차지하는지 — 색상 검증 모드는 이 비율 그대로
// 크롭한 영역만 분석한다. 카메라 UI(ScavengerHuntGame.tsx)의 가이드 틀 오버레이도 반드시 같은 값을 써야 한다.
export const SCAVENGER_HUNT_GUIDE_FRAME_RATIO = 0.7

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

function hueInRange(hue: number, min: number, max: number): boolean {
  // min > max면 0도를 넘어가는 색상(예: 빨강)이므로 OR로 판정한다
  return min <= max ? hue >= min && hue <= max : hue >= min || hue <= max
}

// 색상 검증 모드: 촬영된 캔버스의 중앙 가이드 틀 영역만 크롭해서, 목표 HSV 범위 안에 드는 픽셀 비율(0~100)을 계산한다
export function analyzeColorMatch(canvas: HTMLCanvasElement, target: ScavengerHuntColorTarget): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0

  const cropSize = Math.round(Math.min(canvas.width, canvas.height) * SCAVENGER_HUNT_GUIDE_FRAME_RATIO)
  const cropX = Math.round((canvas.width - cropSize) / 2)
  const cropY = Math.round((canvas.height - cropSize) / 2)
  const { data } = ctx.getImageData(cropX, cropY, cropSize, cropSize)

  // 픽셀 전체를 다 보면 큰 사진에서 느려질 수 있어 4픽셀 간격으로 샘플링한다
  const strideBytes = 4 * 4
  let matched = 0
  let sampled = 0
  for (let i = 0; i < data.length; i += strideBytes) {
    const { h, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2])
    sampled++
    if (hueInRange(h, target.hueMin, target.hueMax) && s >= target.satMin && v >= target.valMin && v <= target.valMax) {
      matched++
    }
  }
  return sampled === 0 ? 0 : Math.round((matched / sampled) * 100)
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
