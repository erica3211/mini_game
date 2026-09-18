import { useNavigate } from 'react-router-dom'
import type { GameSession } from '../../hooks/useGameSession'
import { PartyConfetti } from './PartyConfetti'
import { PartyScoreList } from './PartyScoreList'

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
  const entries = ranked.map((p, index) => {
    const score = state.scores[p.id] ?? 0
    const rank = previousScore !== null && score === previousScore ? previousRank : index + 1
    previousScore = score
    previousRank = rank
    return { id: p.id, label: `${rank}위 ${p.nickname}`, points: score }
  })
  // 공동 1위도 우승자이니 최고 점수와 같으면 함께 색종이를 보고, 이름도 같이 불린다
  const winners = winner !== undefined ? ranked.filter((p) => state.scores[p.id] === state.scores[winner.id]) : []
  const isWinner = session.playerId !== null && winners.some((p) => p.id === session.playerId)
  const winnerNames = winners.map((p) => p.nickname).join(', ')
  const tiedSuffix = winners.length > 1 ? ' 공동' : ''
  const winnerAnnouncement = winners.length > 0 ? `${winnerNames}님${tiedSuffix} 우승!` : null

  const handleLeave = () => {
    session.leaveRoom()
    navigate('/')
  }

  return (
    <section className="game-page">
      {isWinner && <PartyConfetti />}
      <h1 className="page-title">🏆 최종 결과</h1>
      {winnerAnnouncement && <p className="page-subtitle">{winnerAnnouncement}</p>}

      <PartyScoreList entries={entries} badgeClass="badge-strike" />

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
