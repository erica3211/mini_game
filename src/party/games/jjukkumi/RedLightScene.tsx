import { useEffect, useRef } from 'react'
import type { JjukkumiPlayerState, RedLightLight } from './protocol'
import { playerSpriteName, type SpriteMap } from './sprites'

// 스테이지 1(무궁화 꽃이 피었습니다)의 장면 — 위쪽에 영희와 진행 요원이 서 있고 그 아래 빨간 선이 도착선이다.
// 참가자들은 아래(출발선)에서 같이 출발해 빨간 선을 향해 올라간다. 좌표는 모두 장면 크기에 대한 비율이라 화면 크기가 달라도 같은 모양이다.

/** 하늘이 끝나고 담벼락이 시작하는 높이, 도착선(빨간 선) 높이, 출발선 높이 */
const SKY_BOTTOM = 0.12
const FINISH_LINE = 0.27
const START_LINE = 0.96
/** 참가자 발끝이 있는 높이 — progress 0이 출발선, 1이 도착선 바로 아래다 */
const FEET_START = 0.935
const FEET_FINISH = 0.29
/** 영희와 진행 요원이 서 있는 발끝 높이 */
const IDOL_FEET = 0.255
const GUARD_FEET = 0.245
/** 내 캐릭터·구경하는 캐릭터의 테두리 굵기(장면 너비에 대한 비율)와 색 */
const OUTLINE_RATIO = 0.011
const MINE_COLOR = '#ffd400'
const WATCH_COLOR = '#35a7ff'
/** 서버가 알려 준 위치로 부드럽게 따라가는 정도(1/초) */
const FOLLOW_RATE = 14

export interface SceneLight {
  state: RedLightLight
  /** 이 방향을 보기 시작한 시각(performance.now() 기준) */
  startedAt: number
}

export interface ScenePlayer {
  playerId: string
  character: number
  nickname: string
  status: JjukkumiPlayerState
  progress: number
  /** 지금 움직이는 정도(0~1) */
  level: number
}

interface Props {
  sprites: SpriteMap
  players: ScenePlayer[]
  light: SceneLight | null
  myId: string | null
  /** 구경하려고 고른 사람 */
  watchingId: string | null
}

const silhouettes = new Map<string, HTMLCanvasElement>()

/** 그림의 모양대로 한 색으로 칠한 그림 — 테두리를 그릴 때 쓴다 */
function silhouetteOf(name: string, image: HTMLImageElement, color: string): HTMLCanvasElement {
  const key = `${name}|${color}`
  const cached = silhouettes.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  silhouettes.set(key, canvas)
  return canvas
}

