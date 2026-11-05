import type { MarbleWorld } from '../marbleMaze/physics'
import type { TreasurePoint } from './protocol'

/**
 * 벽 없이 탁 트인 방 — 가장자리 한 겹만 벽인 정사각형 지도. 구슬 탈출의 구슬 물리(stepMarble)가 그대로 읽을 수 있는 모양으로 만든다.
 * 구멍과 출구는 없고(출구는 출발 자리와 같게 둔다), 미로 칸·거리 정보도 쓰지 않는다.
 */
export function buildOpenWorld(size: number, start: TreasurePoint): MarbleWorld {
  const solid = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => x === 0 || y === 0 || x === size - 1 || y === size - 1))
  return { size, solid, start, exit: start, holes: [], cells: 0, distance: [], startDistance: 1 }
}
