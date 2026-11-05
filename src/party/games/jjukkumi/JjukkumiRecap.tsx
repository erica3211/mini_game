import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { JjukkumiEnd } from './JjukkumiView'
import type { JjukkumiRoundMeta } from './protocol'

interface Props {
  meta: JjukkumiRoundMeta
  playerId: string | null
  players: PlayerInfo[]
}

/** 결과 화면: 게임이 끝났을 때 보이던 최종 순위 상자를 그대로 다시 보여준다 */
export function JjukkumiRecap({ meta, playerId, players }: Props) {
  return (
    <div className="jk-recap">
      <JjukkumiEnd end={meta.end} players={players} myId={playerId} />
    </div>
  )
}
