import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamOf } from '../../core/PartyTeamBanner'
import { TugBars, TugEnd, TugRope } from './TugView'
import type { TugRoundMeta } from './protocol'

interface Props {
  meta: TugRoundMeta
  teams: TeamInfo[]
  playerId: string | null
  nicknameOf: (playerId: string) => string
}

/** 결과 화면: 게임이 끝났을 때 보이던 화면(줄, 팀별 힘, 결과 상자)을 그대로 다시 보여준다 */
export function TugRecap({ meta, teams, playerId, nicknameOf }: Props) {
  const power = Object.fromEntries(meta.end.teams.map((team) => [team.teamId, team.power]))
  return (
    <div className="party-tug-recap">
      <TugRope teams={teams} power={power} />
      <TugBars teams={teams} power={power} myTeamId={teamOf(teams, playerId)?.id} />
      <TugEnd end={meta.end} teams={teams} playerId={playerId} nicknameOf={nicknameOf} />
    </div>
  )
}
