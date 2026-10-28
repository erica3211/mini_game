// 수박게임 캔버스 렌더링 — 과일은 원 + 단계별 무늬 + 얼굴로 직접 그린다
import { FRUITS } from './fruits'
import { BOARD_H, BOARD_W, DEAD_LINE_Y, DROP_Y, levelOf, type SuikaEngine } from './suikaEngine'

const TAU = Math.PI * 2
const FACE_COLOR = '#4a2c2a'
const LEAF_COLOR = '#43a047'
const STEM_COLOR = '#6d4c41'

export interface BoardPalette {
  /** 위험선·강조 색 (--accent) */
  line: string
  /** 보조 글자색 (--text-muted) */
  text: string
}

const leaf = (ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number) => {
  ctx.beginPath()
  ctx.ellipse(x, y, length, length * 0.45, angle, 0, TAU)
  ctx.fillStyle = LEAF_COLOR
  ctx.fill()
}

const stem = (ctx: CanvasRenderingContext2D, r: number, length: number) => {
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.9)
  ctx.quadraticCurveTo(r * 0.1, -r - length * 0.5, r * 0.3, -r - length)
  ctx.strokeStyle = STEM_COLOR
  ctx.lineWidth = Math.max(2, r * 0.08)
  ctx.lineCap = 'round'
  ctx.stroke()
}

