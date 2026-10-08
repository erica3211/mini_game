import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { clearCatchmindCanvas, drawFullBoard, fitCatchmindCanvas, strokeSegment } from '../lib/catchmindDraw'
import { DOODLE_PROMPT_INDICES } from '../lib/doodleLabels'
import { guessDoodle, preloadDoodleModel, type DoodleGuess } from '../lib/doodleNet'
import { CATCHMIND_TURN_TIMEOUT_MS, type CatchmindStroke } from '../lib/partyProtocol'
import { readBestScore, scoreForElapsed, writeBestScore } from '../lib/soloScore'

export const AI_CATCHMIND_QUESTION_COUNT = 5
// 그리는 동안 이 간격마다(그림이 바뀌었을 때만) AI가 다시 추측한다 — 추론 한 번이 10ms 안팎이라 충분히 여유 있다
const GUESS_INTERVAL_MS = 300
const BEST_SCORE_KEY = 'ai_catchmind_best_score'

export type ModelStatus = 'loading' | 'ready' | 'error'
export type AiCatchmindPhase = 'intro' | 'drawing' | 'revealed' | 'finished'

export interface AiCatchmindResult {
  /** DOODLE_CLASSES 인덱스 */
  prompt: number
  correct: boolean
  elapsedMs: number | null
  score: number
  /** 결과표에 보여줄 그림 (JPEG data URL) */
  snapshot: string
}

