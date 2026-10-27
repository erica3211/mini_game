import { useCallback, useEffect, useState } from 'react'
import type {
  CatchmindChatHistoryEntry,
  CatchmindStroke,
  MouseHunterMouse,
  PlayerId,
  RgbColor,
  RoomState,
  ScavengerHuntRoundTarget,
  ServerToClientEvents,
  SessionConfig,
  TelepathyStartSignal,
  MinorityStartSignal,
  AcrosticWriteSignal,
  AcrosticVoteSignal,
} from '../lib/partyProtocol'
import { useSocket } from './useSocket'
import type {
  TelestrationRevealSignal,
  TelestrationTaskSignal,
  TelestrationWordPromptSignal,
} from './useTelestrationDrawing'
import type { TypeRaceStartSignal } from './useTypeRaceRound'

/** 서버가 보내는 시작/복원 신호의 페이로드 타입 — 프로토콜(partyProtocol)에 있는 걸 그대로 쓴다 */
type ServerSignal<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0]

const REJOIN_TTL_MS = 60 * 60 * 1000 // 마지막 접속 후 1시간이 지나면 재접속 정보를 만료시킨다
const STORAGE_PREFIX = 'party_player_'

function storageKey(roomCode: string) {
  return `${STORAGE_PREFIX}${roomCode.toUpperCase()}`
}

/** 만료 체크가 그 방으로 재접속을 시도할 때만 일어나다 보니, 한 번 쓰고 안 돌아온 방의 키는 계속 쌓인다.
 *  앱이 뜰 때마다 한 번씩 훑어서 만료된 것들을 정리한다 */
