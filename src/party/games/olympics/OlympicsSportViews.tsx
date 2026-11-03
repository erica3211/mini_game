import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { ARCHERY_RING_WIDTH, archeryPosition, basketballPosition } from './sports'
import type { OlympicsAttempt, OlympicsGauge } from './protocol'

/**
 * 게이지·조준점이 움직이는 시간을 재는 훅 — 서버가 알려 준 "이미 지난 시간"에서 시작해 화면 시계로 이어서 센다.
 * 같은 시도(key가 같은 동안)에는 시작 시각을 바꾸지 않아서, 상태 신호가 다시 와도 게이지가 튀지 않는다.
 * now()는 지금 누르는 순간의 경과 시간 — 서버에 함께 보내서 네트워크 지연을 덜어 준다.
 */
export function useGaugeClock(gauge: OlympicsGauge | null, key: string) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const gaugeRef = useRef(gauge)
  gaugeRef.current = gauge

  useEffect(() => {
    const current = gaugeRef.current
    if (!current) {
      startRef.current = null
      return
    }
    const start = performance.now() - current.elapsedMs
    startRef.current = start
    let frame = 0
    const tick = () => {
      setElapsed(performance.now() - start)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [key])

  return { elapsed, now: () => (startRef.current === null ? 0 : Math.max(0, performance.now() - startRef.current)) }
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 방금 나온 시도 한 번 — 공이 날아가고 화살이 날아가는 연출의 재료 */
export interface Shot {
  key: string
  teamId: number
  index: number
  attempt: OlympicsAttempt
}

/**
 * 새 시도가 생기면 그 시도를 알려 준다. 연출이 끝날 때까지(delayMs) pending이 true라서,
 * 결과(⭕/점수/꽂힌 화살)를 연출보다 먼저 보여 주지 않도록 화면에서 숨기는 데 쓴다.
 * 라운드가 바뀌거나 처음 들어왔을 때 이미 있던 시도는 연출하지 않는다.
 */
export function useShotTracker(attempts: Record<number, OlympicsAttempt[]>, roundId: string, delayMs: number) {
  const seen = useRef<{ round: string; counts: Record<number, number> } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const previous = seen.current
    const counts: Record<number, number> = {}
    for (const [id, list] of Object.entries(attempts)) counts[Number(id)] = list.length
    seen.current = { round: roundId, counts }
    if (!previous || previous.round !== roundId) {
      if (timer.current) clearTimeout(timer.current)
      setShot(null)
      setPending(false)
      return
    }
    for (const [id, list] of Object.entries(attempts)) {
      const teamId = Number(id)
      if (list.length <= (previous.counts[teamId] ?? 0)) continue
      const index = list.length - 1
      setShot({ key: `${roundId}-${teamId}-${index}`, teamId, index, attempt: list[index] })
      setPending(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setPending(false), delayMs)
    }
  }, [attempts, roundId, delayMs])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return { shot, pending }
}

/** 연출 중인 마지막 시도는 아직 기록 칸에 보여 주지 않는다 */
export function visibleAttempts(attempts: Record<number, OlympicsAttempt[]>, shot: Shot | null, pending: boolean) {
  if (!shot || !pending || !attempts[shot.teamId]) return attempts
  return { ...attempts, [shot.teamId]: attempts[shot.teamId].slice(0, shot.index) }
}

/** 농구: 좌우로 오가는 게이지 — 초록 영역에 있을 때 누른다 */
export function BasketballGauge({ gauge, elapsed, label = '농구 게이지' }: { gauge: OlympicsGauge; elapsed: number; label?: string }) {
  const position = basketballPosition(gauge, elapsed)
  const zoneLeft = ((gauge.zoneCenter ?? 0.5) - (gauge.zoneHalf ?? 0.1)) * 100
  const zoneWidth = (gauge.zoneHalf ?? 0.1) * 2 * 100
  return (
    <div className="party-oly-gauge" aria-label={label}>
      <div className="party-oly-gauge-zone" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} />
      <div className="party-oly-gauge-marker" style={{ left: `${position * 100}%` }} />
    </div>
  )
}

/**
 * 볼링·골프: 두 번 멈추는 게이지를 따로 보여 준다 — 방향은 가로 게이지, 힘은 오른쪽의 세로 게이지.
 * 방향을 정하면 가로 게이지의 표시가 그 자리에 고정되고(점선), 세로 게이지가 움직이기 시작한다.
 */
