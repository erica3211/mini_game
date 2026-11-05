import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { TreasureEnd } from './DarkTreasureView'
import type { TreasureRoundMeta } from './protocol'

interface Props {
  meta: TreasureRoundMeta
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 결과 상자를 그대로 다시 보여준다 */
export function DarkTreasureRecap({ meta, playerId, players }: Props) {
  return (
    <div className="party-mb-recap">
      <TreasureEnd end={meta.end} players={players} myId={playerId} />
    </div>
  )
}