/** 한가운데 아래(발끝)를 (x, y)에 맞춰 높이 height로 그린다. outline 색이 있으면 굵은 테두리를 두른다 */
function drawSprite(ctx: CanvasRenderingContext2D, name: string, image: HTMLImageElement, x: number, feetY: number, height: number, outline?: { color: string; width: number }) {
  const width = (image.naturalWidth / image.naturalHeight) * height
  const left = x - width / 2
  const top = feetY - height
  if (outline) {
    const shape = silhouetteOf(name, image, outline.color)
    for (let step = 0; step < 16; step++) {
      const angle = (step / 16) * Math.PI * 2
      ctx.drawImage(shape, left + Math.cos(angle) * outline.width, top + Math.sin(angle) * outline.width, width, height)
    }
  }
  ctx.drawImage(image, left, top, width, height)
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontPx: number) {
  ctx.font = `800 ${fontPx}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const padX = fontPx * 0.55
  const width = ctx.measureText(text).width + padX * 2
  const height = fontPx * 1.5
  ctx.fillStyle = color
  ctx.beginPath()
  // roundRect는 오래된 브라우저에는 없다 — 없으면 네모로 그린다
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2)
  else ctx.rect(x - width / 2, y - height / 2, width, height)
  ctx.fill()
  ctx.fillStyle = '#1b1b1b'
  ctx.fillText(text, x, y + fontPx * 0.05)
}

/** 장면 하나 — 서버가 알려 주는 위치로 매 프레임 그린다. 값이 바뀔 때마다 다시 만들지 않으려고 최신 값은 ref에 담는다 */
export function RedLightScene({ sprites, players, light, myId, watchingId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ players, light, myId, watchingId })
  live.current = { players, light, myId, watchingId }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    /** 화면에 그려 주는 진행도 — 서버 값을 부드럽게 따라간다 */
    const shown = new Map<string, number>()
    let lastFrame = performance.now()
    let frame = 0

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const dt = Math.min(0.1, (now - lastFrame) / 1000)
      lastFrame = now
      const state = live.current

      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const W = width
      const H = height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // 하늘과 담벼락, 모래 운동장
      const sky = ctx.createLinearGradient(0, 0, 0, SKY_BOTTOM * H)
      sky.addColorStop(0, '#9fd3f0')
      sky.addColorStop(1, '#d9eefa')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, SKY_BOTTOM * H)
      ctx.fillStyle = '#f1c7ac'
      ctx.fillRect(0, SKY_BOTTOM * H, W, (FINISH_LINE - SKY_BOTTOM) * H)
      ctx.fillStyle = 'rgba(160, 90, 60, 0.18)'
      for (let row = 1; row <= 3; row++) ctx.fillRect(0, (SKY_BOTTOM + ((FINISH_LINE - SKY_BOTTOM) * row) / 4) * H, W, Math.max(1, H * 0.003))
      const ground = ctx.createLinearGradient(0, FINISH_LINE * H, 0, H)
      ground.addColorStop(0, '#d9b58b')
      ground.addColorStop(1, '#b98d5f')
      ctx.fillStyle = ground
      ctx.fillRect(0, FINISH_LINE * H, W, H - FINISH_LINE * H)

      // 출발선(하얀 점선)과 도착선(빨간 선)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.lineWidth = Math.max(2, H * 0.006)
      ctx.setLineDash([H * 0.02, H * 0.015])
      ctx.beginPath()
      ctx.moveTo(0, START_LINE * H)
      ctx.lineTo(W, START_LINE * H)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = '#e5322d'
      ctx.lineWidth = Math.max(3, H * 0.011)
      ctx.beginPath()
      ctx.moveTo(0, FINISH_LINE * H)
      ctx.lineTo(W, FINISH_LINE * H)
      ctx.stroke()

      // 영희가 보는 방향
      const lightState: RedLightLight = state.light?.state ?? 'back'
      const idolSprite = sprites[`younghee-${lightState}`]
      const idolHeight = H * 0.205
      // 진행 요원 — 영희 양옆에 선다
      drawSprite(ctx, 'guard-triangle', sprites['guard-triangle'], W * 0.13, GUARD_FEET * H, H * 0.15)
      drawSprite(ctx, 'guard-square', sprites['guard-square'], W * 0.8, GUARD_FEET * H, H * 0.15)
      drawSprite(ctx, 'guard-circle', sprites['guard-circle'], W * 0.92, GUARD_FEET * H, H * 0.15)
      drawSprite(ctx, `younghee-${lightState}`, idolSprite, W * 0.46, IDOL_FEET * H, idolHeight)
      if (lightState === 'front') {
        // 앞을 본다 — 멈춰야 한다는 걸 알리는 느낌표
        const pulse = 0.85 + 0.15 * Math.sin(now / 90)
        drawLabel(ctx, '!', W * 0.46, (IDOL_FEET - 0.205) * H - H * 0.01, '#ff4b45', H * 0.05 * pulse)
      }

      // 참가자들 — 발끝 높이로 정렬해서 위쪽 사람부터 그린다 (아래 사람이 위 사람 앞을 가린다)
      const count = Math.max(1, state.players.length)
      const spriteHeight = H * Math.min(0.17, Math.max(0.085, 0.17 - 0.0065 * Math.max(0, count - 4)))
      const rows = state.players.map((player, index) => {
        const target = player.progress
        const current = shown.get(player.playerId) ?? target
        const next = current + (target - current) * Math.min(1, dt * FOLLOW_RATE)
        shown.set(player.playerId, next)
        const lane = (index + 0.5) / count
        // 사람이 많으면 한 줄에 다 못 서서 위아래로 엇갈려 선다
        const stagger = count > 7 ? (index % 2 === 0 ? -1 : 1) * H * 0.012 : 0
        const bob = player.status === 'run' && player.level > 0.1 ? Math.abs(Math.sin(now / 85 + index)) * H * 0.011 * player.level : 0
        const feetY = FEET_START * H - next * (FEET_START - FEET_FINISH) * H + stagger - bob
        return { player, x: lane * W, feetY }
      })
      rows.sort((a, b) => a.feetY - b.feetY)
      for (const { player, x, feetY } of rows) {
        const name = playerSpriteName(player.character)
        const mine = player.playerId === state.myId
        const watched = player.playerId === state.watchingId
        const out = player.status === 'out'
        ctx.globalAlpha = out ? 0.42 : 1
        const outline = mine ? { color: MINE_COLOR, width: W * OUTLINE_RATIO } : watched ? { color: WATCH_COLOR, width: W * OUTLINE_RATIO } : undefined
        drawSprite(ctx, name, sprites[name], x, feetY, spriteHeight, outline)
        ctx.globalAlpha = 1
        const labelFont = Math.max(9 * dpr, W * 0.032)
        const topY = feetY - spriteHeight
        if (out) drawLabel(ctx, '✖ 탈락', x, topY - labelFont * 0.4, '#ff8a85', labelFont)
        else if (player.status === 'passed') drawLabel(ctx, '✔ 통과', x, topY - labelFont * 0.4, '#8be08e', labelFont)
        else if (mine) drawLabel(ctx, '나', x, topY - labelFont * 0.4, MINE_COLOR, labelFont)
        else if (watched) drawLabel(ctx, player.nickname, x, topY - labelFont * 0.4, '#bfe2ff', labelFont)
      }

      // 앞을 보고 있는 동안은 장면 전체가 붉게 물든다
      if (lightState === 'front') {
        ctx.fillStyle = 'rgba(229, 50, 45, 0.16)'
        ctx.fillRect(0, 0, W, H)
      }
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [sprites])

  return <canvas ref={canvasRef} className="jk-canvas" role="img" aria-label="무궁화 꽃이 피었습니다 장면" />
}
