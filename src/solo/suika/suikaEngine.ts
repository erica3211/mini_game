// 수박게임 물리·규칙 엔진 — React와 분리해 두고, 훅이 프레임마다 advance()만 호출한다
import { Bodies, Body, Composite, Engine, Events, type IEventCollision } from 'matter-js'
import { FRUITS, LAST_LEVEL, MAX_DROP_LEVEL, WATERMELON_BONUS, scoreForLevel } from './fruits'

export const BOARD_W = 400
export const BOARD_H = 600
/** 과일이 이 선 위로 넘치면 위험 — 위험이 계속되면 게임 오버 */
export const DEAD_LINE_Y = 120
/** 떨어뜨리기 전 과일이 놓이는 높이 */
export const DROP_Y = 58

const STEP_MS = 1000 / 60
// 한 프레임이 길어져도(탭 전환 등) 물리를 몰아서 돌리지 않도록 한 번에 돌릴 최대 스텝 수
const MAX_STEPS_PER_ADVANCE = 5
const DROP_COOLDOWN_MS = 500
// 떨어지는 중이거나 막 합쳐진 과일은 선을 넘어 있어도 위험으로 치지 않는다
const SETTLE_GRACE_MS = 1000
const GAME_OVER_MS = 2000
const WALL_THICKNESS = 100

interface FruitState {
  level: number
  bornMs: number
  overMs: number
  merged: boolean
}

export interface SuikaEngine {
  /** 화면에 그릴 과일들 */
  readonly fruits: readonly Body[]
  readonly score: number
  readonly over: boolean
  /** 지금 손에 든 과일 단계 */
  readonly heldLevel: number
  readonly nextLevel: number
  /** 0~1, 1이 되면 게임 오버 — 선을 넘은 과일 중 가장 오래 버틴 정도 */
  readonly danger: number
  /** 다시 떨어뜨릴 수 있는지 */
  readonly canDrop: boolean
  readonly aimX: number
  setAim(x: number): void
  drop(): void
  advance(dtMs: number): void
  destroy(): void
}

export const levelOf = (body: Body): number => (body.plugin as FruitState).level

const randomDropLevel = () => Math.floor(Math.random() * (MAX_DROP_LEVEL + 1))

