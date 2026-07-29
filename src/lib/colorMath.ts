import type { RgbColor } from './partyProtocol'

// 세부 라운드별 채도 고정값 — 백엔드 games/colorMatch.ts의 ROUND_PROFILES와 반드시 같은 값을 유지해야 한다.
// 정답도 이 채도로 생성되므로, 드래그 지도도 같은 채도를 써야 이론상 100% 일치에 도달할 수 있다
export const COLOR_MATCH_SATURATION_BY_ROUND = [90, 30, 55]

export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  const [r0, g0, b0] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  // h가 이론상 [0,360) 범위를 벗어나 들어와도(드래그 델타 누적 오차 등) 채널이 0~255를 벗어나지 않도록 방어
  const clamp = (channel: number) => Math.min(255, Math.max(0, Math.round(channel * 255)))
  return {
    r: clamp(r0 + m),
    g: clamp(g0 + m),
    b: clamp(b0 + m),
  }
}

export function rgbToCss({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`
}

// 백엔드 games/colorMatch.ts의 gradeOf와 같은 기준 — 결과 화면에서 matchPercent만으로 등급을 다시 계산해 보여줄 때 쓴다
export function colorMatchGradeOf(matchPercent: number): string {
  if (matchPercent >= 95) return '절대색감의 신'
  if (matchPercent >= 85) return '인간 포토샵 스포이드'
  if (matchPercent >= 70) return '웬만큼 보는 눈'
  if (matchPercent >= 50) return '좀 헷갈리는 눈'
  return '착각의 늪에 빠진 눈'
}
