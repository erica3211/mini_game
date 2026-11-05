import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { JjukkumiPlayers, type PlayerRow } from './JjukkumiView'
import { jjukkumiStageTitle, TUG_TEAM_STYLE, type JjukkumiEndSignal, type TugStagePowerSignal, type TugStageStateSignal } from './protocol'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: TugStageStateSignal | null
  /** 가장 최근에 받은 팀별 힘 — 없으면 state의 힘을 쓴다 */
  power: TugStagePowerSignal['power'] | null
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 게임이 모두 끝났을 때 보여 줄 최종 순위 상자 */
  children?: ReactNode
}

/** 줄 당기는 신호를 이 간격(ms)보다 짧게 연달아 보내지 않는다 — 서버가 무시하는 속도의 신호가 몰려 소켓이 바빠지는 것을 막는다 (색깔 전쟁과 같다) */
const MIN_PULL_GAP_MS = 55

/**
 * 스테이지 3 — 줄다리기. 색깔 전쟁과 같은 방식으로, 남은 사람들이 초록 팀과 빨강 팀으로 나뉘어 15초 동안 버튼을 연타한다.
 * 팀의 힘은 누른 횟수를 팀 인원으로 나눈 값(1인당 평균)이라 인원이 달라도 공평하고, 힘이 큰 팀이 이기면 진 팀은 전원 탈락한다.
 * 내 팀이 어느 색인지 한눈에 알 수 있도록 내 팀 색으로 화면 테두리·안내·버튼을 칠한다.
 */
