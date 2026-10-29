import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { CharacterRoundMeta } from './protocol'

interface Props {
  meta: CharacterRoundMeta
  teams: TeamInfo[]
  nicknameOf: (playerId: string) => string
}

/** 결과 화면: 이번 캐릭터와 누가 맞혔는지, 팀별로 어떻게 설명했는지 */
export function CharacterDescribeRecap({ meta, teams, nicknameOf }: Props) {
  const teamNameOf = (teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'
  return (
    <div className={`party-chardesc-result${meta.winnerTeamId === null ? ' party-chardesc-result-none' : ''}`}>
      <p className="party-chardesc-result-title">
        {meta.winnerTeamId !== null ? `🎉 ${teamNameOf(meta.winnerTeamId)}이 맞혔어요!` : '⏰ 아무도 못 맞혔어요'}
      </p>
      <p>
        정답은 <strong>{meta.answer}</strong> ({meta.category})
        {meta.solverId && ` · 맞힌 사람 ${nicknameOf(meta.solverId)}`}
      </p>
      <ul className="party-chardesc-result-teams">
        {meta.teams.map((item) => (
          <li key={item.teamId} className={`party-chardesc-result-team ${teamColorClass(item.teamId)}`}>
            <strong>
              {teamEmoji(item.teamId)} {teamNameOf(item.teamId)} · {nicknameOf(item.describerId)}
            </strong>
            {item.descriptions.length === 0 ? <span>(설명 없음)</span> : item.descriptions.map((line, index) => <span key={index}>{line}</span>)}
          </li>
        ))}
      </ul>
    </div>
  )
}