function sweepExpiredSessions() {
  const now = Date.now()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key?.startsWith(STORAGE_PREFIX)) continue
    const raw = localStorage.getItem(key)
    try {
      const { savedAt } = JSON.parse(raw ?? '') as { savedAt: number }
      if (typeof savedAt !== 'number' || now - savedAt > REJOIN_TTL_MS) localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
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
  const { socket, connected } = useSocket()
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejoining, setRejoining] = useState(false)
  const [humanTimerStart, setHumanTimerStart] = useState<ServerSignal<'humanTimer:roundStart'> | null>(null)
  const [oneToTwentyFiveStart, setOneToTwentyFiveStart] = useState<ServerSignal<'oneToTwentyFive:roundStart'> | null>(null)
  const [wordChainStart, setWordChainStart] = useState<ServerSignal<'wordChain:roundStart'> | null>(null)
  const [wordChainCategory, setWordChainCategory] = useState<string | null>(null)
  const [wordChainDefinition, setWordChainDefinition] = useState<string | null>(null)
  const [auctionStart, setAuctionStart] = useState<ServerSignal<'auction:roundStart'> | null>(null)
  const [colorMatchStart, setColorMatchStart] = useState<{
    subRoundIndex: number
    answerColor: RgbColor
    elapsedMs: number
  } | null>(null)
  const [pixelCanvasStart, setPixelCanvasStart] = useState<{
    grid: number[]
    slotColors: string[]
    slotOfPlayer: Record<string, number>
    elapsedMs: number
  } | null>(null)
  const [balloonPopStart, setBalloonPopStart] = useState<ServerSignal<'balloonPop:roundStart'> | null>(null)
  const [mouseHunterStart, setMouseHunterStart] = useState<{
    mice: MouseHunterMouse[]
    caughtCount: number
    elapsedMs: number
  } | null>(null)
  const [scavengerHuntStart, setScavengerHuntStart] = useState<{
    subRoundIndex: number
    target: ScavengerHuntRoundTarget
    elapsedMs: number
    submitted?: boolean
  } | null>(null)
  const [shoutRaceStart, setShoutRaceStart] = useState<{ elapsedMs: number } | null>(null)
  const [shoutRaceCountdown, setShoutRaceCountdown] = useState<{
    slotColors: string[]
    slotOfPlayer: Record<string, number>
    elapsedMs: number
  } | null>(null)
  const [shoutRaceGo, setShoutRaceGo] = useState<{
    slotColors: string[]
    slotOfPlayer: Record<string, number>
    elapsedMs: number
    finished?: boolean
    myProgress?: number
  } | null>(null)
  const [catchmindTurnStart, setCatchmindTurnStart] = useState<{
    turnIndex: number
    totalTurns: number
    drawerId: PlayerId
    strokes: CatchmindStroke[]
    elapsedMs: number
    guessed?: boolean
    history?: CatchmindChatHistoryEntry[]
  } | null>(null)
  const [catchmindWord, setCatchmindWord] = useState<{ turnIndex: number; word: string } | null>(null)
  // 글자 수 힌트 — 게임 화면이 뜨기 전에(예: 새로고침 후 재접속) 서버가 다시 보내줘도 놓치지 않도록 세션에서 항상 받아둔다
  const [catchmindHintLength, setCatchmindHintLength] = useState<number | null>(null)
  const [typeRaceStart, setTypeRaceStart] = useState<TypeRaceStartSignal | null>(null)
  const [telepathyStart, setTelepathyStart] = useState<TelepathyStartSignal | null>(null)
  const [minorityStart, setMinorityStart] = useState<MinorityStartSignal | null>(null)
  const [acrosticWrite, setAcrosticWrite] = useState<AcrosticWriteSignal | null>(null)
  const [acrosticVote, setAcrosticVote] = useState<AcrosticVoteSignal | null>(null)
  const [telestrationTask, setTelestrationTask] = useState<TelestrationTaskSignal | null>(null)
  const [telestrationReveal, setTelestrationReveal] = useState<TelestrationRevealSignal | null>(null)
  const [telestrationWordPrompt, setTelestrationWordPrompt] = useState<TelestrationWordPromptSignal | null>(null)

  useEffect(() => {
    sweepExpiredSessions()
  }, [])

  // room:state가 브로드캐스트되기도 전에 게임별 roundStart가 먼저 도착할 수 있어서
  // (라운드별 화면이 마운트되기 전에 신호를 놓치지 않도록) 세션이 살아있는 동안 항상 구독해둔다
  useEffect(() => {
    const onState = (state: RoomState) => {
      setRoomState(state)
      if (state.phase !== 'round_active') {
        setHumanTimerStart(null)
        setOneToTwentyFiveStart(null)
        setWordChainStart(null)
        setWordChainCategory(null)
        setWordChainDefinition(null)
        setAuctionStart(null)
        setColorMatchStart(null)
        setPixelCanvasStart(null)
        setBalloonPopStart(null)
        setMouseHunterStart(null)
        setScavengerHuntStart(null)
        setShoutRaceStart(null)
        setShoutRaceCountdown(null)
        setShoutRaceGo(null)
        setCatchmindTurnStart(null)
        setCatchmindWord(null)
        setCatchmindHintLength(null)
        setTypeRaceStart(null)
        setTelepathyStart(null)
        setMinorityStart(null)
        setAcrosticWrite(null)
        setAcrosticVote(null)
        setTelestrationTask(null)
        setTelestrationReveal(null)
        setTelestrationWordPrompt(null)
      }
    }
    const onError = (message: string) => setError(message)
    const onHumanTimerStart = (data: ServerSignal<'humanTimer:roundStart'>) => setHumanTimerStart(data)
    const onOneToTwentyFiveStart = (data: ServerSignal<'oneToTwentyFive:roundStart'>) => setOneToTwentyFiveStart(data)
    const onWordChainStart = (data: ServerSignal<'wordChain:roundStart'>) => {
      setWordChainStart(data)
      setWordChainCategory(null)
      setWordChainDefinition(null)
    }
    const onWordChainCategory = (data: { category: string }) => setWordChainCategory(data.category)
    const onWordChainDefinition = (data: { definition: string }) => setWordChainDefinition(data.definition)
    const onAuctionStart = (data: ServerSignal<'auction:roundStart'>) => setAuctionStart(data)
    const onColorMatchStart = (data: { subRoundIndex: number; answerColor: RgbColor; elapsedMs: number }) =>
      setColorMatchStart(data)
    const onPixelCanvasStart = (data: {
      grid: number[]
      slotColors: string[]
      slotOfPlayer: Record<string, number>
      elapsedMs: number
    }) => setPixelCanvasStart(data)
    const onBalloonPopStart = (data: ServerSignal<'balloonPop:roundStart'>) => setBalloonPopStart(data)
    const onMouseHunterStart = (data: { mice: MouseHunterMouse[]; caughtCount: number; elapsedMs: number }) =>
      setMouseHunterStart(data)
    const onScavengerHuntStart = (data: { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number; submitted?: boolean }) =>
      setScavengerHuntStart(data)
    const onShoutRaceStart = (data: { elapsedMs: number }) => setShoutRaceStart(data)
    const onShoutRaceCountdown = (data: { slotColors: string[]; slotOfPlayer: Record<string, number>; elapsedMs: number }) =>
      setShoutRaceCountdown(data)
    const onShoutRaceGo = (data: { slotColors: string[]; slotOfPlayer: Record<string, number>; elapsedMs: number; finished?: boolean; myProgress?: number }) =>
      setShoutRaceGo(data)
    const onCatchmindTurnStart = (data: {
      turnIndex: number
      totalTurns: number
      drawerId: PlayerId
      strokes: CatchmindStroke[]
      elapsedMs: number
      guessed?: boolean
      history?: CatchmindChatHistoryEntry[]
    }) => {
      setCatchmindTurnStart(data)
      // 새 턴(또는 재접속 스냅샷)이 오면 힌트를 비운다 — 서버는 재접속 때 turnStart 다음에 hintRevealed를 이어서 다시 보낸다
      setCatchmindHintLength(null)
    }
    const onCatchmindWord = (data: { turnIndex: number; word: string }) => setCatchmindWord(data)
    const onCatchmindHint = (data: { length: number }) => setCatchmindHintLength(data.length)
    const onTypeRaceStart = (data: TypeRaceStartSignal) => setTypeRaceStart(data)
    const onTelepathyStart = (data: TelepathyStartSignal) => setTelepathyStart(data)
    const onMinorityStart = (data: MinorityStartSignal) => setMinorityStart(data)
    const onAcrosticWrite = (data: AcrosticWriteSignal) => setAcrosticWrite(data)
    const onAcrosticVote = (data: AcrosticVoteSignal) => setAcrosticVote(data)
    const onTelestrationTask = (data: TelestrationTaskSignal) => setTelestrationTask(data)
    const onTelestrationReveal = (data: TelestrationRevealSignal) => setTelestrationReveal(data)
    const onTelestrationWordPrompt = (data: TelestrationWordPromptSignal) => setTelestrationWordPrompt(data)
    socket.on('room:state', onState)
    socket.on('room:error', onError)
    socket.on('humanTimer:roundStart', onHumanTimerStart)
    socket.on('oneToTwentyFive:roundStart', onOneToTwentyFiveStart)
    socket.on('wordChain:roundStart', onWordChainStart)
    socket.on('wordChain:categoryRevealed', onWordChainCategory)
    socket.on('wordChain:definitionRevealed', onWordChainDefinition)
    socket.on('auction:roundStart', onAuctionStart)
    socket.on('colorMatch:roundStart', onColorMatchStart)
    socket.on('pixelCanvas:roundStart', onPixelCanvasStart)
    socket.on('balloonPop:roundStart', onBalloonPopStart)
    socket.on('mouseHunter:roundStart', onMouseHunterStart)
    socket.on('scavengerHunt:roundStart', onScavengerHuntStart)
    socket.on('shoutRace:roundStart', onShoutRaceStart)
    socket.on('shoutRace:countdown', onShoutRaceCountdown)
    socket.on('shoutRace:go', onShoutRaceGo)
    socket.on('catchmind:turnStart', onCatchmindTurnStart)
    socket.on('catchmind:hintRevealed', onCatchmindHint)
    socket.on('catchmind:word', onCatchmindWord)
    socket.on('typeRace:roundStart', onTypeRaceStart)
    socket.on('telepathy:roundStart', onTelepathyStart)
    socket.on('minority:roundStart', onMinorityStart)
    socket.on('acrostic:writeStart', onAcrosticWrite)
    socket.on('acrostic:voteStart', onAcrosticVote)
    socket.on('telestration:task', onTelestrationTask)
    socket.on('telestration:reveal', onTelestrationReveal)
    socket.on('telestration:wordPrompt', onTelestrationWordPrompt)
    return () => {
      socket.off('room:state', onState)
      socket.off('room:error', onError)
      socket.off('humanTimer:roundStart', onHumanTimerStart)
      socket.off('oneToTwentyFive:roundStart', onOneToTwentyFiveStart)
      socket.off('wordChain:roundStart', onWordChainStart)
      socket.off('wordChain:categoryRevealed', onWordChainCategory)
      socket.off('wordChain:definitionRevealed', onWordChainDefinition)
      socket.off('auction:roundStart', onAuctionStart)
      socket.off('colorMatch:roundStart', onColorMatchStart)
      socket.off('pixelCanvas:roundStart', onPixelCanvasStart)
      socket.off('balloonPop:roundStart', onBalloonPopStart)
      socket.off('mouseHunter:roundStart', onMouseHunterStart)
      socket.off('scavengerHunt:roundStart', onScavengerHuntStart)
      socket.off('shoutRace:roundStart', onShoutRaceStart)
      socket.off('shoutRace:countdown', onShoutRaceCountdown)
      socket.off('shoutRace:go', onShoutRaceGo)
      socket.off('catchmind:turnStart', onCatchmindTurnStart)
      socket.off('catchmind:hintRevealed', onCatchmindHint)
      socket.off('catchmind:word', onCatchmindWord)
      socket.off('typeRace:roundStart', onTypeRaceStart)
      socket.off('telepathy:roundStart', onTelepathyStart)
      socket.off('minority:roundStart', onMinorityStart)
      socket.off('acrostic:writeStart', onAcrosticWrite)
      socket.off('acrostic:voteStart', onAcrosticVote)
      socket.off('telestration:task', onTelestrationTask)
      socket.off('telestration:reveal', onTelestrationReveal)
      socket.off('telestration:wordPrompt', onTelestrationWordPrompt)
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
  const transferHost = useCallback((targetPlayerId: string) => socket.emit('host:transferHost', targetPlayerId), [socket])
  const start = useCallback(() => socket.emit('host:start'), [socket])
  const nextRound = useCallback(() => socket.emit('host:nextRound'), [socket])
  const returnToLobby = useCallback(() => socket.emit('host:returnToLobby'), [socket])
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
    connected,
    roomState,
    playerId,
    me,
    isHost,
    error,
    rejoining,
    humanTimerStart,
    oneToTwentyFiveStart,
    wordChainStart,
    wordChainCategory,
    wordChainDefinition,
    auctionStart,
    colorMatchStart,
    pixelCanvasStart,
    balloonPopStart,
    mouseHunterStart,
    scavengerHuntStart,
    shoutRaceStart,
    shoutRaceCountdown,
    shoutRaceGo,
    catchmindTurnStart,
    catchmindWord,
    catchmindHintLength,
    typeRaceStart,
    telepathyStart,
    minorityStart,
    acrosticWrite,
    acrosticVote,
    telestrationTask,
    telestrationReveal,
    telestrationWordPrompt,
    createRoom,
    joinRoom,
    setReady,
    updateConfig,
    transferHost,
    start,
    nextRound,
    returnToLobby,
    playAgain,
    leaveRoom,
  }
}

export type GameSession = ReturnType<typeof useGameSession>
