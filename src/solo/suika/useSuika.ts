import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { readBestScore, writeBestScore } from '../shared/soloScore'
import { createSuikaEngine, BOARD_H, BOARD_W, type SuikaEngine } from './suikaEngine'
import { drawBoard, type BoardPalette } from './suikaDraw'

export type SuikaPhase = 'intro' | 'playing' | 'finished'

const BEST_SCORE_KEY = 'suika_best_score'
// 점수 표시는 매 프레임이 아니라 이 간격으로만 React 상태에 올린다 (typeRace와 같은 방식)
const SCORE_REFRESH_MS = 100
// 테마(라이트/다크)가 바뀌어도 위험선 색이 따라오도록 가끔 다시 읽는다
const PALETTE_REFRESH_FRAMES = 30

function readPalette(): BoardPalette {
  const style = getComputedStyle(document.documentElement)
  return {
    line: style.getPropertyValue('--accent').trim() || '#d6336c',
    text: style.getPropertyValue('--text-muted').trim() || '#888888',
  }
}

export function useSuika(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [phase, setPhase] = useState<SuikaPhase>('intro')
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(() => readBestScore(BEST_SCORE_KEY))
  const [isNewBest, setIsNewBest] = useState(false)
  const engineRef = useRef<SuikaEngine | null>(null)
  const bestScoreRef = useRef(bestScore)

  const start = useCallback(() => {
    engineRef.current?.destroy()
    engineRef.current = createSuikaEngine()
    setScore(0)
    setIsNewBest(false)
    setPhase('playing')
  }, [])

  useEffect(() => () => engineRef.current?.destroy(), [])

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    const engine = engineRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !engine || !ctx) return

    // 화면 배율에 맞춰 백버퍼를 키우고 좌표계는 논리 크기(BOARD_W x BOARD_H)로 유지한다
    const dpr = window.devicePixelRatio || 1
    canvas.width = BOARD_W * dpr
    canvas.height = BOARD_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let palette = readPalette()
    let frame = 0
    let last = performance.now()
    let lastUiRefresh = last
    let raf = 0

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      engine.advance(dt)
      if (++frame % PALETTE_REFRESH_FRAMES === 0) palette = readPalette()
      drawBoard(ctx, engine, palette)

      if (engine.over) {
        const finalScore = engine.score
        const isBest = finalScore > bestScoreRef.current
        if (isBest) {
          bestScoreRef.current = finalScore
          writeBestScore(BEST_SCORE_KEY, finalScore)
          setBestScore(finalScore)
        }
        setScore(finalScore)
        setIsNewBest(isBest)
        setPhase('finished')
        return
      }
      if (now - lastUiRefresh >= SCORE_REFRESH_MS) {
        lastUiRefresh = now
        setScore(engine.score)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, canvasRef])

  const aimAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    engineRef.current?.setAim(((event.clientX - rect.left) / rect.width) * BOARD_W)
  }

  // 마우스는 올려만 둬도 조준되고 클릭으로 떨어뜨린다. 터치는 누른 채 움직여 조준하고 손을 떼면 떨어뜨린다
  const boardProps = {
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
      if (phase !== 'playing') return
      event.currentTarget.setPointerCapture(event.pointerId)
      aimAt(event)
    },
    onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => {
      if (phase === 'playing') aimAt(event)
    },
    onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => {
      if (phase !== 'playing') return
      aimAt(event)
      engineRef.current?.drop()
    },
  }

  return { phase, score, bestScore, isNewBest, start, boardProps }
}
