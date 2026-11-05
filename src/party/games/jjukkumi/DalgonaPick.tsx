import { useEffect, useState } from 'react'
import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { DALGONA_BUTTONS, DALGONA_SHAPES, type DalgonaShapeId, type DalgonaStateSignal } from './protocol'

// 달고나 모양 고르기 — 구름이 그려진 하늘 배경에 물음표 버튼 네 개가 있고, 하나를 고른다(버튼마다 동그라미·세모·별·우산 중 하나가 숨어 있다).
// 모두 고르면(또는 10초가 지나면) 버튼 속 모양을 한꺼번에 보여 준다 — 먼저 고른 사람이 결과를 알고 따라 고르지 못하게 하려는 것이다.

/** 구름 하나 — 하늘색 테두리에 연한 푸른 속을 채운 손그림 느낌 (원본 그림처럼 둥글둥글한 구름) */
const CLOUD_PATH = 'M22 50 C6 50 4 30 20 27 C18 8 44 2 54 16 C66 4 92 12 88 32 C106 32 108 54 90 54 C84 62 68 62 62 56 C54 64 36 62 32 54 C28 54 24 52 22 50 Z'

/** 구름의 기본 크기 배율 — 원본 그림처럼 작은 구름이 여기저기 흩어져 있게 한다 */
const CLOUD_SCALE = 0.62

/** 구름들의 자리(0~100 좌표)와 크기 — 늘 같은 배치다 */
const CLOUDS: { x: number; y: number; scale: number; rotate: number }[] = [
  { x: 4, y: 4, scale: 0.55, rotate: -4 },
  { x: 62, y: 2, scale: 0.5, rotate: 6 },
  { x: 30, y: 22, scale: 0.42, rotate: 3 },
  { x: 74, y: 30, scale: 0.46, rotate: -5 },
  { x: -2, y: 44, scale: 0.5, rotate: 5 },
  { x: 46, y: 52, scale: 0.55, rotate: -3 },
  { x: 80, y: 62, scale: 0.4, rotate: 7 },
  { x: 14, y: 72, scale: 0.46, rotate: -6 },
  { x: 58, y: 82, scale: 0.5, rotate: 4 },
]

/** 구름이 그려진 하늘 배경 */
export function CloudBackdrop() {
  return (
    <svg className="jk-clouds" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill="#dbe9fb" />
      {CLOUDS.map((cloud, index) => (
        <g key={index} transform={`translate(${cloud.x} ${cloud.y}) rotate(${cloud.rotate} 50 30) scale(${cloud.scale * CLOUD_SCALE})`}>
          <path d={CLOUD_PATH} fill="rgba(150, 200, 245, 0.4)" stroke="#78b6ea" strokeWidth="5" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  )
}

/** 별 모양의 점들 (바깥 꼭짓점 다섯, 안쪽 꼭짓점 다섯) */
const STAR_POINTS = Array.from({ length: 10 }, (_, k) => {
  const angle = -Math.PI / 2 + (k * Math.PI) / 5
  const radius = k % 2 === 0 ? 40 : 17
  return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(53 + radius * Math.sin(angle)).toFixed(1)}`
}).join(' ')

/** 모양 그림 — 굵은 색 테두리로만 그린다 (동그라미 초록, 세모 빨강, 별 노랑, 우산 파랑) */
export function DalgonaShapeIcon({ shape, size }: { shape: string; size?: string }) {
  const info = DALGONA_SHAPES[shape as DalgonaShapeId]
  if (!info) return null
  const common = { fill: 'none', stroke: info.color, strokeWidth: 8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg className="jk-shape-icon" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={info.name}>
      {shape === 'circle' && <circle cx="50" cy="50" r="38" {...common} />}
      {shape === 'triangle' && <polygon points="50,12 90,82 10,82" {...common} />}
      {shape === 'star' && <polygon points={STAR_POINTS} {...common} />}
      {shape === 'umbrella' && (
        <path d="M12 48 A38 38 0 0 1 88 48 A9.5 9.5 0 0 1 69 48 A9.5 9.5 0 0 1 50 48 A9.5 9.5 0 0 1 31 48 A9.5 9.5 0 0 1 12 48 Z M50 48 V82 A7 7 0 0 1 36 82" {...common} />
      )}
    </svg>
  )
}

interface Props {
  state: DalgonaStateSignal
  players: PlayerInfo[]
  myId: string | null
  /** 내가 방금 누른 버튼 — 새로고침하면 사라지니, 이미 골랐는지는 state.chosenIds로 따로 안다 */
  myButton: number | null
  onPick: (button: number) => void
  /** 이 신호를 받은 시각(performance.now() 기준) — 남은 시간을 셀 때 쓴다 */
  receivedAt: number
}

/** 모양 고르기(pick)와 결과 보기(reveal) 화면 */
export function DalgonaPick({ state, players, myId, myButton, onPick, receivedAt }: Props) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  const isReveal = state.phase !== 'pick'
  const meInStage = !!myId && state.players.some((p) => p.playerId === myId)
  const iChose = !!myId && state.chosenIds.includes(myId)
  const seconds = Math.max(0, Math.ceil((receivedAt + state.phaseEndsInMs - now) / 1000))
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myChoice = isReveal && myId && state.choices ? state.choices[myId] : null

  return (
    <div className="jk-pick">
      <CloudBackdrop />
      <div className="jk-pick-body">
        <p className="jk-pick-title">{isReveal ? '숨어 있던 모양은?' : meInStage ? '버튼을 하나 골라요!' : '다른 사람이 고르고 있어요'}</p>
        <p className="jk-pick-sub">
          {isReveal
            ? myChoice !== null && state.buttons
              ? `내가 고른 건 ${DALGONA_SHAPES[state.buttons[myChoice] as DalgonaShapeId]?.name ?? ''}!`
              : '모두가 고른 버튼의 모양이에요'
            : iChose
              ? `선택 완료! 다른 사람을 기다려요 (${state.chosenIds.length}/${state.players.length}명) · ⏳ ${seconds}초`
              : meInStage
                ? `⏳ ${seconds}초 안에 골라요 (못 고르면 랜덤!)`
                : `${state.chosenIds.length}/${state.players.length}명 선택 · ⏳ ${seconds}초`}
        </p>
        <div className="jk-pick-grid">
          {Array.from({ length: DALGONA_BUTTONS }, (_, button) => {
            const shape = isReveal && state.buttons ? state.buttons[button] : null
            const mine = isReveal ? myChoice === button : myButton === button
            const choosers = isReveal && state.choices ? Object.entries(state.choices).filter(([, chosen]) => chosen === button).map(([id]) => nicknameOf(id)) : []
            return (
              <button
                key={button}
                type="button"
                className={`jk-pick-btn${mine ? ' jk-pick-btn-mine' : ''}${shape ? ' jk-pick-btn-open' : ''}`}
                disabled={isReveal || iChose || !meInStage}
                onClick={() => onPick(button)}
                aria-label={shape ? (DALGONA_SHAPES[shape as DalgonaShapeId]?.name ?? '모양') : `버튼 ${button + 1}`}
              >
                {shape ? <DalgonaShapeIcon shape={shape} /> : <span className="jk-pick-q">?</span>}
                {choosers.length > 0 && <span className="jk-pick-who">{choosers.join(', ')}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