export function createSuikaEngine(): SuikaEngine {
  const engine = Engine.create({ gravity: { x: 0, y: 1.5 }, positionIterations: 8, velocityIterations: 6 })

  const wallOptions = { isStatic: true, friction: 0.1, label: 'wall' }
  Composite.add(engine.world, [
    Bodies.rectangle(BOARD_W / 2, BOARD_H + WALL_THICKNESS / 2, BOARD_W + WALL_THICKNESS * 2, WALL_THICKNESS, wallOptions),
    Bodies.rectangle(-WALL_THICKNESS / 2, BOARD_H / 2, WALL_THICKNESS, BOARD_H * 4, wallOptions),
    Bodies.rectangle(BOARD_W + WALL_THICKNESS / 2, BOARD_H / 2, WALL_THICKNESS, BOARD_H * 4, wallOptions),
  ])

  const fruits: Body[] = []
  let simMs = 0
  let accumulatorMs = 0
  let lastDropMs = -DROP_COOLDOWN_MS
  let score = 0
  let over = false
  let danger = 0
  let heldLevel = randomDropLevel()
  let nextLevel = randomDropLevel()
  let aimX = BOARD_W / 2
  // 한 스텝 안에서 닿은 같은 단계 쌍 — 물리 스텝이 끝난 뒤에 한꺼번에 합쳐야 중복 합체가 생기지 않는다
  const touching: [Body, Body][] = []

  const addFruit = (level: number, x: number, y: number, velocity?: { x: number; y: number }) => {
    const state: FruitState = { level, bornMs: simMs, overMs: 0, merged: false }
    const body = Bodies.circle(x, y, FRUITS[level].radius, {
      restitution: 0.05,
      friction: 0.2,
      frictionStatic: 0.5,
      label: 'fruit',
      plugin: state,
    })
    if (velocity) Body.setVelocity(body, velocity)
    Composite.add(engine.world, body)
    fruits.push(body)
  }

  const removeFruit = (body: Body) => {
    Composite.remove(engine.world, body)
    fruits.splice(fruits.indexOf(body), 1)
  }

  const collectTouching = (event: IEventCollision<Engine>) => {
    for (const { bodyA, bodyB } of event.pairs) {
      if (bodyA.label !== 'fruit' || bodyB.label !== 'fruit') continue
      if (levelOf(bodyA) === levelOf(bodyB)) touching.push([bodyA, bodyB])
    }
  }
  // 막 합쳐져 생긴 과일이 이웃과 이미 겹친 채 태어나면 collisionStart가 오지 않을 수 있어 Active도 본다
  Events.on(engine, 'collisionStart', collectTouching)
  Events.on(engine, 'collisionActive', collectTouching)

  const mergeTouching = () => {
    for (const [a, b] of touching) {
      const stateA = a.plugin as FruitState
      const stateB = b.plugin as FruitState
      if (stateA.merged || stateB.merged) continue
      stateA.merged = stateB.merged = true

      const level = stateA.level
      const x = (a.position.x + b.position.x) / 2
      const y = (a.position.y + b.position.y) / 2
      const velocity = { x: (a.velocity.x + b.velocity.x) / 2, y: (a.velocity.y + b.velocity.y) / 2 }
      removeFruit(a)
      removeFruit(b)

      if (level === LAST_LEVEL) {
        score += WATERMELON_BONUS
      } else {
        score += scoreForLevel(level + 1)
        addFruit(level + 1, x, y, velocity)
      }
    }
    touching.length = 0
  }

  const checkGameOver = () => {
    let maxOver = 0
    for (const body of fruits) {
      const state = body.plugin as FruitState
      const crossing =
        simMs - state.bornMs >= SETTLE_GRACE_MS && body.position.y - FRUITS[state.level].radius < DEAD_LINE_Y
      state.overMs = crossing ? state.overMs + STEP_MS : 0
      maxOver = Math.max(maxOver, state.overMs)
    }
    danger = Math.min(1, maxOver / GAME_OVER_MS)
    if (danger >= 1) over = true
  }

  const step = () => {
    Engine.update(engine, STEP_MS)
    simMs += STEP_MS
    mergeTouching()
    checkGameOver()
  }

  return {
    get fruits() {
      return fruits
    },
    get score() {
      return score
    },
    get over() {
      return over
    },
    get heldLevel() {
      return heldLevel
    },
    get nextLevel() {
      return nextLevel
    },
    get danger() {
      return danger
    },
    get canDrop() {
      return !over && simMs - lastDropMs >= DROP_COOLDOWN_MS
    },
    get aimX() {
      return aimX
    },
    setAim(x) {
      const r = FRUITS[heldLevel].radius
      aimX = Math.min(BOARD_W - r, Math.max(r, x))
    },
    drop() {
      if (over || simMs - lastDropMs < DROP_COOLDOWN_MS) return
      addFruit(heldLevel, aimX, DROP_Y)
      lastDropMs = simMs
      heldLevel = nextLevel
      nextLevel = randomDropLevel()
      // 손에 든 과일이 바뀌면 반지름도 달라지므로 벽 밖으로 나가지 않게 다시 맞춘다
      const r = FRUITS[heldLevel].radius
      aimX = Math.min(BOARD_W - r, Math.max(r, aimX))
    },
    advance(dtMs) {
      if (over) return
      accumulatorMs += dtMs
      let steps = 0
      while (accumulatorMs >= STEP_MS && steps < MAX_STEPS_PER_ADVANCE && !over) {
        step()
        accumulatorMs -= STEP_MS
        steps++
      }
      // 따라잡지 못한 시간은 버린다 — 느린 기기에서 물리가 계속 밀리지 않게 한다
      if (steps === MAX_STEPS_PER_ADVANCE) accumulatorMs = 0
    },
    destroy() {
      Events.off(engine, 'collisionStart', collectTouching)
      Events.off(engine, 'collisionActive', collectTouching)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    },
  }
}
