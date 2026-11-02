import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { prefersReducedMotion, type Shot } from './OlympicsSportViews'
import type { OlympicsAttempt, OlympicsGauge } from './protocol'
import { ARCHERY_RING_WIDTH, archeryPosition } from './sports'

// 볼링 레인과 역도 무대 — 던지기·들어올리기 연출

// ---------------------------------------------------------------- 볼링 (viewBox 100 x 80)

interface Pin {
  x: number
  y: number
}

// 핀 10개: 맨 뒷줄(4개)부터 헤드핀(1개)까지
const PINS: Pin[] = [
  { x: 41, y: 9 }, { x: 47, y: 9 }, { x: 53, y: 9 }, { x: 59, y: 9 },
  { x: 44, y: 14 }, { x: 50, y: 14 }, { x: 56, y: 14 },
  { x: 47, y: 19 }, { x: 53, y: 19 },
  { x: 50, y: 24 },
]
const BALL_START: Pin = { x: 50, y: 66 }
const BALL_END_Y = 26

export const BOWLING_THROW_MS = 1000
export const BOWLING_REVEAL_MS = 800

/** 공이 닿는 가로 위치 — 방향 게이지를 멈춘 곳(0~1)이 가운데(0.5)에서 벗어난 만큼 옆으로 간다 */
export function bowlingArrivalX(aim: number): number {
  return 50 + (aim - 0.5) * 24
}

/** 공이 닿는 곳에서 가까운 핀부터 count개가 쓰러진다 */
export function knockedPins(count: number, arrivalX: number): Set<number> {
  const order = PINS.map((pin, index) => ({ index, distance: Math.abs(pin.x - arrivalX) + (24 - pin.y) * 0.02 })).sort((a, b) => a.distance - b.distance)
  return new Set(order.slice(0, count).map((entry) => entry.index))
}