export function TwoStageGauges({ gauge, elapsed, children }: { gauge: OlympicsGauge | null; elapsed: number; children: ReactNode }) {
  const aiming = gauge !== null && (gauge.stage ?? 0) === 0
  const powering = gauge !== null && gauge.stage === 1
  const aimPosition = aiming ? basketballPosition(gauge, elapsed) : (gauge?.aimAt ?? null)
  const powerPosition = powering ? basketballPosition(gauge, elapsed) : null
  const powerLow = powering ? (gauge.zoneCenter ?? 0.5) - (gauge.zoneHalf ?? 0.04) : 0
  const powerHigh = powering ? (gauge.zoneCenter ?? 0.5) + (gauge.zoneHalf ?? 0.04) : 0
  return (
    <div className="party-oly-twostage">
      <div className="party-oly-twostage-main">
        {children}
        <div className={`party-oly-gauge${aiming ? '' : ' party-oly-gauge-idle'}`} aria-label="방향 게이지">
          <div className="party-oly-gauge-zone" style={{ left: '46%', width: '8%' }} />
          {aimPosition !== null && <div className={`party-oly-gauge-marker${aiming ? '' : ' party-oly-gauge-marker-locked'}`} style={{ left: `${aimPosition * 100}%` }} />}
        </div>
        <small className="party-oly-gauge-label">① 방향 (가로) — 가운데 초록 선에 맞춰요</small>
      </div>
      <div className="party-oly-vgauge">
        <div className={`party-oly-vgauge-bar${powering ? '' : ' party-oly-gauge-idle'}`} aria-label="힘 게이지">
          {powering && <div className="party-oly-vgauge-zone" style={{ bottom: `${powerLow * 100}%`, height: `${(powerHigh - powerLow) * 100}%` }} />}
          {powerPosition !== null && <div className="party-oly-vgauge-marker" style={{ bottom: `${powerPosition * 100}%` }} />}
        </div>
        <small className="party-oly-gauge-label">② 힘 (세로)</small>
      </div>
    </div>
  )
}

interface Point {
  x: number
  y: number
}

// 농구 코트 좌표 (viewBox 100 x 64)
const BALL_REST: Point = { x: 16, y: 50 }
const RIM_CENTER: Point = { x: 68, y: 24 }
const FLOOR_BALL_Y = 51.5

/** from에서 to까지 포물선으로 날아가는 공의 키프레임 (시작점은 빼서 이어 붙일 때 겹치지 않게 한다) */
function arc(from: Point, to: Point, lift: number, o0: number, o1: number, steps: number, scale = 1): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const offset = o0 + (o1 - o0) * t
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t)
    frames.push(ballFrame(offset, x, y, 1, scale))
  }
  return frames
}

function ballFrame(offset: number, x: number, y: number, opacity = 1, scale = 1): Keyframe {
  return { offset, transform: `translate(${x}px, ${y}px) rotate(${Math.round(offset * 720)}deg) scale(${scale})`, opacity }
}

/** 시도 결과에 맞는 공의 비행: 골인이면 림을 통과해 그물을 지나 바닥으로, 아니면 림·백보드에 맞고 튕겨 나간다 */
function basketballFrames(attempt: OlympicsAttempt, zoneCenter: number | null): Keyframe[] {
  const frames: Keyframe[] = [ballFrame(0, BALL_REST.x, BALL_REST.y)]
  const floor = (x: number): Point => ({ x, y: FLOOR_BALL_Y })
  if (attempt.hit) {
    const aboveRim = { x: RIM_CENTER.x, y: RIM_CENTER.y - 4 }
    frames.push(...arc(BALL_REST, aboveRim, 26, 0, 0.45, 14))
    frames.push(ballFrame(0.6, RIM_CENTER.x, 36, 1, 0.9))
    frames.push(ballFrame(0.76, RIM_CENTER.x, FLOOR_BALL_Y))
    frames.push(...arc(floor(RIM_CENTER.x), floor(RIM_CENTER.x + 6), 7, 0.76, 0.86, 4))
    frames.push(ballFrame(0.92, RIM_CENTER.x + 9, FLOOR_BALL_Y, 0))
  } else if (!attempt.at) {
    // 시간 안에 던지지 못했다: 힘없이 떨어지는 공
    frames.push(...arc(BALL_REST, floor(54), 22, 0, 0.6, 14))
    frames.push(ballFrame(0.9, 62, FLOOR_BALL_Y, 0))
  } else if (attempt.at.x < (zoneCenter ?? 0.5)) {
    // 일찍 던졌다: 림 앞에 맞고 튕겨 나온다
    const rimFront = { x: RIM_CENTER.x - 8, y: RIM_CENTER.y - 3 }
    frames.push(...arc(BALL_REST, rimFront, 22, 0, 0.4, 12))
    frames.push(...arc(rimFront, floor(46), 16, 0.4, 0.75, 10))
    frames.push(ballFrame(0.9, 38, FLOOR_BALL_Y, 0))
  } else {
    // 너무 세게 던졌다: 백보드 위로 넘어가 화면 밖으로 날아간다
    frames.push(...arc(BALL_REST, { x: 112, y: 30 }, 36, 0, 0.55, 16))
    frames.push(ballFrame(0.6, 112, 30, 0))
  }
  frames.push(ballFrame(0.93, BALL_REST.x, BALL_REST.y, 0))
  frames.push(ballFrame(1, BALL_REST.x, BALL_REST.y, 1))
  return frames
}

