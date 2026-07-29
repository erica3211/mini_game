import type { GameSession } from '../../hooks/useGameSession'
import { AuctionGame } from './AuctionGame'
import { ColorMatchGame } from './ColorMatchGame'
import { HumanTimerGame } from './HumanTimerGame'
import { OneToFiftyGame } from './OneToFiftyGame'
import { WordChainGame } from './WordChainGame'

interface Props {
  session: GameSession
}

export function PartyRoundActive({ session }: Props) {
  const state = session.roomState!
  const roundKey = `${state.currentRoundIndex}-${state.currentGameId}`
  const gameMeta = state.gameCatalog.find((g) => g.id === state.currentGameId)
  const isParticipating = session.playerId !== null && state.currentRoundPlayerIds.includes(session.playerId)

  return (
    <section className="game-page">
      <h1 className="page-title">
        라운드 {state.currentRoundIndex + 1} / {state.config.totalRounds}
      </h1>
      <p className="page-subtitle">{gameMeta ? `${gameMeta.emoji} ${gameMeta.title}` : '게임 준비 중...'}</p>

      {!isParticipating ? (
        <p className="party-round-hint">이미 게임이 진행중이라 참여할 수 없어요. 다음 라운드부터 참여 가능해요.</p>
      ) : (
        gameMeta &&
        (state.currentGameId === 'humanTimer' ? (
          <HumanTimerGame
            socket={session.socket}
            roundKey={roundKey}
            startSignal={session.humanTimerStart}
            howToPlay={gameMeta.howToPlay}
          />
        ) : state.currentGameId === 'oneToFifty' ? (
          <OneToFiftyGame
            socket={session.socket}
            roundKey={roundKey}
            startSignal={session.oneToFiftyStart}
            howToPlay={gameMeta.howToPlay}
          />
        ) : state.currentGameId === 'wordChain' ? (
          <WordChainGame
            socket={session.socket}
            roundKey={roundKey}
            startSignal={session.wordChainStart}
            category={session.wordChainCategory}
            definition={session.wordChainDefinition}
            howToPlay={gameMeta.howToPlay}
            players={state.players}
          />
        ) : state.currentGameId === 'auction' ? (
          <AuctionGame socket={session.socket} roundKey={roundKey} startSignal={session.auctionStart} howToPlay={gameMeta.howToPlay} />
        ) : (
          state.currentGameId === 'colorMatch' && (
            <ColorMatchGame
              socket={session.socket}
              roundKey={roundKey}
              startSignal={session.colorMatchStart}
              howToPlay={gameMeta.howToPlay}
            />
          )
        ))
      )}
    </section>
  )
}
