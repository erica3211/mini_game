import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 경매: 물품 식별자 (항상 4개, A~D 고정 라벨 — 실제 정체는 없고 미스터리 박스로 취급)
export type AuctionItemId = 'A' | 'B' | 'C' | 'D'

// 경매: 라운드 종료 후 결과 화면에 공개하는 물품별 상세 (RoundResult.meta로 전달됨)
export interface AuctionItemResult {
  itemId: AuctionItemId
  /** 물품의 실제 가치 (마이너스 가능, 단위: 만원) */
  value: number
  /** 낙찰자. 아무도 안 썼거나 최고가가 동점이면 유찰 */
  winnerPlayerId: PlayerId | null
  /** 전원 공개용 — 이 물품에 각자 얼마씩 베팅했는지 */
  bids: Record<PlayerId, number>
}

export interface AuctionRoundMeta {
  items: AuctionItemResult[]
}
export const AUCTION_ITEM_IDS: AuctionItemId[] = ['A', 'B', 'C', 'D']
// 화면에는 A~D 대신 사람이 말하기 쉬운 1~4번으로 물품을 표시한다
export const auctionItemNumber = (itemId: AuctionItemId) => AUCTION_ITEM_IDS.indexOf(itemId) + 1
export const AUCTION_STARTING_BUDGET = 1000
export const AUCTION_ROUND_TIMEOUT_MS = 90_000
