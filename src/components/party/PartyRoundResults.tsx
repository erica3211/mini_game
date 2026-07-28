import type { GameSession } from '../../hooks/useGameSession'
import { formatWon, signClass } from '../../lib/auctionFormat'
import { pickAuctionFlavors } from '../../lib/auctionItems'
import { auctionItemNumber, type AuctionRoundMeta } from '../../lib/partyProtocol'
import { PartyScoreList } from './PartyScoreList'

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

  const detailOf = (entry: (typeof lastRound.ranking)[number]) => {
    if (entry.disconnected) return ' (연결 끊김)'
    if (lastRound.gameId === 'oneToFifty' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}개 터치)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완료)`
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
