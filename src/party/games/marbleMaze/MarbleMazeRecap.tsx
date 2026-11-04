import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { MarbleEnd } from './MarbleMazeView'
import type { MarbleRoundMeta } from './protocol'

interface Props {
  meta: MarbleRoundMeta
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 결과 상자를 그대로 다시 보여준다 */
export function MarbleMazeRecap({ meta, playerId, players }: Props) {
  return (
    <div className="party-mb-recap">
      <MarbleEnd end={meta.end} players={players} myId={playerId} />
    </div>
  )
}
