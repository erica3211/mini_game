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

/** 칸 cell을 기준으로 한 모양이 덮는 칸들 — 서버의 swingCells와 같아야 한다 (고르는 동안 모양을 미리 그려 주려고 화면에도 둔다).
 *  항상 3칸이고, 대각선은 판 끝에서 반대쪽으로 이어진다 */
/**
 * 마주 보는 쪽의 좌우 뒤집기 — 서버는 골키퍼·받는 쪽·타자가 고른 값을 공격하는 쪽(키커·치는 쪽·투수) 기준으로 뒤집어 저장한다.
 * 결과 화면에서 저장된 값을 보는 사람의 시점으로 다시 그릴 때도 같은 식을 쓴다 (왼쪽 열 ↔ 오른쪽 열, 대각선 ╲ ↔ ╱)
 */
export function mirrorCell(cell: number): number {
  return Math.floor(cell / 3) * 3 + (2 - (cell % 3))
}

export function mirrorSwing<T extends 'row' | 'column' | 'down' | 'up'>(type: T): T | 'down' | 'up' {
  return type === 'down' ? 'up' : type === 'up' ? 'down' : type
}

export function swingCells(type: 'row' | 'column' | 'down' | 'up', cell: number): number[] {
  const row = Math.floor(cell / 3)
  const col = cell % 3
  const wrap = (n: number) => ((n % 3) + 3) % 3
  const cells = [0, 1, 2].map((k) => {
    if (type === 'row') return row * 3 + k
    if (type === 'column') return k * 3 + col
    if (type === 'down') return wrap(row + k) * 3 + wrap(col + k)
    return wrap(row + k) * 3 + wrap(col - k)
  })
  return cells.sort((x, y) => x - y)
}

/** 구종마다 칠해지는 모양 — 서버의 pitchZone과 같아야 한다 */
export function pitchZone(type: 'fastball' | 'curve' | 'changeup' | 'slider', target: number): number[] {
  const shape = { fastball: 'row', curve: 'column', changeup: 'down', slider: 'up' } as const
  return swingCells(shape[type], target)
}


// 과녁의 링 하나의 폭(과녁 크기를 1로 봤을 때) — 서버의 ARCHERY_RING_WIDTH와 같아야 한다
export const ARCHERY_RING_WIDTH = 0.045
