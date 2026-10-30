import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerId, RgbColor, RoomMode, RoomState, ServerToClientEvents, SessionConfig } from '../../shared/lib/partyProtocol'
import type { AcrosticWriteSignal, AcrosticVoteSignal } from '../games/acrostic/protocol'
import type { CatchmindChatHistoryEntry, CatchmindStroke } from '../games/catchmind/protocol'
import type { LiarQuizWriteSignal, LiarQuizGuessSignal, LiarQuizComposeSignal } from '../games/liarQuiz/protocol'
import type { MinorityStartSignal } from '../games/minority/protocol'
import type { FindOddRoundSignal } from '../games/findOdd/protocol'
import type { MouseHunterMouse } from '../games/mouseHunter/protocol'
import type { ScavengerHuntRoundTarget } from '../games/scavengerHunt/protocol'
import { reduceMaze, type MazeAction, type MazeViewState } from '../games/mazeEscape/protocol'
import { reduceCharacter, type CharacterAction, type CharacterViewState } from '../games/characterDescribe/protocol'
import { reduceEmojiCharades, type EmojiCharadesAction, type EmojiCharadesViewState } from '../games/emojiCharades/protocol'
import type { FourCharsTurnSignal } from '../games/fourChars/protocol'
import type { SimonStartSignal } from '../games/simon/protocol'
import type { TelepathyStartSignal } from '../games/telepathy/protocol'
import { clearAllDrafts } from './sessionDraft'
import { useSocket } from './useSocket'
import type {
  TelestrationRevealSignal,
  TelestrationTaskSignal,
  TelestrationWordPromptSignal,
} from '../games/telestration/useTelestrationDrawing'
import type { TypeRaceStartSignal } from '../games/typeRace/useTypeRaceRound'

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
/** 설정 변경 응답(room:state)이 더 오지 않고 이만큼 지나면 낙관적 값을 버리고 서버 값으로 맞춘다 */
const PENDING_CONFIG_SETTLE_MS = 800
/** 응답이 아예 없을 때도 낙관적 값이 이 시간 뒤에는 사라진다 */
const PENDING_CONFIG_TIMEOUT_MS = 5000

