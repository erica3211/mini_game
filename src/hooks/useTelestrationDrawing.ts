import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { clearCatchmindCanvas, drawFullBoard, fitCatchmindCanvas, strokeSegment } from '../lib/catchmindDraw'
import { loadDraft, saveDraft } from '../lib/sessionDraft'
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
  /** 현재 단계를 제출한 사람 수 (새로고침 복원용) */
  progress?: { submitted: number; total: number }
}

/** 직접 입력 방식에서 라운드 시작 전 제시어를 적으라는 신호 */
export interface TelestrationWordPromptSignal {
  submitted: boolean
  elapsedMs: number
  /** 제시어를 낸 사람 수 (새로고침 복원용) */
  progress?: { submitted: number; total: number }
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
  /** 있으면 그린 획을 이 키로 sessionStorage에 임시 저장하고, 새로고침 후 같은 키로 돌아오면 그대로 복원한다 */
  draftKey?: string,
) {
  const strokesRef = useRef<CatchmindStroke[]>([])
  const currentRef = useRef<CatchmindStroke | null>(null)

  const persist = useCallback(() => {
    if (draftKey) saveDraft(draftKey, strokesRef.current)
  }, [draftKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fitCatchmindCanvas(canvas)
    clearCatchmindCanvas(canvas)
    // 새로고침 전에 그리던 획이 있으면 되살린다
    const saved = draftKey ? loadDraft<CatchmindStroke[]>(draftKey) : null
    if (saved && saved.length > 0) {
      strokesRef.current = saved
      drawFullBoard(canvas, saved)
    }
  }, [canvasRef, draftKey])

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
      persist()
    },
  })

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || currentRef.current) return
    strokesRef.current.pop()
    drawFullBoard(canvas, strokesRef.current)
    persist()
  }, [canvasRef, persist])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    strokesRef.current = []
    currentRef.current = null
    clearCatchmindCanvas(canvas)
    persist()
  }, [canvasRef, persist])

  const getStrokes = useCallback(() => strokesRef.current, [])

  return { drawingProps, undo, clear, getStrokes }
}