export const BASKETBALL_SHOT_MS = 1000
export const BASKETBALL_REVEAL_MS = 900

/** 농구 코트: 던지면 공이 포물선으로 날아가 골대에 들어가거나 림에 튕긴다 */
export function BasketballCourt({ shot, pending, zoneCenter }: { shot: Shot | null; pending: boolean; zoneCenter: number | null }) {
  const ball = useRef<SVGGElement>(null)
  const shotKey = shot?.key
  const attemptRef = useRef(shot?.attempt)
  attemptRef.current = shot?.attempt
  const zoneRef = useRef(zoneCenter)
  zoneRef.current = zoneCenter

  useEffect(() => {
    const element = ball.current
    const attempt = attemptRef.current
    if (!shotKey || !element || !attempt || prefersReducedMotion() || typeof element.animate !== 'function') return
    const animation = element.animate(basketballFrames(attempt, zoneRef.current), { duration: BASKETBALL_SHOT_MS, easing: 'linear' })
    return () => animation.cancel()
  }, [shotKey])

  const hit = shot?.attempt.hit ?? false
  // 다음 게이지가 시작되면 zoneCenter가 바뀌므로, 말풍선 문구는 던진 순간 값으로 고정한다
  const tooStrong = useMemo(
    () => !hit && shot?.attempt.at != null && shot.attempt.at.x > (zoneRef.current ?? 0.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shotKey],
  )
  return (
    <svg className="party-oly-court" viewBox="0 0 100 64" role="img" aria-label="농구 코트">
      <rect x="0" y="56" width="100" height="8" fill="#d9a066" />
      <line x1="0" y1="56" x2="100" y2="56" stroke="#a8743c" strokeWidth="0.8" />
      <rect x="83" y="22" width="2.4" height="34" fill="#6b7280" />
      <rect x="79" y="8" width="2.6" height="22" rx="0.6" fill="#fff" stroke="#6b7280" strokeWidth="0.6" />
      <rect x="79.4" y="17" width="2" height="7" fill="#e8501e" opacity="0.7" />
      <line x1="76" y1={RIM_CENTER.y} x2="79" y2={RIM_CENTER.y} stroke="#e8501e" strokeWidth="1.2" />
      <g key={`net-${shot?.key ?? 'none'}`} className={`party-oly-net${hit ? ' party-oly-net-swish' : ''}`}>
        <path d="M60 24 L64 38 M64 24 L66 38 M68 24 L68 38 M72 24 L70 38 M76 24 L72 38 M61 29 H75 M62.5 34 H73.5" stroke="#f1f5f9" strokeWidth="0.55" fill="none" opacity="0.9" />
        <path d="M60 24 L64 38 H72 L76 24" stroke="#f1f5f9" strokeWidth="0.7" fill="rgba(255,255,255,0.15)" />
      </g>
      <ellipse cx={RIM_CENTER.x} cy={RIM_CENTER.y} rx="8" ry="1.6" fill="none" stroke="#e8501e" strokeWidth="1.4" />
      <g ref={ball} style={{ transform: `translate(${BALL_REST.x}px, ${BALL_REST.y}px)` }}>
        <g className={pending ? undefined : 'party-oly-ball-idle'}>
          <circle r="4.5" fill="#ee7a30" stroke="#8a3a0e" strokeWidth="0.5" />
          <path d="M-4.5 0 H4.5 M0 -4.5 V4.5 M-3.2 -3.2 Q0 0 -3.2 3.2 M3.2 -3.2 Q0 0 3.2 3.2" stroke="#8a3a0e" strokeWidth="0.5" fill="none" />
        </g>
      </g>
      {shot && (
        <text key={shot.key} className={`party-oly-pop${hit ? ' party-oly-pop-hit' : ''}`} x="52" y="14" textAnchor="middle" style={{ animationDelay: `${BASKETBALL_REVEAL_MS - 380}ms` }}>
          {hit ? '골인! 🎉' : tooStrong ? '너무 세요!' : '아쉬워요'}
        </text>
      )}
    </svg>
  )
}

