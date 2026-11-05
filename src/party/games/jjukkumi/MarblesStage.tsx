import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { JjukkumiPlayers, type PlayerRow } from './JjukkumiView'
import { Marble } from './Marble'
import { jjukkumiStageTitle, MARBLES_GOAL, MARBLES_START, type JjukkumiEndSignal, type MarblesHand, type MarblesRoundResult, type MarblesStateSignal } from './protocol'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: MarblesStateSignal | null
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 게임이 모두 끝났을 때 보여 줄 최종 순위 상자 */
  children?: ReactNode
}

const HAND_NAME: Record<MarblesHand, string> = { left: '왼손', right: '오른손' }

/** 유리구슬 하나 — twist로 무늬를 돌려서 여러 개가 똑같이 찍어 낸 것처럼 보이지 않게 한다 */
function Bead({ twist = 0 }: { twist?: number }) {
  return <Marble className="jk-bead" twist={twist} />
}

/** 가진 구슬 수 — 목표(5개) 칸 중 가진 만큼 구슬이 채워져 있다 */
function BeadRow({ count }: { count: number }) {
  return (
    <div className="jk-beadrow" role="img" aria-label={`구슬 ${count}개`}>
      {Array.from({ length: MARBLES_GOAL }, (_, i) => (
        <span key={i} className={`jk-beadslot${i < count ? ' jk-beadslot-full' : ''}`}>
          {i < count && <Bead twist={i * 47} />}
        </span>
      ))}
    </div>
  )
}

interface HandProps {
  side: MarblesHand
  /** 손바닥을 펼쳐서 구슬을 보여 준다 */
  open: boolean
  /** 펼친 손바닥 위의 구슬 수 (짝수 = 2개, 홀수 = 1개) */
  beads: number
  /** 내가 고른 손 — 결과 전에는 노란 테두리, 결과가 나오면 맞았으면 초록·틀렸으면 빨강 */
  mark: 'picked' | 'correct' | 'wrong' | null
  disabled: boolean
  onPick: () => void
}

/** 주먹 쥔 손 — 누르면 고른다. 결과를 보여 줄 때는 손이 펼쳐지고 손바닥 위에 구슬이 놓인다 */
function Hand({ side, open, beads, mark, disabled, onPick }: HandProps) {
  return (
    <button type="button" className={`jk-hand${mark ? ` jk-hand-${mark}` : ''}`} disabled={disabled} onClick={onPick} aria-label={`${HAND_NAME[side]} 고르기`}>
      <span className="jk-hand-art">
        <img className="jk-hand-img" style={{ opacity: open ? 0 : 1 }} src={`/jjukkumi/hand-${side}-fist.png`} alt="" draggable={false} />
        <img className="jk-hand-img" style={{ opacity: open ? 1 : 0 }} src={`/jjukkumi/hand-${side}-palm.png`} alt="" draggable={false} />
        {open && (
          <span className={`jk-hand-beads jk-hand-beads-${beads}`}>
            {Array.from({ length: beads }, (_, i) => (
              <Bead key={i} twist={i * 120 + 30} />
            ))}
          </span>
        )}
      </span>
      <span className="jk-hand-name">{HAND_NAME[side]}</span>
    </button>
  )
}

/**
 * 스테이지 4 — 구슬치기. 구슬 3개로 시작해서 "짝수/홀수를 맞춰라" 문제에 맞는 손을 고르면 구슬 +1, 틀리면 −1이다. 5개를 모으면 통과, 0개가 되면 탈락이다.
 * 양손은 처음에는 주먹이고, 모두 고르면 손을 펼쳐서 손바닥 위의 구슬(짝수 = 2개, 홀수 = 1개)을 보여 준다.
 */
