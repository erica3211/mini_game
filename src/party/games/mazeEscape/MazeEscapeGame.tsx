import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { MazeBoard } from './MazeBoard'
import { useStableViewportHeight } from './useStableViewportHeight'
import {
  MAZE_DIRECTION_ARROW,
  MAZE_DIRECTION_LABEL,
  MAZE_REPEAT_MS,
  MAZE_RUN_MS,
  type MazeDirection,
  type MazeViewState,
} from './protocol'
import {
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
  type TeamInfo,
} from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: MazeViewState | null
  playerId: string | null
  players: PlayerInfo[]
  /** 이번 라운드의 팀 배정 */
  teams: TeamInfo[]
}

// 키보드: 방향키와 WASD
const KEY_DIRECTION: Record<string, MazeDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

// 십자 모양 버튼의 그리는 순서 (자리는 CSS grid-area가 정한다)
const MAZE_DIRECTIONS_ORDER: MazeDirection[] = ['up', 'left', 'right', 'down']

// 시작 직후 내 담당 방향 안내를 반짝이는 시간
const ROLE_PULSE_MS = 5_000

const arrowsOf = (directions: MazeDirection[]) => directions.map((dir) => MAZE_DIRECTION_ARROW[dir]).join('')

interface PadButtonProps {
  dir: MazeDirection
  enabled: boolean
  onMove: (dir: MazeDirection) => void
}

