import type { GameStatus } from '../hooks/useBaseballGame'

interface Props {
  status: GameStatus
  answer: string[]
  /** 정답 표시 문구. 생략하면 answer를 공백으로 이어 보여준다 */
  answerLabel?: string
  attemptsLeft: number
  onReset: () => void
}

export function GameStatusBanner({ status, answer, answerLabel, attemptsLeft, onReset }: Props) {
  if (status === 'playing') {
    return (
      <p className="attempts">
        남은 기회 <strong>{attemptsLeft}</strong>번
      </p>
    )
  }
  return (
    <div className={`banner ${status === 'won' ? 'banner-won' : 'banner-lost'}`}>
      <p className="banner-title">{status === 'won' ? '정답! 🎉' : '실패! 😢'}</p>
      <p className="banner-answer">
        정답은 <strong>{answerLabel ?? answer.join(' ')}</strong>
      </p>
      <button type="button" className="btn btn-primary" onClick={onReset}>
        다시 하기
      </button>
    </div>
  )
}
