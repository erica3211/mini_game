import { useCallback, useEffect, useState } from 'react'
import {
  ITEMS,
  STAGES,
  calculateScore,
  cardLabel,
  createShuffledDeck,
  resolveRound,
  type Card,
  type ItemId,
  type RoundResult,
} from '../lib/blackjack'

export type Phase = 'shop' | 'playing' | 'roundEnd' | 'gameOver' | 'victory'

export interface InventoryItem {
  uid: string
  id: ItemId
}

export interface BlackjackState {
  stage: number
  money: number
  inventory: InventoryItem[]
  bet: number
  deck: Card[]
  playerHand: Card[]
  dealerHand: Card[]
  phase: Phase
  roundResult: RoundResult | null
  message: string
  xrayActive: boolean
  insuranceActive: boolean
}

const STORAGE_KEY = 'blackjack_save'
const STARTING_MONEY = 1000
const MIN_BET = 100
const MAX_INVENTORY = 3

function createInitialState(): BlackjackState {
  return {
    stage: 1,
    money: STARTING_MONEY,
    inventory: [],
    bet: MIN_BET,
    deck: [],
    playerHand: [],
    dealerHand: [],
    phase: 'shop',
    roundResult: null,
    message: '',
    xrayActive: false,
    insuranceActive: false,
  }
}

function loadInitialState(): BlackjackState {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return createInitialState()
  try {
    return { ...createInitialState(), ...JSON.parse(saved) }
  } catch {
    return createInitialState()
  }
}

function currentStage(state: BlackjackState) {
  return STAGES[state.stage - 1]
}

/** 플레이어가 스탠드(혹은 강제 스탠드)했을 때 딜러를 마저 진행시키고 정산한다 */
function resolveAfterStand(state: BlackjackState, emergencyClamped: boolean): BlackjackState {
  const stage = currentStage(state)
  const deck = [...state.deck]
  let dealerHand = [...state.dealerHand]

  const playerScore = emergencyClamped ? 21 : calculateScore(state.playerHand)
  if (playerScore <= 21) {
    while (calculateScore(dealerHand) < stage.dealerStandThreshold && deck.length > 0) {
      dealerHand = [...dealerHand, deck.shift()!]
    }
  }

  const dealerScore = calculateScore(dealerHand)
  const outcome = resolveRound(playerScore, dealerScore, state.bet, state.insuranceActive)
  const money = state.money + outcome.moneyDelta

  if (outcome.result === 'win') {
    if (state.stage >= STAGES.length) {
      return { ...state, deck, dealerHand, money, phase: 'victory', roundResult: outcome.result, message: outcome.summary }
    }
    return {
      ...state,
      deck,
      dealerHand,
      money,
      stage: state.stage + 1,
      phase: 'roundEnd',
      roundResult: outcome.result,
      message: outcome.summary,
    }
  }

  if (money <= 0) {
    return { ...state, deck, dealerHand, money, phase: 'gameOver', roundResult: outcome.result, message: outcome.summary }
  }
  return { ...state, deck, dealerHand, money, phase: 'roundEnd', roundResult: outcome.result, message: outcome.summary }
}

