import { useCallback, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { roleAllows, type TowerAction, type TowerEndSignal, type TowerRole, type TowerStateSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

// 이동 버튼을 누르고 있는 동안 신호를 보내는 간격 (서버는 300ms 안에 다음 신호가 없으면 멈춘다)
const HOLD_HEARTBEAT_MS = 120
// 한 번씩 보내는 조작(돌리기·떨어뜨리기)을 이 간격보다 짧게 연달아 보내지 않는다 (서버는 25ms보다 짧은 신호를 버린다)
const MIN_SEND_MS = 45

type HoldDir = 'left' | 'right'

const KEY_ACTIONS: Record<string, 'left' | 'right' | 'rotate' | 'drop'> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotate',
  ArrowDown: 'drop',
  a: 'left',
  d: 'right',
  w: 'rotate',
  x: 'rotate',
  s: 'drop',
  ' ': 'drop',
}

/**
 * 타워쌓기 한 판의 조작. 팀의 탑 상태(tower:state)는 useGameSession이 세션 내내 받아 두고, 여기서는 시작 시각과
 * 내 담당 조작(역할은 한가운데에서 바뀐다), 버튼·키보드 입력을 서버로 보내는 일을 맡는다. 서버가 물리를 돌리므로 보낸 조작은 서버 응답으로 화면에 반영된다.
 */
export function useTowerRound(socket: PartySocket, roundKey: string, state: TowerStateSignal | null, end: TowerEndSignal | null, playerId: string | null) {
  const startedAt = useMonotonicStartedAt(roundKey, state, end ? 'finished' : 'running')
  const myRole: TowerRole | undefined = state?.roles.find((assignment) => assignment.playerId === playerId)?.role
  // 끝나기 전 3·2·1 카운트다운 중에는 아무 조작도 안 된다
  const enabled = !!state && !state.over && state.endsInMs === null && !end
  const lastSentRef = useRef<Record<string, number>>({})
  const holdTimers = useRef<Partial<Record<HoldDir, number>>>({})

  const allowed = useCallback((action: TowerAction) => enabled && !!myRole && roleAllows(myRole, action), [enabled, myRole])

  const sendOnce = useCallback(
    (action: 'rotate' | 'drop') => {
      if (!allowed(action)) return
      const now = performance.now()
      if (now - (lastSentRef.current[action] ?? 0) < MIN_SEND_MS) return
      lastSentRef.current[action] = now
      socket.emit('tower:input', { action })
    },
    [socket, allowed],
  )

  // 이동 — 누르고 있는 동안 신호를 계속 보내고(서버는 신호가 끊기면 저절로 멈춘다), 손을 떼면 멈춤 신호를 보낸다
  const stopHold = useCallback(
    (dir: HoldDir) => {
      const timer = holdTimers.current[dir]
      if (timer === undefined) return
      window.clearInterval(timer)
      delete holdTimers.current[dir]
      socket.emit('tower:input', { action: dir === 'left' ? 'stopLeft' : 'stopRight' })
    },
    [socket],
  )
  const startHold = useCallback(
    (dir: HoldDir) => {
      if (holdTimers.current[dir] !== undefined || !allowed(dir)) return
      socket.emit('tower:input', { action: dir })
      holdTimers.current[dir] = window.setInterval(() => socket.emit('tower:input', { action: dir }), HOLD_HEARTBEAT_MS)
    },
    [socket, allowed],
  )
  const stopAll = useCallback(() => {
    stopHold('left')
    stopHold('right')
  }, [stopHold])

  // 담당이 바뀌거나 끝나거나 화면을 벗어나면 누르고 있던 것도 멈춘다
  const canLeft = allowed('left')
  const canRight = allowed('right')
  useEffect(() => {
    if (!canLeft) stopHold('left')
  }, [canLeft, stopHold])
  useEffect(() => {
    if (!canRight) stopHold('right')
  }, [canRight, stopHold])
  useEffect(() => stopAll, [stopAll])
  useEffect(() => {
    window.addEventListener('blur', stopAll)
    return () => window.removeEventListener('blur', stopAll)
  }, [stopAll])

  /** 버튼을 눌렀다 — 이동은 누르고 있는 동안 이어지고, 나머지는 한 번씩 보낸다 */
  const press = useCallback(
    (action: 'left' | 'right' | 'rotate' | 'drop') => {
      if (action === 'left' || action === 'right') startHold(action)
      else sendOnce(action)
    },
    [startHold, sendOnce],
  )
  const release = useCallback(
    (action: 'left' | 'right' | 'rotate' | 'drop') => {
      if (action === 'left' || action === 'right') stopHold(action)
    },
    [stopHold],
  )

  // 키보드(데스크톱): 방향키·WASD·X·스페이스 — 내 담당이 아닌 키는 그대로 둔다
  useEffect(() => {
    const actionOf = (event: KeyboardEvent) => KEY_ACTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = actionOf(event)
      if (!action || !allowed(action)) return
      event.preventDefault()
      if (event.repeat) return // 꾹 눌러서 반복되는 입력은 따로 세지 않는다 (이동은 누르고 있는 동안 알아서 이어진다)
      press(action)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const action = actionOf(event)
      if (action) release(action)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [allowed, press, release])

  return { startedAt, myRole, allowed, press, release }
}
