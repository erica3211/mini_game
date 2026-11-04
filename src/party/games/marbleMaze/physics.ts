import { MAZE_OPEN, type MazePoint } from '../mazeEscape/protocol'
import type { MarbleMazeData } from './protocol'

// 구슬 굴리기 — 화면과 상관없는 순수 계산이다. 길이의 단위는 "타일"이고 타일 하나가 1이다.
// 미로(칸 단위)는 칸과 칸 사이 길목까지 타일 하나씩으로 펼쳐서, 벽을 타일 한 칸 두께로 본다: 한 변이 (2×칸+1)개 타일이다.
// 칸 (cx, cy)는 타일 (2cx+1, 2cy+1)이고, 그 한가운데는 (2cx+1.5, 2cy+1.5)이다.

/** 구슬 반지름 — 길(타일 하나 너비)의 0.3배라 좁은 길도 지나간다 */
export const MARBLE_RADIUS = 0.3
/** 구슬 가운데가 구멍 가운데에서 이만큼 안으로 들어가면 빠진다 */
export const HOLE_RADIUS = 0.3
/** 구슬 가운데가 출구 가운데에서 이만큼 안으로 들어가면 탈출이다 */
export const EXIT_RADIUS = 0.4
/** 기울기를 끝까지 기울였을 때 가속도(타일/초²) — 폰 센서 느낌을 바꾸고 싶으면 이 값을 고친다 */
export const TILT_ACCEL = 24
/** 속도가 줄어드는 정도(1/초) — 클수록 빨리 멈춘다 */
export const DAMPING = 1.0
/** 구슬의 최고 속도(타일/초) — 서버가 가짜 탈출을 거를 때 쓰는 값(12)보다 작아야 한다 */
export const MAX_SPEED = 9
/** 벽에 부딪힐 때 튕기는 정도 */
export const RESTITUTION = 0.25

export interface Marble {
  x: number
  y: number
  vx: number
  vy: number
}

export interface MarbleWorld {
  /** 한 변의 타일 수 */
  size: number
  /** solid[y][x] — 그 타일이 벽이면 true */
  solid: boolean[][]
  start: MazePoint
  exit: MazePoint
  /** 구멍 한가운데(타일 좌표) */
  holes: MazePoint[]
  cells: number
  /** 칸마다 출구까지 가는 칸 수 */
  distance: number[]
  startDistance: number
}

const center = (cell: MazePoint): MazePoint => ({ x: cell.x * 2 + 1.5, y: cell.y * 2 + 1.5 })

/** 서버가 준 미로를 타일 지도로 펼친다 */
export function buildWorld(data: MarbleMazeData): MarbleWorld {
  const { maze } = data
  const size = maze.width * 2 + 1
  const solid = Array.from({ length: size }, () => new Array<boolean>(size).fill(true))
  for (let cy = 0; cy < maze.height; cy++) {
    for (let cx = 0; cx < maze.width; cx++) {
      const open = maze.cells[cy * maze.width + cx]
      solid[cy * 2 + 1][cx * 2 + 1] = false
      if (open & MAZE_OPEN.right) solid[cy * 2 + 1][cx * 2 + 2] = false
      if (open & MAZE_OPEN.down) solid[cy * 2 + 2][cx * 2 + 1] = false
    }
  }
  return {
    size,
    solid,
    start: center(maze.start),
    exit: center(maze.exit),
    // 함정 구멍은 칸 한가운데, 길목 구멍은 한가운데에서 벽 쪽으로 치우친 곳
    holes: [...data.holes.map(center), ...data.edgeHoles.map((hole) => ({ x: hole.x * 2 + 1.5 + hole.dx, y: hole.y * 2 + 1.5 + hole.dy }))],
    cells: maze.width,
    distance: data.distance,
    startDistance: data.distance[maze.start.y * maze.width + maze.start.x],
  }
}

export function newMarble(world: MarbleWorld): Marble {
  return { x: world.start.x, y: world.start.y, vx: 0, vy: 0 }
}