/** 제시어로 낼 클래스 count개를 중복 없이 무작위로 고른다 */
function pickPrompts(count: number): number[] {
  const pool = [...DOODLE_PROMPT_INDICES]
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

/**
 * 혼자 하는 AI 캐치마인드 상태 훅. 내가 제시어를 그리면 브라우저 안의 DoodleNet이 실시간으로 추측하고,
 * 1순위 추측이 제시어와 같아지는 순간 정답이다. 서버 통신은 전혀 없다
 */
export function useAiCatchmind(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [modelLoadKey, setModelLoadKey] = useState(0)
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [phase, setPhase] = useState<AiCatchmindPhase>('intro')
  const [prompts, setPrompts] = useState<number[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<AiCatchmindResult[]>([])
  const [guesses, setGuesses] = useState<DoodleGuess[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [bestScore, setBestScore] = useState(() => readBestScore(BEST_SCORE_KEY))
  const [isNewBest, setIsNewBest] = useState(false)

  const strokesRef = useRef<CatchmindStroke[]>([])
  // 마지막 추측 이후 그림이 바뀌었는지 — 바뀌지 않았으면 같은 그림을 다시 추론하지 않는다
  const dirtyRef = useRef(false)
  // 문제가 끝나거나 바뀔 때마다 올린다. 추론(await) 도중 문제가 바뀌었으면 늦게 도착한 결과를 버리는 데 쓴다
  const questionTokenRef = useRef(0)
  const resolvedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    setModelStatus('loading')
    preloadDoodleModel()
      .then(() => !cancelled && setModelStatus('ready'))
      .catch((error: unknown) => {
        console.error('DoodleNet 모델을 불러오지 못했습니다:', error)
        if (!cancelled) setModelStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [modelLoadKey])

  const prompt = prompts[index] as number | undefined

  const beginQuestion = useCallback((nextIndex: number) => {
    strokesRef.current = []
    dirtyRef.current = false
    resolvedRef.current = false
    questionTokenRef.current++
    setIndex(nextIndex)
    setGuesses([])
    setStartedAt(performance.now())
    setPhase('drawing')
  }, [])

  // 새 문제가 시작되면 도화지를 비운다 (캔버스는 문제 사이에도 계속 마운트되어 있다)
  useEffect(() => {
    if (phase !== 'drawing') return
    const canvas = canvasRef.current
    if (!canvas) return
    fitCatchmindCanvas(canvas)
    clearCatchmindCanvas(canvas)
  }, [phase, index, canvasRef])

  /** 현재 문제를 끝낸다. 시간 초과·포기·AI 정답이 거의 동시에 일어나도 한 번만 기록된다 */
  const resolveQuestion = useCallback(
    (correct: boolean) => {
      if (resolvedRef.current || prompt === undefined || startedAt === null) return
      resolvedRef.current = true
      questionTokenRef.current++
      const elapsedMs = correct ? performance.now() - startedAt : null
      setResults((prev) => [
        ...prev,
        {
          prompt,
          correct,
          elapsedMs,
          score: elapsedMs !== null ? scoreForElapsed(elapsedMs, CATCHMIND_TURN_TIMEOUT_MS) : 0,
          snapshot: canvasRef.current?.toDataURL('image/jpeg', 0.7) ?? '',
        },
      ])
      setPhase('revealed')
    },
    [prompt, startedAt, canvasRef],
  )

  // 그리는 동안: 시간 초과 타이머 + 그림이 바뀔 때마다 AI 추측
  useEffect(() => {
    if (phase !== 'drawing' || prompt === undefined) return
    const timeout = window.setTimeout(() => resolveQuestion(false), CATCHMIND_TURN_TIMEOUT_MS)
    let inFlight = false
    const interval = window.setInterval(async () => {
      if (inFlight || !dirtyRef.current) return
      inFlight = true
      dirtyRef.current = false
      const token = questionTokenRef.current
      try {
        const next = await guessDoodle(strokesRef.current)
        if (token !== questionTokenRef.current) return
        setGuesses(next)
        if (next[0]?.index === prompt) resolveQuestion(true)
      } catch (error) {
        console.error('AI 추측 중 오류:', error)
      } finally {
        inFlight = false
      }
    }, GUESS_INTERVAL_MS)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [phase, prompt, resolveQuestion])

  // ── 그리기 (획 데이터는 AI 입력용으로 따로 보관하고, 화면에는 파티 캐치마인드와 같은 함수로 그린다)
  const beginStroke = useCallback(
    (color: string, width: number, point: { x: number; y: number }) => {
      if (phase !== 'drawing') return
      strokesRef.current.push({ color, width, points: [point] })
      const canvas = canvasRef.current
      if (canvas) strokeSegment(canvas, color, width, null, [point])
      dirtyRef.current = true
    },
    [phase, canvasRef],
  )

  const continueStroke = useCallback(
    (point: { x: number; y: number }) => {
      const stroke = strokesRef.current.at(-1)
      if (!stroke) return
      const canvas = canvasRef.current
      if (canvas) strokeSegment(canvas, stroke.color, stroke.width, stroke.points.at(-1) ?? null, [point])
      stroke.points.push(point)
      dirtyRef.current = true
    },
    [canvasRef],
  )

  const undoStroke = useCallback(() => {
    if (phase !== 'drawing' || strokesRef.current.length === 0) return
    strokesRef.current.pop()
    const canvas = canvasRef.current
    if (canvas) drawFullBoard(canvas, strokesRef.current)
    dirtyRef.current = true
  }, [phase, canvasRef])

  const clearBoard = useCallback(() => {
    if (phase !== 'drawing') return
    strokesRef.current = []
    const canvas = canvasRef.current
    if (canvas) clearCatchmindCanvas(canvas)
    dirtyRef.current = true
  }, [phase, canvasRef])

  // ── 진행
  const start = useCallback(() => {
    if (modelStatus !== 'ready') return
    setPrompts(pickPrompts(AI_CATCHMIND_QUESTION_COUNT))
    setResults([])
    setIsNewBest(false)
    beginQuestion(0)
  }, [modelStatus, beginQuestion])

  const giveUp = useCallback(() => resolveQuestion(false), [resolveQuestion])

  const next = useCallback(() => {
    if (phase !== 'revealed') return
    if (index + 1 < prompts.length) {
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
  }, [phase, index, prompts.length, results, bestScore, beginQuestion])

  const retryModel = useCallback(() => setModelLoadKey((key) => key + 1), [])

  return {
    modelStatus,
    phase,
    prompt,
    index,
    total: prompts.length || AI_CATCHMIND_QUESTION_COUNT,
    guesses,
    results,
    lastResult: results[index] as AiCatchmindResult | undefined,
    totalScore: results.reduce((sum, r) => sum + r.score, 0),
    bestScore,
    isNewBest,
    startedAt,
    beginStroke,
    continueStroke,
    undoStroke,
    clearBoard,
    start,
    giveUp,
    next,
    retryModel,
  }
}
