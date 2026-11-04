import { useCallback, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { roleAllows, type TetrisAction, type TetrisEndSignal, type TetrisRole, type TetrisStateSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

// 빠르게 내리기를 누르고 있는 동안 신호를 보내는 간격 (서버는 300ms 안에 다음 신호가 없으면 멈춘다)
const FAST_HEARTBEAT_MS = 120

// 같은 조작을 이 간격보다 짧게 연달아 보내지 않는다 (서버는 25ms보다 짧은 신호를 버린다 — 지터로 붙어 도착해도 버려지지 않게 넉넉히 둔다)
const MIN_SEND_MS = 45

const KEY_ACTIONS: Record<string, TetrisAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotate',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'rotate',
  x: 'rotate',
  s: 'down',
}

/**
 * 테트리스 한 판의 조작. 팀의 판 상태(tetris:state)는 useGameSession이 세션 내내 받아 두고, 여기서는 시작 시각과
 * 내 담당 조작(역할은 한가운데에서 바뀐다), 버튼·키보드 입력을 서버로 보내는 일을 맡는다. 서버가 판을 돌리므로 보낸 조작은 서버 응답으로 화면에 반영된다.
 */
export function useTetrisRound(socket: PartySocket, roundKey: string, state: TetrisStateSignal | null, end: TetrisEndSignal | null, playerId: string | null) {
  const startedAt = useMonotonicStartedAt(roundKey, state, end ? 'finished' : 'running')
  const myRole: TetrisRole | undefined = state?.roles.find((assignment) => assignment.playerId === playerId)?.role
  const lastSentRef = useRef<Record<string, number>>({})
  const enabled = !!state && !end

  const allowed = useCallback((action: TetrisAction) => enabled && !!myRole && roleAllows(myRole, action), [enabled, myRole])

  const send = useCallback(
    (action: TetrisAction) => {
      if (!allowed(action)) return
      const now = performance.now()
      if (now - (lastSentRef.current[action] ?? 0) < MIN_SEND_MS) return
      lastSentRef.current[action] = now
      socket.emit('tetris:input', { action })
    },
    [socket, allowed],
  )

  // 빠르게 내리기 — 누르고 있는 동안 신호를 계속 보내고(서버는 신호가 끊기면 저절로 멈춘다), 손을 떼면 멈춤 신호를 보낸다
  const fastTimerRef = useRef<number | null>(null)
  const stopFast = useCallback(() => {
    if (fastTimerRef.current === null) return
    window.clearInterval(fastTimerRef.current)
    fastTimerRef.current = null
    socket.emit('tetris:input', { action: 'stop' })
  }, [socket])
  const startFast = useCallback(() => {
    if (fastTimerRef.current !== null || !allowed('down')) return
    socket.emit('tetris:input', { action: 'down' })
    fastTimerRef.current = window.setInterval(() => socket.emit('tetris:input', { action: 'down' }), FAST_HEARTBEAT_MS)
  }, [socket, allowed])
  // 담당이 바뀌거나 끝나거나 화면을 벗어나면 누르고 있던 것도 멈춘다
  const canFast = allowed('down')
  useEffect(() => {
    if (!canFast) stopFast()
  }, [canFast, stopFast])
  useEffect(() => stopFast, [stopFast])
  useEffect(() => {
    window.addEventListener('blur', stopFast)
    return () => window.removeEventListener('blur', stopFast)
  }, [stopFast])

  /** 버튼을 눌렀다 — 빠르게 내리기는 누르고 있는 동안 이어지고, 나머지는 한 번씩 보낸다 */
  const press = useCallback((action: TetrisAction) => (action === 'down' ? startFast() : send(action)), [send, startFast])
  const release = useCallback((action: TetrisAction) => {
    if (action === 'down') stopFast()
  }, [stopFast])

  // 키보드(데스크톱): 방향키·WASD·X — 내 담당이 아닌 키는 그대로 둔다
  useEffect(() => {
    const actionOf = (event: KeyboardEvent) => KEY_ACTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = actionOf(event)
      if (!action || !allowed(action)) return
      event.preventDefault()
      // 회전·빠르게 내리기는 꾹 눌러서 반복되는 입력을 따로 세지 않는다 (빠르게 내리기는 누르고 있는 동안 알아서 이어진다)
      if ((action === 'rotate' || action === 'down') && event.repeat) return
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