export function useBlackjackGame() {
  const [state, setState] = useState<BlackjackState>(loadInitialState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addBet = useCallback((amount: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev
      const bet = Math.min(prev.money, prev.bet + amount)
      return { ...prev, bet }
    })
  }, [])

  const allIn = useCallback(() => {
    setState((prev) => (prev.phase === 'shop' ? { ...prev, bet: prev.money } : prev))
  }, [])

  const resetBet = useCallback(() => {
    setState((prev) => (prev.phase === 'shop' ? { ...prev, bet: Math.min(MIN_BET, prev.money) } : prev))
  }, [])

  const buyItem = useCallback((id: ItemId) => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev
      const item = ITEMS.find((entry) => entry.id === id)
      if (!item) return prev
      if (prev.inventory.length >= MAX_INVENTORY || prev.money < item.price) return prev
      return {
        ...prev,
        money: prev.money - item.price,
        inventory: [...prev.inventory, { uid: crypto.randomUUID(), id }],
      }
    })
  }, [])

  const startRound = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev
      if (prev.bet < Math.min(MIN_BET, prev.money) || prev.bet > prev.money) return prev
      const deck = createShuffledDeck()
      const playerHand = [deck.shift()!, deck.shift()!]
      const dealerHand = [deck.shift()!, deck.shift()!]
      return {
        ...prev,
        phase: 'playing',
        deck,
        playerHand,
        dealerHand,
        xrayActive: false,
        insuranceActive: false,
        roundResult: null,
        message: '플레이어님의 차례입니다. HIT 또는 STAND를 선택하세요.',
      }
    })
  }, [])

  const hit = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev
      const stage = currentStage(prev)
      const deck = [...prev.deck]
      let playerHand = [...prev.playerHand]
      let dealerHand = [...prev.dealerHand]
      let message = '카드를 받았습니다.'

      const drawn = deck.shift()!
      if (stage.ability === 'steal' && Math.random() < 0.15) {
        dealerHand = [...dealerHand, drawn]
        playerHand = [...playerHand, deck.shift()!]
        message = '🚨 회장이 카드를 가로챘습니다! 다음 카드를 받았습니다.'
      } else {
        playerHand = [...playerHand, drawn]
      }

      const next = { ...prev, deck, playerHand, dealerHand, message }
      if (calculateScore(playerHand) <= 21) return next

      const emergencyIndex = prev.inventory.findIndex((entry) => entry.id === 'emergency')
      if (emergencyIndex === -1) {
        return resolveAfterStand({ ...next, message: '버스트! 21을 초과했습니다.' }, false)
      }
      const inventory = [...prev.inventory]
      inventory.splice(emergencyIndex, 1)
      return resolveAfterStand(
        { ...next, inventory, message: '🩹 긴급 수술 키트가 발동해 점수를 21로 고정했습니다!' },
        true,
      )
    })
  }, [])

  const stand = useCallback(() => {
    setState((prev) => (prev.phase === 'playing' ? resolveAfterStand(prev, false) : prev))
  }, [])

  const useXray = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev
      const index = prev.inventory.findIndex((entry) => entry.id === 'xray')
      if (index === -1) return prev
      const inventory = [...prev.inventory]
      inventory.splice(index, 1)
      return { ...prev, inventory, xrayActive: true, message: '🔮 딜러의 숨겨진 카드를 확인했습니다.' }
    })
  }, [])

  const useInsurance = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev
      const index = prev.inventory.findIndex((entry) => entry.id === 'insurance')
      if (index === -1) return prev
      const inventory = [...prev.inventory]
      inventory.splice(index, 1)
      return { ...prev, inventory, insuranceActive: true, message: '🛡️ 보험이 적용되었습니다.' }
    })
  }, [])

  const usePickpocket = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.playerHand.length === 0) return prev
      const index = prev.inventory.findIndex((entry) => entry.id === 'pickpocket')
      if (index === -1) return prev
      const inventory = [...prev.inventory]
      inventory.splice(index, 1)
      const deck = [...prev.deck]
      const playerHand = prev.playerHand.slice(0, -1)
      playerHand.push(deck.shift()!)
      return { ...prev, inventory, deck, playerHand, message: '🃏 방금 뽑은 카드를 새 카드로 교체했습니다.' }
    })
  }, [])

  const useCounter = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev
      const index = prev.inventory.findIndex((entry) => entry.id === 'counter')
      if (index === -1) return prev
      const inventory = [...prev.inventory]
      inventory.splice(index, 1)
      const preview = prev.deck.slice(0, 3).map(cardLabel).join(', ')
      return { ...prev, inventory, message: `🧮 다음 카드: ${preview}` }
    })
  }, [])

  const continueRound = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: 'shop',
      roundResult: null,
      bet: Math.min(MIN_BET, prev.money),
      playerHand: [],
      dealerHand: [],
      message: '',
    }))
  }, [])

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(createInitialState())
  }, [])

  return {
    state,
    stage: currentStage(state),
    playerScore: calculateScore(state.playerHand),
    dealerScore: calculateScore(state.dealerHand),
    addBet,
    allIn,
    resetBet,
    buyItem,
    startRound,
    hit,
    stand,
    useXray,
    useInsurance,
    usePickpocket,
    useCounter,
    continueRound,
    resetGame,
  }
}
