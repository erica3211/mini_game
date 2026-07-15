// 블랙잭 카드/덱/점수 계산 및 스테이지·아이템 정의

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦'
}

/** 새 52장 덱을 만들어 셔플까지 마친 상태로 반환 */
export function createShuffledDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** 카드 조합의 블랙잭 점수. A는 버스트 나지 않는 선에서 11로 계산 */
export function calculateScore(cards: Card[]): number {
  let total = 0
  let aceCount = 0
  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount += 1
      total += 11
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === '10') {
      total += 10
    } else {
      total += Number(card.rank)
    }
  }
  while (total > 21 && aceCount > 0) {
    total -= 10
    aceCount -= 1
  }
  return total
}

export type StageAbilityTag = 'none' | 'pokerface' | 'fog' | 'steal'

export interface StageConfig {
  id: number
  dealerName: string
  abilityName: string
  description: string
  dealerStandThreshold: number
  ability: StageAbilityTag
}

export const STAGES: StageConfig[] = [
  {
    id: 1,
    dealerName: '초보 딜러👶',
    abilityName: '없음',
    description: '특수 능력이 없는 평범한 딜러입니다. 기본 블랙잭 규칙으로 가볍게 승리하세요!',
    dealerStandThreshold: 17,
    ability: 'none',
  },
  {
    id: 2,
    dealerName: '안경잡이 딜러🧐',
    abilityName: '철벽 방어',
    description:
      '16점이 아니라 17점 이하일 때까지 카드를 받습니다. 위험을 감수하는 타입이라 스스로 버스트될 확률이 높지만, 메이드 되면 점수가 높습니다.',
    dealerStandThreshold: 18,
    ability: 'none',
  },
  {
    id: 3,
    dealerName: '피도 눈물도 없는 타짜😈',
    abilityName: '포커페이스',
    description:
      '타짜의 완벽한 포커페이스 앞에서는 아무것도 예측할 수 없습니다. 원래 딜러의 카드 1장은 오픈되어야 하지만, 이 판에서는 딜러의 카드 2장이 모두 숨겨진 채로 진행됩니다.',
    dealerStandThreshold: 17,
    ability: 'pokerface',
  },
  {
    id: 4,
    dealerName: '앵무새를 든 선장🦜',
    abilityName: '안개 자욱한 테이블',
    description:
      '플레이어의 첫 번째 카드를 앵무새가 가려버립니다. 내 카드 1장이 무엇인지 보이지 않는 상태에서 감으로 HIT/STAND를 결정해야 합니다.',
    dealerStandThreshold: 17,
    ability: 'fog',
  },
  {
    id: 5,
    dealerName: '카지노 회장👑',
    abilityName: '절대 권력 - 바꿔치기',
    description:
      '플레이어가 카드를 뽑을 때마다, 15% 확률로 회장이 그 카드를 뺏어가서 자기 패에 넣고 플레이어에게는 다음 카드를 줍니다.',
    dealerStandThreshold: 17,
    ability: 'steal',
  },
]

export type ItemId = 'xray' | 'pickpocket' | 'insurance' | 'counter' | 'emergency'

export interface ItemConfig {
  id: ItemId
  emoji: string
  name: string
  price: number
  description: string
  /** manual: 인벤토리에서 클릭해 즉시 발동 / passive: 조건 충족 시 자동 발동 */
  activation: 'manual' | 'passive'
}

export const ITEMS: ItemConfig[] = [
  {
    id: 'xray',
    emoji: '🔮',
    name: '딜러 투시경',
    price: 200,
    description: '이번 판 동안 딜러의 숨겨진 카드를 미리 봅니다. (4단계에서는 내 가려진 카드도 함께 보입니다)',
    activation: 'manual',
  },
  {
    id: 'pickpocket',
    emoji: '🃏',
    name: '소매치기 기술',
    price: 300,
    description: '방금 뽑은 카드를 버리고 덱에서 새 카드를 다시 받습니다.',
    activation: 'manual',
  },
  {
    id: 'insurance',
    emoji: '🛡️',
    name: '반쪽짜리 보험',
    price: 300,
    description: '이번 판에서 버스트되거나 패배해도, 잃는 배팅 금액의 80%를 돌려받습니다.',
    activation: 'manual',
  },
  {
    id: 'counter',
    emoji: '🧮',
    name: '카운팅 계산기',
    price: 400,
    description: '덱에서 다음에 나올 카드 3장을 미리 텍스트로 보여줍니다.',
    activation: 'manual',
  },
  {
    id: 'emergency',
    emoji: '🩹',
    name: '긴급 수술 키트',
    price: 500,
    description: '내 점수가 21을 넘는 순간 자동으로 발동해, 점수를 21로 고정하고 강제로 스탠드시킵니다. (판당 최대 1회)',
    activation: 'passive',
  },
]

export function cardLabel(card: Card): string {
  return `${card.suit}${card.rank}`
}

export function formatCards(cards: Card[]): string {
  return cards.map(cardLabel).join(', ')
}

export type RoundResult = 'win' | 'lose' | 'push'

export interface RoundOutcome {
  result: RoundResult
  moneyDelta: number
  summary: string
}

/**
 * 점수 비교로 승패를 정하고 손익을 계산한다.
 * 배팅금은 거는 시점엔 차감되지 않고, 여기서 계산된 순손익만 소지금에 반영된다.
 */
export function resolveRound(
  playerScore: number,
  dealerScore: number,
  bet: number,
  insuranceActive: boolean,
): RoundOutcome {
  let result: RoundResult
  if (playerScore > 21) result = 'lose'
  else if (dealerScore > 21) result = 'win'
  else if (playerScore > dealerScore) result = 'win'
  else if (playerScore < dealerScore) result = 'lose'
  else result = 'push'

  const deltaByResult: Record<RoundResult, number> = { win: bet, push: 0, lose: -bet }

  let delta = deltaByResult[result]
  if (delta < 0 && insuranceActive) {
    delta = Math.round(delta * 0.2)
  }

  const summary = buildRoundSummary(result, delta)
  return { result, moneyDelta: delta, summary }
}

function buildRoundSummary(result: RoundResult, delta: number): string {
  if (result === 'win') return `승리! ${delta.toLocaleString()}원을 획득했습니다.`
  if (result === 'lose') return `패배... ${(-1 * delta).toLocaleString()}원을 잃었습니다.`
  return delta === 0 ? '무승부! 승부가 나지 않았습니다.' : `무승부지만 ${delta}원이 정산되었습니다.`
}
