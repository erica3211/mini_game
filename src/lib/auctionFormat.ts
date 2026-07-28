export const formatWon = (amount: number) => `${amount.toLocaleString()}만원`

export const signClass = (amount: number) =>
  amount < 0 ? 'party-auction-value-negative' : amount > 0 ? 'party-auction-value-positive' : ''