export function MarblesStage({ socket, roundKey, state, end, playerId, players, children }: Props) {
  const [myHand, setMyHand] = useState<MarblesHand | null>(null)
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    setMyHand(null)
    setWatchingId(null)
  }, [roundKey])
  // 새 판이 시작되면 내가 고른 손을 비운다
  const round = state?.round ?? 0
  useEffect(() => {
    setMyHand(null)
  }, [round])

  // 이 신호를 받은 시각 — 이번 판의 남은 시간을 재는 기준이다
  const stateAt = useMemo(() => performance.now(), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const startSignal = useMemo(() => (state && state.phase !== 'ended' ? { elapsedMs: state.elapsedMs } : null), [state])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end || state?.phase === 'ended' ? 'finished' : 'running')
  const elapsed = startedAt === null ? null : now - startedAt
  const countingDown = state?.phase === 'intro' && elapsed !== null && elapsed < 0

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const meInStage = !!playerId && state.players.includes(playerId)
  const iAmActive = !!playerId && state.active.includes(playerId)
  const canWatch = !iAmActive || state.phase === 'ended'
  // 지금 보이는 손 — 구경하려고 고른 사람이 있으면 그 사람, 없으면 나(구경만 하는 사람은 아직 뛰는 첫 사람)
  const shownId = watchingId && state.players.includes(watchingId) ? watchingId : meInStage ? playerId! : (state.active[0] ?? state.players[0])
  const shownIsMe = shownId === playerId
  const shownName = nicknameOf(shownId)
  const shownMarbles = state.marbles[shownId] ?? 0
  const result: MarblesRoundResult | undefined = state.results?.find((row) => row.playerId === shownId)
  const reveal = state.phase === 'reveal' && !!result
  const canPick = state.phase === 'pick' && shownIsMe && iAmActive && !state.chosenIds.includes(playerId!) && myHand === null
  const secondsLeft = Math.max(0, Math.ceil((stateAt + state.phaseEndsInMs - now) / 1000))
  const iChose = !!playerId && state.chosenIds.includes(playerId)
  const shownChose = state.chosenIds.includes(shownId)

  const pick = (hand: MarblesHand) => {
    if (!canPick) return
    setMyHand(hand)
    socket.emit('jjukkumi:marbles:pick', { hand })
  }

  const markOf = (side: MarblesHand): HandProps['mark'] => {
    if (reveal && result?.choice === side) return result.correct ? 'correct' : 'wrong'
    if (!reveal && shownIsMe && myHand === side) return 'picked'
    return null
  }

  const rows: PlayerRow[] = state.players.map((id) => {
    const status = state.statuses.find((row) => row.playerId === id)
    const marbles = state.marbles[id] ?? 0
    return { playerId: id, character: 0, emoji: '🔮', status: status?.status ?? 'run', progress: Math.min(1, marbles / MARBLES_GOAL), atMs: status?.atMs ?? null, label: status?.status === 'passed' ? '✔ 통과' : status?.status === 'out' ? '✖ 탈락' : `🔮 ${marbles}개` }
  })

  const promptText = state.prompt === 'even' ? '짝수를 맞춰라!' : '홀수를 맞춰라!'
  const promptSub = state.prompt === 'even' ? '구슬이 짝수 개(2개) 들어 있는 손은 어느 쪽일까?' : '구슬이 홀수 개(1개) 들어 있는 손은 어느 쪽일까?'

  return (
    <div className="party-round-stage jk-stage jk-marbles">
      <p className="jk-title">
        🐙 쭈꾸미 게임{' '}
        <span className="jk-title-stage">
          {state.stage.index + 1}/{state.stage.count} · {jjukkumiStageTitle(state.stage.id)}
        </span>
      </p>
      {startedAt !== null && !countingDown && state.phase !== 'ended' && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      {/* 가진 구슬 — 5개를 모으면 통과, 0개면 탈락 */}
      <div className="jk-marbles-count">
        <p className="jk-marbles-who">{shownIsMe && meInStage ? '내 구슬' : `👀 ${shownName}님의 구슬`}</p>
        <BeadRow count={shownMarbles} />
        <p className="party-mb-note">
          {MARBLES_START}개로 시작해요 · 맞히면 +1, 틀리면 −1 · {MARBLES_GOAL}개를 모으면 통과, 0개면 탈락!
        </p>
      </div>

      {countingDown ? (
        <div className="jk-marbles-intro" role="timer">
          <strong key={Math.ceil(-elapsed! / 1000)}>{Math.ceil(-elapsed! / 1000)}</strong>
          <p>양손 중 문제에 맞는 쪽을 골라요!</p>
          <p className="party-mb-note">한 손에는 구슬이 2개(짝수), 다른 손에는 1개(홀수)가 들어 있어요. 손 구성은 사람마다 달라요.</p>
        </div>
      ) : (
        state.prompt && (
          <>
            <div className={`jk-prompt jk-prompt-${state.prompt}`}>
              <p className="jk-prompt-round">{state.round}번째 판</p>
              <p className="jk-prompt-text">{promptText}</p>
              <p className="jk-prompt-sub">{promptSub}</p>
            </div>

            <div className="jk-hands">
              {(['left', 'right'] as const).map((side) => (
                <Hand key={side} side={side} open={reveal} beads={result ? (result.evenHand === side ? 2 : 1) : 0} mark={markOf(side)} disabled={!canPick} onPick={() => pick(side)} />
              ))}
            </div>

            {state.phase === 'pick' && (
              <p className="jk-marbles-status">
                {shownIsMe && iAmActive
                  ? iChose
                    ? `선택 완료! 다른 사람을 기다려요 (${state.chosenIds.length}/${state.active.length}명) · ⏳ ${secondsLeft}초`
                    : `⏳ ${secondsLeft}초 안에 손을 골라요! (못 고르면 −1)`
                  : `${shownName}님은 ${shownChose ? '이미 골랐어요' : '고르는 중'} · ⏳ ${secondsLeft}초`}
              </p>
            )}
            {reveal && result && (
              <p className={`jk-marbles-status jk-marbles-status-${result.correct ? 'win' : 'lose'}`}>
                {result.correct ? '🎉 맞았어요! 구슬 +1' : result.choice === null ? '⏰ 시간 초과… 구슬 −1' : '😢 틀렸어요… 구슬 −1'}
              </p>
            )}
            {state.phase === 'reveal' && !result && <p className="jk-marbles-status">{shownName}님은 이번 판에 뛰지 않았어요 ({state.marbles[shownId] >= MARBLES_GOAL ? '이미 통과' : '이미 탈락'})</p>}
          </>
        )
      )}

      {!end && meInStage && state.statuses.find((s) => s.playerId === playerId)?.status === 'passed' && <p className="party-mb-banner party-mb-banner-win">🔮 구슬 5개 달성! 다른 사람들이 끝나길 기다려요</p>}
      {!end && meInStage && state.statuses.find((s) => s.playerId === playerId)?.status === 'out' && <p className="party-mb-banner party-mb-banner-lose">😵 탈락했어요! 이름을 눌러서 다른 사람을 구경해 보세요</p>}
      {!end && !meInStage && <p className="party-mb-banner">👀 앞에서 탈락해서 구경만 해요</p>}

      {canWatch && watchingId && (
        <p className="party-mb-watching">
          👀 {shownName}님을 보는 중
          <button type="button" className="btn btn-secondary" onClick={() => setWatchingId(null)}>
            {meInStage ? '내 화면으로' : '그만 보기'}
          </button>
        </p>
      )}

      <JjukkumiPlayers players={players} rows={rows} myId={playerId} onWatch={canWatch ? (id) => setWatchingId((current) => (current === id ? null : id)) : undefined} watchingId={canWatch ? (watchingId ?? null) : null} />

      {children}
    </div>
  )
}
