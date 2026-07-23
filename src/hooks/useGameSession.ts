import { useCallback, useEffect, useState } from 'react'
import type { RoomState, SessionConfig } from '../lib/partyProtocol'
import { useSocket } from './useSocket'

const REJOIN_TTL_MS = 60 * 60 * 1000 // 마지막 접속 후 1시간이 지나면 재접속 정보를 만료시킨다

function storageKey(roomCode: string) {
  return `party_player_${roomCode.toUpperCase()}`
}

/** 만료됐으면 저장된 값을 지우고 null을 반환한다 */
function readSavedPlayerId(roomCode: string): string | null {
  const raw = localStorage.getItem(storageKey(roomCode))
  if (!raw) return null

  try {
    const { playerId, savedAt } = JSON.parse(raw) as { playerId: string; savedAt: number }
    if (Date.now() - savedAt > REJOIN_TTL_MS) {
      localStorage.removeItem(storageKey(roomCode))
      return null
    }
    return playerId
  } catch {
    localStorage.removeItem(storageKey(roomCode))
    return null
  }
}

/** 접속/재접속에 성공할 때마다 호출해 만료 시각을 갱신한다 */
function saveSession(roomCode: string, playerId: string) {
  localStorage.setItem(storageKey(roomCode), JSON.stringify({ playerId, savedAt: Date.now() }))
}

/** 방 코드(roomCodeFromUrl)가 있으면 새로고침은 물론 앱을 껐다 켜도(1시간 이내) 저장된 참가자로 자동 재접속을 시도한다 */
export function useGameSession(roomCodeFromUrl?: string) {
  const { socket } = useSocket()
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejoining, setRejoining] = useState(false)
  const [humanTimerStart, setHumanTimerStart] = useState<{ elapsedMs: number } | null>(null)

  // room:state가 브로드캐스트되기도 전에 humanTimer:roundStart가 먼저 도착할 수 있어서
  // (라운드별 화면이 마운트되기 전에 신호를 놓치지 않도록) 세션이 살아있는 동안 항상 구독해둔다
  useEffect(() => {
    const onState = (state: RoomState) => {
      setRoomState(state)
      if (state.phase !== 'round_active') setHumanTimerStart(null)
    }
    const onError = (message: string) => setError(message)
    const onHumanTimerStart = (data: { elapsedMs: number }) => setHumanTimerStart(data)
    socket.on('room:state', onState)
    socket.on('room:error', onError)
    socket.on('humanTimer:roundStart', onHumanTimerStart)
    return () => {
      socket.off('room:state', onState)
      socket.off('room:error', onError)
      socket.off('humanTimer:roundStart', onHumanTimerStart)
    }
  }, [socket])

  // 소켓 하트비트 타임아웃(20초)보다 짧게 백그라운드에 있다 돌아오면 연결은 안 끊기지만,
  // 그 사이 브라우저가 JS 실행을 멈춰서 humanTimer:roundStart 같은 이벤트를 놓칠 수 있음.
  // 탭이 다시 보이게 될 때마다 현재 라운드의 진짜 경과 시간을 다시 요청해 동기화
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.connected) {
        socket.emit('round:requestResync')
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [socket])

  // 최초 접속뿐 아니라, 화면 잠금 등으로 소켓이 끊겼다가 새로운 소켓으로 재연결될 때마다
  // 다시 room:rejoin을 보내야 서버가 새 소켓을 이 참가자와 다시 연결
  useEffect(() => {
    if (!roomCodeFromUrl) return

    const tryRejoin = () => {
      const savedPlayerId = readSavedPlayerId(roomCodeFromUrl)
      if (!savedPlayerId) return

      setRejoining(true)
      socket.emit('room:rejoin', { roomCode: roomCodeFromUrl, playerId: savedPlayerId }, (result) => {
        setRejoining(false)
        if (result.ok) {
          saveSession(roomCodeFromUrl, savedPlayerId)
          setPlayerId(savedPlayerId)
        } else {
          localStorage.removeItem(storageKey(roomCodeFromUrl))
        }
      })
    }

    if (socket.connected) tryRejoin()
    socket.on('connect', tryRejoin)
    return () => {
      socket.off('connect', tryRejoin)
    }
  }, [roomCodeFromUrl, socket])

  const createRoom = useCallback(
    (nickname: string) =>
      new Promise<{ ok: true; roomCode: string } | { ok: false; error: string }>((resolve) => {
        socket.emit('room:create', nickname, (result) => {
          if (result.ok) {
            saveSession(result.roomCode, result.playerId)
            setPlayerId(result.playerId)
            resolve({ ok: true, roomCode: result.roomCode })
          } else {
            resolve(result)
          }
        })
      }),
    [socket],
  )

  const joinRoom = useCallback(
    (roomCode: string, nickname: string) =>
      new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
        socket.emit('room:join', { roomCode, nickname }, (result) => {
          if (result.ok) {
            saveSession(roomCode, result.playerId)
            setPlayerId(result.playerId)
            resolve({ ok: true })
          } else {
            resolve(result)
          }
        })
      }),
    [socket],
  )

  const setReady = useCallback((ready: boolean) => socket.emit('player:ready', ready), [socket])
  const updateConfig = useCallback((patch: Partial<SessionConfig>) => socket.emit('host:updateConfig', patch), [socket])
  const start = useCallback(() => socket.emit('host:start'), [socket])
  const nextRound = useCallback(() => socket.emit('host:nextRound'), [socket])
  const playAgain = useCallback(() => socket.emit('room:playAgain'), [socket])

  const leaveRoom = useCallback(() => {
    socket.emit('player:leave')
    if (roomCodeFromUrl) localStorage.removeItem(storageKey(roomCodeFromUrl))
    setPlayerId(null)
    setRoomState(null)
  }, [socket, roomCodeFromUrl])

  const me = roomState?.players.find((p) => p.id === playerId) ?? null
  const isHost = roomState !== null && playerId !== null && roomState.hostId === playerId

  return {
    socket,
    roomState,
    playerId,
    me,
    isHost,
    error,
    rejoining,
    humanTimerStart,
    createRoom,
    joinRoom,
    setReady,
    updateConfig,
    start,
    nextRound,
    playAgain,
    leaveRoom,
  }
}

export type GameSession = ReturnType<typeof useGameSession>