const RING_COLORS = ['#ffffff', '#ffffff', '#111111', '#111111', '#2f7bd1', '#2f7bd1', '#d93b3b', '#d93b3b', '#f2c01e', '#f2c01e']

// 양궁 좌표 (viewBox 100 x 134): 과녁은 위쪽 100x100, 활은 아래쪽
const BOW_TIP: Point = { x: 50, y: 102 }
export const ARCHERY_FLIGHT_MS = 1000
export const ARCHERY_REVEAL_MS = 500

function arrowFrames(attempt: OlympicsAttempt): Keyframe[] {
  const rest = (scale: number) => `translate(${BOW_TIP.x}px, ${BOW_TIP.y}px) rotate(0deg) scale(${scale})`
  const target = attempt.at ? { x: attempt.at.x * 100, y: attempt.at.y * 100 } : { x: 50, y: -28 }
  const angle = (Math.atan2(target.x - BOW_TIP.x, BOW_TIP.y - target.y) * 180) / Math.PI
  const landed = `translate(${target.x}px, ${target.y}px) rotate(${angle}deg) scale(0.8)`
  return [
    { offset: 0, transform: rest(1.3), opacity: 1, easing: 'cubic-bezier(0.12, 0.7, 0.3, 1)' },
    { offset: 0.5, transform: landed, opacity: 1 },
    { offset: 0.72, transform: landed, opacity: attempt.at ? 1 : 0 },
    { offset: 0.74, transform: landed, opacity: 0 },
    { offset: 0.9, transform: rest(1.3), opacity: 0 },
    { offset: 1, transform: rest(1.3), opacity: 1 },
  ]
}

