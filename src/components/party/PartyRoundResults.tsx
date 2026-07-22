import type { GameSession } from '../../hooks/useGameSession'
import { PartyScoreList } from './PartyScoreList'

interface Props {
  session: GameSession
}

export function PartyRoundResults({ session }: Props) {
  const state = session.roomState!
  const lastRound = state.roundHistory[state.roundHistory.length - 1]
  const nicknameOf = (playerId: string) => state.players.find((p) => p.id === playerId)?.nickname ?? '???'
  const isLastRound = state.currentRoundIndex + 1 >= state.config.totalRounds

  const detailOf = (entry: (typeof lastRound.ranking)[number]) => {
    if (entry.disconnected) return ' (연결 끊김)'
    if (entry.dnf) return ' (미제출)'
    if (lastRound.gameId === 'humanTimer' && entry.value !== undefined) {
      return ` (${(entry.value / 1000).toFixed(2)}초에 정지)`
    }
    return ''
  }

  const roundEntries = [...lastRound.ranking]
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => ({
      id: entry.playerId,
      label: `${entry.rank}위 ${nicknameOf(entry.playerId)}${detailOf(entry)}`,
      points: entry.points,
    }))

  const cumulativeEntries = [...state.players]
    .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
    .map((p) => ({ id: p.id, label: p.nickname, points: state.scores[p.id] ?? 0 }))

  return (
    <section className="game-page">
      <h1 className="page-title">라운드{state.currentRoundIndex + 1} 결과</h1>

      <PartyScoreList entries={roundEntries} badgeClass="badge-strike" />

      <h2 className="party-section-title">누적 점수</h2>
      <PartyScoreList entries={cumulativeEntries} />

      {session.isHost && (
        <button type="button" className="btn btn-primary" onClick={session.nextRound}>
          {isLastRound ? '최종 결과 보기' : '다음 라운드'}
        </button>
      )}
    </section>
  )
}
