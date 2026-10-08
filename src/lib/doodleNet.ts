import { CATCHMIND_CANVAS_HEIGHT, CATCHMIND_CANVAS_WIDTH } from './catchmindDraw'
import type { CatchmindStroke } from './partyProtocol'

// DoodleNet(ml5, MIT): Quick, Draw! 345종으로 학습된 28x28 흑백 낙서 분류기. public/models/doodlenet/에 함께 배포한다
const MODEL_URL = '/models/doodlenet/model.json'
const INPUT_SIZE = 28
// 획을 이 크기의 정사각형에 먼저 다시 그린 뒤 단계적으로 28까지 줄인다 — 한 번에 줄이면 얇은 선이 끊겨 사라진다
const RENDER_SIZE = 224
// 그림 둘레 여백 비율 (Quick, Draw! 비트맵도 가장자리에 살짝 여백이 있다)
const PADDING_RATIO = 0.1
// 사용자 펜 굵기와 무관하게 28px 기준 약 1.5px 두께로 통일한다 — 학습 데이터의 선 굵기에 맞춘 값
const INK_WIDTH = (RENDER_SIZE / INPUT_SIZE) * 1.5
const ERASER_COLOR = '#ffffff'
// 28x28 입력에서 가장 진한 픽셀이 이보다 옅으면 보이는 잉크가 없다고 본다
const MIN_VISIBLE_INK = 0.1

export interface DoodleGuess {
  /** DOODLE_CLASSES 인덱스 (= 모델 출력 인덱스) */
  index: number
  probability: number
}

type LayersModel = import('@tensorflow/tfjs').LayersModel
type Tf = typeof import('@tensorflow/tfjs')

// tfjs는 번들이 커서(수 MB) 이 페이지에 들어왔을 때만 지연 로딩하고, 모듈 스코프 싱글턴으로 한 번만 받는다
// (scavengerHuntVision.ts의 preloadCocoSsdModel과 같은 방식)
let modelPromise: Promise<{ tf: Tf; model: LayersModel }> | null = null

export function preloadDoodleModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      await tf.ready()
      const model = await tf.loadLayersModel(MODEL_URL)
      // 첫 추론은 WebGL 셰이더 컴파일 때문에 1초 넘게 걸린다 — 시작 전에 빈 입력으로 한 번 돌려둬서
      // 1번 문제에서만 AI 반응이 늦어 플레이어 시간이 깎이는 일이 없게 한다
      tf.tidy(() => (model.predict(tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 1])) as import('@tensorflow/tfjs').Tensor).dataSync())
      return { tf, model }
    })()
    // 실패한 프로미스를 캐싱해두면 '다시 시도'해도 계속 실패하므로 비운다
    modelPromise.catch(() => {
      modelPromise = null
    })
  }
  return modelPromise
}

/** 지우개가 아닌 획들이 차지하는 영역(캔버스 픽셀 좌표). 그린 게 없으면 null */
function inkBounds(strokes: CatchmindStroke[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    if (stroke.color === ERASER_COLOR) continue
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x * CATCHMIND_CANVAS_WIDTH)
      maxX = Math.max(maxX, p.x * CATCHMIND_CANVAS_WIDTH)
      minY = Math.min(minY, p.y * CATCHMIND_CANVAS_HEIGHT)
      maxY = Math.max(maxY, p.y * CATCHMIND_CANVAS_HEIGHT)
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** 그림 영역만 정사각형으로 잘라, 색과 펜 굵기를 무시하고 검은 선으로 다시 그린 28x28 캔버스를 만든다 */
function renderModelInput(strokes: CatchmindStroke[]): HTMLCanvasElement | null {
  const bounds = inkBounds(strokes)
  if (!bounds) return null

  const side = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
  const scale = (RENDER_SIZE * (1 - 2 * PADDING_RATIO)) / side
  // 긴 변 기준으로 맞추고 짧은 변 쪽은 가운데 정렬
  const offsetX = (RENDER_SIZE - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale
  const offsetY = (RENDER_SIZE - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale

  let canvas = document.createElement('canvas')
  canvas.width = canvas.height = RENDER_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, RENDER_SIZE, RENDER_SIZE)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    const isEraser = stroke.color === ERASER_COLOR
    ctx.strokeStyle = isEraser ? '#ffffff' : '#000000'
    // 지우개는 실제로 지운 만큼(비율 그대로) 지워야 하므로 원래 굵기를 같은 배율로 줄인다
    ctx.lineWidth = isEraser ? stroke.width * scale : INK_WIDTH
    ctx.beginPath()
    const [first, ...rest] = stroke.points
    const toX = (x: number) => x * CATCHMIND_CANVAS_WIDTH * scale + offsetX
    const toY = (y: number) => y * CATCHMIND_CANVAS_HEIGHT * scale + offsetY
    ctx.moveTo(toX(first.x), toY(first.y))
    if (rest.length === 0) ctx.lineTo(toX(first.x) + 0.01, toY(first.y) + 0.01)
    for (const p of rest) ctx.lineTo(toX(p.x), toY(p.y))
    ctx.stroke()
  }

  // 224 → 112 → 56 → 28: 절반씩 줄여야 브라우저 축소 보간이 선을 건너뛰지 않고 고르게 평균낸다
  for (let size = RENDER_SIZE / 2; size >= INPUT_SIZE; size /= 2) {
    const next = document.createElement('canvas')
    next.width = next.height = size
    const nextCtx = next.getContext('2d')!
    nextCtx.imageSmoothingEnabled = true
    nextCtx.imageSmoothingQuality = 'high'
    nextCtx.drawImage(canvas, 0, 0, size, size)
    canvas = next
  }
  return canvas
}

/** 확률이 높은 순으로 상위 topK개를 돌려준다. 아직 그린 게 없으면 빈 배열 */
export async function guessDoodle(strokes: CatchmindStroke[], topK = 3): Promise<DoodleGuess[]> {
  const { tf, model } = await preloadDoodleModel()
  const input = renderModelInput(strokes)
  if (!input) return []

  const probabilities = tf.tidy(() => {
    // 학습 데이터는 검은 배경에 흰 선(잉크=1)이므로 밝기를 뒤집어 0~1로 맞춘다
    const pixels = tf.browser.fromPixels(input, 1).toFloat()
    const inverted = tf.scalar(1).sub(pixels.div(255))
    // 지우개로 전부 지웠으면 획 좌표는 남아 있어도 실제로 보이는 잉크가 없다 — 빈 도화지로 취급한다
    if (inverted.max().dataSync()[0] < MIN_VISIBLE_INK) return undefined
    return (model.predict(inverted.expandDims(0)) as import('@tensorflow/tfjs').Tensor).dataSync()
  })
  if (!probabilities) return []

  return Array.from(probabilities, (probability, index) => ({ index, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topK)
}
