import { useEffect, useRef } from 'react'
import { drawFullBoard, fitCatchmindCanvas } from '../../lib/catchmindDraw'
import type { CatchmindStroke } from '../../lib/partyProtocol'

interface Props {
  strokes: CatchmindStroke[]
}

/** 턴이 끝난 시점의 그림을 그대로 다시 그려서 결과 화면에서 보여준다 (PixelCanvasSnapshot과 동일한 목적) */
export function CatchmindSnapshot({ strokes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fitCatchmindCanvas(canvas)
    drawFullBoard(canvas, strokes)
  }, [strokes])

  return <canvas ref={canvasRef} className="party-catchmind-snapshot" />
}
