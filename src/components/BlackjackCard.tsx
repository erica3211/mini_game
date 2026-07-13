import { isRedSuit, type Card } from '../lib/blackjack'

interface Props {
  card?: Card
  hidden?: boolean
  size?: 'md' | 'sm'
}

export function BlackjackCard({ card, hidden, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'bj-card-sm' : ''

  if (hidden || !card) {
    return (
      <div className={`bj-card bj-card-hidden ${sizeClass}`}>
        <span>🂠</span>
      </div>
    )
  }
  return (
    <div className={`bj-card ${sizeClass} ${isRedSuit(card.suit) ? 'bj-card-red' : ''}`}>
      <span className="bj-card-suit">{card.suit}</span>
      <span className="bj-card-rank">{card.rank}</span>
    </div>
  )
}
