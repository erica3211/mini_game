import { Link } from 'react-router-dom'
import type { GameSession } from '../../hooks/useGameSession'
import { PartyScoreList } from './PartyScoreList'

interface Props {
  session: GameSession
}

export function PartyFinalResults({ session }: Props) {
  const state = session.roomState!
  const ranked = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  const winner = ranked[0]
  const entries = ranked.map((p, index) => ({ id: p.id, label: `${index + 1}위 ${p.nickname}`, points: state.scores[p.id] ?? 0 }))

  return (
    <section className="game-page">
      <h1 className="page-title">🏆 최종 결과</h1>
      {winner && <p className="page-subtitle">{winner.nickname}님 우승!</p>}

      <PartyScoreList entries={entries} badgeClass="badge-strike" />

      <Link to="/party" className="btn btn-primary">
        새 방 만들기
      </Link>
    </section>
  )
}
