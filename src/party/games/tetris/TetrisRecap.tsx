import type { PlayerInfo, TeamInfo } from '../../../shared/lib/partyProtocol'
import { TetrisEnd } from './TetrisView'
import type { TetrisRoundMeta } from './protocol'

interface Props {
  meta: TetrisRoundMeta
  teams: TeamInfo[]
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 결과 상자를 그대로 다시 보여준다 */
export function TetrisRecap({ meta, teams, playerId, players }: Props) {
  return (
    <div className="party-tt-recap">
      <TetrisEnd end={meta.end} teams={teams} playerId={playerId} players={players} />
    </div>
  )
}
