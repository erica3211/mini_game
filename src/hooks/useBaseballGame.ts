import { useCallback, useState } from 'react'
import { judge, markGuess, type JudgeResult, type Mark } from '../lib/baseball'

export const MAX_ATTEMPTS = 5

export type GameStatus = 'playing' | 'won' | 'lost'

export interface GuessRecord extends JudgeResult {
  guess: string[]
  marks: Mark[]
}

/** 정답 생성 함수를 받아 숫자/한글 공용으로 쓰는 게임 상태 훅 */
export function useBaseballGame(generateAnswer: () => string[]) {
  const [answer, setAnswer] = useState(generateAnswer)
  const [history, setHistory] = useState<GuessRecord[]>([])
  const [status, setStatus] = useState<GameStatus>('playing')

  const submitGuess = useCallback(
    (guess: string[]) => {
      if (status !== 'playing') return
      const result = judge(answer, guess)
      const nextHistory = [...history, { guess, marks: markGuess(answer, guess), ...result }]
      setHistory(nextHistory)
      if (result.strike === answer.length) setStatus('won')
      else if (nextHistory.length >= MAX_ATTEMPTS) setStatus('lost')
    },
    [answer, history, status],
  )

  const reset = useCallback(() => {
    setAnswer(generateAnswer())
    setHistory([])
    setStatus('playing')
  }, [generateAnswer])

  return {
    answer,
    history,
    status,
    submitGuess,
    reset,
    attemptsLeft: MAX_ATTEMPTS - history.length,
  }
}