/** 구슬이 출구까지 길의 몇 %를 왔는가 (0~1) — 가장 가까운 칸의 출구까지 거리로 잰다 */
export function progressOf(world: MarbleWorld, marble: Marble): number {
  const nearest = (value: number) => Math.min(world.cells - 1, Math.max(0, Math.round((value - 1.5) / 2)))
  const d = world.distance[nearest(marble.y) * world.cells + nearest(marble.x)]
  return Math.max(0, Math.min(1, 1 - d / world.startDistance))
}

/** 구슬이 구멍에 빠졌는가 */
export function fellInHole(world: MarbleWorld, marble: Marble): boolean {
  return world.holes.some((hole) => Math.hypot(hole.x - marble.x, hole.y - marble.y) < HOLE_RADIUS)
}

/** 구슬이 출구에 도착했는가 */
export function reachedExit(world: MarbleWorld, marble: Marble): boolean {
  return Math.hypot(world.exit.x - marble.x, world.exit.y - marble.y) < EXIT_RADIUS
}

/** 벽 타일과 부딪혔으면 밀어내고 속도를 튕긴다 */
function collide(world: MarbleWorld, marble: Marble): void {
  const minX = Math.max(0, Math.floor(marble.x - MARBLE_RADIUS))
  const maxX = Math.min(world.size - 1, Math.floor(marble.x + MARBLE_RADIUS))
  const minY = Math.max(0, Math.floor(marble.y - MARBLE_RADIUS))
  const maxY = Math.min(world.size - 1, Math.floor(marble.y + MARBLE_RADIUS))
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!world.solid[ty][tx]) continue
      // 타일(네모)에서 구슬 가운데에 가장 가까운 점
      const nearestX = Math.min(tx + 1, Math.max(tx, marble.x))
      const nearestY = Math.min(ty + 1, Math.max(ty, marble.y))
      let dx = marble.x - nearestX
      let dy = marble.y - nearestY
      const distance = Math.hypot(dx, dy)
      if (distance >= MARBLE_RADIUS) continue
      if (distance === 0) {
        // 가운데가 타일 안으로 들어왔다 — 가장 가까운 면 쪽으로 밀어낸다
        const toLeft = marble.x - tx
        const toRight = tx + 1 - marble.x
        const toTop = marble.y - ty
        const toBottom = ty + 1 - marble.y
        const smallest = Math.min(toLeft, toRight, toTop, toBottom)
        dx = smallest === toLeft ? -1 : smallest === toRight ? 1 : 0
        dy = smallest === toTop ? -1 : smallest === toBottom ? 1 : 0
        marble.x += dx * (smallest + MARBLE_RADIUS)
        marble.y += dy * (smallest + MARBLE_RADIUS)
      } else {
        const push = MARBLE_RADIUS - distance
        dx /= distance
        dy /= distance
        marble.x += dx * push
        marble.y += dy * push
      }
      // 벽 쪽으로 가던 속도만 튕겨 낸다
      const into = marble.vx * dx + marble.vy * dy
      if (into < 0) {
        marble.vx -= (1 + RESTITUTION) * into * dx
        marble.vy -= (1 + RESTITUTION) * into * dy
      }
    }
  }
}

/**
 * 구슬을 dt초 굴린다. tilt는 기울인 정도(-1~1)로, x는 오른쪽 y는 아래쪽이다.
 * 얇게 나눠서(한 걸음 최대 1/240초) 빠르게 굴려도 벽을 뚫고 지나가지 않는다.
 */
export function stepMarble(world: MarbleWorld, marble: Marble, tiltX: number, tiltY: number, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt * 240))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    marble.vx += tiltX * TILT_ACCEL * h
    marble.vy += tiltY * TILT_ACCEL * h
    const damping = Math.max(0, 1 - DAMPING * h)
    marble.vx *= damping
    marble.vy *= damping
    const speed = Math.hypot(marble.vx, marble.vy)
    if (speed > MAX_SPEED) {
      marble.vx *= MAX_SPEED / speed
      marble.vy *= MAX_SPEED / speed
    }
    marble.x += marble.vx * h
    marble.y += marble.vy * h
    collide(world, marble)
  }
}