/** 양궁: 과녁 위를 휘젓는 조준점 — 중앙에 올 때 누르면 활에서 화살이 날아가 꽂힌다. 이미 꽂힌 화살은 점으로 남는다 */
export function ArcheryTarget({ gauge, elapsed, arrows, shot }: { gauge: OlympicsGauge | null; elapsed: number; arrows: OlympicsAttempt[]; shot: Shot | null }) {
  const aim = gauge ? archeryPosition(gauge, elapsed) : null
  const ring = ARCHERY_RING_WIDTH * 100
  const arrow = useRef<SVGGElement>(null)
  const string = useRef<SVGPathElement>(null)
  const shotKey = shot?.key
  const attemptRef = useRef(shot?.attempt)
  attemptRef.current = shot?.attempt

  useEffect(() => {
    const attempt = attemptRef.current
    if (!shotKey || !attempt || prefersReducedMotion()) return
    const animations: Animation[] = []
    if (arrow.current && typeof arrow.current.animate === 'function') {
      animations.push(arrow.current.animate(arrowFrames(attempt), { duration: ARCHERY_FLIGHT_MS, easing: 'linear' }))
    }
    if (string.current && typeof string.current.animate === 'function') {
      animations.push(
        string.current.animate(
          [
            { offset: 0, transform: 'scaleY(1)' },
            { offset: 0.04, transform: 'scaleY(0.02)' },
            { offset: 0.09, transform: 'scaleY(-0.35)' },
            { offset: 0.15, transform: 'scaleY(0.2)' },
            { offset: 0.22, transform: 'scaleY(0.02)' },
            { offset: 0.9, transform: 'scaleY(0.02)' },
            { offset: 1, transform: 'scaleY(1)' },
          ],
          { duration: ARCHERY_FLIGHT_MS, easing: 'linear' },
        ),
      )
    }
    return () => animations.forEach((animation) => animation.cancel())
  }, [shotKey])

  const landedAt = shot?.attempt.at
  return (
    <svg className="party-oly-target" viewBox="0 0 100 134" role="img" aria-label="양궁 과녁">
      <rect x="0" y="0" width="100" height="100" fill="none" />
      {RING_COLORS.map((color, index) => (
        <circle key={index} cx="50" cy="50" r={ring * (RING_COLORS.length - index)} fill={color} stroke="#555" strokeWidth="0.3" />
      ))}
      {arrows.map((item, index) =>
        item.at ? <circle key={index} cx={item.at.x * 100} cy={item.at.y * 100} r="1.6" fill="#7a3fb8" stroke="#fff" strokeWidth="0.5" /> : null,
      )}
      {aim && (
        <g transform={`translate(${aim.x * 100} ${aim.y * 100})`}>
          <circle r="4" fill="none" stroke="#e11d1d" strokeWidth="0.9" />
          <line x1="-6" y1="0" x2="6" y2="0" stroke="#e11d1d" strokeWidth="0.9" />
          <line x1="0" y1="-6" x2="0" y2="6" stroke="#e11d1d" strokeWidth="0.9" />
        </g>
      )}
      {/* 활 */}
      <path d="M33 126 Q50 106 67 126" fill="none" stroke="#8b5a2b" strokeWidth="2.2" strokeLinecap="round" />
      <path ref={string} d="M33 126 L50 134 L67 126" fill="none" stroke="#6b7280" strokeWidth="0.7" style={{ transformOrigin: '50px 126px' }} />
      {/* 시위에 걸린 화살 — 쏘면 과녁으로 날아간다 */}
      <g ref={arrow} style={{ transform: `translate(${BOW_TIP.x}px, ${BOW_TIP.y}px) scale(1.3)` }}>
        <line x1="0" y1="0" x2="0" y2="22" stroke="#a16207" strokeWidth="1" strokeLinecap="round" />
        <polygon points="0,-3.4 -2,2 2,2" fill="#475569" />
        <path d="M0 22 L-2.2 25 M0 22 L2.2 25 M0 19.5 L-2.2 22.5 M0 19.5 L2.2 22.5" stroke="#d93b3b" strokeWidth="0.9" strokeLinecap="round" />
      </g>
      {shot && (
        <text
          key={shot.key}
          className={`party-oly-pop${shot.attempt.score >= 9 ? ' party-oly-pop-hit' : ''}`}
          x={landedAt ? Math.min(82, Math.max(18, landedAt.x * 100)) : 50}
          y={landedAt ? Math.max(12, landedAt.y * 100 - 7) : 14}
          textAnchor="middle"
          style={{ animationDelay: `${ARCHERY_REVEAL_MS - 80}ms` }}
        >
          {landedAt ? `${shot.attempt.score}점!` : '빗나갔어요'}
        </text>
      )}
    </svg>
  )
}

/** 기록 칸 한 개의 표시 */
function chipText(sportId: string, attempt: OlympicsAttempt): string | number {
  if (sportId === 'archery' || sportId === 'shooting') return attempt.score
  if (sportId === 'bowling') return attempt.score === 10 ? '🎳' : attempt.score
  if (sportId === 'golf') return attempt.score === 10 ? '⛳' : attempt.score
  if (sportId === 'gymnastics' || sportId === 'skating') return attempt.hit ? attempt.score : '✖'
  if (sportId === 'weightlifting') return attempt.hit ? attempt.score : '✖'
  return attempt.hit ? '⭕' : '✖'
}

/** 팀 줄 오른쪽의 합계 표시 — 역도는 합이 아니라 성공한 가장 무거운 기록 */
function sumText(sportId: string, sum: number, best: number): string {
  if (sportId === 'archery' || sportId === 'shooting') return `${sum}점`
  if (sportId === 'golf' || sportId === 'gymnastics' || sportId === 'skating') return `${sum}점`
  if (sportId === 'bowling') return `${sum}핀`
  if (sportId === 'weightlifting') return best > 0 ? `${best}kg` : '-'
  return `${sum}골`
}

interface AttemptsProps {
  sportId: string
  total: number
  teams: TeamInfo[]
  order: number[]
  attempts: Record<number, OlympicsAttempt[]>
  turnTeamId: number | null
  nameOf: (teamId: number) => string
}