/** 방향 버튼 — 내 담당이 아니면 흐리게 막혀 있고, 꾹 누르고 있으면 계속 움직인다 */
function PadButton({ dir, enabled, onMove }: PadButtonProps) {
  const timer = useRef<number | null>(null)
  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }
  // 버튼이 막히거나 화면이 사라지면 반복을 멈춘다
  useEffect(() => {
    if (!enabled) stop()
    return stop
  }, [enabled])

  return (
    <button
      type="button"
      className={`party-maze-pad-btn party-maze-pad-${dir}${enabled ? '' : ' party-maze-pad-btn-off'}`}
      disabled={!enabled}
      aria-label={MAZE_DIRECTION_LABEL[dir]}
      onPointerDown={(event) => {
        event.preventDefault()
        onMove(dir)
        stop()
        timer.current = window.setInterval(() => onMove(dir), MAZE_REPEAT_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      {MAZE_DIRECTION_ARROW[dir]}
    </button>
  )
}

export function MazeEscapeGame({ socket, roundKey, state, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const start = state?.start ?? null
  const phase = start?.phase ?? 'run'
  // 미로 크기 — 팀 진행률 + 미로 + 방향 버튼이 한 화면에 들어오도록 화면 높이에서 나머지 부분의 높이를 뺀 만큼으로 하되 (너무 작아지지 않게 224px 이상, 420px 이하),
  // 스크롤할 때 하단 바가 나타났다 사라져도 크기가 흔들리지 않게 "지금까지 본 가장 작은 화면 높이"로 잰다
  const viewportHeight = useStableViewportHeight()
  const boardMax = Math.min(420, Math.max(224, viewportHeight - (384 + Math.max(0, teams.length - 2) * 36)))
  const phaseSignal = useMemo(() => (start ? { elapsedMs: start.phaseElapsedMs } : null), [start])
  const startedAt = useMonotonicStartedAt(`${roundKey}-${phase}`, phaseSignal, phase === 'ended' ? 'finished' : 'running')

  // 시작하고 몇 초 동안은 내 담당 방향 안내를 반짝여서 눈에 띄게 한다 — 자리가 바뀌지 않도록 크기는 그대로 두고 깜빡임만 준다
  const [rolePulse, setRolePulse] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setRolePulse(false), ROLE_PULSE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const myDirections = useMemo(() => start?.myDirections ?? [], [start])
  const running = phase === 'run'

  const move = (dir: MazeDirection) => {
    if (running && myDirections.includes(dir)) socket.emit('mazeEscape:move', { dir })
  }
  const playRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef(move)
  useEffect(() => {
    moveRef.current = move
  })

  // 손가락으로 쓰는 기기(모바일)에서는 달리기가 시작될 때 시간·팀 진행률·미로·방향 버튼이 한 화면에 보이도록 위치를 맞춘다.
  // 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다
  useEffect(() => {
    if (phase !== 'run' || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [phase])

  // 키보드: 내가 맡은 방향의 키만 반응하고, 채팅 입력 중에는 건드리지 않는다
  useEffect(() => {
    if (!running) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const dir = KEY_DIRECTION[event.key.length === 1 ? event.key.toLowerCase() : event.key]
      if (!dir || !myDirections.includes(dir)) return
      event.preventDefault()
      moveRef.current(dir)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [running, myDirections])

  // 탈출한 뒤 구경 중인 다른 팀 (없으면 우리 팀 화면)
  const [watchingId, setWatchingId] = useState<number | null>(null)

  if (!state || !start || !state.pos) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const myTeamFinished = state.finished[start.teamId] !== undefined
  const teamNameOf = (teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'
  const myTeam = teams.find((team) => team.id === start.teamId)
  const watched = watchingId !== null ? state.watch[watchingId] : undefined

  const rolesPanel = (
    <ul className="party-maze-roles">
      {(myTeam?.memberIds ?? []).map((id) => (
        <li key={id} className={id === playerId ? 'party-maze-role-me' : ''}>
          <span>
            {nicknameOf(id)}
            {id === playerId && ' (나)'}
            {start.absentIds.includes(id) && ' · 자리 비움'}
          </span>
          <strong>{arrowsOf(start.roles[id] ?? [])}</strong>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="party-round-stage party-maze-stage">
      <div ref={playRef} className="party-maze-play" style={{ '--maze-max': `${boardMax}px` } as CSSProperties}>
        {phase === 'run' && startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={MAZE_RUN_MS} />}

        <ul className="party-maze-lanes">
          {teams.map((team) => {
            const finishedMs = state.finished[team.id]
            const progress = finishedMs !== undefined ? 100 : (state.progress[team.id] ?? 0)
            // 우리 팀이 탈출한 뒤에는 다른 팀 막대를 눌러 그 팀이 달리는 모습을 구경할 수 있다
            const watchable = myTeamFinished && phase === 'run' && team.id !== start.teamId && state.watch[team.id] !== undefined
            return (
              <li
                key={team.id}
                className={`party-maze-lane${team.id === start.teamId ? ' party-maze-lane-mine' : ''}${watchable ? ' party-maze-lane-clickable' : ''}${watchingId === team.id ? ' party-maze-lane-watching' : ''}`}
                role={watchable ? 'button' : undefined}
                tabIndex={watchable ? 0 : undefined}
                onClick={watchable ? () => setWatchingId(watchingId === team.id ? null : team.id) : undefined}
                onKeyDown={watchable ? (event) => event.key === 'Enter' && setWatchingId(watchingId === team.id ? null : team.id) : undefined}
              >
                <span className="party-maze-lane-name">
                  {teamEmoji(team.id)} {team.name}
                </span>
                <div className="party-race-track-bar party-maze-lane-bar">
                  <div
                    className="party-race-track-dot party-race-track-dot-me"
                    style={{ left: `${progress}%`, '--dot-color': `rgb(${teamRgb(team.id)})` } as CSSProperties}
                  >
                    <span className="party-race-track-dot-mark" />
                  </div>
                </div>
                <span className="party-maze-lane-value">{finishedMs !== undefined ? `🏁 ${(finishedMs / 1000).toFixed(1)}초` : `${progress}%`}</span>
              </li>
            )
          })}
        </ul>

        {watched && watchingId !== null ? (
          <div className="party-maze-spectate">
            <div className="party-maze-spectate-header">
              <span>
                👀 {teamNameOf(watchingId)}이 달리는 중 ({state.finished[watchingId] !== undefined ? '탈출 완료' : `${state.progress[watchingId] ?? 0}%`})
              </span>
              <button type="button" className="party-typerace-spectate-close" onClick={() => setWatchingId(null)}>
                닫기
              </button>
            </div>
            <MazeBoard maze={start.maze} pos={watched.pos} visited={watched.visited} teamId={watchingId} />
          </div>
        ) : (
          <MazeBoard maze={start.maze} pos={state.pos} visited={state.visited} teamId={start.teamId} />
        )}

        {myTeamFinished && phase === 'run' ? (
          <>
            <p className="party-race-finished">🏁 탈출 성공! 다른 팀을 기다리는 중...</p>
            {watchingId === null && <p className="party-typerace-waiting">위 막대에서 다른 팀을 눌러 달리는 모습을 구경해 보세요.</p>}
          </>
        ) : (
          phase === 'run' && (
            <div className="party-maze-pad" aria-label="방향 버튼">
              {MAZE_DIRECTIONS_ORDER.map((dir) => (
                <PadButton key={dir} dir={dir} enabled={myDirections.includes(dir)} onMove={move} />
              ))}
              <span className={`party-maze-pad-role${rolePulse ? ' party-maze-pad-role-pulse' : ''}`}>내 담당 {arrowsOf(myDirections) || '—'}</span>
            </div>
          )
        )}
        {phase === 'run' && rolesPanel}
      </div>

      {phase === 'ended' && state.end && (
        <div className="party-maze-end">
          <p className="party-maze-end-title">🏁 미로 탈출 끝!</p>
          <ol className="party-maze-end-list">
            {[...state.end.teams]
              .sort((a, b) => (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity) || b.progress - a.progress)
              .map((item) => (
                <li key={item.teamId} className={teamColorClass(item.teamId)}>
                  <span>
                    {teamEmoji(item.teamId)} {teamNameOf(item.teamId)}
                  </span>
                  <strong>{item.finishedMs !== null ? `${(item.finishedMs / 1000).toFixed(1)}초에 탈출` : `${item.progress}%까지 도착`}</strong>
                </li>
              ))}
          </ol>
        </div>
      )}

    </div>
  )
}
