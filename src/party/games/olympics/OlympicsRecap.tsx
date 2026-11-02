import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { OlympicsRoundMeta } from './protocol'

interface Props {
  meta: OlympicsRoundMeta
  teams: TeamInfo[]
  nicknameOf: (playerId: string) => string
}

// 종목 이름과 이모티콘 — 서버의 OLYMPICS_SPORTS와 같아야 한다 (결과 화면에서 종목 id로 보여주려고 따로 둔다)
const SPORT_LABELS: Record<string, string> = { basketball: '🏀 농구', archery: '🏹 양궁', bowling: '🎳 볼링', weightlifting: '🏋️ 역도', track: '🏃 육상 100m' }

/** 결과 화면: 종목마다 대표가 누구였고 각 팀이 몇 위·몇 점을 받았는지 */
export function OlympicsRecap({ meta, teams, nicknameOf }: Props) {
  return (
    <ol className="party-oly-recap">
      {meta.rounds.map((round, index) => (
        <li key={round.roundIndex} className="party-oly-recap-item">
          <p className="party-oly-recap-title">
            {index + 1}. {SPORT_LABELS[round.sportId] ?? round.sportId}
          </p>
          <ul className="party-oly-recap-rows">
            {round.teams.map((row) => (
              <li key={row.teamId} className={`party-oly-recap-row ${teamColorClass(row.teamId)}`}>
                <span>
                  {row.rank}위 {teamEmoji(row.teamId)} {teams.find((team) => team.id === row.teamId)?.name ?? '팀'} · {nicknameOf(meta.history[index]?.reps[row.teamId] ?? '')}
                </span>
                <span>
                  {row.detail} · +{row.points}점
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
