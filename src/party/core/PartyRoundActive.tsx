import type { GameSession } from './useGameSession'
import { RulesBox } from '../../shared/components/RulesBox'
import { AcrosticGame } from '../games/acrostic/AcrosticGame'
import { AuctionGame } from '../games/auction/AuctionGame'
import { BalloonPopGame } from '../games/balloonPop/BalloonPopGame'
import { CatchmindGame } from '../games/catchmind/CatchmindGame'
import { ColorMatchGame } from '../games/colorMatch/ColorMatchGame'
import { HumanTimerGame } from '../games/humanTimer/HumanTimerGame'
import { LiarQuizGame } from '../games/liarQuiz/LiarQuizGame'
import { MinorityGame } from '../games/minority/MinorityGame'
import { FindOddGame } from '../games/findOdd/FindOddGame'
import { StroopGame } from '../games/stroop/StroopGame'
import { MouseHunterGame } from '../games/mouseHunter/MouseHunterGame'
import { OneToTwentyFiveGame } from '../games/oneToTwentyFive/OneToTwentyFiveGame'
import { PartyExitToLobbyButton } from './PartyExitToLobbyButton'
import { PartyTeamBanner } from './PartyTeamBanner'
import { PixelCanvasGame } from '../games/pixelCanvas/PixelCanvasGame'
import { ScavengerHuntGame } from '../games/scavengerHunt/ScavengerHuntGame'
import { ShoutRaceGame } from '../games/shoutRace/ShoutRaceGame'
import { CharacterDescribeGame } from '../games/characterDescribe/CharacterDescribeGame'
import { MazeEscapeGame } from '../games/mazeEscape/MazeEscapeGame'
import { EmojiCharadesGame } from '../games/emojiCharades/EmojiCharadesGame'
import { FourCharsGame } from '../games/fourChars/FourCharsGame'
import { SimonGame } from '../games/simon/SimonGame'
import { TelepathyGame } from '../games/telepathy/TelepathyGame'
import { TelestrationGame } from '../games/telestration/TelestrationGame'
import { TypeRaceGame } from '../games/typeRace/TypeRaceGame'
import { WordChainGame } from '../games/wordChain/WordChainGame'

interface Props {
  session: GameSession
}

/** 현재 라운드의 게임 화면 하나를 고른다. gameId마다 게임 모듈이 필요로 하는 startSignal 등 개인화된 props가 달라서 분기가 필요하다 */
function renderGame(session: GameSession, roundKey: string) {
  const state = session.roomState!
  switch (state.currentGameId) {
    case 'humanTimer':
      return (
        <HumanTimerGame socket={session.socket} roundKey={roundKey} startSignal={session.humanTimerStart} />
      )
    case 'oneToTwentyFive':
      return (
        <OneToTwentyFiveGame socket={session.socket} roundKey={roundKey} startSignal={session.oneToTwentyFiveStart} />
      )
    case 'wordChain':
      return (
        <WordChainGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.wordChainStart}
          category={session.wordChainCategory}
          definition={session.wordChainDefinition}
          players={state.players}
        />
      )
    case 'auction':
      return <AuctionGame socket={session.socket} roundKey={roundKey} startSignal={session.auctionStart} />
    case 'colorMatch':
      return (
        <ColorMatchGame socket={session.socket} roundKey={roundKey} startSignal={session.colorMatchStart} />
      )
    case 'pixelCanvas':
      return (
        <PixelCanvasGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.pixelCanvasStart}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'balloonPop':
      return (
        <BalloonPopGame socket={session.socket} roundKey={roundKey} startSignal={session.balloonPopStart} />
      )
    case 'stroop':
      return (
        <StroopGame
          socket={session.socket}
          roundKey={roundKey}
          signal={session.stroopQuestion}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'findOdd':
      return (
        <FindOddGame
          socket={session.socket}
          roundKey={roundKey}
          signal={session.findOddRound}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'mouseHunter':
      return (
        <MouseHunterGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.mouseHunterStart}
          players={state.players}
        />
      )
    case 'scavengerHunt':
      return (
        <ScavengerHuntGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.scavengerHuntStart}
        />
      )
    case 'shoutRace':
      return (
        <ShoutRaceGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.shoutRaceStart}
          countdownSignal={session.shoutRaceCountdown}
          goSignal={session.shoutRaceGo}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'catchmind':
      return (
        <CatchmindGame
          socket={session.socket}
          roundKey={roundKey}
          turnStart={session.catchmindTurnStart}
          wordSignal={session.catchmindWord}
          hintLength={session.catchmindHintLength}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
        />
      )
    case 'typeRace':
      return (
        <TypeRaceGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.typeRaceStart}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'telestration':
      return (
        <TelestrationGame
          socket={session.socket}
          roundKey={roundKey}
          task={session.telestrationTask}
          reveal={session.telestrationReveal}
          wordPrompt={session.telestrationWordPrompt}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'telepathy':
      return (
        <TelepathyGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.telepathyStart}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
        />
      )
    case 'minority':
      return (
        <MinorityGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.minorityStart}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'acrostic':
      return (
        <AcrosticGame
          socket={session.socket}
          roundKey={roundKey}
          writeSignal={session.acrosticWrite}
          voteSignal={session.acrosticVote}
        />
      )
    case 'liarQuiz':
      return (
        <LiarQuizGame
          socket={session.socket}
          roundKey={roundKey}
          composeSignal={session.liarQuizCompose}
          writeSignal={session.liarQuizWrite}
          guessSignal={session.liarQuizGuess}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'simon':
      return (
        <SimonGame
          socket={session.socket}
          roundKey={roundKey}
          startSignal={session.simonStart}
          playerId={session.playerId}
          players={state.players}
        />
      )
    case 'fourChars':
      return (
        <FourCharsGame
          socket={session.socket}
          roundKey={roundKey}
          turnSignal={session.fourCharsTurn}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
        />
      )
    case 'emojiCharades':
      return (
        <EmojiCharadesGame
          socket={session.socket}
          roundKey={roundKey}
          state={session.emojiCharades}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
        />
      )
    case 'characterDescribe':
      return (
        <CharacterDescribeGame
          socket={session.socket}
          roundKey={roundKey}
          state={session.characterDescribe}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
        />
      )
    case 'mazeEscape':
      return (
        <MazeEscapeGame
          socket={session.socket}
          roundKey={roundKey}
          state={session.mazeEscape}
          playerId={session.playerId}
          players={state.players}
          teams={state.teams}
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
    <section className="game-page game-page-fill">
      <div>
        <PartyExitToLobbyButton session={session} />  
      </div>
      <div className="party-page-header">
        <h1 className="page-title">
          라운드 {state.currentRoundIndex + 1} / {state.config.totalRounds}
        </h1>
      </div>
      <p className="page-subtitle">{gameMeta ? `${gameMeta.emoji} ${gameMeta.title}` : '게임 준비 중...'}</p>

      {!isParticipating ? (
        <p className="party-round-hint">이미 게임이 진행중이라 참여할 수 없어요. 다음 라운드부터 참여 가능해요.</p>
      ) : (
        gameMeta && (
          <>
            <PartyTeamBanner
              teams={state.teams}
              playerId={session.playerId}
              nicknameOf={(id) => state.players.find((p) => p.id === id)?.nickname ?? '???'}
            />
            {renderGame(session, roundKey)}
            <RulesBox summary={gameMeta.howToPlay} />
          </>
        )
      )}
    </section>
  )
}
