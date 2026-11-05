import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerId, RgbColor, RoomMode, RoomState, ServerToClientEvents, SessionConfig } from '../../shared/lib/partyProtocol'
import type { AcrosticWriteSignal, AcrosticVoteSignal } from '../games/acrostic/protocol'
import type { CatchmindChatHistoryEntry, CatchmindStroke } from '../games/catchmind/protocol'
import type { LiarQuizWriteSignal, LiarQuizGuessSignal, LiarQuizComposeSignal } from '../games/liarQuiz/protocol'
import type { MinorityStartSignal } from '../games/minority/protocol'
import type { FindOddRoundSignal } from '../games/findOdd/protocol'
import type { StroopQuestionSignal } from '../games/stroop/protocol'
import type { MemoryStateSignal } from '../games/memoryCards/protocol'
import type { OlympicsStateSignal } from '../games/olympics/protocol'
import type { OrderCardsEndSignal, OrderCardsStanding, OrderCardsStateSignal } from '../games/orderCards/protocol'
import type { TugStartSignal } from '../games/tugOfWar/protocol'
import type { RecyclingStartSignal } from '../games/recycling/protocol'
import type { TetrisEndSignal, TetrisProgressSignal, TetrisStateSignal } from '../games/tetris/protocol'
import type { MarbleEndSignal, MarblePositionsSignal, MarbleProgressSignal, MarbleStateSignal } from '../games/marbleMaze/protocol'
import type { TreasureEndSignal, TreasurePositionsSignal, TreasureProgressSignal, TreasureStateSignal } from '../games/darkTreasure/protocol'
import { mergeDalgonaTraces, type DalgonaStateSignal, type DalgonaTrace, type DalgonaTracesSignal, type JjukkumiEndSignal, type JjukkumiPositionsSignal, type JjukkumiStageSignal, type JjukkumiStateSignal } from '../games/jjukkumi/protocol'
import type { ConnectionsEndSignal, ConnectionsProgressSignal, ConnectionsStateSignal } from '../games/connections/protocol'
import type { TowerEndSignal, TowerProgressSignal, TowerStateSignal } from '../games/towerStack/protocol'
import type { SpyWordsEndSignal, SpyWordsStateSignal } from '../games/spyWords/protocol'
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
// 화면이 다시 보일 때 보내는 상태 요청에 이 시간 안에 응답이 없으면 연결이 죽은 것으로 보고 새로 연결한다
const RESYNC_ACK_TIMEOUT_MS = 3000
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
  const [stroopQuestion, setStroopQuestion] = useState<StroopQuestionSignal | null>(null)
  const [tugStart, setTugStart] = useState<TugStartSignal | null>(null)
  const [recyclingStart, setRecyclingStart] = useState<RecyclingStartSignal | null>(null)
  const [tetrisState, setTetrisState] = useState<TetrisStateSignal | null>(null)
  const [tetrisProgress, setTetrisProgress] = useState<TetrisProgressSignal | null>(null)
  const [tetrisEnd, setTetrisEnd] = useState<TetrisEndSignal | null>(null)
  const [marbleState, setMarbleState] = useState<MarbleStateSignal | null>(null)
  const [marbleProgress, setMarbleProgress] = useState<MarbleProgressSignal | null>(null)
  const [marbleEnd, setMarbleEnd] = useState<MarbleEndSignal | null>(null)
  const [marblePositions, setMarblePositions] = useState<MarblePositionsSignal | null>(null)
  const [treasureState, setTreasureState] = useState<TreasureStateSignal | null>(null)
  const [treasureProgress, setTreasureProgress] = useState<TreasureProgressSignal | null>(null)
  const [treasureEnd, setTreasureEnd] = useState<TreasureEndSignal | null>(null)
  const [treasurePositions, setTreasurePositions] = useState<TreasurePositionsSignal | null>(null)
  const [jjukkumiState, setJjukkumiState] = useState<JjukkumiStateSignal | null>(null)
  const [jjukkumiPositions, setJjukkumiPositions] = useState<JjukkumiPositionsSignal | null>(null)
  const [jjukkumiEnd, setJjukkumiEnd] = useState<JjukkumiEndSignal | null>(null)
  const [jjukkumiStage, setJjukkumiStage] = useState<JjukkumiStageSignal | null>(null)
  const [dalgonaState, setDalgonaState] = useState<DalgonaStateSignal | null>(null)
  const [dalgonaTraces, setDalgonaTraces] = useState<Record<string, DalgonaTrace>>({})
  const [connectionsState, setConnectionsState] = useState<ConnectionsStateSignal | null>(null)
  const [connectionsProgress, setConnectionsProgress] = useState<ConnectionsProgressSignal | null>(null)
  const [connectionsEnd, setConnectionsEnd] = useState<ConnectionsEndSignal | null>(null)
  const [towerState, setTowerState] = useState<TowerStateSignal | null>(null)
  const [towerProgress, setTowerProgress] = useState<TowerProgressSignal | null>(null)
  const [towerEnd, setTowerEnd] = useState<TowerEndSignal | null>(null)
  const [spyWordsState, setSpyWordsState] = useState<SpyWordsStateSignal | null>(null)
  const [spyWordsEnd, setSpyWordsEnd] = useState<SpyWordsEndSignal | null>(null)
  const [memoryCardsState, setMemoryCardsState] = useState<MemoryStateSignal | null>(null)
  const [olympicsState, setOlympicsState] = useState<OlympicsStateSignal | null>(null)
  const [orderCardsState, setOrderCardsState] = useState<OrderCardsStateSignal | null>(null)
  const [orderCardsStandings, setOrderCardsStandings] = useState<OrderCardsStanding[]>([])
  const [orderCardsEnd, setOrderCardsEnd] = useState<OrderCardsEndSignal | null>(null)
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
        setStroopQuestion(null)
        setTugStart(null)
        setRecyclingStart(null)
        setTetrisState(null)
        setTetrisProgress(null)
        setTetrisEnd(null)
        setMarbleState(null)
        setMarbleProgress(null)
        setMarbleEnd(null)
        setMarblePositions(null)
        setTreasureState(null)
        setTreasureProgress(null)
        setTreasureEnd(null)
        setTreasurePositions(null)
        setJjukkumiState(null)
        setJjukkumiPositions(null)
        setJjukkumiEnd(null)
        setJjukkumiStage(null)
        setDalgonaState(null)
        setDalgonaTraces({})
        setConnectionsState(null)
        setConnectionsProgress(null)
        setConnectionsEnd(null)
        setTowerState(null)
        setTowerProgress(null)
        setTowerEnd(null)
        setSpyWordsState(null)
        setSpyWordsEnd(null)
        setMemoryCardsState(null)
        setOlympicsState(null)
        setOrderCardsState(null)
        setOrderCardsStandings([])
        setOrderCardsEnd(null)
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
    const onStroopQuestion = (data: StroopQuestionSignal) => setStroopQuestion(data)
    const onTugStart = (data: TugStartSignal) => setTugStart(data)
    const onRecyclingStart = (data: RecyclingStartSignal) => setRecyclingStart(data)
    const onTetrisState = (data: TetrisStateSignal) => setTetrisState(data)
    const onTetrisProgress = (data: TetrisProgressSignal) => setTetrisProgress(data)
    const onTetrisEnd = (data: TetrisEndSignal) => setTetrisEnd(data)
    const onMarbleState = (data: MarbleStateSignal) => setMarbleState(data)
    const onMarbleProgress = (data: MarbleProgressSignal) => setMarbleProgress(data)
    const onMarbleEnd = (data: MarbleEndSignal) => setMarbleEnd(data)
    const onMarblePositions = (data: MarblePositionsSignal) => setMarblePositions(data)
    const onTreasureState = (data: TreasureStateSignal) => setTreasureState(data)
    const onTreasureProgress = (data: TreasureProgressSignal) => setTreasureProgress(data)
    const onTreasureEnd = (data: TreasureEndSignal) => setTreasureEnd(data)
    const onTreasurePositions = (data: TreasurePositionsSignal) => setTreasurePositions(data)
    const onJjukkumiState = (data: JjukkumiStateSignal) => setJjukkumiState(data)
    const onJjukkumiPositions = (data: JjukkumiPositionsSignal) => setJjukkumiPositions(data)
    const onJjukkumiEnd = (data: JjukkumiEndSignal) => setJjukkumiEnd(data)
    const onJjukkumiStage = (data: JjukkumiStageSignal) => setJjukkumiStage(data)
    const onDalgonaState = (data: DalgonaStateSignal) => setDalgonaState(data)
    const onDalgonaTraces = (data: DalgonaTracesSignal) => setDalgonaTraces((previous) => mergeDalgonaTraces(previous, data))
    const onConnectionsState = (data: ConnectionsStateSignal) => setConnectionsState(data)
    const onConnectionsProgress = (data: ConnectionsProgressSignal) => setConnectionsProgress(data)
    const onConnectionsEnd = (data: ConnectionsEndSignal) => setConnectionsEnd(data)
    const onTowerState = (data: TowerStateSignal) => setTowerState(data)
    const onTowerProgress = (data: TowerProgressSignal) => setTowerProgress(data)
    const onTowerEnd = (data: TowerEndSignal) => setTowerEnd(data)
    const onSpyWordsState = (data: SpyWordsStateSignal) => setSpyWordsState(data)
    const onSpyWordsEnd = (data: SpyWordsEndSignal) => setSpyWordsEnd(data)
    const onMemoryCardsState = (data: MemoryStateSignal) => setMemoryCardsState(data)
    const onOlympicsState = (data: OlympicsStateSignal) => setOlympicsState(data)
    const onOrderCardsState = (data: OrderCardsStateSignal) => setOrderCardsState(data)
    const onOrderCardsStandings = (data: { standings: OrderCardsStanding[] }) => setOrderCardsStandings(data.standings)
    const onOrderCardsEnd = (data: OrderCardsEndSignal) => setOrderCardsEnd(data)
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
    socket.on('stroop:question', onStroopQuestion)
    socket.on('tugOfWar:start', onTugStart)
    socket.on('recycling:start', onRecyclingStart)
    socket.on('tetris:state', onTetrisState)
    socket.on('tetris:progress', onTetrisProgress)
    socket.on('tetris:end', onTetrisEnd)
    socket.on('marbleMaze:state', onMarbleState)
    socket.on('marbleMaze:progress', onMarbleProgress)
    socket.on('marbleMaze:end', onMarbleEnd)
    socket.on('marbleMaze:positions', onMarblePositions)
    socket.on('darkTreasure:state', onTreasureState)
    socket.on('darkTreasure:progress', onTreasureProgress)
    socket.on('darkTreasure:end', onTreasureEnd)
    socket.on('darkTreasure:positions', onTreasurePositions)
    socket.on('jjukkumi:state', onJjukkumiState)
    socket.on('jjukkumi:positions', onJjukkumiPositions)
    socket.on('jjukkumi:end', onJjukkumiEnd)
    socket.on('jjukkumi:stage', onJjukkumiStage)
    socket.on('jjukkumi:dalgona:state', onDalgonaState)
    socket.on('jjukkumi:dalgona:traces', onDalgonaTraces)
    socket.on('connections:state', onConnectionsState)
    socket.on('connections:progress', onConnectionsProgress)
    socket.on('connections:end', onConnectionsEnd)
    socket.on('tower:state', onTowerState)
    socket.on('tower:progress', onTowerProgress)
    socket.on('tower:end', onTowerEnd)
    socket.on('spyWords:state', onSpyWordsState)
    socket.on('spyWords:end', onSpyWordsEnd)
    socket.on('memoryCards:state', onMemoryCardsState)
    socket.on('olympics:state', onOlympicsState)
    socket.on('orderCards:state', onOrderCardsState)
    socket.on('orderCards:standings', onOrderCardsStandings)
    socket.on('orderCards:end', onOrderCardsEnd)
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
      socket.off('stroop:question', onStroopQuestion)
      socket.off('tugOfWar:start', onTugStart)
      socket.off('recycling:start', onRecyclingStart)
      socket.off('tetris:state', onTetrisState)
      socket.off('tetris:progress', onTetrisProgress)
      socket.off('tetris:end', onTetrisEnd)
      socket.off('marbleMaze:state', onMarbleState)
      socket.off('marbleMaze:progress', onMarbleProgress)
      socket.off('marbleMaze:end', onMarbleEnd)
      socket.off('marbleMaze:positions', onMarblePositions)
      socket.off('darkTreasure:state', onTreasureState)
      socket.off('darkTreasure:progress', onTreasureProgress)
      socket.off('darkTreasure:end', onTreasureEnd)
      socket.off('darkTreasure:positions', onTreasurePositions)
      socket.off('jjukkumi:state', onJjukkumiState)
      socket.off('jjukkumi:positions', onJjukkumiPositions)
      socket.off('jjukkumi:end', onJjukkumiEnd)
      socket.off('jjukkumi:stage', onJjukkumiStage)
      socket.off('jjukkumi:dalgona:state', onDalgonaState)
      socket.off('jjukkumi:dalgona:traces', onDalgonaTraces)
      socket.off('connections:state', onConnectionsState)
      socket.off('connections:progress', onConnectionsProgress)
      socket.off('connections:end', onConnectionsEnd)
      socket.off('tower:state', onTowerState)
      socket.off('tower:progress', onTowerProgress)
      socket.off('tower:end', onTowerEnd)
      socket.off('spyWords:state', onSpyWordsState)
      socket.off('spyWords:end', onSpyWordsEnd)
      socket.off('memoryCards:state', onMemoryCardsState)
      socket.off('olympics:state', onOlympicsState)
      socket.off('orderCards:state', onOrderCardsState)
      socket.off('orderCards:standings', onOrderCardsStandings)
      socket.off('orderCards:end', onOrderCardsEnd)
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

  // 소켓 하트비트 타임아웃보다 짧게 백그라운드에 있다 돌아오면 연결은 안 끊기지만,
  // 그 사이 브라우저가 JS 실행을 멈춰서 humanTimer:roundStart 같은 이벤트를 놓칠 수 있음.
  // 탭이 다시 보이게 될 때마다 현재 라운드의 진짜 경과 시간을 다시 요청해 동기화.
  // 폰에서 화면이 꺼졌다 켜지면 연결은 이미 죽었는데 소켓은 아직 연결된 줄 아는 경우가 있다 — 그러면 서버가 보낸 걸 못 받은 채 화면이 멈춘다.
  // 그래서 요청에 응답(ack)을 받아서, 응답이 없거나 서버가 이 연결을 모른다면 연결을 새로 맺고 다시 입장한다 (connect → room:rejoin)
  useEffect(() => {
    let lastCheckAt = 0
    const check = () => {
      if (document.visibilityState !== 'visible' || !roomCodeFromUrl || !readSavedPlayerId(roomCodeFromUrl)) return
      const now = Date.now()
      if (now - lastCheckAt < 1_000) return // 보이게 됨·포커스·pageshow가 연달아 와도 한 번만
      lastCheckAt = now
      // 끊겨 있으면 소켓이 알아서 다시 붙는다 (붙으면 room:rejoin이 상태를 되돌린다). 재연결이 멈춰 있으면 깨운다
      if (!socket.connected) {
        socket.connect()
        return
      }
      socket.timeout(RESYNC_ACK_TIMEOUT_MS).emit('round:requestResync', (error, known) => {
        if (!error && known) return
        socket.disconnect()
        socket.connect()
      })
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    window.addEventListener('online', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      window.removeEventListener('online', check)
    }
  }, [socket, roomCodeFromUrl])

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
    stroopQuestion,
    tugStart,
    recyclingStart,
    tetrisState,
    tetrisProgress,
    tetrisEnd,
    marbleState,
    marbleProgress,
    marbleEnd,
    marblePositions,
    treasureState,
    treasureProgress,
    treasureEnd,
    treasurePositions,
    jjukkumiState,
    jjukkumiPositions,
    jjukkumiEnd,
    jjukkumiStage,
    dalgonaState,
    dalgonaTraces,
    connectionsState,
    connectionsProgress,
    connectionsEnd,
    towerState,
    towerProgress,
    towerEnd,
    spyWordsState,
    spyWordsEnd,
    memoryCardsState,
    olympicsState,
    orderCardsState,
    orderCardsStandings,
    orderCardsEnd,
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
