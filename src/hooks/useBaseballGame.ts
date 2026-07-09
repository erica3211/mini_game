import { useCallback, useState } from 'react'
import { judge, markGuess, type JudgeResult, type Mark } from '../lib/baseball'

export const MAX_ATTEMPTS = 5

export type GameStatus = 'playing' | 'won' | 'lost' | 'finish'

export interface GuessRecord extends JudgeResult {
  guess: string[]
  marks: Mark[]
}

/** 정답 생성 함수를 받아 숫자/한글 공용으로 쓰는 게임 상태 훅 */
export function useBaseballGame(generateAnswer: () => string[], submitCount: number) {
  const [answer, setAnswer] = useState<string[]>(() => {
    const saved = localStorage.getItem('current_answer');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return generateAnswer();
      }
    }
    return generateAnswer();
  });

  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('game_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [status, setStatus] = useState<GameStatus>(() => {
    // 로컬 스토리지에 저장된 상태가 있는지 확인
    const savedStatus = localStorage.getItem('game_status') as GameStatus | null;

    if (savedStatus) return savedStatus;

    // 진입 시점에 이미 오늘 3번 다 채웠다면 무조건 'finish'
    if (submitCount >= 3) return 'finish';

    // 그렇지 않다면 기존 저장된 게임 상태가 있는지 확인
    return 'playing';
  });

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
    localStorage.removeItem('game_status');
    localStorage.removeItem('game_history');

    setAnswer(generateAnswer());
    setHistory([]);
    setStatus('playing');
  }, [generateAnswer]);

  return {
    answer,
    history,
    status,
    submitGuess,
    reset,
    attemptsLeft: MAX_ATTEMPTS - history.length,
  }
}