/** 볼링 레인: 공이 굴러가 핀을 쓰러뜨린다. fallen이 true인 동안(던진 뒤 다음 시도 전까지) 쓰러진 핀을 보여준다 */
export function BowlingLane({ shot, fallen }: { shot: Shot | null; fallen: boolean }) {
  const ball = useRef<SVGGElement>(null)
  const shotKey = shot?.key
  const attemptRef = useRef(shot?.attempt)
  attemptRef.current = shot?.attempt

  useEffect(() => {
    const element = ball.current
    const attempt = attemptRef.current
    if (!shotKey || !element || !attempt || prefersReducedMotion() || typeof element.animate !== 'function') return
    const endX = bowlingArrivalX(attempt.at?.x ?? 0.5)
    const frames: Keyframe[] = []
    const steps = 12
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const eased = t * t * 0.4 + t * 0.6
      const x = BALL_START.x + (endX - BALL_START.x) * eased
      const y = BALL_START.y + (BALL_END_Y - BALL_START.y) * eased
      frames.push({ offset: 0.6 * t, transform: `translate(${x}px, ${y}px) scale(${1 - 0.4 * eased})`, opacity: 1 })
    }
    frames.push({ offset: 0.66, transform: `translate(${endX}px, ${BALL_END_Y - 6}px) scale(0.5)`, opacity: 0 })
    frames.push({ offset: 0.94, transform: `translate(${BALL_START.x}px, ${BALL_START.y}px) scale(1)`, opacity: 0 })
    frames.push({ offset: 1, transform: `translate(${BALL_START.x}px, ${BALL_START.y}px) scale(1)`, opacity: 1 })
    const animation = element.animate(frames, { duration: BOWLING_THROW_MS, easing: 'linear' })
    return () => animation.cancel()
  }, [shotKey])

  const arrivalX = shot ? bowlingArrivalX(shot.attempt.at?.x ?? 0.5) : 50
  const knocked = shot && fallen ? knockedPins(shot.attempt.score, arrivalX) : new Set<number>()
  const score = shot?.attempt.score ?? 0
  return (
    <svg className="party-oly-court party-oly-lane-scene" viewBox="0 0 100 80" role="img" aria-label="볼링 레인">
      <polygon points="35,4 65,4 80,76 20,76" fill="#e8c28a" stroke="#a8743c" strokeWidth="0.6" />
      <polygon points="31,4 35,4 20,76 12,76" fill="#3b4252" />
      <polygon points="65,4 69,4 88,76 80,76" fill="#3b4252" />
      <path d="M42 70 L40 40 M50 70 L50 40 M58 70 L60 40" stroke="#c99a5b" strokeWidth="0.4" fill="none" />
      {PINS.map((pin, index) => {
        const down = knocked.has(index)
        const direction = pin.x >= arrivalX ? 1 : -1
        return (
          <g
            key={`${shotKey ?? 'none'}-${index}`}
            className={down ? 'party-oly-pin party-oly-pin-down' : 'party-oly-pin'}
            style={
              down
                ? ({ '--pin-dx': `${direction * (3 + (index % 3) * 2)}px`, '--pin-rot': `${direction * (70 + (index % 4) * 10)}deg`, animationDelay: `${520 + Math.abs(pin.x - arrivalX) * 14}ms` } as CSSProperties)
                : undefined
            }
          >
            <ellipse cx={pin.x} cy={pin.y} rx="2" ry="3" fill="#fff" stroke="#6b7280" strokeWidth="0.4" />
            <rect x={pin.x - 1.5} y={pin.y - 0.8} width="3" height="0.9" fill="#d93b3b" />
          </g>
        )
      })}
      <g ref={ball} style={{ transform: `translate(${BALL_START.x}px, ${BALL_START.y}px)` }}>
        <circle r="4.5" fill="#1f2937" stroke="#0f172a" strokeWidth="0.5" />
        <circle cx="-1.2" cy="-1.4" r="0.7" fill="#475569" />
        <circle cx="1.2" cy="-1.6" r="0.7" fill="#475569" />
        <circle cx="0" cy="0.2" r="0.7" fill="#475569" />
      </g>
      {shot && (
        <text key={shot.key} className={`party-oly-pop${score === 10 ? ' party-oly-pop-hit' : ''}`} x="50" y="42" textAnchor="middle" style={{ animationDelay: `${BOWLING_REVEAL_MS - 200}ms` }}>
          {score === 10 ? '스트라이크! 🎳' : score === 0 ? '거터!' : `${score}핀`}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------- 역도 (viewBox 100 x 64)

export const LIFT_MS = 1000
export const LIFT_REVEAL_MS = 800
const FLOOR_Y = 56
const BAR_FLOOR = 52
const BAR_TOP = 8

const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const easeIn = (t: number) => t * t

/** 바벨의 높이(0 바닥 ~ 1 머리 위) — 성공이면 끝까지 들어 올려 버티고 내리고, 실패하면 반쯤 들다 버티지 못하고 떨어뜨린다 */
export function liftHeight(progress: number, success: boolean): number {
  if (success) {
    if (progress < 0.5) return easeOut(progress / 0.5)
    if (progress < 0.8) return 1
    return 1 - easeIn((progress - 0.8) / 0.2)
  }
  if (progress < 0.35) return 0.55 * easeOut(progress / 0.35)
  if (progress < 0.5) return 0.55
  if (progress < 0.75) return 0.55 * (1 - easeIn((progress - 0.5) / 0.25))
  return 0
}

/** 연출 시간 동안 0→1로 올라가는 값 (shotKey가 바뀔 때마다 처음부터). 연출이 없으면 1 */
function useProgress(shotKey: string | undefined, durationMs: number): number {
  const [progress, setProgress] = useState(1)
  useEffect(() => {
    if (!shotKey || prefersReducedMotion()) {
      setProgress(1)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs)
      setProgress(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [shotKey, durationMs])
  return progress
}

/** 역도 무대: 고른 무게의 바벨을 선수가 들어 올린다 */
export function WeightliftingStage({ shot, weight }: { shot: Shot | null; weight: number | null }) {
  const shown = shot && weight === null ? (shot.attempt.weight ?? 60) : (weight ?? 60)
  const progress = useProgress(shot?.key, LIFT_MS)
  const success = shot?.attempt.hit ?? false
  const height = shot ? liftHeight(progress, success) : 0
  const shake = shot && !success && progress >= 0.35 && progress < 0.5 ? Math.sin(progress * 160) * 0.8 : 0
  const barY = BAR_FLOOR - height * (BAR_FLOOR - BAR_TOP)
  const plate = 3.5 + (shown / 140) * 5
  const plateCount = shown >= 100 ? 2 : 1
  return (
    <svg className="party-oly-court" viewBox="0 0 100 64" role="img" aria-label="역도 무대">
      <rect x="0" y={FLOOR_Y} width="100" height="8" fill="#6b7280" />
      <rect x="14" y={FLOOR_Y - 1} width="72" height="2" fill="#374151" />
      {/* 선수 */}
      <g stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <line x1="50" y1="30" x2="50" y2="44" />
        <line x1="50" y1="44" x2="44" y2={FLOOR_Y - 1} />
        <line x1="50" y1="44" x2="56" y2={FLOOR_Y - 1} />
        <polyline points={`45,31 ${42 + shake},${(31 + barY) / 2} ${41 + shake},${barY}`} />
        <polyline points={`55,31 ${58 + shake},${(31 + barY) / 2} ${59 + shake},${barY}`} />
      </g>
      <circle cx="50" cy="24" r="4.2" fill="#f2c9a0" stroke="#1f2937" strokeWidth="0.8" />
      {/* 바벨 */}
      <g transform={`translate(${shake} 0)`}>
        <line x1="20" y1={barY} x2="80" y2={barY} stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
        {[0, 1].slice(0, plateCount).map((layer) => (
          <g key={layer}>
            <rect x={22 + layer * 3.2} y={barY - plate} width="2.8" height={plate * 2} rx="0.6" fill={layer === 0 ? '#d93b3b' : '#2f7bd1'} stroke="#111" strokeWidth="0.4" />
            <rect x={75 - layer * 3.2} y={barY - plate} width="2.8" height={plate * 2} rx="0.6" fill={layer === 0 ? '#d93b3b' : '#2f7bd1'} stroke="#111" strokeWidth="0.4" />
          </g>
        ))}
      </g>
      <text x="50" y="62" textAnchor="middle" className="party-oly-weight-label">
        {shown}kg
      </text>
      {shot && (
        <text key={shot.key} className={`party-oly-pop${success ? ' party-oly-pop-hit' : ''}`} x="50" y="40" textAnchor="middle" style={{ animationDelay: `${LIFT_REVEAL_MS - 250}ms` }}>
          {success ? `${shot.attempt.weight ?? shown}kg 성공! 🏆` : '실패 💥'}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------- 사격 (viewBox 100 x 134): 표적은 위쪽 100x100, 총은 아래쪽 — 양궁과 같은 구조

const MUZZLE: Pin = { x: 50, y: 104 }
export const SHOOTING_FLIGHT_MS = 1000
export const SHOOTING_REVEAL_MS = 500

function bulletFrames(attempt: OlympicsAttempt): Keyframe[] {
  const rest = `translate(${MUZZLE.x}px, ${MUZZLE.y}px) rotate(0deg) scale(1.1)`
  const target = attempt.at ? { x: attempt.at.x * 100, y: attempt.at.y * 100 } : { x: 50, y: -28 }
  const angle = (Math.atan2(target.x - MUZZLE.x, MUZZLE.y - target.y) * 180) / Math.PI
  const landed = `translate(${target.x}px, ${target.y}px) rotate(${angle}deg) scale(0.7)`
  // 총알은 화살보다 훨씬 빠르게 날아간다 (0.2초). 맞은 자리에 구멍이 생길 때까지 잠깐 보이다가 사라진다
  return [
    { offset: 0, transform: rest, opacity: 1, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
    { offset: 0.2, transform: landed, opacity: 1 },
    { offset: 0.5, transform: landed, opacity: attempt.at ? 1 : 0 },
    { offset: 0.52, transform: landed, opacity: 0 },
    { offset: 1, transform: landed, opacity: 0 },
  ]
}

// 사격 표적: 하얀 종이에 안쪽 4칸이 검은 원 (양궁 과녁과 같은 10칸 점수)
const SHOOTING_RINGS = Array.from({ length: 10 }, (_, index) => index < 6)

/** 사격: 표적 위를 휘젓는 조준점 — 중앙에 올 때 누르면 총에서 총알이 날아가 맞는다. 이미 맞은 자리는 구멍으로 남는다 */
export function ShootingTarget({ gauge, elapsed, shots, shot }: { gauge: OlympicsGauge | null; elapsed: number; shots: OlympicsAttempt[]; shot: Shot | null }) {
  const aim = gauge ? archeryPosition(gauge, elapsed) : null
  const ring = ARCHERY_RING_WIDTH * 100
  const bullet = useRef<SVGGElement>(null)
  const gun = useRef<SVGGElement>(null)
  const flash = useRef<SVGCircleElement>(null)
  const shotKey = shot?.key
  const attemptRef = useRef(shot?.attempt)
  attemptRef.current = shot?.attempt

  useEffect(() => {
    const attempt = attemptRef.current
    if (!shotKey || !attempt || prefersReducedMotion()) return
    const animations: Animation[] = []
    if (bullet.current && typeof bullet.current.animate === 'function') {
      animations.push(bullet.current.animate(bulletFrames(attempt), { duration: SHOOTING_FLIGHT_MS, easing: 'linear' }))
    }
    if (gun.current && typeof gun.current.animate === 'function') {
      // 반동: 총이 뒤로 튕겼다가 돌아온다
      animations.push(
        gun.current.animate(
          [
            { offset: 0, transform: 'translateY(0px)' },
            { offset: 0.04, transform: 'translateY(5px)' },
            { offset: 0.2, transform: 'translateY(0px)' },
            { offset: 1, transform: 'translateY(0px)' },
          ],
          { duration: SHOOTING_FLIGHT_MS, easing: 'ease-out' },
        ),
      )
    }
    if (flash.current && typeof flash.current.animate === 'function') {
      animations.push(flash.current.animate([{ opacity: 1, scale: '1.4' }, { opacity: 0, scale: '0.6' }], { duration: 120, easing: 'ease-out' }))
    }
    return () => animations.forEach((animation) => animation.cancel())
  }, [shotKey])

  const landedAt = shot?.attempt.at
  return (
    <svg className="party-oly-target" viewBox="0 0 100 134" role="img" aria-label="사격 표적">
      <rect x="1" y="1" width="98" height="98" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.6" />
      {SHOOTING_RINGS.map((light, index) => (
        <circle key={index} cx="50" cy="50" r={ring * (SHOOTING_RINGS.length - index)} fill={light ? '#f8fafc' : '#1f2937'} stroke={light ? '#475569' : '#e5e7eb'} strokeWidth="0.35" />
      ))}
      <circle cx="50" cy="50" r="1" fill="#e5e7eb" />
      {shots.map((item, index) =>
        item.at ? (
          <g key={index}>
            <circle cx={item.at.x * 100} cy={item.at.y * 100} r="1.7" fill="#0f172a" stroke="#fde047" strokeWidth="0.6" />
          </g>
        ) : null,
      )}
      {aim && (
        <g transform={`translate(${aim.x * 100} ${aim.y * 100})`}>
          <circle r="4" fill="none" stroke="#e11d1d" strokeWidth="0.9" />
          <line x1="-6" y1="0" x2="6" y2="0" stroke="#e11d1d" strokeWidth="0.9" />
          <line x1="0" y1="-6" x2="0" y2="6" stroke="#e11d1d" strokeWidth="0.9" />
        </g>
      )}
      {/* 총: 총구가 표적을 향한다 */}
      <g ref={gun}>
        <rect x="46" y="106" width="8" height="14" rx="1" fill="#475569" stroke="#1f2937" strokeWidth="0.6" />
        <rect x="42" y="118" width="16" height="9" rx="1.5" fill="#374151" stroke="#111827" strokeWidth="0.6" />
        <path d="M44 126 L56 126 L58 134 L47 134 Z" fill="#1f2937" />
        <path d="M53 127 Q57 129 53 131" fill="none" stroke="#9ca3af" strokeWidth="0.8" />
        <rect x="49" y="104" width="2" height="3" fill="#111827" />
      </g>
      <circle ref={flash} cx={MUZZLE.x} cy={MUZZLE.y - 1} r="3" fill="#fde047" opacity="0" style={{ transformOrigin: `${MUZZLE.x}px ${MUZZLE.y - 1}px` }} />
      {/* 총알: 쏘면 총구에서 표적으로 날아간다 */}
      <g ref={bullet} style={{ transform: `translate(${MUZZLE.x}px, ${MUZZLE.y}px) scale(1.1)`, opacity: 0 }}>
        <path d="M0 -4 C2.2 -2.2 2.2 0 2.2 5 L-2.2 5 C-2.2 0 -2.2 -2.2 0 -4 Z" fill="#c28a3a" stroke="#7c5314" strokeWidth="0.4" />
        <rect x="-2.2" y="5" width="4.4" height="1.4" fill="#e5e7eb" />
      </g>
      {shot && (
        <text
          key={shot.key}
          className={`party-oly-pop${shot.attempt.score >= 9 ? ' party-oly-pop-hit' : ''}`}
          x={landedAt ? Math.min(82, Math.max(18, landedAt.x * 100)) : 50}
          y={landedAt ? Math.max(12, landedAt.y * 100 - 7) : 14}
          textAnchor="middle"
          style={{ animationDelay: `${SHOOTING_REVEAL_MS - 80}ms` }}
        >
          {landedAt ? `${shot.attempt.score}점!` : '빗나갔어요'}
        </text>
      )}
    </svg>
  )
}
