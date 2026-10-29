import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { MazeRoundMeta } from './protocol'

interface Props {
  meta: MazeRoundMeta
  teams: TeamInfo[]
}

/** 결과 화면: 팀별로 탈출했는지, 못 나갔다면 어디까지 갔는지 */
export function MazeRecap({ meta, teams }: Props) {
  const ordered = [...meta.teams].sort((a, b) => (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity) || b.progress - a.progress)
  return (
    <ol className="party-maze-end-list">
      {ordered.map((item) => (
        <li key={item.teamId} className={teamColorClass(item.teamId)}>
          <span>
            {teamEmoji(item.teamId)} {teams.find((team) => team.id === item.teamId)?.name ?? '팀'}
          </span>
          <strong>
            {item.finishedMs !== null ? `🏁 ${(item.finishedMs / 1000).toFixed(1)}초에 탈출` : `${item.progress}%까지 도착`} · {item.steps}칸 이동
          </strong>
        </li>
      ))}
    </ol>
  )
}
