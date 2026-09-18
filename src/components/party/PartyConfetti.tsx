import { useEffect, useMemo, useState } from 'react'

const CONFETTI_COLORS = ['#ff7b9c', '#ffd1dc', '#fde047', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#f97316']
const CONFETTI_COUNT = 300
// 300개를 한꺼번에 떨어뜨리면 화면이 꽉 차버리니, 순서대로 조금씩 시차를 둬서 항상 대략 이 개수 정도만
// 동시에 화면에 떠 있게 한다 (나머지는 아직 대기 중이거나 이미 떨어져 사라진 상태)
const CONFETTI_CONCURRENT = 70
const CONFETTI_DURATION_MIN_S = 4
const CONFETTI_DURATION_MAX_S = 6
// 평균 낙하 시간 동안 CONFETTI_CONCURRENT개가 유지되려면, 이 간격으로 한 개씩 순서대로 새로 떨어뜨리면 된다
const CONFETTI_SPAWN_INTERVAL_S = (CONFETTI_DURATION_MIN_S + CONFETTI_DURATION_MAX_S) / 2 / CONFETTI_CONCURRENT
// 마지막 조각이 시작해서 다 떨어질 때까지: (전체 개수 × 간격) + 최대 낙하 시간 + 여유
const CONFETTI_VISIBLE_MS = (CONFETTI_COUNT * CONFETTI_SPAWN_INTERVAL_S + CONFETTI_DURATION_MAX_S + 0.5) * 1000

interface ConfettiPiece {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  width: number
  height: number
}

function makePieces(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: i * CONFETTI_SPAWN_INTERVAL_S + Math.random() * CONFETTI_SPAWN_INTERVAL_S,
    duration: CONFETTI_DURATION_MIN_S + Math.random() * (CONFETTI_DURATION_MAX_S - CONFETTI_DURATION_MIN_S),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    width: 6 + Math.random() * 6,
    height: 10 + Math.random() * 8,
  }))
}

/** 최종 결과 화면의 1등 축하용 색종이 폭죽 연출 — 화면 전체를 덮지만 pointer-events: none이라 버튼 클릭을 막지 않는다 */
export function PartyConfetti() {
  const pieces = useMemo(makePieces, [])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), CONFETTI_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="party-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="party-confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: p.color,
            width: `${p.width}px`,
            height: `${p.height}px`,
          }}
        />
      ))}
    </div>
  )
}
