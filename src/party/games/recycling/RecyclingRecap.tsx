import type { PlayerInfo, TeamInfo } from '../../../shared/lib/partyProtocol'
import { RecyclingEnd } from './RecyclingView'
import type { RecyclingRoundMeta } from './protocol'

interface Props {
  meta: RecyclingRoundMeta
  teams: TeamInfo[]
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 결과 상자를 그대로 다시 보여준다 */
export function RecyclingRecap({ meta, teams, playerId, players }: Props) {
  return (
    <div className="party-rc-recap">
      <RecyclingEnd end={meta.end} teams={teams} playerId={playerId} players={players} />
    </div>
  )
}
