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

  const generateUniqueAnswer = useCallback(() => {
    const savedTodayAnswers = localStorage.getItem('today_answers');
    const todayAnswersList: string[][] = savedTodayAnswers ? JSON.parse(savedTodayAnswers) : [];
    
    let newAnswer = generateAnswer();
    let attempts = 0;

    // 새로 뽑은 단어가 오늘 이미 풀었던 단어 목록에 있으면 최대 10번 재시도
    while (
      todayAnswersList.some(savedAns => JSON.stringify(savedAns) === JSON.stringify(newAnswer)) && 
      attempts < 10
    ) {
      newAnswer = generateAnswer();
      attempts++;
    }
    
    return newAnswer;
  }, [generateAnswer]);

  const [answer, setAnswer] = useState<string[]>(() => {
    const saved = localStorage.getItem('current_answer');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return generateUniqueAnswer();
      }
    }
    return generateUniqueAnswer();
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

    // 진입 시점에 이미 오늘 3번 다 채웠다면 무조건 'lost'
    if (submitCount >= 3) return 'lost';

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
    localStorage.removeItem('current_answer');

    setAnswer(generateUniqueAnswer());
    setHistory([]);
    setStatus('playing');
  }, [generateUniqueAnswer]);

  return {
    answer,
    history,
    status,
    submitGuess,
    reset,
    attemptsLeft: MAX_ATTEMPTS - history.length,
  }
}
