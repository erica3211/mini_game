import type { PlayerId, TeamInfo } from '../../shared/lib/partyProtocol'

// 팀 색 목록 — TEAM_NAMES, styles.css의 .party-team-color-N과 같은 순서
const TEAM_EMOJIS = ['💙', '❤️', '💚', '💛', '💜', '🧡', '🤎', '🩷']

/** 팀 번호마다 색이 정해져 있다 — styles.css의 .party-team-color-N과 짝 */
export function teamEmoji(teamId: number): string {
  return TEAM_EMOJIS[teamId % TEAM_EMOJIS.length]
}

export function teamColorClass(teamId: number): string {
  return `party-team-color-${teamId % TEAM_EMOJIS.length}`
}

export function teamOf(teams: TeamInfo[], playerId: PlayerId | null): TeamInfo | null {
  if (!playerId) return null
  return teams.find((team) => team.memberIds.includes(playerId)) ?? null
}

interface Props {
  teams: TeamInfo[]
  playerId: PlayerId | null
  nicknameOf: (playerId: PlayerId) => string
}

/** 팀전 라운드에서 "내 팀"과 팀원을 보여주는 띠 — 카운트다운과 게임 화면 위에 붙는다 */
export function PartyTeamBanner({ teams, playerId, nicknameOf }: Props) {
  const team = teamOf(teams, playerId)
  if (!team) return null
  const mates = team.memberIds.filter((id) => id !== playerId).map(nicknameOf)
  return (
    <div className={`party-team-banner ${teamColorClass(team.id)}`}>
      <strong>
        {teamEmoji(team.id)} {team.name}
      </strong>
      <span className="party-team-banner-mates">{mates.length > 0 ? `팀원: ${mates.join(', ')}` : '혼자 팀이에요'}</span>
    </div>
  )
}
