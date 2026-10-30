import type { CSSProperties } from 'react'
import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import type { TugEndSignal, TugPower } from './protocol'

// 줄다리기 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

const teamNameOf = (teams: TeamInfo[], teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

interface RopeProps {
  teams: TeamInfo[]
  power: TugPower
}

/** 두 팀의 줄 — 두 팀의 색이 각자 힘의 비율만큼 차지하고, 센 팀의 색이 상대 쪽으로 밀고 들어간다. 가운데(▼, 검은 선)가 비긴 지점이다 */
export function TugRope({ teams, power }: RopeProps) {
  if (teams.length !== 2) return null
  const [left, right] = teams
  const a = power[left.id] ?? 0
  const b = power[right.id] ?? 0
  const leftPercent = a + b === 0 ? 50 : (a / (a + b)) * 100
  return (
    <div className="party-tug-rope" aria-label="색깔 줄">
      <span className="party-tug-rope-marker" aria-hidden="true">
        ▼
      </span>
      <div className="party-tug-rope-bar" style={{ background: `rgb(${teamRgb(right.id)})` }}>
        <div className="party-tug-rope-fill" style={{ width: `${leftPercent}%`, background: `rgb(${teamRgb(left.id)})` }} />
        <span className="party-tug-rope-center" aria-hidden="true" />
        <span className="party-tug-rope-name">
          {teamEmoji(left.id)} {left.name}
        </span>
        <span className="party-tug-rope-name party-tug-rope-name-right">
          {right.name} {teamEmoji(right.id)}
        </span>
      </div>
    </div>
  )
}

interface BarsProps {
  teams: TeamInfo[]
  power: TugPower
  myTeamId?: number
}

/** 팀별 힘 막대 */
export function TugBars({ teams, power, myTeamId }: BarsProps) {
  const powerOf = (teamId: number) => power[teamId] ?? 0
  const maxPower = Math.max(1, ...teams.map((team) => powerOf(team.id)))
  return (
    <ul className="party-tug-teams">
      {teams.map((team) => (
        <li key={team.id} className={`party-tug-team ${teamColorClass(team.id)}${team.id === myTeamId ? ' party-tug-team-mine' : ''}`}>
          <span className="party-tug-team-name">
            {teamEmoji(team.id)} {team.name}
          </span>
          <span className="party-tug-bar">
            <span style={{ width: `${(powerOf(team.id) / maxPower) * 100}%`, '--tug-color': `rgb(${teamRgb(team.id)})` } as CSSProperties} />
          </span>
          <span className="party-tug-team-power">{powerOf(team.id).toFixed(1)}</span>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: TugEndSignal
  teams: TeamInfo[]
  playerId: string | null
  nicknameOf: (playerId: string) => string
}

/** 끝난 뒤의 결과 상자 — 이긴 팀, 팀 순위, 내가 누른 횟수, 가장 많이 누른 사람 */
export function TugEnd({ end, teams, playerId, nicknameOf }: EndProps) {
  const winnerNames = end.teams.filter((team) => team.rank === 1).map((team) => teamNameOf(teams, team.teamId))
  const myPulls = end.players.find((player) => player.playerId === playerId)?.pulls ?? 0
  return (
    <div className="party-tug-end">
      <p className="party-tug-end-title">{winnerNames.length === teams.length ? '🤝 모두 비겼어요!' : `🏆 ${winnerNames.join(', ')} 승리!`}</p>
      <ol className="party-tug-end-list">
        {[...end.teams]
          .sort((a, b) => a.rank - b.rank || a.teamId - b.teamId)
          .map((team) => (
            <li key={team.teamId} className={teamColorClass(team.teamId)}>
              <span>
                {team.rank}위 {teamEmoji(team.teamId)} {teamNameOf(teams, team.teamId)}
              </span>
              <strong>
                1인당 {team.power.toFixed(1)}번 ({team.pulls}번)
              </strong>
            </li>
          ))}
      </ol>
      {playerId && <p className="party-tug-note">내가 누른 횟수: {myPulls}번</p>}
      <ul className="party-tug-pullers">
        {[...end.players]
          .sort((a, b) => b.pulls - a.pulls)
          .slice(0, 3)
          .map((player, index) => (
            <li key={player.playerId}>
              {['🥇', '🥈', '🥉'][index]} {nicknameOf(player.playerId)} · {player.pulls}번
            </li>
          ))}
      </ul>
    </div>
  )
}
