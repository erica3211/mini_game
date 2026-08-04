import type { GameSession } from '../../hooks/useGameSession'
import type { GameMeta } from '../../lib/partyProtocol'
import { AuctionGame } from './AuctionGame'
import { BalloonPopGame } from './BalloonPopGame'
import { ColorMatchGame } from './ColorMatchGame'
import { HumanTimerGame } from './HumanTimerGame'
import { MouseHunterGame } from './MouseHunterGame'
import { OneToFiftyGame } from './OneToFiftyGame'
import { PixelCanvasGame } from './PixelCanvasGame'
import { ScavengerHuntGame } from './ScavengerHuntGame'
import { WordChainGame } from './WordChainGame'

interface Props {
  session: GameSession
}

/** 현재 라운드의 게임 화면 하나를 고른다. gameId마다 게임 모듈이 필요로 하는 startSignal 등 개인화된 props가 달라서 분기가 필요하다 */
function renderGame(session: GameSession, roundKey: string, gameMeta: GameMeta) {
  const state = session.roomState!
  switch (state.currentGameId) {
    case 'humanTimer':
      return (
        <HumanTimerGame socket={session.socket} roundKey={roundKey} startSignal={session.humanTimerStart} howToPlay={gameMeta.howToPlay} />
      )
    case 'oneToFifty':
      return (
        <OneToFiftyGame socket={session.socket} roundKey={roundKey} startSignal={session.oneToFiftyStart} howToPlay={gameMeta.howToPlay} />
      )
    case 'wordChain':
      return (
        <WordChainGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.wordChainStart}
          category={session.wordChainCategory}
          definition={session.wordChainDefinition}
          howToPlay={gameMeta.howToPlay}
          players={state.players}
        />
      )
    case 'auction':
      return <AuctionGame socket={session.socket} roundKey={roundKey} startSignal={session.auctionStart} howToPlay={gameMeta.howToPlay} />
    case 'colorMatch':
      return (
        <ColorMatchGame socket={session.socket} roundKey={roundKey} startSignal={session.colorMatchStart} howToPlay={gameMeta.howToPlay} />
      )
    case 'pixelCanvas':
      return (
        <PixelCanvasGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.pixelCanvasStart}
          playerId={session.playerId}
          players={state.players}
          howToPlay={gameMeta.howToPlay}
        />
      )
    case 'balloonPop':
      return (
        <BalloonPopGame socket={session.socket} roundKey={roundKey} startSignal={session.balloonPopStart} howToPlay={gameMeta.howToPlay} />
      )
    case 'mouseHunter':
      return (
        <MouseHunterGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.mouseHunterStart}
          howToPlay={gameMeta.howToPlay}
          players={state.players}
        />
      )
    case 'scavengerHunt':
      return (
        <ScavengerHuntGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.scavengerHuntStart}
          howToPlay={gameMeta.howToPlay}
        />
      )
    default:
      return null
  }
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
        gameMeta && renderGame(session, roundKey, gameMeta)
      )}
    </section>
  )
}
