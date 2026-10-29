import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { EmojiCharadesRoundMeta } from './protocol'

interface Props {
  meta: EmojiCharadesRoundMeta
  teams: TeamInfo[]
  nicknameOf: (playerId: string) => string
}

/** 결과 화면: 이번 제시어와 팀마다 이모티콘으로 어떻게 표현했는지 */
export function EmojiCharadesRecap({ meta, teams, nicknameOf }: Props) {
  const winner = teams.find((team) => team.id === meta.winnerTeamId)
  return (
    <div className={`party-emojichar-end${winner ? ' party-emojichar-end-solved' : ''}`}>
      <p className="party-emojichar-end-title">{winner ? `🎉 ${winner.name}이 맞혔어요!` : '⏰ 아무도 못 맞혔어요'}</p>
      <p>
        {meta.category} · 정답은 <strong>{meta.answer}</strong>
        {meta.solverId && ` · 맞힌 사람 ${nicknameOf(meta.solverId)}`}
      </p>
      <ul className="party-emojichar-end-teams">
        {meta.teams.map((item) => (
          <li key={item.teamId} className={`party-emojichar-end-team ${teamColorClass(item.teamId)}`}>
            <span>
              {teamEmoji(item.teamId)} {teams.find((team) => team.id === item.teamId)?.name} · {nicknameOf(item.expresserId)}
            </span>
            <span className="party-emojichar-end-emojis">{item.emojis.join('') || '(비어 있음)'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
