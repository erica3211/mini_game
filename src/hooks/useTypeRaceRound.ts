import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type KeyboardEvent, type RefObject } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type Phase = 'waiting' | 'racing' | 'finished'

export interface TypeRaceStartSignal {
  sentences: string[]
  slotColors: string[]
  slotOfPlayer: Record<PlayerId, number>
  myConfirmedChars: number
  elapsedMs: number
}

// 최근 이 구간(ms) 동안의 실제 키보드 입력 횟수로 순간 타자 속도(분당 타수)를 계산한다
const CPM_WINDOW_MS = 2_000
// 이 분당 타수(실제 키 입력 횟수 기준, 완성 글자 기준 아님 — 한글 음절 하나가 평균 2~3키이므로
// 옛 완성-글자 기준 상한(480)에 대략적인 평균 배수(×2.2)를 곱해 잡았다)를 내면 speedFactor가 1(최고 속도)에 도달한다
const MAX_CPM = 1_000
// speedFactor를 볼록하게 만들어 고속 구간에서 가속감이 커지도록 한다 (shoutRace의 dB 가속 곡선과 같은 취지)
const ACCEL_EXPONENT = 1.6
const MOVING_EPSILON = 0.02
// 진행률(confirmedChars)을 서버로 보내는 주기
const PROGRESS_EMIT_MS = 150
// 화면에 보이는 CPM/진행률을 state에 반영하는 주기 (매 프레임 setState하면 리렌더가 과해진다)
const DISPLAY_REFRESH_MS = 100
// 관성: 타자 속도가 커질 땐 즉각 반응하지만, 느려지거나 멈추면 훨씬 느리게 줄어들며 서서히 멈춘다
const VISUAL_SPEED_RISE_PER_SEC = 6
const VISUAL_SPEED_FALL_PER_SEC = 1.2
// 완주 후("finished") 차가 완전히 멈추지 않고 천천히 굴러가는 것처럼 보이도록 고정해두는 시각 속도
const FINISHED_IDLE_SPEED = 0.15
// .party-race-car의 CSS left:30%와 반드시 같은 값을 유지해야 시작선/결승선이 차와 같은 좌표계에서 만난다
const CAR_LEFT_PERCENT = 30
const START_LINE_TRAVEL_PERCENT = 100
const FINISH_LINE_TRAVEL_PERCENT = 220
// 시각 진행률이 실제 진행률(정확한 confirmedChars 기준)을 관성 있게 뒤따라가는 속도
const VISUAL_PROGRESS_FOLLOW_RATE = 3
const ROAD_TOTAL_PX = 900
const MOUNTAINS_TOTAL_PX = 500
const CLOUDS_TOTAL_PX = 300
const WHEEL_TOTAL_DEG = 5400
const FINISHED_IDLE_ROAD_PX_PER_SEC = 14
const FINISHED_IDLE_MOUNTAINS_PX_PER_SEC = 6
const FINISHED_IDLE_CLOUDS_PX_PER_SEC = 3
const FINISHED_IDLE_WHEEL_DEG_PER_SEC = 240
const ROAD_TILE_PX = 60
const CLOUDS_TILE_PX = 220
// 오타 흔들림(shake) 애니메이션을 보여주는 시간 — CSS의 typerace-shake 길이(0.18s)보다 살짝 여유를 둔다
const WRONG_FLASH_MS = 220

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// 평균 타수 계산에서 제외할 키 — Backspace/Delete는 "고치는" 동작이라 실제 입력으로 치지 않고,
// 나머지는 문자 하나 만들어내지 않는 제어/이동 키다. 이 목록에 없는 키는(한글 조합 중 눌리는
// 'Process' 포함) 전부 "실제 키보드 입력 1회"로 센다
const NON_CONTENT_KEYS = new Set([
  'Backspace',
  'Delete',
  'Enter',
  'Tab',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'ContextMenu',
])

/** value가 target의 접두사로서 몇 글자까지 정확히 일치하는지 계산한다 — 관전 모드에서 상대방의
 *  typed 값(오타가 그대로 남아있을 수 있음)을 채점할 때도 컴포넌트 쪽에서 그대로 재사용한다 */
export function matchingPrefixLength(value: string, target: string): number {
  const max = Math.min(value.length, target.length)
  let i = 0
  while (i < max && value[i] === target[i]) i++
  return i
}

