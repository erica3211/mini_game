import { useState, type FormEvent } from 'react'
import { generateNumberAnswer } from '../lib/baseball'
import { useBaseballGame } from '../hooks/useBaseballGame'
import { GuessHistory } from '../components/GuessHistory'
import { GameStatusBanner } from '../components/GameStatusBanner'

function validate(value: string): string | null {
  if (!/^\d{3}$/.test(value)) return '숫자 3자리를 입력해주세요.'
  if (new Set(value).size !== 3) return '세 숫자는 모두 달라야 해요.'
  return null
}

export function NumberBaseball() {
  const game = useBaseballGame(generateNumberAnswer, 0);
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const message = validate(input)
    if (message) {
      setError(message)
      return
    }
    game.submitGuess(input.split(''))
    setInput('')
    setError(null)
  }

  const handleReset = () => {
    game.reset()
    setInput('')
    setError(null)
  }

  return (
    <section className="game-page">
      <h1 className="page-title">⚾ 숫자야구</h1>
      <p className="rules">
        서로 다른 숫자로 이루어진 세 자리 수를 맞혀보세요. 숫자와 자리가 모두 맞으면{' '}
        <strong>스트라이크(S)</strong>, 숫자만 있으면 <strong>볼(B)</strong>, 하나도 없으면{' '}
        <strong>아웃(OUT)</strong>! 기회는 5번이에요.
      </p>

      <GameStatusBanner
        status={game.status}
        answer={game.answer}
        attemptsLeft={game.attemptsLeft}
        error={null}
        onReset={handleReset}
      />

      {game.status === 'playing' && (
        <form className="guess-form" onSubmit={handleSubmit}>
          <input
            className="guess-input"
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="예: 123"
            value={input}
            onChange={(event) => {
              setInput(event.target.value.replace(/\D/g, ''))
              setError(null)
            }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            던지기!
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <GuessHistory history={game.history} />
    </section>
  )
}
