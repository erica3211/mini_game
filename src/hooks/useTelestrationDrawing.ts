import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { clearCatchmindCanvas, drawFullBoard, fitCatchmindCanvas, strokeSegment } from '../lib/catchmindDraw'
import type {
  CatchmindStroke,
  TelestrationChainReveal,
  TelestrationPrompt,
  TelestrationStepKind,
} from '../lib/partyProtocol'
import { useCanvasPointerDrawing } from './useCanvasPointerDrawing'

/** 서버가 단계마다 본인에게만 보내주는 과제 — 사람마다 받는 체인이 달라서 emitToPlayer로만 전달된다 */
export interface TelestrationTaskSignal {
  stepIndex: number
  totalSteps: number
  kind: TelestrationStepKind
  prompt: TelestrationPrompt
  submitted: boolean
  elapsedMs: number
}

/** 직접 입력 방식에서 라운드 시작 전 제시어를 적으라는 신호 */
export interface TelestrationWordPromptSignal {
  submitted: boolean
  elapsedMs: number
}

/** 모든 단계가 끝난 뒤 공개되는 체인 전체 + 내가 이미 한 투표(재접속 복원용) */
export interface TelestrationRevealSignal {
  chains: TelestrationChainReveal[]
  myVotes: { chainIndex: number; stepIndex: number }[]
  counts: number[][]
  voteDone: boolean
  elapsedMs: number
}

/**
 * 캐치마인드와 달리 그림을 실시간으로 중계하지 않는다 — 내 화면에서만 그리다가 단계가 끝날 때 획 배열을 한 번에 제출한다.
 * 그래서 서버 왕복 없이 로컬에서 곧바로 되돌리기/전체 지우기를 처리할 수 있다.
 */
export function useTelestrationDrawing(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  color: string,
  width: number,
) {
  const strokesRef = useRef<CatchmindStroke[]>([])
  const currentRef = useRef<CatchmindStroke | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fitCatchmindCanvas(canvas)
    clearCatchmindCanvas(canvas)
  }, [canvasRef])

  const drawingProps = useCanvasPointerDrawing(canvasRef, enabled, {
    onBegin: ({ x, y }) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const stroke: CatchmindStroke = { color, width, points: [{ x, y }] }
      strokesRef.current.push(stroke)
      currentRef.current = stroke
      strokeSegment(canvas, color, width, null, [{ x, y }])
    },
    onMove: ({ x, y }) => {
      const canvas = canvasRef.current
      const stroke = currentRef.current
      if (!canvas || !stroke) return
      const last = stroke.points[stroke.points.length - 1]
      stroke.points.push({ x, y })
      strokeSegment(canvas, stroke.color, stroke.width, last, [{ x, y }])
    },
    onEnd: () => {
      currentRef.current = null
    },
  })

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || currentRef.current) return
    strokesRef.current.pop()
    drawFullBoard(canvas, strokesRef.current)
  }, [canvasRef])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    strokesRef.current = []
    currentRef.current = null
    clearCatchmindCanvas(canvas)
  }, [canvasRef])

  const getStrokes = useCallback(() => strokesRef.current, [])

  return { drawingProps, undo, clear, getStrokes }
}
