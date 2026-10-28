import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WORD_CHAIN_CATEGORY_REVEAL_MS,
  WORD_CHAIN_DEFINITION_REVEAL_MS,
  WORD_CHAIN_ROUND_TIMEOUT_MS,
} from '../../party/games/wordChain/protocol'
import { readBestScore, scoreForElapsed, writeBestScore } from '../shared/soloScore'

export const CHOSEONG_QUIZ_QUESTION_COUNT = 10
/** 카테고리를 하나만 골라 처음부터 카테고리 힌트를 보여줄 때 문제당 최대 점수 (전체는 100점) */
export const CHOSEONG_SINGLE_CATEGORY_MAX_SCORE = 70
const SHAKE_DURATION_MS = 300
// 한글 IME에서 Enter 한 번이 keydown을 두 번 내보내는 브라우저가 있어, 정답 직후 '다음 문제'가 같이 눌리지 않게 막는 시간
const NEXT_GUARD_MS = 500
const BEST_SCORE_KEY = 'choseong_best_score'
const SELECTED_CATEGORIES_KEY = 'choseong_categories'
const SOLO_API = `${import.meta.env.VITE_SOCKET_URL as string}/solo/word-chain`

export interface ChoseongQuizItem {
  word: string
  category: string
  definition: string
  chosung: string[]
}

export interface ChoseongCategory {
  category: string
  count: number
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

// 시크릿 창 등에서 localStorage 접근이 막혀도 게임은 그대로 돌아가야 한다
function readSavedCategories(): string[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SELECTED_CATEGORIES_KEY) ?? 'null')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : null
  } catch {
    return null
  }
}

function writeSavedCategories(selected: string[]) {
  try {
    localStorage.setItem(SELECTED_CATEGORIES_KEY, JSON.stringify(selected))
  } catch {
    // 저장 실패는 무시한다 — 이번 선택은 화면에 그대로 반영된다
  }
}

/**
 * 혼자 하는 초성퀴즈 상태 훅. 시작 화면에서 카테고리를 고르면 그 카테고리의 문제 세트를 백엔드에서 한 번에 받아오고,
 * 정답 판정·타이머·점수는 전부 클라이언트에서 처리한다.
 * 문제당 제한시간과 힌트 공개 시점은 파티 초성퀴즈(wordChain) 상수를 그대로 쓴다
 *
 * 카테고리를 하나만 고르면 카테고리 힌트가 처음부터 보이는 대신 점수가 낮아지고,
 * 전체 카테고리로 한 판만 최고기록에 반영된다 (카테고리 조합마다 난이도가 달라 기록 비교가 안 되기 때문)
 */
