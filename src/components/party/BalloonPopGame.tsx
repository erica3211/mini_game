import { useCallback, useMemo, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { useBalloonPopRound } from '../../hooks/useBalloonPopRound'
import { BALLOON_POP_MAX_PUMPS, BALLOON_POP_ROUND_TIMEOUT_MS, type ClientToServerEvents, type ServerToClientEvents } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { elapsedMs: number } | null
  howToPlay: string
}

// 풍선 색은 순전히 코스메틱이라(채점과 무관) 서버가 정할 필요 없이 라운드마다 클라이언트가 하나 무작위로 고른다
const BALLOON_COLORS = ['#f85149', '#649ae2', '#e2b23e', '#3ecf8e', '#c264dd', '#f2789f']
// .party-balloonpop-stage 칸(260x300) 안에 여유 있게 들어가는 상한 — 이보다 크게 하면 칸 밖으로 잘려 보인다
const MAX_SCALE = 1.5

export function BalloonPopGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const { status, pumps, startPumping, pausePumping, stop, startedAt } = useBalloonPopRound(socket, roundKey, startSignal)
  const color = useMemo(() => BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)], [roundKey])

  const growth = Math.min(1, pumps / BALLOON_POP_MAX_PUMPS)
  const scale = 1 + growth * (MAX_SCALE - 1)

  const onPointerDown = useCallback(
    (e: PointerEvent<SVGPathElement>) => {
      // 누르고 있는 도중 손가락이 풍선 밖으로 나가도 손을 뗀 걸로 놓치지 않게 캡처 — 지원 안 하는 환경도 있으니 실패해도 무시
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op
      }
      startPumping()
    },
    [startPumping],
  )

  const onPointerUp = useCallback(() => {
    pausePumping()
  }, [pausePumping])

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && (
        <>
          {status === 'alive' && startedAt !== null && (
            <RemainingTime startedAt={startedAt} timeoutMs={BALLOON_POP_ROUND_TIMEOUT_MS} />
          )}

          <div className={`party-balloonpop-stage${status === 'popped' ? ' party-balloonpop-stage-popped' : ''}`}>
            {status === 'popped' ? (
              <p className="party-balloonpop-pop-text">💥 펑!</p>
            ) : (
              <svg
                className={`party-balloonpop-balloon${status === 'alive' ? ' party-balloonpop-balloon-pumpable' : ''}`}
                viewBox="0 0 100 130"
                // 매듭 끝(아래 고정점)을 기준으로 커지도록 transform-origin을 중앙이 아니라 그 지점으로 옮긴다
                style={{ transform: `scale(${scale})`, transformOrigin: '50% 83%' }}
              >
                {/* 원+삼각형을 이어붙이지 않고, 위쪽 둥근 몸통에서 아래 매듭까지 하나의 매끄러운 윤곽선으로 그린다 */}
                <path
                  d="M50,6 C76,6 92,26 92,54 C92,80 74,94 60,100 C55,102 52,104 50,108 C48,104 45,102 40,100 C26,94 8,80 8,54 C8,26 24,6 50,6 Z"
                  fill={color}
                  onPointerDown={status === 'alive' ? onPointerDown : undefined}
                  onPointerUp={status === 'alive' ? onPointerUp : undefined}
                  onPointerCancel={status === 'alive' ? onPointerUp : undefined}
                  onPointerLeave={status === 'alive' ? onPointerUp : undefined}
                />
                <ellipse cx="36" cy="30" rx="9" ry="13" fill="rgba(255,255,255,0.25)" />
                <line x1="50" y1="108" x2="50" y2="126" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <p className="party-balloonpop-pumps">{pumps}번 부풀림</p>

          {status === 'alive' && (
            <>
              <p className="party-round-hint">풍선을 "꾹" 눌러서 부풀리세요.</p>
              <button type="button" className="btn btn-secondary" onClick={stop}>
                그만하기
              </button>
            </>
          )}
          {status === 'popped' && <p className="party-round-hint">터졌어요! 결과를 기다려주세요...</p>}
          {status === 'stopped' && <p className="party-round-hint">{pumps}번에서 멈췄어요. 결과를 기다려주세요...</p>}
        </>
      )}
    </div>
  )
}
