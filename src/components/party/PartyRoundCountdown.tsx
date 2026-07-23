import { useEffect, useState } from 'react'
import { ROUND_COUNTDOWN_MS } from '../../lib/partyProtocol'
import type { GameSession } from '../../hooks/useGameSession'

interface Props {
  session: GameSession
}

export function PartyRoundCountdown({ session }: Props) {
  const state = session.roomState!
  const [count, setCount] = useState(3)
  const [anchor, setAnchor] = useState<number | null>(null)
  const gameMeta = state.gameCatalog.find((g) => g.id === state.currentGameId)

  // 새 라운드로 넘어가면 앵커를 초기화한다
  useEffect(() => {
    setAnchor(null)
  }, [state.currentRoundIndex])

  useEffect(() => {
    const candidate = performance.now() - state.countdownElapsedMs
    // 백그라운드에 있던 동안 밀려있던 예전(=더 적게 흐른) 상태가 뒤늦게 도착해도
    // 이미 알고 있는 것보다 더 늦게 시작한 것으로는 절대 되돌리지 않는다
    setAnchor((prev) => (prev !== null && candidate > prev ? prev : candidate))
  }, [state.countdownElapsedMs, state.currentRoundIndex])

  useEffect(() => {
    if (anchor === null) return
    const tick = () => {
      const remaining = ROUND_COUNTDOWN_MS - (performance.now() - anchor)
      setCount(Math.min(3, Math.max(0, Math.ceil(remaining / 1000))))
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [anchor])

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
