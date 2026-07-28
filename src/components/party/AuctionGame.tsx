import { useMemo } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuctionRound } from '../../hooks/useAuctionRound'
import { formatWon, signClass } from '../../lib/auctionFormat'
import { pickAuctionFlavors, resolveHintText } from '../../lib/auctionItems'
import {
  AUCTION_ITEM_IDS,
  AUCTION_ROUND_TIMEOUT_MS,
  auctionItemNumber,
  type AuctionItemId,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { budget: number; hint: { itemId: AuctionItemId; text: string }; elapsedMs: number } | null
  howToPlay: string
}

export function AuctionGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const { status, budget, hint, bids, setBid, remaining, submit, rejection, startedAt } = useAuctionRound(
    socket,
    roundKey,
    startSignal,
  )
  // roundKey로 시드를 고정해서, 서버 통신 없이도 모든 참가자가 같은 물품 4종(전부 다른 종류)을 보게 한다
  const flavors = useMemo(() => pickAuctionFlavors(roundKey), [roundKey])

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && (
        <>
          {startedAt !== null && status === 'running' && (
            <RemainingTime startedAt={startedAt} timeoutMs={AUCTION_ROUND_TIMEOUT_MS} />
          )}

          {hint && (
            <div className="party-auction-hint-card">
              <span className="party-auction-hint-label">
                🔍 나만 보이는 힌트 — {auctionItemNumber(hint.itemId)}. {flavors[hint.itemId].name}
              </span>
              <p className="party-auction-hint-text">{resolveHintText(hint.text, flavors)}</p>
            </div>
          )}

          <div className="party-auction-budget-bar">
            남은 예산 <strong className={signClass(remaining)}>{formatWon(remaining)}</strong> / {formatWon(budget)}
          </div>

          <div className="party-auction-item-grid">
            {AUCTION_ITEM_IDS.map((itemId) => (
              <div className="party-auction-item-card" key={itemId}>
                <img className="party-auction-item-image" src={flavors[itemId].image} alt={flavors[itemId].name} />
                <div className="party-auction-item-header">
                  <span className="party-auction-item-label">
                    {auctionItemNumber(itemId)}. {flavors[itemId].name}
                  </span>
                  {hint?.itemId === itemId && <span className="party-auction-item-hint-badge">힌트 보유</span>}
                </div>
                {/* max를 예산으로 고정해야 한다 — 다른 물품에 걸린 금액에 따라 매번 다시 계산하면(remaining 기반)
                    슬라이더를 하나만 움직여도 다른 슬라이더들의 max가 같이 바뀌면서 다같이 움직이는 것처럼 보인다.
                    실제 상한선 강제는 setBid의 클램프 로직만으로 충분하다 */}
                <input
                  type="range"
                  className="party-auction-item-slider"
                  min={0}
                  max={budget}
                  step={10}
                  value={bids[itemId]}
                  disabled={status !== 'running'}
                  onChange={(e) => setBid(itemId, Number(e.target.value))}
                />
                <div className="party-auction-item-amount">{formatWon(bids[itemId])}</div>
              </div>
            ))}
          </div>

          {rejection && <p className="party-auction-rejection">{rejection}</p>}

          {status === 'running' ? (
            <button type="button" className="btn btn-primary" onClick={submit}>
              베팅 확정
            </button>
          ) : (
            <p className="party-round-hint">제출 완료! 다른 사람들을 기다리는 중...</p>
          )}
        </>
      )}
    </div>
  )
}