export function TugStage({ socket, roundKey, state, power, end, playerId, players, children }: Props) {
  const [myPulls, setMyPulls] = useState(0)
  const lastPullAt = useRef(0)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    setMyPulls(0)
  }, [roundKey])
  // 재접속하면 서버가 알려 준 내가 당긴 횟수로 맞춘다
  useEffect(() => {
    if (state && state.myPulls > 0) setMyPulls((current) => Math.max(current, state.myPulls))
  }, [state])

  const startSignal = useMemo(() => (state && state.phase !== 'ended' ? { elapsedMs: state.elapsedMs } : null), [state])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end || state?.phase === 'ended' ? 'finished' : 'running')
  const elapsed = startedAt === null ? null : now - startedAt
  const countingDown = state?.phase === 'intro' && elapsed !== null && elapsed < 0
  const timeUp = state?.phase === 'ended' || (elapsed !== null && state !== null && elapsed >= state.durationMs)
  const canPull = !!state && !countingDown && !timeUp && !end && !!playerId && state.teams.some((team) => team.memberIds.includes(playerId))

  const pull = useCallback(() => {
    if (!canPull) return
    // 서버가 무시하는 속도의 신호는 처음부터 보내지 않는다
    const at = performance.now()
    if (at - lastPullAt.current < MIN_PULL_GAP_MS) return
    lastPullAt.current = at
    setMyPulls((current) => current + 1)
    socket.emit('jjukkumi:pull')
  }, [canPull, socket])

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = playerId ? state.teams.find((team) => team.memberIds.includes(playerId)) : undefined
  const myStyle = myTeam ? TUG_TEAM_STYLE[myTeam.color] : null
  const teamStyle = (teamId: number) => TUG_TEAM_STYLE[state.teams.find((team) => team.teamId === teamId)?.color ?? 'green']
  const shownPower = state.result ? Object.fromEntries(state.result.teams.map((team) => [team.teamId, team.power])) : (power ?? state.power)
  const [left, right] = state.teams
  const leftPower = shownPower[left.teamId] ?? 0
  const rightPower = shownPower[right.teamId] ?? 0
  const leftPercent = leftPower + rightPower === 0 ? 50 : (leftPower / (leftPower + rightPower)) * 100
  const result = state.result
  const myOutcome = myTeam && result ? result.teams.find((team) => team.teamId === myTeam.teamId)?.outcome : undefined

  const rows: PlayerRow[] = state.teams.flatMap((team) =>
    team.memberIds.map((id) => {
      const status = state.statuses.find((row) => row.playerId === id)
      return { playerId: id, character: 0, emoji: TUG_TEAM_STYLE[team.color].emoji, status: status?.status ?? 'run', progress: 0, atMs: null, label: result ? `${result.players.find((p) => p.playerId === id)?.pulls ?? 0}번 · ${status?.status === 'out' ? '✖ 탈락' : '✔ 통과'}` : countingDown ? '준비' : '당기는 중' }
    }),
  )

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    pull()
  }
  // 키보드(데스크톱): 스페이스·엔터를 누를 때마다 센다 (꾹 눌러서 반복되는 입력은 세지 않는다)
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault()
      pull()
    }
  }

  const stageStyle = myStyle ? ({ '--jk-team-color': myStyle.color } as CSSProperties) : undefined

  return (
    <div className="party-round-stage jk-stage jk-tug" style={stageStyle} data-team={myTeam?.color ?? 'none'}>
      <p className="jk-title">
        🐙 쭈꾸미 게임{' '}
        <span className="jk-title-stage">
          {state.stage.index + 1}/{state.stage.count} · {jjukkumiStageTitle(state.stage.id)}
        </span>
      </p>
      {startedAt !== null && !countingDown && state.phase === 'run' && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      {/* 내 팀 — 어느 색인지 한눈에 알 수 있게 큰 띠로 알려 준다 */}
      {myStyle ? (
        <p className="jk-tug-mine" role="status">
          <span aria-hidden="true">{myStyle.emoji}</span> 나는 <strong>{myStyle.name}</strong>이에요!
        </p>
      ) : (
        <p className="jk-tug-mine jk-tug-mine-spectator">👀 구경 중 — 🟢 초록 팀 vs 🔴 빨강 팀</p>
      )}

      {/* 줄 — 두 팀의 색이 힘의 비율만큼 차지하고, 센 팀의 색이 상대 쪽으로 밀고 들어간다. 가운데 검은 선이 비긴 지점이다 */}
      <div className="jk-tug-rope" aria-label="줄다리기 줄">
        <span className="jk-tug-marker" aria-hidden="true">
          ▼
        </span>
        <div className="jk-tug-bar" style={{ background: teamStyle(right.teamId).color }}>
          <div className="jk-tug-fill" style={{ width: `${leftPercent}%`, background: teamStyle(left.teamId).color }} />
          <span className="jk-tug-center" aria-hidden="true" />
          <span className="jk-tug-name">
            {teamStyle(left.teamId).emoji} {teamStyle(left.teamId).name}
            {myTeam?.teamId === left.teamId && <em className="jk-tug-me">내 팀</em>}
          </span>
          <span className="jk-tug-name jk-tug-name-right">
            {myTeam?.teamId === right.teamId && <em className="jk-tug-me">내 팀</em>}
            {teamStyle(right.teamId).name} {teamStyle(right.teamId).emoji}
          </span>
        </div>
      </div>
      <ul className="jk-tug-powers">
        {state.teams.map((team) => {
          const style = TUG_TEAM_STYLE[team.color]
          return (
            <li key={team.teamId} className={myTeam?.teamId === team.teamId ? 'jk-tug-power-mine' : undefined} style={{ '--jk-team-color': style.color } as CSSProperties}>
              <span>
                {style.emoji} {style.name} <small>({team.memberIds.length}명)</small>
              </span>
              <strong>{(shownPower[team.teamId] ?? 0).toFixed(1)}</strong>
            </li>
          )
        })}
      </ul>
      <p className="party-mb-note">힘은 팀이 누른 횟수를 팀 인원으로 나눈 값이라 인원이 달라도 공평해요.</p>

      {/* 소개 — 두 팀이 누구인지 */}
      {countingDown && (
        <div className="jk-tug-intro" role="timer">
          <strong key={Math.ceil(-elapsed! / 1000)}>{Math.ceil(-elapsed! / 1000)}</strong>
          <div className="jk-tug-teams">
            {state.teams.map((team) => {
              const style = TUG_TEAM_STYLE[team.color]
              return (
                <div key={team.teamId} className={`jk-tug-team${myTeam?.teamId === team.teamId ? ' jk-tug-team-mine' : ''}`} style={{ '--jk-team-color': style.color } as CSSProperties}>
                  <p>
                    {style.emoji} {style.name}
                  </p>
                  <ul>
                    {team.memberIds.map((id) => (
                      <li key={id}>{id === playerId ? `${nicknameOf(id)} (나)` : nicknameOf(id)}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 당기기 */}
      {!result && !countingDown && myTeam && (
        <>
          <button type="button" className="jk-tug-button" disabled={!canPull} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onContextMenu={(event) => event.preventDefault()} aria-label={`${myStyle?.name} 힘으로 당기기`}>
            {timeUp ? '끝!' : `${myStyle?.emoji} 당겨라!! 💪`}
          </button>
          <p className="jk-tug-count">
            내가 누른 횟수 <strong>{myPulls}</strong>번
          </p>
        </>
      )}
      {!result && !countingDown && !myTeam && <p className="party-mb-banner">👀 앞에서 탈락해서 구경만 해요</p>}

      {/* 결과 */}
      {result && (
        <div className="jk-tug-end">
          <p className="jk-tug-end-title">
            {result.teams.every((team) => team.outcome === 'tie')
              ? '🤝 비겼어요! 두 팀 모두 통과!'
              : `🏆 ${teamStyle(result.teams.find((team) => team.outcome === 'won')!.teamId).emoji} ${teamStyle(result.teams.find((team) => team.outcome === 'won')!.teamId).name} 승리!`}
          </p>
          {myOutcome && <p className={`jk-tug-end-me jk-tug-end-me-${myOutcome === 'lost' ? 'lost' : 'won'}`}>{myOutcome === 'lost' ? '😵 우리 팀이 졌어요… 탈락!' : myOutcome === 'tie' ? '🤝 비겨서 통과!' : '🎉 우리 팀이 이겼어요! 통과!'}</p>}
          <ul className="jk-tug-end-list">
            {result.teams.map((team) => {
              const style = teamStyle(team.teamId)
              return (
                <li key={team.teamId} style={{ '--jk-team-color': style.color } as CSSProperties}>
                  <span>
                    {style.emoji} {style.name}
                  </span>
                  <strong>
                    1인당 {team.power.toFixed(1)}번 ({team.pulls}번)
                  </strong>
                </li>
              )
            })}
          </ul>
          <p className="party-mb-note">
            가장 많이 누른 사람:{' '}
            {[...result.players]
              .sort((a, b) => b.pulls - a.pulls)
              .slice(0, 3)
              .map((player, index) => `${['🥇', '🥈', '🥉'][index]} ${nicknameOf(player.playerId)} ${player.pulls}번`)
              .join(' · ')}
          </p>
        </div>
      )}

      <JjukkumiPlayers players={players} rows={rows} myId={playerId} watchingId={null} showBar={false} />

      {children}
    </div>
  )
}