export function useGameSession(roomCodeFromUrl?: string) {
  const { socket, connected } = useSocket()
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  // 방장이 방금 바꾼 설정 — 서버가 room:state로 돌려주기 전까지 화면에 먼저 반영한다.
  // 서버 응답을 기다렸다가 그 값을 기준으로 다음 값을 계산하면, 응답이 오기 전에 연달아 누른 터치가
  // 서로 덮어쓰거나 한참 뒤에야 반영된다 (연결이 느린 모바일/인앱 브라우저에서 "터치가 씹히는" 증상)
  const [pendingConfig, setPendingConfig] = useState<Partial<SessionConfig>>({})
  const pendingConfigRef = useRef<Partial<SessionConfig>>({})
  const pendingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [findOddRound, setFindOddRound] = useState<FindOddRoundSignal | null>(null)
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
  const [liarQuizCompose, setLiarQuizCompose] = useState<LiarQuizComposeSignal | null>(null)
  const [liarQuizWrite, setLiarQuizWrite] = useState<LiarQuizWriteSignal | null>(null)
  const [liarQuizGuess, setLiarQuizGuess] = useState<LiarQuizGuessSignal | null>(null)
  const [simonStart, setSimonStart] = useState<SimonStartSignal | null>(null)
  // 턴 시작·힌트·결과를 하나의 신호로 합쳐 둔다 — 화면이 뜨기 전에(예: 새로고침 후 재접속) 와도 놓치지 않도록 세션에서 항상 받아둔다
  const [fourCharsTurn, setFourCharsTurn] = useState<FourCharsTurnSignal | null>(null)
  // 이모티콘 퀴즈는 신호가 여러 종류라 하나의 상태로 합쳐 둔다 — 지원 팝업 신호가 화면보다 먼저 와도 놓치지 않도록 세션에서 항상 받아둔다
  const [emojiCharades, setEmojiCharades] = useState<EmojiCharadesViewState | null>(null)
  // 캐릭터 설명도 신호가 여러 종류라 하나의 상태로 합쳐 둔다
  const [characterDescribe, setCharacterDescribe] = useState<CharacterViewState | null>(null)
  // 미로 탈출도 신호가 여러 종류라 하나의 상태로 합쳐 둔다
  const [mazeEscape, setMazeEscape] = useState<MazeViewState | null>(null)
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
      // 연달아 보낸 변경의 응답이 줄줄이 오는 동안에는 중간 값으로 되돌아가지 않도록, 응답이 잠잠해진 뒤에야 서버 값으로 맞춘다
      // (서버가 변경을 거절했다면 이때 서버 값으로 되돌아간다)
      if (pendingClearTimer.current) clearTimeout(pendingClearTimer.current)
      pendingClearTimer.current = setTimeout(() => {
        pendingConfigRef.current = {}
        setPendingConfig({})
      }, PENDING_CONFIG_SETTLE_MS)
      if (state.phase !== 'round_active') {
        // 라운드 밖에 남은 쓰다 만 초안은 낡은 것이다 — 다음 라운드(다른 방·다음 판 포함)에 되살아나지 않게 비운다
        clearAllDrafts()
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
        setFindOddRound(null)
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
        setLiarQuizCompose(null)
        setLiarQuizWrite(null)
        setLiarQuizGuess(null)
        setSimonStart(null)
        setFourCharsTurn(null)
        setEmojiCharades(null)
        setCharacterDescribe(null)
        setMazeEscape(null)
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
    const onFindOddRound = (data: FindOddRoundSignal) => setFindOddRound(data)
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
    // 새 턴의 작성 신호가 오면 지난 턴의 맞히기 신호는 버린다 (화면은 맞히기 신호가 있으면 맞히기 단계로 본다)
    const onLiarQuizCompose = (data: LiarQuizComposeSignal) => setLiarQuizCompose(data)
    const onLiarQuizComposeProgress = (data: { submitted: number }) =>
      setLiarQuizCompose((prev) => (prev ? { ...prev, submittedCount: data.submitted } : prev))
    const onLiarQuizWrite = (data: LiarQuizWriteSignal) => {
      setLiarQuizWrite(data)
      setLiarQuizGuess(null)
      // 첫 턴이 시작되면 문제 입력 단계는 끝난 것이다
      setLiarQuizCompose(null)
    }
    const onLiarQuizGuess = (data: LiarQuizGuessSignal) => setLiarQuizGuess(data)
    // 아래 세 증분 이벤트는 화면이 아직 안 떠 있어도 놓치지 않도록 여기서 현재 신호에 합쳐둔다 (턴이 다르면 무시)
    const onLiarQuizProgress = (data: { turnIndex: number; submitted: number }) =>
      setLiarQuizWrite((prev) => (prev && prev.turnIndex === data.turnIndex ? { ...prev, submittedCount: data.submitted } : prev))
    const onLiarQuizPicked = (data: { turnIndex: number; choiceId: number }) =>
      setLiarQuizGuess((prev) => (prev && prev.turnIndex === data.turnIndex ? { ...prev, pickedId: data.choiceId } : prev))
    const onLiarQuizTurnResult = (data: ServerSignal<'liarQuiz:turnResult'>) =>
      setLiarQuizGuess((prev) => (prev && prev.turnIndex === data.turnIndex ? { ...prev, reveal: data } : prev))
    const onSimonStart = (data: SimonStartSignal) => setSimonStart(data)
    const onFourCharsTurn = (data: FourCharsTurnSignal) => setFourCharsTurn(data)
    const emojiCharadesDispatch = (action: EmojiCharadesAction) => setEmojiCharades((prev) => reduceEmojiCharades(prev, action))
    const onEmojiSelect = (data: ServerSignal<'emojiCharades:select'>) => emojiCharadesDispatch({ type: 'select', data })
    const onEmojiStart = (data: ServerSignal<'emojiCharades:start'>) => emojiCharadesDispatch({ type: 'start', data })
    const onEmojiEmojis = (data: { emojis: string[] }) => emojiCharadesDispatch({ type: 'emojis', emojis: data.emojis })
    const onEmojiChat = (entry: ServerSignal<'emojiCharades:chat'>) => emojiCharadesDispatch({ type: 'chat', entry })
    const onEmojiHint = (data: { lengthHint?: number; chosungHint?: string }) => emojiCharadesDispatch({ type: 'hint', data })
    const onEmojiEnd = (data: ServerSignal<'emojiCharades:end'>) => emojiCharadesDispatch({ type: 'end', data })
    const characterDispatch = (action: CharacterAction) => setCharacterDescribe((prev) => reduceCharacter(prev, action))
    const onCharacterSelect = (data: ServerSignal<'characterDescribe:select'>) => characterDispatch({ type: 'select', data })
    const onCharacterStart = (data: ServerSignal<'characterDescribe:start'>) => characterDispatch({ type: 'start', data })
    const onCharacterChat = (entry: ServerSignal<'characterDescribe:chat'>) => characterDispatch({ type: 'chat', entry })
    const onCharacterHint = (data: { lengthHint?: number; chosungHint?: string }) => characterDispatch({ type: 'hint', data })
    const onCharacterRejected = (data: ServerSignal<'characterDescribe:rejected'>) => characterDispatch({ type: 'rejected', data })
    const onCharacterEnd = (data: ServerSignal<'characterDescribe:end'>) => characterDispatch({ type: 'end', data })
    const mazeDispatch = (action: MazeAction) => setMazeEscape((prev) => reduceMaze(prev, action))
    const onMazeStart = (data: ServerSignal<'mazeEscape:start'>) => mazeDispatch({ type: 'start', data })
    const onMazePos = (pos: ServerSignal<'mazeEscape:pos'>) => mazeDispatch({ type: 'pos', pos })
    const onMazeProgress = (data: ServerSignal<'mazeEscape:progress'>) => mazeDispatch({ type: 'progress', data })
    const onMazeWatch = (data: ServerSignal<'mazeEscape:watch'>) => mazeDispatch({ type: 'watch', data })
    const onMazeEnd = (data: ServerSignal<'mazeEscape:end'>) => mazeDispatch({ type: 'end', data })
    const onFourCharsHint = (data: { turnIndex: number; category: string }) =>
      setFourCharsTurn((prev) => (prev && prev.turnIndex === data.turnIndex ? { ...prev, category: data.category } : prev))
    const onFourCharsProgress = (data: { turnIndex: number; submitted: number; total: number }) =>
      setFourCharsTurn((prev) =>
        prev && prev.turnIndex === data.turnIndex ? { ...prev, progress: { submitted: data.submitted, total: data.total } } : prev,
      )
    const onFourCharsTurnResult = (data: ServerSignal<'fourChars:turnResult'>) =>
      setFourCharsTurn((prev) => (prev && prev.turnIndex === data.turnIndex ? { ...prev, teamStates: data.teamStates, scores: data.scores, result: data } : prev))
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
    socket.on('findOdd:roundStart', onFindOddRound)
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
    socket.on('liarQuiz:composeStart', onLiarQuizCompose)
    socket.on('liarQuiz:composeProgress', onLiarQuizComposeProgress)
    socket.on('liarQuiz:writeStart', onLiarQuizWrite)
    socket.on('liarQuiz:guessStart', onLiarQuizGuess)
    socket.on('liarQuiz:progress', onLiarQuizProgress)
    socket.on('liarQuiz:picked', onLiarQuizPicked)
    socket.on('liarQuiz:turnResult', onLiarQuizTurnResult)
    socket.on('simon:stageStart', onSimonStart)
    socket.on('fourChars:turn', onFourCharsTurn)
    socket.on('fourChars:hint', onFourCharsHint)
    socket.on('fourChars:progress', onFourCharsProgress)
    socket.on('mazeEscape:start', onMazeStart)
    socket.on('mazeEscape:pos', onMazePos)
    socket.on('mazeEscape:progress', onMazeProgress)
    socket.on('mazeEscape:watch', onMazeWatch)
    socket.on('mazeEscape:end', onMazeEnd)
    socket.on('characterDescribe:select', onCharacterSelect)
    socket.on('characterDescribe:start', onCharacterStart)
    socket.on('characterDescribe:chat', onCharacterChat)
    socket.on('characterDescribe:hint', onCharacterHint)
    socket.on('characterDescribe:rejected', onCharacterRejected)
    socket.on('characterDescribe:end', onCharacterEnd)
    socket.on('emojiCharades:select', onEmojiSelect)
    socket.on('emojiCharades:start', onEmojiStart)
    socket.on('emojiCharades:emojis', onEmojiEmojis)
    socket.on('emojiCharades:chat', onEmojiChat)
    socket.on('emojiCharades:hint', onEmojiHint)
    socket.on('emojiCharades:end', onEmojiEnd)
    socket.on('fourChars:turnResult', onFourCharsTurnResult)
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
      socket.off('findOdd:roundStart', onFindOddRound)
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
      socket.off('liarQuiz:composeStart', onLiarQuizCompose)
      socket.off('liarQuiz:composeProgress', onLiarQuizComposeProgress)
      socket.off('liarQuiz:writeStart', onLiarQuizWrite)
      socket.off('liarQuiz:guessStart', onLiarQuizGuess)
      socket.off('liarQuiz:progress', onLiarQuizProgress)
      socket.off('liarQuiz:picked', onLiarQuizPicked)
      socket.off('liarQuiz:turnResult', onLiarQuizTurnResult)
      socket.off('simon:stageStart', onSimonStart)
      socket.off('fourChars:turn', onFourCharsTurn)
      socket.off('fourChars:hint', onFourCharsHint)
      socket.off('fourChars:progress', onFourCharsProgress)
      socket.off('mazeEscape:start', onMazeStart)
      socket.off('mazeEscape:pos', onMazePos)
      socket.off('mazeEscape:progress', onMazeProgress)
      socket.off('mazeEscape:watch', onMazeWatch)
      socket.off('mazeEscape:end', onMazeEnd)
      socket.off('characterDescribe:select', onCharacterSelect)
      socket.off('characterDescribe:start', onCharacterStart)
      socket.off('characterDescribe:chat', onCharacterChat)
      socket.off('characterDescribe:hint', onCharacterHint)
      socket.off('characterDescribe:rejected', onCharacterRejected)
      socket.off('characterDescribe:end', onCharacterEnd)
      socket.off('emojiCharades:select', onEmojiSelect)
      socket.off('emojiCharades:start', onEmojiStart)
      socket.off('emojiCharades:emojis', onEmojiEmojis)
      socket.off('emojiCharades:chat', onEmojiChat)
      socket.off('emojiCharades:hint', onEmojiHint)
      socket.off('emojiCharades:end', onEmojiEnd)
      socket.off('fourChars:turnResult', onFourCharsTurnResult)
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
          // 방에서 나간 사람(나가기를 눌렀거나 오래 끊겨 있던 사람)이거나 방이 사라진 경우 — 앱을 안 닫고 있다가 돌아온 화면에 예전 방 상태가
          // 남아 있지 않도록 비워서, 닉네임 입력부터 다시 시작하게 한다
          localStorage.removeItem(storageKey(roomCodeFromUrl))
          setPlayerId(null)
          setRoomState(null)
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
    (nickname: string, mode: RoomMode = 'individual') =>
      new Promise<{ ok: true; roomCode: string } | { ok: false; error: string }>((resolve) => {
        socket.emit('room:create', nickname, mode, (result) => {
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

  const setTeam = useCallback((teamId: number) => socket.emit('player:setTeam', teamId), [socket])
  const setTeamColor = useCallback((colorId: number) => socket.emit('player:setTeamColor', colorId), [socket])
  const setReady = useCallback((ready: boolean) => socket.emit('player:ready', ready), [socket])
  const updateConfig = useCallback(
    (patch: Partial<SessionConfig>) => {
      pendingConfigRef.current = { ...pendingConfigRef.current, ...patch }
      setPendingConfig(pendingConfigRef.current)
      // 응답이 안 오는 경우(연결 끊김 등)에도 낙관적 값이 영원히 남지 않게 한다
      if (pendingClearTimer.current) clearTimeout(pendingClearTimer.current)
      pendingClearTimer.current = setTimeout(() => {
        pendingConfigRef.current = {}
        setPendingConfig({})
      }, PENDING_CONFIG_TIMEOUT_MS)
      socket.emit('host:updateConfig', patch)
    },
    [socket],
  )
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

  const displayRoomState = useMemo(
    () => (roomState && Object.keys(pendingConfig).length > 0 ? { ...roomState, config: { ...roomState.config, ...pendingConfig } } : roomState),
    [roomState, pendingConfig],
  )

  return {
    socket,
    connected,
    roomState: displayRoomState,
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
    findOddRound,
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
    liarQuizCompose,
    liarQuizWrite,
    liarQuizGuess,
    simonStart,
    fourCharsTurn,
    emojiCharades,
    characterDescribe,
    mazeEscape,
    telestrationTask,
    telestrationReveal,
    telestrationWordPrompt,
    createRoom,
    joinRoom,
    setReady,
    setTeam,
    setTeamColor,
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