/** 팀별 시도 기록 — 농구는 ✅/❌, 양궁은 점수. 지금 하는 팀은 강조한다 */
export function AttemptsPanel({ sportId, total, order, attempts, turnTeamId, nameOf }: AttemptsProps) {
  return (
    <ul className="party-oly-attempts">
      {order.map((teamId) => {
        const list = attempts[teamId] ?? []
        const sum = list.reduce((acc, a) => acc + a.score, 0)
        const best = list.reduce((max, a) => (a.hit ? Math.max(max, a.score) : max), 0)
        return (
          <li key={teamId} className={`party-oly-attempt-row ${teamColorClass(teamId)}${teamId === turnTeamId ? ' party-oly-attempt-row-turn' : ''}`}>
            <span className="party-oly-attempt-team">
              {teamEmoji(teamId)} {nameOf(teamId)}
            </span>
            <span className="party-oly-attempt-list">
              {Array.from({ length: total }, (_, index) => {
                const attempt = list[index]
                if (!attempt) return <span key={index} className="party-oly-chip party-oly-chip-empty">·</span>
                return (
                  <span key={index} className={`party-oly-chip${attempt.hit ? ' party-oly-chip-hit' : ' party-oly-chip-miss'}`}>
                    {chipText(sportId, attempt)}
                  </span>
                )
              })}
            </span>
            <strong className="party-oly-attempt-sum">{sumText(sportId, sum, best)}</strong>
          </li>
        )
      })}
    </ul>
  )
}

interface TrackProps {
  teams: TeamInfo[]
  positions: Record<number, number>
  finishTaps: number
  nameOf: (teamId: number) => string
  myTeamId: number | undefined
}

/** 달리는 사람 — 팔다리가 움직이는 모습. running일 때만 뛴다 */
function Runner({ running, finished }: { running: boolean; finished: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`party-oly-runner${running ? ' party-oly-runner-running' : ''}${finished ? ' party-oly-runner-finished' : ''}`} aria-hidden="true">
      <g className="party-oly-runner-limb party-oly-runner-leg-back">
        <polyline points="11,14 11,18 6,20" />
      </g>
      <g className="party-oly-runner-limb party-oly-runner-arm-back">
        <polyline points="12,9 8,11 7,14" />
      </g>
      <line x1="12" y1="8" x2="11" y2="14" className="party-oly-runner-body" />
      <circle cx="13" cy="4.6" r="2.6" className="party-oly-runner-head" />
      <g className="party-oly-runner-limb party-oly-runner-leg-front">
        <polyline points="11,14 15,16 14,22" />
      </g>
      <g className="party-oly-runner-limb party-oly-runner-arm-front">
        <polyline points="12,9 16,10 18,7" />
      </g>
    </svg>
  )
}

const RUNNING_HOLD_MS = 350
/** 레인 안에서 출발선·결승선 때문에 비워 둘 앞뒤 여백(%) */
const LANE_START = 6
const LANE_SPAN = 86

function Lane({ team, taps, finishTaps, nameOf, mine }: { team: TeamInfo; taps: number; finishTaps: number; nameOf: (teamId: number) => string; mine: boolean }) {
  const [running, setRunning] = useState(false)
  const lastTaps = useRef(taps)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (taps > lastTaps.current) {
      setRunning(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setRunning(false), RUNNING_HOLD_MS)
    }
    lastTaps.current = taps
  }, [taps])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const finished = taps >= finishTaps
  const percent = (taps / finishTaps) * 100
  const left = LANE_START + (percent * LANE_SPAN) / 100
  return (
    <li className={`party-oly-lane${mine ? ' party-oly-lane-mine' : ''}`}>
      <span className="party-oly-lane-name">
        {teamEmoji(team.id)} {nameOf(team.id)}
      </span>
      <div className={`party-oly-lane-track${running && !finished ? ' party-oly-lane-track-running' : ''}`} style={{ '--lane-color': `rgb(${teamRgb(team.id)})` } as CSSProperties}>
        <div className="party-oly-lane-fill" style={{ width: `${left}%` }} />
        <span className="party-oly-lane-start" />
        <span className="party-oly-lane-finish" />
        <span className="party-oly-lane-runner" style={{ left: `${left}%` }}>
          <Runner running={running && !finished} finished={finished} />
        </span>
      </div>
      <span className="party-oly-lane-count">{taps}</span>
    </li>
  )
}