export function useChoseongQuiz() {
  const [loadKey, setLoadKey] = useState(0)
  const [phase, setPhase] = useState<ChoseongQuizPhase>('loading')
  const [categories, setCategories] = useState<ChoseongCategory[]>([])
  const [selected, setSelected] = useState<string[]>([])
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
  const startControllerRef = useRef<AbortController | null>(null)
  // 이번 판의 규칙 — 시작 시점의 선택으로 정해지고 판이 끝날 때까지 바뀌지 않는다
  const runRef = useRef({ maxScore: 100, initialHint: 0 as HintLevel, isFullSet: true })

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    fetch(`${SOLO_API}/categories`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ChoseongCategory[]>
      })
      .then((data) => {
        const names = new Set(data.map((c) => c.category))
        // 저장된 선택 중 지금도 있는 카테고리만 남기고, 하나도 안 남으면 전체 선택으로 시작한다
        const saved = (readSavedCategories() ?? []).filter((name) => names.has(name))
        setCategories(data)
        setSelected(saved.length > 0 ? saved : data.map((c) => c.category))
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('초성퀴즈 카테고리를 불러오지 못했습니다:', error)
        setPhase('error')
      })
    return () => controller.abort()
  }, [loadKey])

  const current = items[index] as ChoseongQuizItem | undefined

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const candidateCount = useMemo(
    () => categories.filter((c) => selectedSet.has(c.category)).reduce((sum, c) => sum + c.count, 0),
    [categories, selectedSet],
  )
  const allSelected = categories.length > 0 && selected.length === categories.length
  const canStart = candidateCount >= CHOSEONG_QUIZ_QUESTION_COUNT

  const updateSelected = useCallback((next: string[]) => {
    setSelected(next)
    writeSavedCategories(next)
  }, [])

  const toggleCategory = useCallback(
    (category: string) =>
      updateSelected(selected.includes(category) ? selected.filter((name) => name !== category) : [...selected, category]),
    [selected, updateSelected],
  )
  const selectAllCategories = useCallback(() => updateSelected(categories.map((c) => c.category)), [categories, updateSelected])
  const clearCategories = useCallback(() => updateSelected([]), [updateSelected])

  /** 현재 문제를 끝낸다. 타이머와 정답 제출이 거의 동시에 들어와도 문제당 결과는 한 번만 기록된다 */
  const resolveQuestion = useCallback(
    (correct: boolean, elapsedMs: number | null) => {
      if (!current) return
      setResults((prev) =>
        prev.length > index
          ? prev
          : [
              ...prev,
              {
                word: current.word,
                correct,
                elapsedMs,
                score:
                  correct && elapsedMs !== null
                    ? scoreForElapsed(elapsedMs, WORD_CHAIN_ROUND_TIMEOUT_MS, runRef.current.maxScore)
                    : 0,
              },
            ],
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
    setHintLevel(runRef.current.initialHint)
    setGuess('')
    setPhase('playing')
  }, [])

  // 문제가 바뀔 때마다 힌트 공개·시간 초과 타이머를 새로 건다. 문제가 끝나면(phase 변경) cleanup으로 모두 해제된다
  useEffect(() => {
    if (phase !== 'playing') return
    const timers = [
      window.setTimeout(() => setHintLevel((level) => Math.max(level, 1) as HintLevel), WORD_CHAIN_CATEGORY_REVEAL_MS),
      window.setTimeout(() => setHintLevel(2), WORD_CHAIN_DEFINITION_REVEAL_MS),
      window.setTimeout(() => resolveQuestion(false, null), WORD_CHAIN_ROUND_TIMEOUT_MS),
    ]
    return () => timers.forEach(window.clearTimeout)
    // resolveQuestion은 index가 바뀔 때만 바뀌므로, 같은 문제 안에서 타이머가 다시 걸리지 않는다
  }, [phase, index, resolveQuestion])

  useEffect(
    () => () => {
      if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current)
      startControllerRef.current?.abort()
    },
    [],
  )

  /** 고른 카테고리로 문제 세트를 받아와 첫 문제를 시작한다 */
  const start = useCallback(() => {
    if (phase !== 'ready' || !canStart) return
    const isSingleCategory = selected.length === 1
    const query = allSelected ? '' : `&categories=${encodeURIComponent(selected.join(','))}`
    const controller = new AbortController()
    startControllerRef.current = controller
    setPhase('loading')
    fetch(`${SOLO_API}?count=${CHOSEONG_QUIZ_QUESTION_COUNT}${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ChoseongQuizItem[]>
      })
      .then((data) => {
        if (data.length === 0) throw new Error('선택한 카테고리에 출제할 문제가 없습니다')
        runRef.current = {
          maxScore: isSingleCategory ? CHOSEONG_SINGLE_CATEGORY_MAX_SCORE : 100,
          initialHint: isSingleCategory ? 1 : 0,
          isFullSet: allSelected,
        }
        setItems(data)
        setResults([])
        setIsNewBest(false)
        beginQuestion(0)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('초성퀴즈 문제를 불러오지 못했습니다:', error)
        setPhase('error')
      })
  }, [phase, canStart, selected, allSelected, beginQuestion])

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
    // 최고기록은 전체 카테고리로 한 판만 반영한다
    if (runRef.current.isFullSet && total > bestScore) {
      writeBestScore(BEST_SCORE_KEY, total)
      setBestScore(total)
      setIsNewBest(true)
    }
    setPhase('finished')
  }, [phase, index, items.length, results, bestScore, beginQuestion])

  /** 카테고리를 다시 고르는 시작 화면으로 돌아간다. 카테고리 목록을 아직 못 받았다면 목록부터 다시 불러온다 */
  const restart = useCallback(() => {
    if (categories.length === 0) {
      setLoadKey((key) => key + 1)
      return
    }
    setItems([])
    setResults([])
    setIndex(0)
    setStartedAt(null)
    setIsNewBest(false)
    setPhase('ready')
  }, [categories.length])

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
    categories,
    selected,
    toggleCategory,
    selectAllCategories,
    clearCategories,
    candidateCount,
    allSelected,
    canStart,
    start,
    submit,
    pass,
    next,
    restart,
  }
}
