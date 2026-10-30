import { type KeyboardEvent, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { useTugOfWarRound } from './useTugOfWarRound'
import type { TugStartSignal } from './protocol'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamOf } from '../../core/PartyTeamBanner'
import { TugBars, TugEnd, TugRope } from './TugView'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: TugStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

export function TugOfWarGame({ socket, roundKey, startSignal, playerId, players, teams }: Props) {
  const { power, myPulls, end, timeUp, startedAt, pull } = useTugOfWarRound(socket, roundKey, startSignal)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)

  if (!startSignal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

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

  return (
    <div className="party-round-stage party-tug-stage">
      {startedAt !== null && !end && <RemainingTime startedAt={startedAt} timeoutMs={startSignal.durationMs} />}

      <TugRope teams={teams} power={power} />
      <TugBars teams={teams} power={power} myTeamId={myTeam?.id} />
      <p className="party-tug-note">힘은 팀이 누른 횟수를 팀 인원으로 나눈 값이라 인원이 달라도 공평해요.</p>

      {end ? (
        <TugEnd end={end} teams={teams} playerId={playerId} nicknameOf={nicknameOf} />
      ) : (
        <>
          <button
            type="button"
            className="party-tug-button"
            disabled={timeUp}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="우리 색으로 채우기"
          >
            {timeUp ? '끝!' : '채워라!! 💪'}
          </button>
          <p className="party-tug-count">
            내가 누른 횟수 <strong>{myPulls}</strong>번
          </p>
        </>
      )}
    </div>
  )
}
