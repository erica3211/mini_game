import { useState, type FormEvent } from 'react'
import { generateNumberAnswer } from '../lib/baseball'
import { useBaseballGame } from '../hooks/useBaseballGame'
import { GuessHistory } from '../components/GuessHistory'
import { GameStatusBanner } from '../components/GameStatusBanner'
import { RulesBox } from '../components/RulesBox'

function validate(value: string): string | null {
  if (!/^\d{3}$/.test(value)) return '숫자 3자리를 입력해주세요.'
  if (new Set(value).size !== 3) return '세 숫자는 모두 달라야 해요.'
  return null
}

export function NumberBaseball() {
  const game = useBaseballGame(generateNumberAnswer, 0, 'number');
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
      <RulesBox
        summary={
          <>
            컴퓨터가 생각하는 0부터 9까지의 서로 다른 숫자로 이루어진 세 자리 수를 맞혀보세요. <br/> 숫자와 자리가 모두 맞으면{' '}
            <strong>스트라이크(S)</strong>, 숫자만 있으면 <strong>볼(B)</strong>, 하나도 없으면{' '}
            <strong>아웃(OUT)</strong>! 기회는 5번이에요.
          </>
        }
        example={
          <>
            <p className="rules-example-title">
              예시: 정답이 <strong>583</strong>일 때 <strong>539</strong>를 입력하면?
            </p>
            <table className="rules-example-table">
              <thead>
                <tr>
                  <th>자리</th>
                  <th>정답</th>
                  <th>입력</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>5</td>
                  <td>5</td>
                  <td>
                    <span className="badge badge-strike">S</span> 숫자·자리 모두 일치
                  </td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>8</td>
                  <td>3</td>
                  <td>
                    <span className="badge badge-ball">B</span> 3은 정답에 있지만 3번째 자리
                    숫자예요
                  </td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>3</td>
                  <td>9</td>
                  <td>
                    <span className="badge badge-out">OUT</span> 9는 정답에 없어요
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              → 결과는{' '}
              <span className="badge badge-strike">1S</span>{' '}
              <span className="badge badge-ball">1B</span> (1스트라이크 1볼)로 표시돼요.
            </p>
          </>
        }
      />

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
