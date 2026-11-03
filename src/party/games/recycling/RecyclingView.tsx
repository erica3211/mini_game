import type { CSSProperties } from 'react'
import type { PlayerInfo, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { RECYCLING_KINDS, type RecyclingEndSignal, type RecyclingRole } from './protocol'

// 분리수거 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

const teamNameOf = (teams: TeamInfo[], teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

export function KindChip({ kind }: { kind: number }) {
  const info = RECYCLING_KINDS[kind]
  return (
    <span className="party-rc-kind" style={{ '--rc-kind': info.color } as CSSProperties}>
      {info.emojis[0]} {info.name}
    </span>
  )
}

interface RolesProps {
  roles: RecyclingRole[]
  playerId: string | null
  nicknameOf: (playerId: string) => string
}

/** 팀원들이 맡은 종류 — 내 줄이 맨 위 */
export function RecyclingRoles({ roles, playerId, nicknameOf }: RolesProps) {
  const sorted = [...roles].sort((a, b) => Number(b.playerId === playerId) - Number(a.playerId === playerId))
  return (
    <ul className="party-rc-roles">
      {sorted.map((role) => (
        <li key={role.playerId} className={role.playerId === playerId ? 'party-rc-role-mine' : undefined}>
          <span className="party-rc-role-name">{role.playerId === playerId ? '나' : nicknameOf(role.playerId)}</span>
          <span className="party-rc-role-kinds">
            {role.kinds.map((kind) => (
              <KindChip key={kind} kind={kind} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface ScoresProps {
  teams: TeamInfo[]
  scores: Record<number, number>
  myTeamId?: number
}

/** 팀별 점수 현황 */
export function RecyclingScores({ teams, scores, myTeamId }: ScoresProps) {
  return (
    <ul className="party-rc-scores">
      {teams.map((team) => (
        <li key={team.id} className={`${teamColorClass(team.id)}${team.id === myTeamId ? ' party-rc-score-mine' : ''}`} style={{ '--rc-team': `rgb(${teamRgb(team.id)})` } as CSSProperties}>
          <span>
            {teamEmoji(team.id)} {team.name}
          </span>
          <strong>{scores[team.id] ?? 0}점</strong>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: RecyclingEndSignal
  teams: TeamInfo[]
  playerId: string | null
  players: PlayerInfo[]
}

/** 끝난 뒤의 결과 상자 — 이긴 팀, 팀 순위(치움·잘못 누름·놓침), 내 기록, 가장 많이 치운 사람 */
export function RecyclingEnd({ end, teams, playerId, players }: EndProps) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const winnerNames = end.teams.filter((team) => team.rank === 1).map((team) => teamNameOf(teams, team.teamId))
  const mine = end.players.find((player) => player.playerId === playerId)
  return (
    <div className="party-rc-end">
      <p className="party-rc-end-title">{winnerNames.length === teams.length ? '🤝 모두 비겼어요!' : `🏆 ${winnerNames.join(', ')} 승리!`}</p>
      <ol className="party-rc-end-list">
        {[...end.teams]
          .sort((a, b) => a.rank - b.rank || a.teamId - b.teamId)
          .map((team) => (
            <li key={team.teamId} className={teamColorClass(team.teamId)}>
              <span>
                {team.rank}위 {teamEmoji(team.teamId)} {teamNameOf(teams, team.teamId)}
              </span>
              <span className="party-rc-end-detail">
                <strong>{team.score}점</strong> · 치움 {team.done} · 잘못 누름 {team.wrong} · 놓침 {team.missed}
              </span>
            </li>
          ))}
      </ol>
      {mine && (
        <p className="party-rc-note">
          내 기록: {mine.done}개 치움 · {mine.wrong}번 잘못 누름
        </p>
      )}
      <ul className="party-rc-top">
        {[...end.players]
          .sort((a, b) => b.done - a.done)
          .slice(0, 3)
          .filter((player) => player.done > 0)
          .map((player, index) => (
            <li key={player.playerId}>
              {['🥇', '🥈', '🥉'][index]} {nicknameOf(player.playerId)} · {player.done}개
            </li>
          ))}
      </ul>
    </div>
  )
}
