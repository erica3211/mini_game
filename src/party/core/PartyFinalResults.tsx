import { useNavigate } from 'react-router-dom'
import type { GameSession } from './useGameSession'
import { PartyConfetti } from './PartyConfetti'
import { PartyScoreList } from './PartyScoreList'
import { teamEmoji } from './PartyTeamBanner'
import { teamScoreRows } from './teamUtils'

interface Props {
  session: GameSession
}

export function PartyFinalResults({ session }: Props) {
  const navigate = useNavigate()
  const state = session.roomState!
  const ranked = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  const winner = ranked[0]
  // 라운드 결과 화면과 동일하게, 점수가 같으면 공동 등수(1,1,3 방식)로 매긴다
  let previousScore: number | null = null
  let previousRank = 0
  // 팀전이면 마지막 라운드의 팀 색을 이름 앞에 붙인다 (팀을 직접 고른 방에서는 그대로 내 팀이다)
  const lastTeams = state.roundHistory[state.roundHistory.length - 1]?.teams ?? []
  const tagOf = (playerId: string) => {
    const team = lastTeams.find((t) => t.memberIds.includes(playerId))
    return team ? `${teamEmoji(team.id)} ` : ''
  }
  const entries = ranked.map((p, index) => {
    const score = state.scores[p.id] ?? 0
    const rank = previousScore !== null && score === previousScore ? previousRank : index + 1
    previousScore = score
    previousRank = rank
    return { id: p.id, label: `${rank}위 ${tagOf(p.id)}${p.nickname}`, points: score }
  })
  // 공동 1위도 우승자이니 최고 점수와 같으면 함께 색종이를 보고, 이름도 같이 불린다
  const winners = winner !== undefined ? ranked.filter((p) => state.scores[p.id] === state.scores[winner.id]) : []
  const isWinner = session.playerId !== null && winners.some((p) => p.id === session.playerId)
  const winnerNames = winners.map((p) => p.nickname).join(', ')
  const tiedSuffix = winners.length > 1 ? ' 공동' : ''
  let winnerAnnouncement = winners.length > 0 ? `${winnerNames}님${tiedSuffix} 우승!` : null

  // 팀전은 팀 단위로 순위와 우승을 보여준다
  const teamRows = lastTeams.length > 0 ? teamScoreRows(lastTeams, state.scores) : []
  const nicknameOf = (id: string) => state.players.find((p) => p.id === id)?.nickname ?? '???'
  const teamEntries = teamRows.map(({ team, rank, score }) => ({
    id: String(team.id),
    label: `${rank}위 ${teamEmoji(team.id)} ${team.name} (${team.memberIds.map(nicknameOf).join(', ')})`,
    points: score,
  }))
  const winningTeams = teamRows.filter((row) => row.rank === 1)
  const isWinningTeamMember = session.playerId !== null && winningTeams.some((row) => row.team.memberIds.includes(session.playerId!))
  if (teamRows.length > 0) {
    winnerAnnouncement = `${winningTeams.map((row) => `${teamEmoji(row.team.id)} ${row.team.name}`).join(', ')}${winningTeams.length > 1 ? ' 공동' : ''} 우승!`
  }

  const handleLeave = () => {
    session.leaveRoom()
    navigate('/')
  }

  return (
    <section className="game-page">
      {(teamRows.length > 0 ? isWinningTeamMember : isWinner) && <PartyConfetti />}
      <h1 className="page-title">🏆 최종 결과</h1>
      {winnerAnnouncement && <p className="page-subtitle">{winnerAnnouncement}</p>}

      <PartyScoreList entries={teamRows.length > 0 ? teamEntries : entries} badgeClass="badge-strike" />

      <div className="party-final-actions">
        {session.isHost ? (
          <button type="button" className="btn btn-primary" onClick={session.playAgain}>
            다시하기
          </button>
        ) : (
          <p className="party-round-hint">방장이 다시하기를 누르면 대기실로 돌아가요.</p>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleLeave}>
          나가기
        </button>
      </div>
    </section>
  )
}
