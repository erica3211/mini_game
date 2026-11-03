import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import type { OlympicsAttempt, OlympicsStateSignal, OlympicsTrackSignal } from './protocol'
import { BaseballField } from './BaseballField'
import { ZoneDuelField } from './ZoneDuelField'
import { BOWLING_REVEAL_MS, BowlingLane, GOLF_REVEAL_MS, GYM_REVEAL_MS, GolfCourse, GymStage, LIFT_REVEAL_MS, ShootingTarget, WeightliftingStage } from './OlympicsStages'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import {
  ARCHERY_REVEAL_MS,
  ArcheryTarget,
  AttemptsPanel,
  BASKETBALL_REVEAL_MS,
  BasketballCourt,
  BasketballGauge,
  SwimLanes,
  TwoStageGauges,
  TrackLanes,
  useGaugeClock,
  useShotTracker,
  visibleAttempts,
} from './OlympicsSportViews'

const NO_ATTEMPTS: Record<number, OlympicsAttempt[]> = {}

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: OlympicsStateSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

export function OlympicsGame({ socket, roundKey, state, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const nameOf = (teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'
  const myTeam = teamOf(teams, playerId)

  // 육상: 팀별 달린 칸 수 — 서버가 일정 간격으로 알려 주고, 내가 누른 것은 바로 올려서 보여준다
  const [serverPositions, setServerPositions] = useState<Record<number, number>>({})
  const [myTaps, setMyTaps] = useState(0)
  useEffect(() => {
    if (state?.track) setServerPositions(state.track.positions)
  }, [state?.track])
  useEffect(() => {
    const onTrack = (data: OlympicsTrackSignal) => setServerPositions(data.positions)
    socket.on('olympics:track', onTrack)
    return () => {
      socket.off('olympics:track', onTrack)
    }
  }, [socket])
  const roundId = `${roundKey}-${state?.roundIndex ?? 'none'}`
  useEffect(() => {
    setMyTaps(0)
    lastSideRef.current = null
  }, [roundId])

  const gauge = state?.gauge ?? null
  // 볼링은 한 번 던질 때 게이지가 두 번(방향, 힘) 나오므로 단계까지 키에 넣어 시계를 다시 시작한다
  const gaugeKey = gauge ? `${roundId}-${gauge.teamId}-${gauge.attempt}-${gauge.stage ?? 0}` : 'none'
  const clock = useGaugeClock(gauge, gaugeKey)
  const trackStartedAt = useMonotonicStartedAt(`${roundId}-track`, state?.track ? { elapsedMs: state.track.elapsedMs } : null, state?.phase === 'play' ? 'running' : 'finished')
  const lastTapRef = useRef(0)
  // 수영: 마지막으로 누른 쪽 (같은 쪽을 연달아 누르면 세지 않는다 — 서버도 같은 기준)
  const lastSideRef = useRef<'left' | 'right' | null>(null)
  const pressSwimRef = useRef<((side: 'left' | 'right') => void) | null>(null)
  useEffect(() => {
    // 키보드: ← → 로 번갈아 저을 수 있다
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'ArrowLeft') pressSwimRef.current?.('left')
      else if (event.key === 'ArrowRight') pressSwimRef.current?.('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // 던진 뒤에는 게이지가 사라지므로, 공이 어느 쪽으로 빗나갔는지 알려면 마지막 목표 위치를 기억해 둔다
  const zoneRef = useRef<number | null>(null)
  if (gauge?.zoneCenter !== undefined) zoneRef.current = gauge.zoneCenter
  // 체조: 모든 팀이 같은 큐로 겨루므로, 게이지가 없는 동안에도 큐를 보여 주려고 마지막으로 본 큐를 기억해 둔다
  const gymRef = useRef<{ cues: number[]; windowMs: number; maxMs: number } | null>(null)
  if ((gauge?.kind === 'gymnastics' || gauge?.kind === 'skating') && gauge.cues) gymRef.current = { cues: gauge.cues, windowMs: gauge.windowMs ?? 150, maxMs: gauge.maxMs }
  const revealMs = { archery: ARCHERY_REVEAL_MS, shooting: ARCHERY_REVEAL_MS, bowling: BOWLING_REVEAL_MS, golf: GOLF_REVEAL_MS, gymnastics: GYM_REVEAL_MS, skating: GYM_REVEAL_MS, weightlifting: LIFT_REVEAL_MS }[state?.sport.id ?? ''] ?? BASKETBALL_REVEAL_MS
  const { shot, pending } = useShotTracker(state?.attempts ?? NO_ATTEMPTS, roundId, revealMs)
  const choiceStartedAt = useMonotonicStartedAt(`${roundId}-choice-${state?.choice?.teamId}-${state?.choice?.attempt}`, state?.choice ? { elapsedMs: state.choice.elapsedMs } : null, state?.choice ? 'running' : 'finished')

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const sport = state.sport
  const myTeamId = myTeam?.id
  const iAmRep = myTeamId !== undefined && state.reps[myTeamId] === playerId
  const finishTaps = state.track?.finishTaps ?? 60
  // 내가 누른 것은 바로 올려서 보여주되, 결승선(도착)은 서버가 센 값으로만 정한다 — 서버가 못 센 신호가 있으면 화면만 먼저 도착해 버리기 때문이다
  const positions = { ...serverPositions }
  if (myTeamId !== undefined && iAmRep) positions[myTeamId] = Math.max(positions[myTeamId] ?? 0, Math.min(myTaps, finishTaps - 1))
  const myFinished = myTeamId !== undefined && (serverPositions[myTeamId] ?? 0) >= finishTaps

  const isTrack = sport.mode === 'simultaneous'
  const isDuel = sport.mode === 'duel'
  const isSwim = sport.id === 'swimming'
  const playing = state.phase === 'play'
  const myTurn = !isTrack && playing && iAmRep && gauge !== null && gauge.teamId === myTeamId
  const canPress = playing && iAmRep && (isTrack ? !myFinished : myTurn)

  const press = () => {
    if (!canPress || isSwim) return
    if (isTrack) {
      // 서버가 무시하는 속도의 신호는 보내지 않는다
      const now = performance.now()
      if (now - lastTapRef.current < 55) return
      lastTapRef.current = now
      setMyTaps((prev) => prev + 1)
      socket.emit('olympics:press', {})
      return
    }
    socket.emit('olympics:press', { elapsedMs: clock.now() })
  }
  // 수영: 왼쪽·오른쪽을 번갈아 눌러야 센다
  const pressSwim = (side: 'left' | 'right') => {
    if (!canPress || !isSwim || lastSideRef.current === side) return
    const now = performance.now()
    if (now - lastTapRef.current < 55) return
    lastTapRef.current = now
    lastSideRef.current = side
    setMyTaps((prev) => prev + 1)
    socket.emit('olympics:press', { side })
  }
  pressSwimRef.current = pressSwim
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    press()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault()
      press()
    }
  }

  const totalsRanked = [...teams]
    .map((team) => ({ team, total: state.roundResult && state.phase !== 'intro' && state.phase !== 'play' ? (state.roundResult.totals[team.id] ?? 0) : (state.totals[team.id] ?? 0) }))
    .sort((a, b) => b.total - a.total)

  const shownAttempts = visibleAttempts(state.attempts, shot, pending)
  const turnRep = state.turnTeamId !== null ? state.reps[state.turnTeamId] : null
  const attemptTotal = sport.attempts
  const choosing = playing && state.choice !== null && state.choice.teamId === myTeamId && iAmRep
  const chooseWeight = (weight: number) => socket.emit('olympics:choose', { weight })

  return (
    <div className="party-round-stage party-oly-stage">
      <p className="party-oly-round">
        {state.roundIndex + 1} <span className="party-oly-round-max">/ {state.totalRounds} 종목</span>
        {sport.group && <span className="party-oly-group">{sport.group} 방식</span>}
      </p>
      <h2 className="party-oly-sport">
        {sport.emoji} {sport.name}
      </h2>

      <p className="party-oly-caption">올림픽 누적 점수 <small>(종목 순위로 받은 점수의 합)</small></p>
      <ul className="party-oly-totals" aria-label="합계 점수">
        {totalsRanked.map(({ team, total }) => (
          <li key={team.id} className={`party-oly-total ${teamColorClass(team.id)}${team.id === myTeamId ? ' party-oly-total-mine' : ''}`}>
            <span>
              {teamEmoji(team.id)} {team.name}
            </span>
            <strong>{total}점</strong>
          </li>
        ))}
      </ul>

      {state.phase === 'intro' && (
        <div className="party-oly-intro">
          <p className="party-oly-rule">{sport.rule}</p>
          <ul className="party-oly-reps">
            {state.teamOrder.map((teamId) => (
              <li key={teamId} className={teamColorClass(teamId)}>
                <span>
                  {teamEmoji(teamId)} {nameOf(teamId)}
                </span>
                <strong>
                  {nicknameOf(state.reps[teamId])}
                  {state.reps[teamId] === playerId && ' (나)'}
                </strong>
              </li>
            ))}
          </ul>
          {iAmRep ? <p className="party-oly-callout">🎽 이번 종목은 내가 우리 팀 대표예요!</p> : <p className="party-round-hint">우리 팀 대표를 응원하며 지켜봐요.</p>}
        </div>
      )}

      {state.phase === 'play' && (
        <>
          {isDuel ? (
            <>
              {state.zoneDuel && (
                <ZoneDuelField
                  duel={state.zoneDuel}
                  roundId={roundId}
                  socket={socket}
                  teams={teams}
                  myTeamId={myTeamId}
                  iAmRep={iAmRep}
                  nameOf={nameOf}
                  nicknameOf={(teamId) => nicknameOf(state.reps[teamId])}
                />
              )}
              {state.baseball && (
              <BaseballField
                baseball={state.baseball}
                roundId={roundId}
                socket={socket}
                teams={teams}
                myTeamId={myTeamId}
                iAmRep={iAmRep}
                nameOf={nameOf}
                nicknameOf={(teamId) => nicknameOf(state.reps[teamId])}
              />
              )}
            </>
          ) : isSwim ? (
            <>
              {trackStartedAt !== null && state.track && <RemainingTime startedAt={trackStartedAt} timeoutMs={state.track.durationMs} />}
              <SwimLanes teams={teams} positions={positions} finishTaps={finishTaps} nameOf={nameOf} myTeamId={myTeamId} />
            </>
          ) : isTrack ? (
            <>
              {trackStartedAt !== null && state.track && <RemainingTime startedAt={trackStartedAt} timeoutMs={state.track.durationMs} />}
              <TrackLanes teams={teams} positions={positions} finishTaps={finishTaps} nameOf={nameOf} myTeamId={myTeamId} />
            </>
          ) : (
            <>
              <p className="party-oly-turn">
                {state.turnTeamId !== null && turnRep ? (
                  <>
                    {teamEmoji(state.turnTeamId)} <strong>{nameOf(state.turnTeamId)}</strong> · {nicknameOf(turnRep)}
                    {turnRep === playerId && ' (나)'}님 차례
                    {gauge && sport.id !== 'gymnastics' && sport.id !== 'skating' && ` (${gauge.attempt + 1}/${attemptTotal})`}
                  </>
                ) : (
                  '다음 팀 준비 중...'
                )}
              </p>
              {sport.id === 'basketball' && <BasketballCourt shot={shot} pending={pending} zoneCenter={zoneRef.current} />}
              {(sport.id === 'bowling' || sport.id === 'golf') && (
                <TwoStageGauges gauge={gauge} elapsed={clock.elapsed}>
                  {sport.id === 'bowling' ? (
                    <BowlingLane shot={shot} fallen={gauge === null} />
                  ) : (
                    <GolfCourse shot={shot} shots={state.turnTeamId !== null ? (shownAttempts[state.turnTeamId] ?? []) : []} />
                  )}
                </TwoStageGauges>
              )}
              {(sport.id === 'gymnastics' || sport.id === 'skating') && gymRef.current && (
                <GymStage
                  variant={sport.id}
                  cues={gymRef.current.cues}
                  windowMs={gymRef.current.windowMs}
                  maxMs={gymRef.current.maxMs}
                  elapsed={gauge ? clock.elapsed : null}
                  attempts={state.turnTeamId !== null ? (shownAttempts[state.turnTeamId] ?? []) : []}
                  shot={shot}
                />
              )}
              {sport.id === 'weightlifting' && <WeightliftingStage shot={shot} weight={gauge?.weight ?? null} />}
              {(gauge?.kind === 'bowling' || gauge?.kind === 'golf') && (
                <p className="party-oly-stage-hint">
                  {gauge.stage === 0 ? '① 방향 게이지(가로)를 가운데 초록 선에 맞춰 멈추세요' : gauge.kind === 'golf' ? '② 이제 힘 게이지(세로)를 초록 영역에 맞춰 멈추세요 (깃대까지의 거리)' : '② 이제 힘 게이지(세로)를 초록 영역에 맞춰 멈추세요'}
                </p>
              )}
              {state.choice && (
                <div className="party-oly-choice">
                  <p className="party-oly-stage-hint">
                    {choosing ? '이번에 들 무게를 고르세요!' : `${nameOf(state.choice.teamId)} 대표가 무게를 고르는 중...`}
                    {choiceStartedAt !== null && <RemainingTime startedAt={choiceStartedAt} timeoutMs={state.choice.maxMs} />}
                  </p>
                  <div className="party-oly-weights">
                    {state.choice.weights.map((weight) => (
                      <button key={weight} type="button" className="btn btn-secondary party-oly-weight" disabled={!choosing} onClick={() => chooseWeight(weight)}>
                        {weight}kg
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {gauge && (sport.id === 'basketball' || sport.id === 'weightlifting') && (
                <BasketballGauge gauge={gauge} elapsed={clock.elapsed} label={`${sport.name} 게이지`} />
              )}
              {sport.id === 'shooting' && (
                <ShootingTarget gauge={gauge} elapsed={clock.elapsed} shots={state.turnTeamId !== null ? (shownAttempts[state.turnTeamId] ?? []) : []} shot={shot} />
              )}
              {sport.id === 'archery' && (
                <ArcheryTarget gauge={gauge} elapsed={clock.elapsed} arrows={state.turnTeamId !== null ? (shownAttempts[state.turnTeamId] ?? []) : []} shot={shot} />
              )}
              <AttemptsPanel
                sportId={sport.id}
                total={attemptTotal}
                teams={teams}
                order={state.teamOrder}
                attempts={shownAttempts}
                turnTeamId={state.turnTeamId}
                nameOf={nameOf}
              />
            </>
          )}

          {isSwim && (
            <div className="party-oly-press-pair">
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  className="party-oly-press"
                  disabled={!canPress}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    pressSwim(side)
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {side === 'left' ? '◀ 왼쪽' : '오른쪽 ▶'}
                </button>
              ))}
              <p className="party-oly-stage-hint">{myFinished ? '🏁 도착!' : iAmRep ? '왼쪽, 오른쪽을 번갈아 눌러요! (키보드 ← →)' : '대표를 응원해요'}</p>
            </div>
          )}
          {!isDuel && !isSwim && (
          <button
            type="button"
            className="party-oly-press"
            disabled={!canPress}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
          >
            {isTrack ? (myFinished ? '🏁 결승선!' : iAmRep ? '달려라!! 🏃' : '대표를 응원해요') : myTurn ? pressLabel(sport.id, gauge?.stage)  : iAmRep ? '내 차례를 기다려요' : '구경 중'}
          </button>
          )}
        </>
      )}

      {state.phase === 'result' && state.roundResult && (
        <ol className="party-oly-result">
          {state.roundResult.teams.map((row) => (
            <li key={row.teamId} className={teamColorClass(row.teamId)}>
              <span>
                {row.rank}위 {teamEmoji(row.teamId)} {nameOf(row.teamId)}
              </span>
              <span>
                {row.detail} · <strong>+{row.points}점</strong>
              </span>
            </li>
          ))}
        </ol>
      )}

      {state.phase === 'ended' && <p className="party-round-hint">모든 종목이 끝났어요! 결과를 확인하는 중...</p>}
    </div>
  )
}

/** 내 차례에 누르는 버튼의 문구 */
function pressLabel(sportId: string, stage: number | undefined): string {
  if (sportId === 'archery' || sportId === 'shooting') return '쏘기!'
  if (sportId === 'bowling' || sportId === 'golf') return stage === 1 ? '힘 멈추기!' : '방향 멈추기!'
  if (sportId === 'weightlifting') return '들어올리기!'
  if (sportId === 'gymnastics') return '동작!'
  if (sportId === 'skating') return '점프!'
  return '던지기!'
}
