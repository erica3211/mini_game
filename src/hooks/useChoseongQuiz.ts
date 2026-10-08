import { useCallback, useEffect, useRef, useState } from 'react'
import {
  WORD_CHAIN_CATEGORY_REVEAL_MS,
  WORD_CHAIN_DEFINITION_REVEAL_MS,
  WORD_CHAIN_ROUND_TIMEOUT_MS,
} from '../lib/partyProtocol'
import { readBestScore, scoreForElapsed, writeBestScore } from '../lib/soloScore'

export const CHOSEONG_QUIZ_QUESTION_COUNT = 10
const SHAKE_DURATION_MS = 300
// 한글 IME에서 Enter 한 번이 keydown을 두 번 내보내는 브라우저가 있어, 정답 직후 '다음 문제'가 같이 눌리지 않게 막는 시간
const NEXT_GUARD_MS = 500
const BEST_SCORE_KEY = 'choseong_best_score'

export interface ChoseongQuizItem {
  word: string
  category: string
  definition: string
  chosung: string[]
}

export interface ChoseongQuestionResult {
  word: string
  correct: boolean
  elapsedMs: number | null
  score: number
}

export type ChoseongQuizPhase = 'loading' | 'error' | 'ready' | 'playing' | 'revealed' | 'finished'
/** 0: 초성만, 1: 카테고리까지, 2: 뜻까지 공개 */
type HintLevel = 0 | 1 | 2

const normalize = (text: string) => text.replace(/\s+/g, '')

/**
 * 혼자 하는 초성퀴즈 상태 훅. 문제 세트는 백엔드에서 한 번에 받아오고, 정답 판정·타이머·점수는 전부 클라이언트에서 처리한다.
 * 문제당 제한시간과 힌트 공개 시점은 파티 초성퀴즈(wordChain) 상수를 그대로 쓴다
 */
export function useChoseongQuiz() {
  const [loadKey, setLoadKey] = useState(0)
  const [phase, setPhase] = useState<ChoseongQuizPhase>('loading')
  const [items, setItems] = useState<ChoseongQuizItem[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<ChoseongQuestionResult[]>([])
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const [guess, setGuess] = useState('')
  const [isWrong, setIsWrong] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [bestScore, setBestScore] = useState(() => readBestScore(BEST_SCORE_KEY))
  const [isNewBest, setIsNewBest] = useState(false)
  const revealedAtRef = useRef(0)
  const shakeTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    const url = `${import.meta.env.VITE_SOCKET_URL as string}/solo/word-chain?count=${CHOSEONG_QUIZ_QUESTION_COUNT}`
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ChoseongQuizItem[]>
      })
      .then((data) => {
        setItems(data)
        setIndex(0)
        setStartedAt(null)
        setResults([])
        setIsNewBest(false)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('초성퀴즈 문제를 불러오지 못했습니다:', error)
        setPhase('error')
      })
    return () => controller.abort()
  }, [loadKey])

  const current = items[index] as ChoseongQuizItem | undefined

  /** 현재 문제를 끝낸다. 타이머와 정답 제출이 거의 동시에 들어와도 문제당 결과는 한 번만 기록된다 */
  const resolveQuestion = useCallback(
    (correct: boolean, elapsedMs: number | null) => {
      if (!current) return
      setResults((prev) =>
        prev.length > index
          ? prev
          : [...prev, { word: current.word, correct, elapsedMs, score: correct && elapsedMs !== null ? scoreForElapsed(elapsedMs, WORD_CHAIN_ROUND_TIMEOUT_MS) : 0 }],
      )
      revealedAtRef.current = performance.now()
      setPhase('revealed')
    },
    [current, index],
  )

  /** 시작 시각을 렌더 전에 같이 바꿔둬야 남은 시간 표시가 이전 문제 값으로 한 프레임 깜빡이지 않는다 */
  const beginQuestion = useCallback((nextIndex: number) => {
    setIndex(nextIndex)
    setStartedAt(performance.now())
    setHintLevel(0)
    setGuess('')
    setPhase('playing')
  }, [])

  // 문제가 바뀔 때마다 힌트 공개·시간 초과 타이머를 새로 건다. 문제가 끝나면(phase 변경) cleanup으로 모두 해제된다
  useEffect(() => {
    if (phase !== 'playing') return
    const timers = [
      window.setTimeout(() => setHintLevel(1), WORD_CHAIN_CATEGORY_REVEAL_MS),
      window.setTimeout(() => setHintLevel(2), WORD_CHAIN_DEFINITION_REVEAL_MS),
      window.setTimeout(() => resolveQuestion(false, null), WORD_CHAIN_ROUND_TIMEOUT_MS),
    ]
    return () => timers.forEach(window.clearTimeout)
    // resolveQuestion은 index가 바뀔 때만 바뀌므로, 같은 문제 안에서 타이머가 다시 걸리지 않는다
  }, [phase, index, resolveQuestion])

  useEffect(
    () => () => {
      if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current)
    },
    [],
  )

  const start = useCallback(() => {
    if (phase === 'ready') beginQuestion(0)
  }, [phase, beginQuestion])

  const submit = useCallback(() => {
    if (phase !== 'playing' || !current || startedAt === null) return
    const normalized = normalize(guess)
    if (!normalized) return
    if (normalized === current.word) {
      resolveQuestion(true, performance.now() - startedAt)
      return
    }
    setGuess('')
    setIsWrong(true)
    if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current)
    shakeTimeoutRef.current = window.setTimeout(() => setIsWrong(false), SHAKE_DURATION_MS)
  }, [phase, current, startedAt, guess, resolveQuestion])

  const pass = useCallback(() => {
    if (phase === 'playing') resolveQuestion(false, null)
  }, [phase, resolveQuestion])

  const next = useCallback(() => {
    if (phase !== 'revealed' || performance.now() - revealedAtRef.current < NEXT_GUARD_MS) return
    if (index + 1 < items.length) {
      beginQuestion(index + 1)
      return
    }
    const total = results.reduce((sum, r) => sum + r.score, 0)
    if (total > bestScore) {
      writeBestScore(BEST_SCORE_KEY, total)
      setBestScore(total)
      setIsNewBest(true)
    }
    setPhase('finished')
  }, [phase, index, items.length, results, bestScore, beginQuestion])

  const restart = useCallback(() => setLoadKey((key) => key + 1), [])

  return {
    phase,
    current,
    index,
    total: items.length,
    results,
    lastResult: results[index] as ChoseongQuestionResult | undefined,
    totalScore: results.reduce((sum, r) => sum + r.score, 0),
    bestScore,
    isNewBest,
    hintLevel,
    guess,
    setGuess,
    isWrong,
    startedAt,
    start,
    submit,
    pass,
    next,
    restart,
  }
}
