import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { teamOf } from '../../core/PartyTeamBanner'
import { useStableViewportHeight } from '../../core/useStableViewportHeight'
import { ghostOf } from './pieces'
import { TETRIS_ROLE_LABEL, type TetrisEndSignal, type TetrisProgressSignal, type TetrisRole, type TetrisStateSignal } from './protocol'
import { TetrisBoard, TetrisEnd, TetrisNext, TetrisPadButton, TetrisRoles, TetrisScores } from './TetrisView'
import { useTetrisRound } from './useTetrisRound'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: TetrisStateSignal | null
  progress: TetrisProgressSignal | null
  end: TetrisEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

// 역할이 바뀌었다고 알려 주는 시간
const SWAP_NOTICE_MS = 3_500

export function TetrisGame({ socket, roundKey, state, progress, end, playerId, players, teams }: Props) {
  const { startedAt, myRole, allowed, press, release } = useTetrisRound(socket, roundKey, state, end, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)
  // 판 크기를 정하는 화면 높이 — 모바일 하단 바가 나타났다 사라져도 크기가 바뀌지 않게, 지금까지 본 가장 작은 높이를 쓴다 (styles.css의 --stable-vh)
  const viewportHeight = useStableViewportHeight()

  // 한가운데에서 내 역할이 바뀌면 크게 알려 준다
  const [swapped, setSwapped] = useState<TetrisRole | null>(null)
  const prevRoleRef = useRef<TetrisRole | undefined>(undefined)
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

  const ghost = useMemo(() => (state?.active ? ghostOf(state.board, state.active) : null), [state?.board, state?.active])

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const scores = { ...(progress?.scores ?? {}), ...(myTeam ? { [myTeam.id]: state.score } : {}) }
  const otherTeams = teams.filter((team) => team.id !== myTeam?.id)

  return (
    <div className="party-round-stage party-tt-stage" style={{ '--stable-vh': `${viewportHeight}px` } as CSSProperties}>
      {startedAt !== null && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      <TetrisScores teams={teams} scores={scores} myTeamId={myTeam?.id} />

      <div className="party-tt-mine" aria-live="polite">
        <span>내 담당</span>
        <strong className="party-tt-role-chip">{myRole ? TETRIS_ROLE_LABEL[myRole] : '없음'}</strong>
      </div>
      {swapped && !end && <p className="party-tt-swap">🔄 역할이 바뀌었어요! 이제 {TETRIS_ROLE_LABEL[swapped]}</p>}

      <div className="party-tt-play">
        <TetrisBoard rows={state.board} active={end ? null : state.active} ghost={end ? null : ghost} clearing={end ? [] : state.clearing} />
        <div className="party-tt-side">
          <div className="party-tt-stat">
            <span>점수</span>
            <strong>{state.score}</strong>
          </div>
          <div className="party-tt-stat">
            <span>지운 줄</span>
            <strong>{state.lines}</strong>
          </div>
          <TetrisNext next={state.next} />
        </div>
      </div>

      {end ? (
        <TetrisEnd end={end} teams={teams} playerId={playerId} players={players} />
      ) : (
        <>
          <div className="party-tt-pad-row">
            <TetrisPadButton action="left" enabled={allowed('left')} onPress={press} onRelease={release} />
            <TetrisPadButton action="rotate" enabled={allowed('rotate')} onPress={press} onRelease={release} />
            <TetrisPadButton action="right" enabled={allowed('right')} onPress={press} onRelease={release} />
            <TetrisPadButton action="down" enabled={allowed('down')} onPress={press} onRelease={release} />
          </div>
          <TetrisRoles roles={state.roles} playerId={playerId} nicknameOf={nicknameOf} />
          <p className="party-tt-note">내 담당 버튼만 눌려요. ▼는 꾹 누르는 동안만 빨리 내려가요. (키보드: 방향키 · A D W S · X)</p>
        </>
      )}

      {otherTeams.length > 0 && (
        <div className="party-tt-others">
          {otherTeams.map((team) => (
            <figure key={team.id} className="party-tt-other">
              <TetrisBoard rows={progress?.boards[team.id] ?? []} mini />
              <figcaption>{team.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
