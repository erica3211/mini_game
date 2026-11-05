import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { DalgonaBoard } from './DalgonaBoard'
import { DalgonaPick } from './DalgonaPick'
import { JjukkumiPlayers, type PlayerRow } from './JjukkumiView'
import { DALGONA_SHAPES, jjukkumiStageTitle, type DalgonaShapeId, type DalgonaStateSignal, type DalgonaTrace, type JjukkumiEndSignal } from './protocol'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: DalgonaStateSignal | null
  traces: Record<string, DalgonaTrace>
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 게임이 모두 끝났을 때 보여 줄 최종 순위 상자 */
  children?: ReactNode
}

const shapeInfo = (shape: string) => DALGONA_SHAPES[shape as DalgonaShapeId] ?? { name: shape, emoji: '🍪' }

/** 스테이지 2 — 달고나. 내 모양의 선을 손가락으로 따라 그린다. 선에서 허용치보다 벗어나면 달고나가 깨져서 탈락이다 */
export function DalgonaStage({ socket, roundKey, state, traces, end, playerId, players, children }: Props) {
  /** 구경하려고 고른 사람 */
  const [watchingId, setWatchingId] = useState<string | null>(null)
  /** 내가 방금 누른 버튼 */
  const [myButton, setMyButton] = useState<number | null>(null)
  useEffect(() => {
    setWatchingId(null)
    setMyButton(null)
  }, [roundKey])

  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  // 이 신호를 받은 시각 — 모양 고르기·결과 보기의 남은 시간을 재는 기준이다
  const stateAt = useMemo(() => performance.now(), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  // 그리기 시작 시각은 소개(3·2·1)부터 알 수 있다 — 그 전(모양 고르기·결과 보기) 신호의 경과 시간 0은 시작 시각이 아니다
  const startSignal = useMemo(() => (state && (state.phase === 'intro' || state.phase === 'run') ? { elapsedMs: state.elapsedMs } : null), [state])
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

  const meInStage = !!playerId && state.players.some((p) => p.playerId === playerId)
  const statusOf = (id: string) => state.statuses.find((row) => row.playerId === id)
  const myStatus = meInStage ? (statusOf(playerId!)?.status ?? 'run') : null
  const running = state.phase !== 'ended' && elapsed !== null && elapsed >= 0 && myStatus === 'run' && !end

  // 지금 보이는 판 — 구경하려고 고른 사람이 있으면 그 사람, 없으면 나(구경만 하는 사람은 첫 번째 사람)
  const shownId = watchingId && state.players.some((p) => p.playerId === watchingId) ? watchingId : meInStage ? playerId! : state.players[0]?.playerId
  const shown = state.players.find((p) => p.playerId === shownId)
  const shownIsMe = shownId === playerId
  const shownTrace = shownId ? traces[shownId] : undefined
  const shownStatus = shownId ? (statusOf(shownId)?.status ?? 'run') : 'run'
  const shownProgress = Math.max(shownTrace?.progress ?? 0, shownId ? (statusOf(shownId)?.progress ?? 0) : 0)
  const shownName = players.find((p) => p.id === shownId)?.nickname ?? '???'
  const myShape = meInStage ? (state.players.find((p) => p.playerId === playerId)?.shape ?? null) : null

  const rows: PlayerRow[] = state.players.map((player) => {
    const status = statusOf(player.playerId)
    return {
      playerId: player.playerId,
      character: 0,
      emoji: player.shape ? shapeInfo(player.shape).emoji : '❔',
      label: state.phase === 'pick' ? (state.chosenIds.includes(player.playerId) ? '✔ 골랐어요' : '고르는 중…') : state.phase === 'reveal' ? '준비 중' : undefined,
      status: status?.status ?? 'run',
      progress: Math.max(status?.progress ?? 0, traces[player.playerId]?.progress ?? 0),
      atMs: status?.atMs ?? null,
    }
  })

  // 달리는(그리는) 중에는 구경할 수 없고, 통과하거나 깨졌거나(또는 앞서 탈락해서 구경만 하는 사람이면) 이름을 눌러 그 사람의 판을 볼 수 있다
  const canWatch = !running && !countingDown
  const toggleWatch = (id: string) => setWatchingId((current) => (current === id ? null : id))

  const pickPhase = state.phase === 'pick' || state.phase === 'reveal'

  const title = (
    <p className="jk-title">
      🐙 쭈꾸미 게임{' '}
      <span className="jk-title-stage">
        {state.stage.index + 1}/{state.stage.count} · {jjukkumiStageTitle(state.stage.id)}
      </span>
    </p>
  )

  const say = countingDown ? `곧 시작! 내 모양은 ${shapeInfo(myShape ?? '').emoji} ${shapeInfo(myShape ?? '').name}` : shownIsMe && meInStage ? `내 모양: ${shapeInfo(shown?.shape ?? '').emoji} ${shapeInfo(shown?.shape ?? '').name}` : `👀 ${shownName}님: ${shapeInfo(shown?.shape ?? '').emoji} ${shapeInfo(shown?.shape ?? '').name}`

  if (pickPhase) {
    return (
      <div className="party-round-stage jk-stage">
        {title}
        <DalgonaPick
          state={state}
          players={players}
          myId={playerId}
          myButton={myButton}
          receivedAt={stateAt}
          onPick={(button) => {
            setMyButton(button)
            socket.emit('jjukkumi:dalgona:pick', { button })
          }}
        />
        <JjukkumiPlayers players={players} rows={rows} myId={playerId} watchingId={null} />
        {children}
      </div>
    )
  }

  return (
    <div className="party-round-stage jk-stage">
      {title}
      {startedAt !== null && !countingDown && state.phase === 'run' && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}
      <p className="jk-say jk-say-idle">{say}</p>

      <div className="jk-dalgona" data-status={shownStatus}>
        {shown?.shape && state.paths[shown.shape] && (
          <DalgonaBoard
            path={state.paths[shown.shape]}
            tolerance={state.tolerance}
            points={shownTrace?.points ?? []}
            progress={shownProgress}
            reversed={shownTrace?.reversed ?? false}
            status={shownStatus}
            interactive={running && shownIsMe}
            onTrace={(points, newStroke) => socket.emit('jjukkumi:trace', { points, newStroke })}
          />
        )}
        {countingDown && (
          <div className="jk-overlay" role="timer">
            <strong key={Math.ceil(-elapsed! / 1000)}>{Math.ceil(-elapsed! / 1000)}</strong>
            <span>초록 점에서 시작해서 선을 따라 그려요! (방향은 어느 쪽이든 OK)</span>
          </div>
        )}
      </div>

      {!end && running && <p className="party-mb-note">초록 점에서 시작해서 선을 따라 그려요. 어느 방향으로 가도 괜찮지만 선에서 너무 벗어나면 달고나가 깨져요! (손가락을 뗐다 다시 대도 돼요)</p>}
      {!end && meInStage && myStatus === 'passed' && <p className="party-mb-banner party-mb-banner-win">🍪 성공! 다른 사람들이 끝나길 기다려요</p>}
      {!end && meInStage && myStatus === 'out' && <p className="party-mb-banner party-mb-banner-lose">💥 달고나가 깨졌어요! 이름을 눌러서 다른 사람을 구경해 보세요</p>}
      {!end && !meInStage && <p className="party-mb-banner">👀 앞에서 탈락해서 구경만 해요</p>}

      {canWatch && watchingId && (
        <p className="party-mb-watching">
          👀 {shownName}님을 보는 중
          <button type="button" className="btn btn-secondary" onClick={() => setWatchingId(null)}>
            {meInStage ? '내 판으로' : '그만 보기'}
          </button>
        </p>
      )}

      <JjukkumiPlayers players={players} rows={rows} myId={playerId} onWatch={canWatch ? toggleWatch : undefined} watchingId={canWatch ? shownId ?? null : null} />

      {children}
    </div>
  )
}
