import { useEffect, useState } from 'react'
import type { GameSession } from '../../hooks/useGameSession'

interface Props {
  session: GameSession
}

export function PartyRoundCountdown({ session }: Props) {
  const state = session.roomState!
  const [count, setCount] = useState(3)
  const gameMeta = state.gameCatalog.find((g) => g.id === state.currentGameId)

  useEffect(() => {
    setCount(3)
    const interval = setInterval(() => {
      setCount((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [state.currentRoundIndex])

  return (
    <section className="game-page party-countdown">
      <p className="page-subtitle">{gameMeta ? `${gameMeta.emoji} ${gameMeta.title}` : '곧 시작합니다'}</p>
      {count > 0 && (
        <div key={count} className="party-countdown-number">
          {count}
        </div>
      )}

      {gameMeta && (
        <div className="party-howtoplay">
          {/* {gameMeta.howToPlayMediaUrl ? (
            <img className="party-howtoplay-media" src={gameMeta.howToPlayMediaUrl} alt={`${gameMeta.title} 플레이 방법`} />
          ) : (
            <div className="party-howtoplay-media party-howtoplay-media-placeholder">{gameMeta.emoji}</div>
          )} */}
          {gameMeta.howToPlayMediaUrl && (
            <img className="party-howtoplay-media" src={gameMeta.howToPlayMediaUrl} alt={`${gameMeta.title} 플레이 방법`} />
          )}
          <p className="party-howtoplay-text">{gameMeta.howToPlay}</p>
        </div>
      )}
    </section>
  )
}
