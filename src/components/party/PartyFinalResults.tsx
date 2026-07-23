import { useNavigate } from 'react-router-dom'
import type { GameSession } from '../../hooks/useGameSession'
import { PartyScoreList } from './PartyScoreList'

interface Props {
  session: GameSession
}

export function PartyFinalResults({ session }: Props) {
  const navigate = useNavigate()
  const state = session.roomState!
  const ranked = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  const winner = ranked[0]
  const entries = ranked.map((p, index) => ({ id: p.id, label: `${index + 1}위 ${p.nickname}`, points: state.scores[p.id] ?? 0 }))

  const handleLeave = () => {
    session.leaveRoom()
    navigate('/')
  }

  return (
    <section className="game-page">
      <h1 className="page-title">🏆 최종 결과</h1>
      {winner && <p className="page-subtitle">{winner.nickname}님 우승!</p>}

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
