import { useEffect, useRef } from 'react'
import type { PixelCanvasRoundMeta } from '../../lib/partyProtocol'
import { drawFullGrid, fitCanvasToGrid } from '../../lib/pixelCanvasDraw'

interface Props {
  meta: PixelCanvasRoundMeta
}

/** 라운드가 끝난 시점의 캔버스를 그대로 다시 그려서 누가 어디를 차지했는지 한눈에 보여준다 */
export function PixelCanvasSnapshot({ meta }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fitCanvasToGrid(canvas)
    drawFullGrid(canvas, meta.grid, meta.slotColors)
  }, [meta])

  return <canvas ref={canvasRef} className="party-pixelcanvas-snapshot" />
}
