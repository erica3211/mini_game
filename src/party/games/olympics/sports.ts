import type { OlympicsGauge } from './protocol'

// 게이지·조준점의 움직임 — 서버(backend/party/games/olympics/sports.ts)와 같은 식이어야 모두의 화면에서 서버가 판정한 위치와 같게 보인다

/** 삼각파 — 0에서 시작해 1까지 올랐다가 다시 0으로 내려온다 (한 주기는 1) */
export function triangle(cycles: number): number {
  const frac = cycles - Math.floor(cycles)
  return 1 - Math.abs(2 * frac - 1)
}

/** 농구 게이지 위치(0~1) */
export function basketballPosition(gauge: OlympicsGauge, elapsedMs: number): number {
  return triangle((elapsedMs / 1000) * (gauge.speed ?? 1))
}

/** 양궁 조준점 위치(0~1, 과녁 한가운데가 0.5, 0.5) */
export function archeryPosition(gauge: OlympicsGauge, elapsedMs: number): { x: number; y: number } {
  const t = elapsedMs / 1000
  return {
    x: 0.5 + 0.45 * Math.sin(2 * Math.PI * (gauge.fx ?? 0) * t + (gauge.px ?? 0)),
    y: 0.5 + 0.45 * Math.sin(2 * Math.PI * (gauge.fy ?? 0) * t + (gauge.py ?? 0)),
  }
}

/** 로비에서 고를 수 있는 종목 — 서버 OLYMPICS_SPORTS와 id가 같아야 한다 */
export const OLYMPICS_SPORT_CHOICES = [
  { id: 'basketball', label: '🏀 농구' },
  { id: 'archery', label: '🏹 양궁' },
  { id: 'bowling', label: '🎳 볼링' },
  { id: 'weightlifting', label: '🏋️ 역도' },
  { id: 'track', label: '🏃 육상' },
]

// 과녁의 링 하나의 폭(과녁 크기를 1로 봤을 때) — 서버의 ARCHERY_RING_WIDTH와 같아야 한다
export const ARCHERY_RING_WIDTH = 0.045