/** 원 안쪽에 그려지는 무늬 (클립 적용 상태에서 호출) */
function drawPattern(ctx: CanvasRenderingContext2D, level: number, r: number) {
  const { dark } = FRUITS[level]
  ctx.strokeStyle = dark
  ctx.fillStyle = dark
  ctx.lineWidth = Math.max(1.5, r * 0.04)
  switch (level) {
    case 1: // 딸기 씨
      for (const [sx, sy] of [[-0.5, 0.3], [0, 0.5], [0.5, 0.3], [-0.25, 0.75], [0.25, 0.75], [0, 0.1], [-0.6, 0.65], [0.6, 0.65]]) {
        ctx.beginPath()
        ctx.ellipse(sx * r, sy * r, r * 0.07, r * 0.11, 0, 0, TAU)
        ctx.fillStyle = '#ffe08a'
        ctx.fill()
      }
      break
    case 2: // 포도알
      ctx.globalAlpha = 0.3
      for (const [gx, gy] of [[-0.45, 0.2], [0.45, 0.2], [0, 0.55], [0, -0.1]]) {
        ctx.beginPath()
        ctx.arc(gx * r, gy * r, r * 0.38, 0, TAU)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    case 6: // 배 점박이
      ctx.globalAlpha = 0.45
      for (const [px, py] of [[-0.5, 0.2], [0.4, 0.4], [0.1, 0.7], [-0.2, 0.5], [0.6, 0.05]]) {
        ctx.beginPath()
        ctx.arc(px * r, py * r, r * 0.04, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
    case 7: // 복숭아 주름
      ctx.beginPath()
      ctx.moveTo(0, -r)
      ctx.quadraticCurveTo(r * 0.45, 0, 0, r * 0.7)
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    case 8: // 파인애플 격자
      ctx.globalAlpha = 0.55
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath()
        ctx.moveTo(i * r * 0.4 - r, -r)
        ctx.lineTo(i * r * 0.4 + r, r)
        ctx.moveTo(i * r * 0.4 + r, -r)
        ctx.lineTo(i * r * 0.4 - r, r)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    case 9: // 멜론 그물
      ctx.globalAlpha = 0.5
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.arc(i * r * 0.55, 0, r * 0.9, 0, TAU)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    case 10: // 수박 줄무늬
      ctx.lineWidth = r * 0.14
      ctx.globalAlpha = 0.7
      for (const sx of [-0.7, -0.35, 0, 0.35, 0.7]) {
        ctx.beginPath()
        ctx.moveTo(sx * r * 0.6, -r)
        ctx.quadraticCurveTo(sx * r * 1.5, 0, sx * r * 0.6, r)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
  }
}

/** 원 바깥으로 튀어나오는 꼭지·잎 */
function drawTopPart(ctx: CanvasRenderingContext2D, level: number, r: number) {
  switch (level) {
    case 0: // 체리
      stem(ctx, r, r * 1.2)
      leaf(ctx, r * 0.5, -r * 1.9, r * 0.6, -0.5)
      break
    case 1: // 딸기 꼭지
      for (const a of [-0.9, -0.3, 0.3, 0.9]) leaf(ctx, Math.sin(a) * r * 0.55, -r * 0.92, r * 0.34, a + Math.PI / 2)
      break
    case 2:
    case 5:
    case 6:
      stem(ctx, r, r * 0.35)
      leaf(ctx, r * 0.5, -r * 1.25, r * 0.28, -0.4)
      break
    case 3:
    case 4:
      leaf(ctx, 0, -r * 0.95, r * 0.28, 0)
      leaf(ctx, 0, -r * 0.95, r * 0.28, Math.PI / 2)
      break
    case 7:
      leaf(ctx, r * 0.3, -r * 1.0, r * 0.3, -0.5)
      break
    case 8: // 파인애플 왕관
      for (const a of [-0.55, 0, 0.55]) leaf(ctx, Math.sin(a) * r * 0.45, -r * 1.12, r * 0.4, a - Math.PI / 2)
      break
  }
}

function drawFace(ctx: CanvasRenderingContext2D, r: number) {
  const eyeR = Math.max(1.6, r * 0.075)
  ctx.fillStyle = FACE_COLOR
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * r * 0.3, -r * 0.05, eyeR, 0, TAU)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, r * 0.12, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.strokeStyle = FACE_COLOR
  ctx.lineWidth = Math.max(1.4, r * 0.05)
  ctx.lineCap = 'round'
  ctx.stroke()
}

export function drawFruit(ctx: CanvasRenderingContext2D, level: number, x: number, y: number, angle = 0, scale = 1) {
  const { radius, color, dark } = FRUITS[level]
  const r = radius * scale
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  drawTopPart(ctx, level, r)

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fillStyle = color
  ctx.fill()

  ctx.save()
  ctx.clip()
  drawPattern(ctx, level, r)
  ctx.restore()

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.lineWidth = Math.max(2, r * 0.06)
  ctx.strokeStyle = dark
  ctx.stroke()

  // 하이라이트
  ctx.beginPath()
  ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.2, r * 0.12, -0.7, 0, TAU)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()

  drawFace(ctx, r)
  ctx.restore()
}

export function drawBoard(ctx: CanvasRenderingContext2D, engine: SuikaEngine, palette: BoardPalette) {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H)

  // 위험선 — 위험이 커질수록 깜빡인다
  ctx.save()
  ctx.setLineDash([10, 8])
  ctx.lineWidth = 2
  ctx.strokeStyle = palette.line
  ctx.globalAlpha = engine.danger > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / (300 - engine.danger * 200))) : 0.45
  ctx.beginPath()
  ctx.moveTo(0, DEAD_LINE_Y)
  ctx.lineTo(BOARD_W, DEAD_LINE_Y)
  ctx.stroke()
  ctx.restore()

  for (const body of engine.fruits) drawFruit(ctx, levelOf(body), body.position.x, body.position.y, body.angle)

  // 손에 든 과일과 떨어질 길잡이 선
  const held = FRUITS[engine.heldLevel]
  ctx.save()
  ctx.globalAlpha = engine.canDrop ? 1 : 0.35
  if (engine.canDrop) {
    ctx.setLineDash([4, 8])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = palette.text
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(engine.aimX, DROP_Y + held.radius)
    ctx.lineTo(engine.aimX, BOARD_H)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
  drawFruit(ctx, engine.heldLevel, engine.aimX, DROP_Y)
  ctx.restore()

  // 다음 과일 미리보기 (오른쪽 위)
  ctx.fillStyle = palette.text
  ctx.font = '600 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('다음', BOARD_W - 34, 20)
  const next = FRUITS[engine.nextLevel]
  drawFruit(ctx, engine.nextLevel, BOARD_W - 34, 24 + 4 + 24, 0, Math.min(1, 22 / next.radius))
}
