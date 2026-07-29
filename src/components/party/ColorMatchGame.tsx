import { useCallback, useRef, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { useColorMatchRound } from '../../hooks/useColorMatchRound'
import { rgbToCss } from '../../lib/colorMath'
import {
  COLOR_MATCH_SUB_ROUND_MS,
  COLOR_MATCH_SUB_ROUNDS,
  type ClientToServerEvents,
  type RgbColor,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { subRoundIndex: number; answerColor: RgbColor; elapsedMs: number } | null
  howToPlay: string
}

// 드래그 위치를 기준으로 그때그때 다시 그리는 지도 배경 — 실제 채점에 쓰이는 색은 훅이 계산하는
// hslToRgb(hue, saturation, lightness) 값이 유일한 정답 소스이고, 이 배경은 그걸 그대로 시각화한 것일 뿐이다
// 화면에는 핀을 중심으로 색상각 ±45도만 보여준다(여러 색 계열이 한눈에 보이도록) — 드래그 1px당
// 움직이는 양(useColorMatchRound의 HUE_PER_PIXEL)도 이 범위와 맞춰뒀으니, 지도 한쪽 끝에서
// 반대쪽 끝까지 드래그하면 대략 화면에 보이는 만큼만 움직인다
const MAP_HUE_SPAN = 45

function mapBackground(hue: number, lightness: number, saturation: number) {
  const centerColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  // 아래(가로) 레이어가 색상각별로 실제 색을 깔고, 위(세로) 레이어는 흰색/검은색을 반투명하게 덧씌워
  // 위아래로는 밝기를, 좌우로는 색상각을 동시에 보여준다 — 핀이 있는 정중앙은 위 레이어가 완전히
  // 투명해지는 지점이라 실제 선택색(centerColor)이 그대로 드러난다
  return [
    'linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0) 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75))',
    `linear-gradient(to right, hsl(${hue - MAP_HUE_SPAN}, ${saturation}%, 50%), ${centerColor} 50%, hsl(${hue + MAP_HUE_SPAN}, ${saturation}%, 50%))`,
  ].join(', ')
}

export function ColorMatchGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const { status, hue, lightness, color, saturation, drag, result, startedAt, answerColor, subRoundIndex } = useColorMatchRound(
    socket,
    roundKey,
    startSignal,
  )

  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    lastPos.current = { x: e.clientX, y: e.clientY }
    // 포인터가 지도 바깥으로 나가도 드래그가 끊기지 않게 캡처 — 지원 안 하는 환경도 있으니 실패해도 무시
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // no-op
    }
  }, [])

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!lastPos.current) return
      const deltaX = e.clientX - lastPos.current.x
      const deltaY = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      drag(deltaX, deltaY)
    },
    [drag],
  )

  const onPointerUp = useCallback(() => {
    lastPos.current = null
  }, [])

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && answerColor && (
        <>
          <p className="party-colormatch-round-label">
            {subRoundIndex + 1} / {COLOR_MATCH_SUB_ROUNDS} 라운드
          </p>

          {startedAt !== null && status === 'running' && (
            <RemainingTime startedAt={startedAt} timeoutMs={COLOR_MATCH_SUB_ROUND_MS} />
          )}

          <div className="party-colormatch-swatches">
            <div className="party-colormatch-swatch-group">
              <span>정답</span>
              <div className="party-colormatch-swatch" style={{ background: rgbToCss(answerColor) }} />
            </div>
            <div className="party-colormatch-swatch-group">
              <span>선택</span>
              <div className="party-colormatch-swatch" style={{ background: rgbToCss(color) }} />
            </div>
          </div>

          <div
            className="party-colormatch-map"
            style={{ background: mapBackground(hue, lightness, saturation) }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="party-colormatch-pin">📍</div>
          </div>

          {result && (
            <div className="party-colormatch-result">
              <p className="party-colormatch-result-percent">{result.matchPercent}% 일치</p>
              <p className="party-colormatch-result-grade">{result.grade}</p>
            </div>
          )}

          {status === 'submitted' && !result && <p className="party-round-hint">채점 중...</p>}
        </>
      )}
    </div>
  )
}
