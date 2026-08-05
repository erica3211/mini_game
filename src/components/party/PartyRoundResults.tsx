import { useState } from 'react'
import type { GameSession } from '../../hooks/useGameSession'
import { formatWon, signClass } from '../../lib/auctionFormat'
import { pickAuctionFlavors } from '../../lib/auctionItems'
import { colorMatchGradeOf, rgbToCss } from '../../lib/colorMath'
import {
  auctionItemNumber,
  type AuctionRoundMeta,
  type BalloonPopRoundMeta,
  type ColorMatchRoundMeta,
  type PixelCanvasRoundMeta,
  type ScavengerHuntRoundMeta,
} from '../../lib/partyProtocol'
import { PartyScoreList } from './PartyScoreList'
import { PartySubRoundCarousel } from './PartySubRoundCarousel'
import { PartySubRoundPager } from './PartySubRoundPager'
import { PixelCanvasSnapshot } from './PixelCanvasSnapshot'

interface Props {
  session: GameSession
}

export function PartyRoundResults({ session }: Props) {
  const state = session.roomState!
  const lastRound = state.roundHistory[state.roundHistory.length - 1]
  // colorMatch/scavengerHunt처럼 서브라운드가 여러 개인 게임의 결과를 한 번에 하나씩만 보여줄 때 쓰는 페이지
  // 인덱스 — 라운드마다 이 컴포넌트가 새로 마운트되므로(phase가 round_active로 나갔다 돌아옴) 항상 1라운드로 초기화된다
  const [subRoundPage, setSubRoundPage] = useState(0)
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
  const scavengerHuntMeta =
    lastRound.gameId === 'scavengerHunt' ? (lastRound.meta as ScavengerHuntRoundMeta | undefined) : undefined

  const detailOf = (entry: (typeof lastRound.ranking)[number]) => {
    if (entry.disconnected) return ' (연결 끊김)'
    if (lastRound.gameId === 'oneToFifty' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}개 터치)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완료)`
    }
    if (lastRound.gameId === 'shoutRace' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}% 도달)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완주)`
    }
    // 픽셀 캔버스는 oneToFifty처럼 dnf(한 칸도 못 칠함)여도 차지한 칸 수를 그대로 보여준다
    if (lastRound.gameId === 'pixelCanvas' && entry.value !== undefined) {
      return ` (${entry.value}칸 차지)`
    }
    // 쥐 세 끼도 pixelCanvas처럼 연속 동작이라 dnf(한 마리도 못 잡음)여도 잡은 수를 그대로 보여준다
    if (lastRound.gameId === 'mouseHunter' && entry.value !== undefined) {
      return ` (${entry.value}마리 잡음)`
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
    if (lastRound.gameId === 'scavengerHunt' && entry.value !== undefined) {
      return ` (3라운드 합산 ${entry.value}점)`
    }
    return ''
  }

  const scavengerHuntTargetLabel = (target: { mode: string; object?: { label: string }; color?: { label: string } }) => {
    if (target.mode === 'object' && target.object) return `📦 ${target.object.label}`
    if (target.mode === 'color' && target.color) return `🎨 ${target.color.label}`
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
          <PartySubRoundPager current={subRoundPage} total={colorMatchMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
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
          </PartySubRoundCarousel>
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

      {scavengerHuntMeta && (
        <div className="party-scavengerhunt-reveal">
          <PartySubRoundPager current={subRoundPage} total={scavengerHuntMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {scavengerHuntMeta.subRounds.map((subRound) => (
              <div className="party-scavengerhunt-reveal-item" key={subRound.subRoundIndex}>
                <div className="party-scavengerhunt-reveal-header">
                  <span>{subRound.subRoundIndex + 1}번 문제</span>
                  <span>{scavengerHuntTargetLabel(subRound.target)}</span>
                </div>
                <ul className="party-scavengerhunt-reveal-picks">
                  {Object.entries(subRound.picks)
                    .sort(([, a], [, b]) => b.roundScore - a.roundScore)
                    .map(([playerId, pick]) => (
                      <li key={playerId}>
                        {pick.photo ? (
                          <img src={pick.photo} alt="" className="party-scavengerhunt-reveal-thumb" />
                        ) : (
                          <span className="party-scavengerhunt-reveal-thumb party-scavengerhunt-reveal-thumb-empty">📷</span>
                        )}
                        <span>
                          {nicknameOf(playerId)}: {pick.submitted ? `일치율 ${pick.matchPercent}% · ${pick.roundScore}점` : '미제출 · 0점'}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
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
