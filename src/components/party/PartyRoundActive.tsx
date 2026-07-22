import type { GameSession } from '../../hooks/useGameSession'
import { HumanTimerGame } from './HumanTimerGame'

interface Props {
  session: GameSession
}

export function PartyRoundActive({ session }: Props) {
  const state = session.roomState!
  const roundKey = `${state.currentRoundIndex}-${state.currentGameId}`
  const gameMeta = state.gameCatalog.find((g) => g.id === state.currentGameId)

  return (
    <section className="game-page">
      <h1 className="page-title">
        라운드 {state.currentRoundIndex + 1} / {state.config.totalRounds}
      </h1>
      <p className="page-subtitle">{gameMeta ? `${gameMeta.emoji} ${gameMeta.title}` : '게임 준비 중...'}</p>

      {state.currentGameId === 'humanTimer' && (
        <HumanTimerGame socket={session.socket} roundKey={roundKey} startSignal={session.humanTimerStart} />
      )}
    </section>
  )
}
