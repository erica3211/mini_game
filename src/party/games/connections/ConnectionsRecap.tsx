import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { ConnectionsEnd } from './ConnectionsView'
import type { ConnectionsRoundMeta } from './protocol'

interface Props {
  meta: ConnectionsRoundMeta
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 결과 상자를 그대로 다시 보여준다 */
export function ConnectionsRecap({ meta, playerId, players }: Props) {
  return (
    <div className="party-cn-recap">
      <ConnectionsEnd end={meta.end} players={players} myId={playerId} />
    </div>
  )
}