/**
 * 문장 시퀀스를 정확하게 입력해 나가는 훅. 한글은 자모가 조합되는 도중(IME composition) 중간 글자가
 * 최종 글자와 다른 코드포인트라 매 onChange마다 정오답을 판정하면 조합 중인 정상 입력도 오타로
 * 오판하므로, 오타 판정/되돌리기는 항상 compositionend(또는 조합이 아예 없는 입력) 시점에만 수행한다.
 * 시각 연출(도로 스크롤 속도, 차체 틸트, 게이지 바늘)은 shoutRace와 동일하게 매 프레임 DOM에 직접
 * 반영한다(리렌더 없이) — 다만 진행률 자체는 dB처럼 추정치가 아니라 confirmedChars/totalChars로 정확히
 * 계산되므로, 시각 진행률(visualProgressRef)은 이 정확한 값을 관성 있게 뒤따라가기만 하면 된다.
 */
export function useTypeRaceRound(
  socket: PartySocket,
  roundKey: string,
  startSignal: TypeRaceStartSignal | null,
  playerId: PlayerId | null,
) {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [sentences, setSentences] = useState<string[]>([])
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [typedValue, setTypedValue] = useState('')
  // typedValue와 달리 '실제로 맞게 친 접두사 길이'만 담는다 — 오타를 쳐도 입력창(typedValue)은 그대로 두므로
  // (사용자가 직접 백스페이스로 고침), 제시문의 초록/커서 표시는 이 값 기준으로 그려야 한다
  const [matchedLen, setMatchedLen] = useState(0)
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [cpm, setCpm] = useState(0)
  const [myProgress, setMyProgress] = useState(0)
  const [opponentProgress, setOpponentProgress] = useState<Record<PlayerId, number>>({})
  const [opponentLive, setOpponentLive] = useState<Record<PlayerId, { sentenceIndex: number; typed: string }>>({})
  const [spectatingId, setSpectatingId] = useState<PlayerId | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const startLineRef = useRef<HTMLDivElement | null>(null)
  const finishLineRef = useRef<HTMLDivElement | null>(null)
  const roadLineRef = useRef<HTMLDivElement | null>(null)
  const mountainsRef = useRef<HTMLDivElement | null>(null)
  const cloudsRef = useRef<HTMLDivElement | null>(null)
  const wheelFrontRef = useRef<HTMLDivElement | null>(null)
  const wheelBackRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const sentencesRef = useRef<string[]>([])
  const sentenceIndexRef = useRef(0)
  const typedValueRef = useRef('')
  const totalCharsRef = useRef(0)
  const confirmedTotalRef = useRef(0)
  const finishedRef = useRef(false)
  const isComposingRef = useRef(false)
  const keystrokeTimestampsRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const cpmRef = useRef(0)
  const visualSpeedRef = useRef(0)
  const visualProgressRef = useRef(0)
  const progressRef = useRef(0)
  const roadOffsetRef = useRef(0)
  const mountainsOffsetRef = useRef(0)
  const cloudsOffsetRef = useRef(0)
  const wheelRotationRef = useRef(0)
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 평균 타수(avgCpm) 계산 전용 — confirmedChars(정오답 판정)와는 별개로, 실제 키보드 입력 누적 횟수와
  // 첫 입력~마지막 입력 시각을 그대로 서버에 보고한다 (라운드 제한시간 전체가 아니라 "실제로 타이핑한 시간"만 분모로 쓰기 위함)
  const totalKeystrokesRef = useRef(0)
  const firstKeystrokeAtRef = useRef<number | null>(null)
  const lastKeystrokeAtRef = useRef<number | null>(null)

  const startedAt = useMonotonicStartedAt(roundKey, startSignal, phase === 'finished' ? 'finished' : 'running')

  // roundKey(=새 라운드)가 바뀌면 이전 라운드에서 남은 상태를 모두 비운다
  useEffect(() => {
    setPhase('waiting')
    setSentences([])
    setSentenceIndex(0)
    setTypedValue('')
    setMatchedLen(0)
    setShakeIndex(null)
    setCpm(0)
    setMyProgress(0)
    setOpponentProgress({})
    setOpponentLive({})
    setSpectatingId(null)
    sentencesRef.current = []
    sentenceIndexRef.current = 0
    typedValueRef.current = ''
    totalCharsRef.current = 0
    confirmedTotalRef.current = 0
    finishedRef.current = false
    isComposingRef.current = false
    keystrokeTimestampsRef.current = []
    cpmRef.current = 0
    visualSpeedRef.current = 0
    visualProgressRef.current = 0
    progressRef.current = 0
    roadOffsetRef.current = 0
    mountainsOffsetRef.current = 0
    cloudsOffsetRef.current = 0
    wheelRotationRef.current = 0
    totalKeystrokesRef.current = 0
    firstKeystrokeAtRef.current = null
    lastKeystrokeAtRef.current = null
  }, [roundKey])

  // typeRace:roundStart 도착 — 문장 시퀀스를 확정한다. myConfirmedChars > 0(재접속)이면 그 글자수만큼
  // 문장 인덱스/문장 내 오프셋을 되짚어 복원한다
  useEffect(() => {
    if (!startSignal) return
    sentencesRef.current = startSignal.sentences
    const totalChars = startSignal.sentences.reduce((sum, s) => sum + s.length, 0)
    totalCharsRef.current = totalChars

    let remaining = startSignal.myConfirmedChars
    let index = 0
    while (index < startSignal.sentences.length && remaining >= startSignal.sentences[index].length) {
      remaining -= startSignal.sentences[index].length
      index++
    }
    const restoredTyped = index < startSignal.sentences.length ? startSignal.sentences[index].slice(0, remaining) : ''

    sentenceIndexRef.current = index
    typedValueRef.current = restoredTyped
    confirmedTotalRef.current = startSignal.myConfirmedChars
    const restoredProgress = totalChars > 0 ? (startSignal.myConfirmedChars / totalChars) * 100 : 0
    progressRef.current = restoredProgress
    visualProgressRef.current = restoredProgress
    finishedRef.current = startSignal.myConfirmedChars >= totalChars && totalChars > 0

    setSentences(startSignal.sentences)
    setSentenceIndex(index)
    setTypedValue(restoredTyped)
    setMatchedLen(restoredTyped.length)
    setMyProgress(restoredProgress)
    setPhase(finishedRef.current ? 'finished' : 'racing')
  }, [startSignal])

  useEffect(() => {
    if (phase === 'racing') inputRef.current?.focus()
  }, [phase])

  const recordKeystroke = (now: number) => {
    const timestamps = keystrokeTimestampsRef.current
    timestamps.push(now)
    const cutoff = now - CPM_WINDOW_MS
    while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift()
  }

  const advanceToNextSentence = () => {
    const nextIndex = sentenceIndexRef.current + 1
    if (nextIndex >= sentencesRef.current.length) {
      finishedRef.current = true
      progressRef.current = 100
      visualProgressRef.current = 100
      setMyProgress(100)
      const elapsedMs = startedAt !== null ? performance.now() - startedAt : 0
      socket.emit('typeRace:finish', { elapsedMs, keystrokes: totalKeystrokesRef.current })
      setPhase('finished')
      return
    }
    sentenceIndexRef.current = nextIndex
    typedValueRef.current = ''
    setSentenceIndex(nextIndex)
    setTypedValue('')
    setMatchedLen(0)
    // 이전 문장에서 흔들림(shake)이 아직 꺼지기 전에 문장이 넘어가면, 새 문장의 같은 인덱스 글자가
    // 엉뚱하게 빨갛게 보일 수 있으므로 여기서도 확실히 지운다
    clearTimeout(shakeTimeoutRef.current)
    setShakeIndex(null)
  }

  const commitConfirmed = (matchLenInSentence: number) => {
    const target = sentencesRef.current[sentenceIndexRef.current] ?? ''
    const priorTotal = sentencesRef.current.slice(0, sentenceIndexRef.current).reduce((sum, s) => sum + s.length, 0)
    const newTotal = priorTotal + matchLenInSentence
    if (newTotal > confirmedTotalRef.current) {
      confirmedTotalRef.current = newTotal
      progressRef.current = totalCharsRef.current > 0 ? (newTotal / totalCharsRef.current) * 100 : 0
    }
    if (matchLenInSentence === target.length && target.length > 0) advanceToNextSentence()
  }

  /** 평균 타수(avgCpm)와 순간 타수(cpm 표시/자동차 속도) 양쪽에 쓰이는 "진짜 키 입력 1회"를 기록한다.
   *  정오답 판정(confirmedChars)과는 완전히 별개 — 오타를 치는 키도, 고치는 도중의 키도 전부 카운트된다 */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (NON_CONTENT_KEYS.has(e.key)) return
    const now = performance.now()
    totalKeystrokesRef.current += 1
    recordKeystroke(now)
    firstKeystrokeAtRef.current ??= now
    lastKeystrokeAtRef.current = now
  }

  const flashWrong = (atIndex: number) => {
    setShakeIndex(atIndex)
    clearTimeout(shakeTimeoutRef.current)
    shakeTimeoutRef.current = setTimeout(() => setShakeIndex(null), WRONG_FLASH_MS)
  }

  /** 조합(IME composition)이 끝난, 최종 확정된 값에 대해서만 호출한다. 오타가 있어도 입력값 자체는 그대로
   *  두고(사용자가 직접 백스페이스로 고칠 수 있게) 잠깐 흔들림만 보여준다 — 진행률(matchedLen 이후 부분)은
   *  실제로 맞게 고칠 때까지 더 늘어나지 않는다 */
  const applyChange = (rawValue: string) => {
    const target = sentencesRef.current[sentenceIndexRef.current] ?? ''
    const matchLen = matchingPrefixLength(rawValue, target)

    typedValueRef.current = rawValue
    setTypedValue(rawValue)
    setMatchedLen(matchLen)

    if (matchLen < rawValue.length) flashWrong(matchLen)

    commitConfirmed(matchLen)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (isComposingRef.current) {
      // 조합 중인 중간 글자(예: '감'을 치는 도중의 '가')는 아직 최종 글자가 아니므로 판정하지 않고 그대로 보여만 준다
      typedValueRef.current = raw
      setTypedValue(raw)
      return
    }
    applyChange(raw)
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false
    applyChange((e.target as HTMLInputElement).value)
  }

  // 매 프레임: 최근 CPM_WINDOW_MS 동안의 확정 글자수로 순간 타자 속도를 구해 시각 연출(도로/차체/게이지)에
  // 반영한다. 실제 진행률(progressRef)은 이미 정확하므로(문장 완성 시 즉시 갱신), 여기서는 그 값을
  // 관성 있게 뒤따라가며 부드럽게 움직이는 연출만 담당한다
  useEffect(() => {
    if (phase !== 'racing' && phase !== 'finished') return
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now

      let speedFactor = FINISHED_IDLE_SPEED
      if (phase === 'racing' && !finishedRef.current) {
        const timestamps = keystrokeTimestampsRef.current
        const cutoff = now - CPM_WINDOW_MS
        while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift()
        const instantCpm = (timestamps.length / (CPM_WINDOW_MS / 1000)) * 60
        cpmRef.current = instantCpm
        const normalized = clamp01(instantCpm / MAX_CPM)
        speedFactor = normalized ** ACCEL_EXPONENT
      }

      const delta = speedFactor - visualSpeedRef.current
      const maxStep = (delta >= 0 ? VISUAL_SPEED_RISE_PER_SEC : VISUAL_SPEED_FALL_PER_SEC) * dtSec
      visualSpeedRef.current += Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep

      const stage = stageRef.current
      if (stage) {
        stage.style.setProperty('--race-speed', visualSpeedRef.current.toFixed(3))
        stage.dataset.boosting = visualSpeedRef.current > 0.35 ? 'true' : 'false'
        stage.dataset.maxspeed = visualSpeedRef.current > 0.85 ? 'true' : 'false'
        stage.dataset.moving = visualSpeedRef.current > MOVING_EPSILON ? 'true' : 'false'
      }

      if (phase === 'racing') {
        const progressGap = progressRef.current - visualProgressRef.current
        visualProgressRef.current += progressGap * VISUAL_PROGRESS_FOLLOW_RATE * dtSec
        if (finishedRef.current) visualProgressRef.current = 100

        const worldFrac = visualProgressRef.current / 100
        roadOffsetRef.current = worldFrac * ROAD_TOTAL_PX
        mountainsOffsetRef.current = worldFrac * MOUNTAINS_TOTAL_PX
        cloudsOffsetRef.current = worldFrac * CLOUDS_TOTAL_PX
        wheelRotationRef.current = worldFrac * WHEEL_TOTAL_DEG

        const startLine = startLineRef.current
        if (startLine) startLine.style.left = `${CAR_LEFT_PERCENT - START_LINE_TRAVEL_PERCENT * worldFrac}%`
        const finishLine = finishLineRef.current
        if (finishLine) finishLine.style.left = `${CAR_LEFT_PERCENT + FINISH_LINE_TRAVEL_PERCENT * (1 - worldFrac)}%`
      } else {
        roadOffsetRef.current += FINISHED_IDLE_ROAD_PX_PER_SEC * dtSec
        mountainsOffsetRef.current += FINISHED_IDLE_MOUNTAINS_PX_PER_SEC * dtSec
        cloudsOffsetRef.current += FINISHED_IDLE_CLOUDS_PX_PER_SEC * dtSec
        wheelRotationRef.current += FINISHED_IDLE_WHEEL_DEG_PER_SEC * dtSec
      }

      const roadLine = roadLineRef.current
      if (roadLine) roadLine.style.backgroundPositionX = `${-(roadOffsetRef.current % ROAD_TILE_PX)}px`
      const clouds = cloudsRef.current
      if (clouds) clouds.style.backgroundPositionX = `${-(cloudsOffsetRef.current % CLOUDS_TILE_PX)}px`
      const mountains = mountainsRef.current
      if (mountains) mountains.style.transform = `translateX(${-mountainsOffsetRef.current}px)`
      const wheelRotation = wheelRotationRef.current % 360
      const wheelFront = wheelFrontRef.current
      if (wheelFront) wheelFront.style.transform = `rotate(${wheelRotation}deg)`
      const wheelBack = wheelBackRef.current
      if (wheelBack) wheelBack.style.transform = `rotate(${wheelRotation}deg)`

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [phase])

  // 진행률/현재 문장 인덱스/현재 입력값/누적 키입력 횟수를 주기적으로 서버에 보고
  // (typed는 관전 모드 표시용, keystrokes/activeMs는 평균 타수 계산용)
  useEffect(() => {
    if (phase !== 'racing') return
    const interval = window.setInterval(() => {
      const activeMs =
        firstKeystrokeAtRef.current !== null && lastKeystrokeAtRef.current !== null
          ? lastKeystrokeAtRef.current - firstKeystrokeAtRef.current
          : 0
      socket.emit('typeRace:progress', {
        confirmedChars: confirmedTotalRef.current,
        sentenceIndex: sentenceIndexRef.current,
        typed: typedValueRef.current,
        keystrokes: totalKeystrokesRef.current,
        activeMs,
      })
    }, PROGRESS_EMIT_MS)
    return () => window.clearInterval(interval)
  }, [phase, socket])

  // 화면에 보여줄 CPM/내 진행률은 따로 주기적으로만 state에 반영 (매 프레임 리렌더 방지)
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCpm(Math.round(cpmRef.current))
      setMyProgress(progressRef.current)
    }, DISPLAY_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  // 전체 참가자 진행률 + 관전용 실시간 타이핑 상태 브로드캐스트 수신
  useEffect(() => {
    const onUpdate = (data: {
      progress: Record<PlayerId, number>
      live: Record<PlayerId, { sentenceIndex: number; typed: string }>
    }) => {
      setOpponentProgress(data.progress)
      setOpponentLive(data.live)
    }
    socket.on('typeRace:update', onUpdate)
    return () => {
      socket.off('typeRace:update', onUpdate)
    }
  }, [socket])

  useEffect(() => {
    socket.emit('round:requestResync')
  }, [socket, roundKey])

  const mySlot = playerId !== null ? (startSignal?.slotOfPlayer[playerId] ?? null) : null
  const slotColors = startSignal?.slotColors ?? []

  return {
    phase,
    sentences,
    sentenceIndex,
    typedValue,
    matchedLen,
    shakeIndex,
    cpm,
    myProgress,
    opponentProgress,
    opponentLive,
    spectatingId,
    setSpectatingId,
    slotColors,
    mySlot,
    startedAt,
    inputRef: inputRef as RefObject<HTMLInputElement | null>,
    handleChange,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    stageRef: stageRef as RefObject<HTMLDivElement | null>,
    startLineRef: startLineRef as RefObject<HTMLDivElement | null>,
    finishLineRef: finishLineRef as RefObject<HTMLDivElement | null>,
    roadLineRef: roadLineRef as RefObject<HTMLDivElement | null>,
    mountainsRef: mountainsRef as RefObject<HTMLDivElement | null>,
    cloudsRef: cloudsRef as RefObject<HTMLDivElement | null>,
    wheelFrontRef: wheelFrontRef as RefObject<HTMLDivElement | null>,
    wheelBackRef: wheelBackRef as RefObject<HTMLDivElement | null>,
  }
}