/** 육상: 모든 팀 대표가 동시에 달리는 트랙 — 가로 위치로 서로 누가 앞서는지 한눈에 비교한다 */
export function TrackLanes({ teams, positions, finishTaps, nameOf, myTeamId }: TrackProps) {
  return (
    <ul className="party-oly-lanes">
      {teams.map((team) => (
        <Lane key={team.id} team={team} taps={Math.min(finishTaps, positions[team.id] ?? 0)} finishTaps={finishTaps} nameOf={nameOf} mine={team.id === myTeamId} />
      ))}
    </ul>
  )
}

/** 헤엄치는 사람 — 옆에서 본 모습. 팔이 번갈아 돌고 다리가 퍼덕이며, swimming일 때만 움직인다 */
function Swimmer({ swimming, finished }: { swimming: boolean; finished: boolean }) {
  return (
    <svg viewBox="0 0 44 22" className={`party-oly-swimmer${swimming ? ' party-oly-swimmer-swimming' : ''}${finished ? ' party-oly-swimmer-finished' : ''}`} aria-hidden="true">
      <g className="party-oly-swimmer-leg party-oly-swimmer-leg-a">
        <line x1="10" y1="12" x2="2" y2="14" />
      </g>
      <g className="party-oly-swimmer-leg party-oly-swimmer-leg-b">
        <line x1="10" y1="12" x2="2" y2="10" />
      </g>
      <ellipse cx="22" cy="12" rx="13" ry="3.6" className="party-oly-swimmer-body" />
      <g className="party-oly-swimmer-arm party-oly-swimmer-arm-a">
        <line x1="28" y1="11" x2="38" y2="11" />
      </g>
      <g className="party-oly-swimmer-arm party-oly-swimmer-arm-b">
        <line x1="28" y1="11" x2="38" y2="11" />
      </g>
      <circle cx="36" cy="10.5" r="3.6" className="party-oly-swimmer-cap" />
      <circle cx="37.2" cy="9.6" r="0.6" className="party-oly-swimmer-eye" />
    </svg>
  )
}

function SwimLane({ team, strokes, finishStrokes, nameOf, mine }: { team: TeamInfo; strokes: number; finishStrokes: number; nameOf: (teamId: number) => string; mine: boolean }) {
  const [swimming, setSwimming] = useState(false)
  const lastStrokes = useRef(strokes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (strokes > lastStrokes.current) {
      setSwimming(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSwimming(false), RUNNING_HOLD_MS)
    }
    lastStrokes.current = strokes
  }, [strokes])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const finished = strokes >= finishStrokes
  const percent = (strokes / finishStrokes) * 100
  const left = LANE_START + (percent * LANE_SPAN) / 100
  return (
    <li className={`party-oly-lane party-oly-pool-row${mine ? ' party-oly-lane-mine' : ''}`}>
      <span className="party-oly-lane-name">
        {teamEmoji(team.id)} {nameOf(team.id)}
      </span>
      <div className={`party-oly-pool${swimming && !finished ? ' party-oly-pool-moving' : ''}`} style={{ '--lane-color': `rgb(${teamRgb(team.id)})` } as CSSProperties}>
        <div className="party-oly-pool-trail" style={{ width: `${left}%` }} />
        <span className="party-oly-pool-wall party-oly-pool-wall-start" />
        <span className="party-oly-pool-wall party-oly-pool-wall-finish" />
        <span className="party-oly-lane-runner party-oly-pool-swimmer" style={{ left: `${left}%` }}>
          <Swimmer swimming={swimming && !finished} finished={finished} />
        </span>
      </div>
      <span className="party-oly-lane-count">{strokes}</span>
    </li>
  )
}

/** 수영: 모든 팀 대표가 동시에 헤엄치는 수영장 — 레인마다 로프가 쳐져 있고 가로 위치로 서로 누가 앞서는지 비교한다 */
export function SwimLanes({ teams, positions, finishTaps, nameOf, myTeamId }: TrackProps) {
  return (
    <ul className="party-oly-lanes">
      {teams.map((team) => (
        <SwimLane key={team.id} team={team} strokes={Math.min(finishTaps, positions[team.id] ?? 0)} finishStrokes={finishTaps} nameOf={nameOf} mine={team.id === myTeamId} />
      ))}
    </ul>
  )
}
