import { useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { teamOf } from '../../core/PartyTeamBanner'
import { TOWER_ROLE_LABEL, type TowerEndSignal, type TowerProgressSignal, type TowerRole, type TowerStateSignal } from './protocol'
import { TowerCanvas } from './TowerCanvas'
import { TowerDropTimer, TowerEnd, TowerEndingCountdown, TowerNext, TowerPadButton, TowerRoles, TowerScores } from './TowerView'
import { useTowerRound } from './useTowerRound'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: TowerStateSignal | null
  progress: TowerProgressSignal | null
  end: TowerEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

// 처음 기회 수 (서버와 같다)
const TOTAL_CHANCES = 3
// 역할이 바뀌었다고 알려 주는 시간, 블록이 떨어져 흔들리는 시간
const SWAP_NOTICE_MS = 3_500
const SHAKE_MS = 600

export function TowerGame({ socket, roundKey, state, progress, end, playerId, players, teams }: Props) {
  const { startedAt, myRole, allowed, press, release } = useTowerRound(socket, roundKey, state, end, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)

  // 한가운데에서 내 역할이 바뀌면 크게 알려 준다
  const [swapped, setSwapped] = useState<TowerRole | null>(null)
  const prevRoleRef = useRef<TowerRole | undefined>(undefined)
  useEffect(() => {
    setSwapped(null)
    prevRoleRef.current = undefined
  }, [roundKey])
  useEffect(() => {
    if (!myRole) return
    const prev = prevRoleRef.current
    prevRoleRef.current = myRole
    if (prev === undefined || prev === myRole) return
    setSwapped(myRole)
    const timer = window.setTimeout(() => setSwapped(null), SWAP_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [myRole])

  // 블록이 탑에서 떨어지면 화면이 잠깐 흔들린다 (처음 받은 상태에 이미 있던 건 센 것으로 치지 않는다)
  const [shaking, setShaking] = useState(false)
  const fallsRef = useRef<number | null>(null)
  useEffect(() => {
    fallsRef.current = null
    setShaking(false)
  }, [roundKey])
  const falls = state?.falls
  useEffect(() => {
    if (falls === undefined) return
    const prev = fallsRef.current
    fallsRef.current = falls
    if (prev === null || falls <= prev) return
    setShaking(true)
    const timer = window.setTimeout(() => setShaking(false), SHAKE_MS)
    return () => window.clearTimeout(timer)
  }, [falls])

  // 기회를 다 써서 끝나는 때(performance.now() 기준) — 카운트다운
  const endsInMs = state?.endsInMs ?? null
  const endsAt = useMemo(() => (endsInMs === null ? null : performance.now() + endsInMs), [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // 떠 있는 블록이 저절로 떨어질 때(performance.now() 기준) — 상태를 받을 때마다 서버가 알려 준 남은 시간으로 다시 맞춘다
  const dropInMs = state?.hover?.dropInMs
  const dropAt = useMemo(() => (dropInMs === undefined ? null : performance.now() + dropInMs), [state]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const scores = { ...(progress?.scores ?? {}), ...(myTeam ? { [myTeam.id]: state.mode === 'count' ? state.placed : state.height } : {}) }
  const chances = { ...(progress?.chances ?? {}), ...(myTeam ? { [myTeam.id]: state.chances } : {}) }

  return (
    <div className="party-round-stage party-tw-stage">
      {startedAt !== null && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      <TowerScores mode={state.mode} teams={teams} scores={scores} chances={chances} total={TOTAL_CHANCES} myTeamId={myTeam?.id} />

      <div className="party-tw-mine" aria-live="polite">
        <span>내 담당</span>
        <strong className="party-tw-role-chip">{myRole ? TOWER_ROLE_LABEL[myRole] : '없음'}</strong>
      </div>
      {swapped && !end && <p className="party-tw-swap">🔄 역할이 바뀌었어요! 이제 {TOWER_ROLE_LABEL[swapped]}</p>}
      {endsAt !== null && !end && !state.over && <p className="party-tw-over">기회를 모두 썼어요! 탑이 무너지는 동안 아무것도 할 수 없어요. 곧 끝나요…</p>}
      {state.over && !end && (
        <p className="party-tw-over">
          {state.mode === 'count'
            ? state.chances === 0
              ? `기회를 모두 썼어요! 다른 팀이 끝나길 기다려요 (쌓은 블록 ${state.placed}개)`
              : state.placed === state.maxBlocks
                ? `🎉 블록 ${state.maxBlocks}개를 모두 쌓았어요! 다른 팀이 끝나길 기다려요`
                : `블록을 모두 썼어요! 다른 팀이 끝나길 기다려요 (쌓은 블록 ${state.placed}개)`
            : `기회를 모두 썼어요! 다른 팀이 끝나길 기다려요 (높이 ${state.height}cm)`}
        </p>
      )}

      <div className={`party-tw-play${shaking ? ' party-tw-shake' : ''}`}>
        <div className="party-tw-canvas-box">
          <TowerCanvas state={state} />
          {dropAt !== null && !end && !state.over && <TowerDropTimer deadline={dropAt} />}
          {endsAt !== null && !end && !state.over && <TowerEndingCountdown deadline={endsAt} />}
        </div>
        <div className="party-tw-side">
          {state.mode === 'count' && (
            <>
              <div className="party-tw-stat">
                <span>쌓은 블록</span>
                <strong>
                  {state.placed}/{state.maxBlocks}
                </strong>
              </div>
              <div className="party-tw-stat">
                <span>남은 블록</span>
                <strong>{Math.max(0, state.maxBlocks - state.dropped)}</strong>
              </div>
            </>
          )}
          {state.mode === 'height' && (
            <div className="party-tw-stat">
              <span>지금 높이</span>
              <strong>{state.height}cm</strong>
            </div>
          )}
          <TowerNext next={state.next} />
        </div>
        {shaking && <span className="party-tw-fall-pop">💥 블록이 떨어졌어요! 기회 -1</span>}
      </div>

      {end ? (
        <TowerEnd end={end} teams={teams} playerId={playerId} players={players} />
      ) : (
        <>
          <div className="party-tw-pad-row">
            <TowerPadButton action="left" enabled={allowed('left')} onPress={press} onRelease={release} />
            <TowerPadButton action="rotate" enabled={allowed('rotate')} onPress={press} onRelease={release} />
            <TowerPadButton action="drop" enabled={allowed('drop')} onPress={press} onRelease={release} />
            <TowerPadButton action="right" enabled={allowed('right')} onPress={press} onRelease={release} />
          </div>
          <TowerRoles roles={state.roles} playerId={playerId} nicknameOf={nicknameOf} />
          <p className="party-tw-note">내 담당 버튼만 눌려요. ◀ ▶는 누르는 동안 움직여요. 받침대 밖으로 떨어지면 기회가 줄어요. (키보드: 방향키 · A D W S · X · 스페이스)</p>
        </>
      )}
    </div>
  )
}
