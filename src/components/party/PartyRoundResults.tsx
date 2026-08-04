import type { GameSession } from '../../hooks/useGameSession'
import { formatWon, signClass } from '../../lib/auctionFormat'
import { pickAuctionFlavors } from '../../lib/auctionItems'
import { colorMatchGradeOf, rgbToCss } from '../../lib/colorMath'
import { MOUSE_HUNTER_ROOMS } from '../../lib/mouseHunterRooms'
import { MOUSE_HUNTER_SKIN_IMAGES } from '../../lib/mouseHunterSkins'
import { MOUSE_HUNTER_SPOT_POSITIONS } from '../../lib/mouseHunterSpots'
import {
  auctionItemNumber,
  type AuctionRoundMeta,
  type BalloonPopRoundMeta,
  type ColorMatchRoundMeta,
  type MouseHunterRoundMeta,
  type PixelCanvasRoundMeta,
} from '../../lib/partyProtocol'
import { PartyScoreList } from './PartyScoreList'
import { PixelCanvasSnapshot } from './PixelCanvasSnapshot'

interface Props {
  session: GameSession
}

export function PartyRoundResults({ session }: Props) {
  const state = session.roomState!
  const lastRound = state.roundHistory[state.roundHistory.length - 1]
  const nicknameOf = (playerId: string) => state.players.find((p) => p.id === playerId)?.nickname ?? '???'
  const isLastRound = state.currentRoundIndex + 1 >= state.config.totalRounds
  const wordChainMeta =
    lastRound.gameId === 'wordChain'
      ? (lastRound.meta as { word: string; category: string; definition: string } | undefined)
      : undefined
  const auctionMeta = lastRound.gameId === 'auction' ? (lastRound.meta as AuctionRoundMeta | undefined) : undefined
  // 베팅 화면과 같은 roundKey로 시드를 고정해야 그때 봤던 물품 이름/이미지가 결과 화면에서도 그대로 재현된다
  const auctionFlavors = auctionMeta ? pickAuctionFlavors(`${lastRound.roundIndex}-${lastRound.gameId}`) : null
  const colorMatchMeta = lastRound.gameId === 'colorMatch' ? (lastRound.meta as ColorMatchRoundMeta | undefined) : undefined
  const pixelCanvasMeta =
    lastRound.gameId === 'pixelCanvas' ? (lastRound.meta as PixelCanvasRoundMeta | undefined) : undefined
  const balloonPopMeta = lastRound.gameId === 'balloonPop' ? (lastRound.meta as BalloonPopRoundMeta | undefined) : undefined
  const mouseHunterMeta = lastRound.gameId === 'mouseHunter' ? (lastRound.meta as MouseHunterRoundMeta | undefined) : undefined
  // 다른 참가자의 위치는 안 보여주고 내가 찾던 3마리가 어디 있었는지만 공개한다
  const myMouseHunterReveal = mouseHunterMeta?.results.find((r) => r.playerId === session.playerId)

  const detailOf = (entry: (typeof lastRound.ranking)[number]) => {
    if (entry.disconnected) return ' (연결 끊김)'
    if (lastRound.gameId === 'oneToFifty' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}개 터치)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완료)`
    }
    // 픽셀 캔버스는 oneToFifty처럼 dnf(한 칸도 못 칠함)여도 차지한 칸 수를 그대로 보여준다
    if (lastRound.gameId === 'pixelCanvas' && entry.value !== undefined) {
      return ` (${entry.value}칸 차지)`
    }
    // 쥐 세 끼도 oneToFifty처럼 dnf(3마리를 다 못 찾음)여도 몇 마리 찾았는지 그대로 보여준다
    if (lastRound.gameId === 'mouseHunter' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}마리 찾음)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 3마리 완료)`
    }
    if (entry.dnf) return ' (미제출)'
    if (lastRound.gameId === 'humanTimer' && entry.value !== undefined) {
      return ` (${(entry.value / 1000).toFixed(2)}초에 정지)`
    }
    if (lastRound.gameId === 'wordChain' && entry.value !== undefined) {
      return ` (${(entry.value / 1000).toFixed(2)}초 만에 정답)`
    }
    if (lastRound.gameId === 'auction' && entry.value !== undefined) {
      return ` (총자산 ${formatWon(entry.value)})`
    }
    if (lastRound.gameId === 'colorMatch' && entry.value !== undefined) {
      return ` (합산 ${entry.value}점)`
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
      <h1 className="page-title">{state.currentRoundIndex + 1}라운드 결과</h1>

      {wordChainMeta && (
        <div className="party-wordchain-answer">
          <p>
            정답: <strong>{wordChainMeta.word}</strong> ({wordChainMeta.category})
          </p>
          <p className="party-wordchain-answer-definition">{wordChainMeta.definition}</p>
        </div>
      )}

      {auctionMeta && auctionFlavors && (
        <div className="party-auction-reveal">
          {auctionMeta.items.map((item) => (
            <div
              className={`party-auction-reveal-item${item.winnerPlayerId === session.playerId ? ' party-auction-reveal-item-won' : ''}`}
              key={item.itemId}
            >
              <img
                className="party-auction-reveal-image"
                src={auctionFlavors[item.itemId].image}
                alt={auctionFlavors[item.itemId].name}
              />
              <div className="party-auction-reveal-body">
                <div className="party-auction-reveal-header">
                  <span>
                    {auctionItemNumber(item.itemId)}. {auctionFlavors[item.itemId].name}
                  </span>
                  <strong className={signClass(item.value)}>{formatWon(item.value)}</strong>
                </div>
                <p className="party-auction-reveal-winner">
                  {item.winnerPlayerId ? `🏆 낙찰: ${nicknameOf(item.winnerPlayerId)}` : '유찰 (아무도 못 가져감)'}
                </p>
                <ul className="party-auction-reveal-bids">
                  {Object.entries(item.bids)
                    .filter(([, amount]) => amount > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([playerId, amount]) => (
                      <li key={playerId}>
                        {nicknameOf(playerId)}: {formatWon(amount)}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {colorMatchMeta && (
        <div className="party-colormatch-reveal">
          {colorMatchMeta.subRounds.map((subRound) => (
            <div className="party-colormatch-reveal-item" key={subRound.subRoundIndex}>
              <div className="party-colormatch-reveal-header">
                <span>{subRound.subRoundIndex + 1}번 문제</span>
                <div className="party-colormatch-reveal-answer" style={{ background: rgbToCss(subRound.answerColor) }} />
              </div>
              <ul className="party-colormatch-reveal-picks">
                {Object.entries(subRound.picks)
                  .sort(([, a], [, b]) => b.matchPercent - a.matchPercent)
                  .map(([playerId, pick]) => (
                    <li key={playerId}>
                      <div className="party-colormatch-reveal-pick-color" style={{ background: rgbToCss(pick.color) }} />
                      <span>
                        {nicknameOf(playerId)}: {pick.matchPercent}% ({colorMatchGradeOf(pick.matchPercent)})
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {pixelCanvasMeta && <PixelCanvasSnapshot meta={pixelCanvasMeta} />}

      {balloonPopMeta && (
        <ul className="party-balloonpop-reveal">
          {[...balloonPopMeta.results]
            .sort((a, b) => b.pumps - a.pumps)
            .map((r) => (
              <li key={r.playerId}>
                <span>{nicknameOf(r.playerId)}</span>
                <span className="party-balloonpop-reveal-detail">
                  {r.status === 'popped' && `💥 ${r.pumps}번에서 터짐`}
                  {r.status === 'stopped' && `🛑 ${r.pumps}번에서 멈춤 (사실 ${r.threshold}번까지 버틸 수 있었어요)`}
                  {r.status === 'alive' && '⏱️ 결정 못 함'}
                </span>
              </li>
            ))}
        </ul>
      )}

      {myMouseHunterReveal && (
        <div className="party-mousehunter-reveal">
          {myMouseHunterReveal.mice.map((mouse) => {
            const room = MOUSE_HUNTER_ROOMS.find((r) => r.id === mouse.roomId)!
            const pos = MOUSE_HUNTER_SPOT_POSITIONS[mouse.roomId][mouse.spotId]
            return (
              <div className="party-mousehunter-reveal-item" key={mouse.id}>
                <div className="party-mousehunter-reveal-thumb">
                  <img src={room.image} alt={room.name} />
                  <span className="party-mousehunter-reveal-marker" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                    <img
                      className={`party-mousehunter-reveal-mouse${mouse.facing === 'right' ? ' party-mousehunter-reveal-mouse-flip' : ''}`}
                      src={MOUSE_HUNTER_SKIN_IMAGES[mouse.skin][mouse.variant]}
                      alt="쥐"
                    />
                  </span>
                </div>
                <span className="party-mousehunter-reveal-label">
                  {mouse.found ? '✅' : '❌'} {room.name}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="party-section-title">이번 라운드 점수</h2>
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
