import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Socket } from 'socket.io-client'
import {
  SHOUT_RACE_COUNTDOWN_MS,
  SHOUT_RACE_FINISH_PROGRESS,
  SHOUT_RACE_ROUND_TIMEOUT_MS,
  type ClientToServerEvents,
  type PlayerId,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type Phase = 'calibrating' | 'countdown' | 'racing' | 'finished'
// 신호등 색 인덱스: 0=빨강, 1=주황, 2=초록(Start!)
type CountdownLight = 0 | 1 | 2

// 캘리브레이션: 마이크 권한을 받은 뒤 이만큼(ms) 동안의 주변 소음을 평균 내 기준(dBFS)으로 삼는다
const MIN_CALIBRATION_SAMPLE_MS = 1_200
// 레이스 도중 재접속 등으로 스스로 캘리브레이션을 못 거친 채 shoutRace:go를 받으면 이 값으로 대체한다
// (조용한 실내 기준 dBFS 대략치 — 무음 판정으로 아예 못 움직이는 것보단 낫다)
const DEFAULT_NOISE_FLOOR_DB = -45
// 소음 기준보다 이만큼(dB) 더 커야 "소리를 냈다"고 인정한다 (숨소리 등 미세한 잡음이 가속으로 오인되지 않도록)
const DEADZONE_DB = 6
// 데드존을 넘은 뒤 이 범위(dB)에 걸쳐 0→1로 커브가 채워진다 — 실제 "고함"은 대략 이 정도 범위에서 갈린다
const DB_RANGE = 30
// 1보다 커서 볼록한 가속 곡선을 만든다 — 최고 데시벨 근처에서 가속이 폭발적으로 커지는 느낌
const ACCEL_EXPONENT = 2.2
// speedFactor가 이보다 작으면(=소음 기준과 비슷한 조용한 상태) 차가 완전히 멈춘 것으로 보고 도로/바퀴
// 애니메이션도 멈춘다 (data-moving) — 부동소수점 잔여값 때문에 "정확히 0"만 멈춤으로 치지 않기 위한 여유
const MOVING_EPSILON = 0.02
// 최고 데시벨을 계속 유지했을 때 결승선(진행률 100)까지 걸리는 시간(초) — 나머지는 20초 제한시간 안에서
// 숨쉬며 끊어질 때를 감안한 여유
const SECONDS_TO_FINISH_AT_MAX = 3.5
const MAX_PROGRESS_PER_SEC = SHOUT_RACE_FINISH_PROGRESS / SECONDS_TO_FINISH_AT_MAX
// 진행률을 서버로 보내는 주기
const PROGRESS_EMIT_MS = 150
// 화면에 보이는 숫자/상대방 위치 갱신 주기 — 매 프레임 setState하면 리렌더가 과해진다
const DISPLAY_REFRESH_MS = 100

// 관성: 목소리가 커질 땐 즉각 반응하지만(초당 이만큼까지 상승), 작아지거나 멈추면 이보다 훨씬 느리게
// 줄어들며 서서히 멈춘다 — 실제 진행률(progressRef)은 항상 그 순간의 목소리 크기(원시값)만으로 계산되고,
// 이 관성은 바퀴 회전/도로·배경 스크롤 같은 "시각적 표현"에만 적용된다 (판정 공정성과는 무관)
const VISUAL_SPEED_RISE_PER_SEC = 5
const VISUAL_SPEED_FALL_PER_SEC = 0.7
// 결승 후("finished") 차가 완전히 멈추지 않고 천천히 굴러가는 것처럼 보이도록 고정해두는 시각 속도
const FINISHED_IDLE_SPEED = 0.15

// 차량이 화면에 고정되는 위치 — .party-shoutrace-car의 CSS left:30%와 반드시 같은 값을 유지해야
// 시작선/결승선이 차와 같은 좌표계에서 정확히 만난다
const CAR_LEFT_PERCENT = 30
// 시작선이 진행률 0→100 동안 왼쪽으로 얼마나(%) 밀려나는지 — carLeft(30%)에서 이 값만큼 빼면 음수가 되어
// 화면 밖(overflow:hidden)으로 일찍 사라진다. 값이 작을수록 더 빨리(진행 초반에) 사라진다
const START_LINE_TRAVEL_PERCENT = 100
// 결승선이 진행률 0→100 동안 오른쪽 밖(carLeft + 이 값)에서 carLeft까지 이동해온다
const FINISH_LINE_TRAVEL_PERCENT = 220

// 도로/산/구름/바퀴/시작선/결승선은 전부 "시각 진행률(visualProgressRef, 0~100)" 하나로 위치를 계산한다 —
// 예전엔 도로/산/구름/바퀴는 "초당 이만큼 스크롤"이라는 독립적인 속도로, 시작선/결승선은 진행률(%)이라는
// 별개의 기준으로 움직여서, 실제로 화면에서 두 그룹이 서로 다른 속도로 움직이는 것처럼 보였다(도로가 그만큼
// 흘렀으면 시작선도 그만큼 사라졌어야 하는데 안 그럼). 하나의 값으로 전부 구동하면 이 불일치가 근본적으로
// 없어진다. visualProgressRef 자체는 실제 진행률(progressRef, 원시값)을 향해 서서히(관성 있게) 따라가므로
// — 목소리가 갑자기 작아져도 뚝 끊기지 않고 서서히 느려지는 느낌은 그대로 유지된다.
// (예전엔 CSS @keyframes의 animation-duration을 매 프레임 calc()로 바꿔서 속도를 표현했는데, CSS
// 애니메이션은 위치를 "경과시간 ÷ duration"으로 계산하기 때문에 duration이 바뀌는 순간 같은 경과시간이
// 다른 길이의 주기에 다시 매핑되면서 위치가 튀는 문제도 있었다 — 지금은 매 프레임 위치를 JS가 직접 계산해
// 쓰므로 그 문제도 함께 없다.)
const VISUAL_PROGRESS_FOLLOW_RATE = 3
// 시각 진행률(0~100)이 100에 도달했을 때 도로/산/구름/바퀴가 각각 얼마나(px/deg) 움직여 있어야 하는지 —
// 값 자체엔 물리적 의미가 없고, 그림이 자연스러워 보이도록 고른 상수다
const ROAD_TOTAL_PX = 900
const MOUNTAINS_TOTAL_PX = 500
const CLOUDS_TOTAL_PX = 300
const WHEEL_TOTAL_DEG = 5400
// 완주("finished") 후엔 더 이상 진행률에 묶이지 않고, 마지막 위치에서부터 이 속도로 계속 천천히 굴러간다
const FINISHED_IDLE_ROAD_PX_PER_SEC = 14
const FINISHED_IDLE_MOUNTAINS_PX_PER_SEC = 6
const FINISHED_IDLE_CLOUDS_PX_PER_SEC = 3
const FINISHED_IDLE_WHEEL_DEG_PER_SEC = 240
// 도로 점선/구름 무늬의 배경 타일 폭(px) — 각 CSS의 background-size와 반드시 같은 값이어야 이음매 없이 반복된다
const ROAD_TILE_PX = 60
const CLOUDS_TILE_PX = 220

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** AnalyserNode의 현재 파형에서 RMS를 구해 dBFS로 환산한다 (무음이면 -Infinity에 가까운 매우 작은 값) */
function readDb(analyser: AnalyserNode, buffer: Float32Array): number {
  analyser.getFloatTimeDomainData(buffer)
  let sumSquares = 0
  for (const sample of buffer) sumSquares += sample * sample
  const rms = Math.sqrt(sumSquares / buffer.length)
  return 20 * Math.log10(Math.max(rms, 1e-8))
}

/**
 * 마이크 입력을 받아 목소리 크기(dB)를 진행률로 바꾸는 훅. 시각 연출(도로 스크롤 속도/차체 틸트/게이지 각도/
 * 부스터 발동 여부)은 매 프레임 바뀌는 값이라 React state로 다루지 않고, stageRef가 가리키는 DOM 노드에
 * CSS 커스텀 프로퍼티(--road-speed 등)와 data 속성(boosting/maxspeed)을 직접 써서 리렌더 없이 반영한다.
 * (pixelCanvas가 캔버스를 ref+직접 그리기로 다루는 것과 같은 이유 — 초당 수십 번 바뀌는 값을 state로 두면 안 된다)
 */
export function useShoutRaceRound(
  socket: PartySocket,
  roundKey: string,
  startSignal: { elapsedMs: number } | null,
  countdownSignal: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number } | null,
  goSignal: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number } | null,
  playerId: PlayerId | null,
) {
  const [micError, setMicError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('calibrating')
  const [myProgress, setMyProgress] = useState(0)
  const [opponentProgress, setOpponentProgress] = useState<Record<PlayerId, number>>({})
  const [currentDb, setCurrentDb] = useState<number | null>(null)
  const [countdownLight, setCountdownLight] = useState<CountdownLight>(0)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const startLineRef = useRef<HTMLDivElement | null>(null)
  const finishLineRef = useRef<HTMLDivElement | null>(null)
  const roadLineRef = useRef<HTMLDivElement | null>(null)
  const mountainsRef = useRef<HTMLDivElement | null>(null)
  const cloudsRef = useRef<HTMLDivElement | null>(null)
  const wheelFrontRef = useRef<HTMLDivElement | null>(null)
  const wheelBackRef = useRef<HTMLDivElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufferRef = useRef<Float32Array | null>(null)

  const noiseFloorRef = useRef<number | null>(null)
  const calibratedSentRef = useRef(false)
  const progressRef = useRef(0)
  const finishedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const dbRef = useRef<number | null>(null)
  const visualSpeedRef = useRef(0)
  const visualProgressRef = useRef(0)
  const roadOffsetRef = useRef(0)
  const mountainsOffsetRef = useRef(0)
  const cloudsOffsetRef = useRef(0)
  const wheelRotationRef = useRef(0)

  const countdownStartedAt = useMonotonicStartedAt(roundKey, countdownSignal, 'running')
  const startedAt = useMonotonicStartedAt(roundKey, goSignal, phase === 'finished' ? 'finished' : 'running')

  // roundKey(=새 라운드)가 바뀌면 이전 라운드에서 남은 상태를 모두 비운다
  useEffect(() => {
    setPhase('calibrating')
    setMyProgress(0)
    setOpponentProgress({})
    setCurrentDb(null)
    setCountdownLight(0)
    noiseFloorRef.current = null
    calibratedSentRef.current = false
    progressRef.current = 0
    finishedRef.current = false
    dbRef.current = null
    visualSpeedRef.current = 0
    visualProgressRef.current = 0
    roadOffsetRef.current = 0
    mountainsOffsetRef.current = 0
    cloudsOffsetRef.current = 0
    wheelRotationRef.current = 0
  }, [roundKey])

  // 마이크 스트림은 이 컴포넌트가 마운트돼 있는 동안(=이 게임 슬롯 하나) 한 번만 요청한다
  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const AudioContextCtor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextCtor) {
          setMicError('이 브라우저는 마이크 분석을 지원하지 않아요.')
          return
        }
        const audioCtx = new AudioContextCtor()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.2
        source.connect(analyser)
        audioCtxRef.current = audioCtx
        analyserRef.current = analyser
        bufferRef.current = new Float32Array(analyser.fftSize)
      })
      .catch(() => setMicError('마이크를 사용할 수 없어요. 브라우저 마이크 권한을 허용했는지 확인해주세요.'))

    return () => {
      cancelled = true
      audioCtxRef.current?.close()
      audioCtxRef.current = null
      analyserRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // 캘리브레이션: 마이크가 준비되면 MIN_CALIBRATION_SAMPLE_MS 동안 dB를 모아 평균을 소음 기준으로 삼고 서버에 보고한다
  useEffect(() => {
    if (!startSignal || phase !== 'calibrating' || calibratedSentRef.current) return

    let raf: number
    let cancelled = false
    const waitForAnalyser = () => {
      if (cancelled) return
      const analyser = analyserRef.current
      const buffer = bufferRef.current
      if (!analyser || !buffer) {
        raf = requestAnimationFrame(waitForAnalyser)
        return
      }

      const samples: number[] = []
      const sampleStartedAt = performance.now()
      const sample = () => {
        if (cancelled) return
        const db = readDb(analyser, buffer)
        samples.push(db)
        dbRef.current = db
        if (performance.now() - sampleStartedAt < MIN_CALIBRATION_SAMPLE_MS) {
          raf = requestAnimationFrame(sample)
          return
        }
        const finiteSamples = samples.filter((db) => Number.isFinite(db))
        const noiseFloor =
          finiteSamples.length > 0 ? finiteSamples.reduce((a, b) => a + b, 0) / finiteSamples.length : DEFAULT_NOISE_FLOOR_DB
        noiseFloorRef.current = noiseFloor
        calibratedSentRef.current = true
        socket.emit('shoutRace:calibrated', { noiseFloor })
      }
      raf = requestAnimationFrame(sample)
    }
    raf = requestAnimationFrame(waitForAnalyser)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [socket, startSignal, phase])

  // shoutRace:countdown 도착 → 신호등(빨→주→초 Start!) 연출 단계로 전환
  useEffect(() => {
    if (!countdownSignal) return
    setPhase((prev) => (prev === 'calibrating' ? 'countdown' : prev))
  }, [countdownSignal])

  // 신호등 색은 SHOUT_RACE_COUNTDOWN_MS를 3등분해 순서대로 켠다 — countdownStartedAt이 재접속 시에도
  // 서버 기준 경과 시간으로 정확히 anchor되므로, 중간에 들어와도 지금 켜져 있어야 할 색부터 바로 보인다
  useEffect(() => {
    if (phase !== 'countdown' || countdownStartedAt === null) return
    const segmentMs = SHOUT_RACE_COUNTDOWN_MS / 3
    const tick = () => {
      const elapsed = performance.now() - countdownStartedAt
      setCountdownLight(Math.min(2, Math.floor(elapsed / segmentMs)) as CountdownLight)
    }
    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [phase, countdownStartedAt])

  // stage(차/도로)는 countdown 단계부터만 렌더되므로, 마운트될 때마다 지금 phase를 data 속성으로 심어준다 —
  // CSS가 이걸로 "신호등 뜨기 전(countdown)엔 모든 애니메이션 정지" 규칙을 건다
  useEffect(() => {
    if (stageRef.current) stageRef.current.dataset.phase = phase
  }, [phase])

  // shoutRace:go 도착 → 레이스 시작. 아직 스스로 캘리브레이션을 못 마쳤다면(재접속 등) 기본값으로 대체한다
  useEffect(() => {
    if (!goSignal) return
    if (noiseFloorRef.current === null) noiseFloorRef.current = DEFAULT_NOISE_FLOOR_DB
    setPhase((prev) => (prev === 'finished' ? prev : 'racing'))
  }, [goSignal])

  // 매 프레임: racing이면 dB를 읽어 진행률/시각 속도에 반영하고, finished가 되면 dB 대신 고정된 낮은
  // 속도(FINISHED_IDLE_SPEED)로 계속 "천천히 굴러가는" 연출을 이어간다 — 두 상태를 하나의 루프로 묶어야
  // 완주 순간 시각 속도가 뚝 끊기지 않고 관성 그대로 IDLE 속도로 서서히 가라앉는다
  useEffect(() => {
    if (phase !== 'racing' && phase !== 'finished') return
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now

      let speedFactor = FINISHED_IDLE_SPEED
      let normalized = 0
      if (phase === 'racing' && !finishedRef.current) {
        const analyser = analyserRef.current
        const buffer = bufferRef.current
        const noiseFloor = noiseFloorRef.current ?? DEFAULT_NOISE_FLOOR_DB
        const db = analyser && buffer ? readDb(analyser, buffer) : Number.NEGATIVE_INFINITY
        if (analyser && buffer) dbRef.current = db
        normalized = clamp01((db - noiseFloor - DEADZONE_DB) / DB_RANGE)
        // 소음 기준과 비슷한(데드존 이내) 조용한 상태면 normalized가 0이라 speedFactor도 정확히 0 —
        // 예전엔 여기에 IDLE_SPEED_FLOOR를 더해 가만히 있어도 살짝 굴러가게 했지만, 사용자가 "측정한 평균
        // 데시벨과 비슷하면 차가 완전히 멈춰 있으면 좋겠다"고 요청해 바닥값 없이 순수 dB 반응형으로 바꿨다
        speedFactor = normalized ** ACCEL_EXPONENT
        progressRef.current = Math.min(SHOUT_RACE_FINISH_PROGRESS, progressRef.current + speedFactor * MAX_PROGRESS_PER_SEC * dtSec)
      }

      // 관성: 시각 속도는 목표(speedFactor)를 향해 움직이되, 커질 땐 빠르게 · 줄어들 땐 느리게 따라간다
      // (실제 진행률은 위에서 이미 원시 speedFactor로 확정했으므로 이 값은 오직 애니메이션 표현용)
      const delta = speedFactor - visualSpeedRef.current
      const maxStep = (delta >= 0 ? VISUAL_SPEED_RISE_PER_SEC : VISUAL_SPEED_FALL_PER_SEC) * dtSec
      visualSpeedRef.current += Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep

      const stage = stageRef.current
      if (stage) {
        stage.style.setProperty('--shoutrace-speed', visualSpeedRef.current.toFixed(3))
        stage.dataset.boosting = normalized > 0.35 ? 'true' : 'false'
        stage.dataset.maxspeed = normalized > 0.85 ? 'true' : 'false'
        stage.dataset.moving = visualSpeedRef.current > MOVING_EPSILON ? 'true' : 'false'
      }

      if (phase === 'racing') {
        // 완주 판정을 먼저 처리한다 — 완주하는 바로 이 프레임에 시각 진행률(visualProgressRef)도 강제로
        // 100까지 맞춰서, 결승선이 관성 지연 때문에 내 차 위치에 못 미친 채로 얼어붙는 일이 없게 한다
        // (다른 모든 프레임에서는 관성 그대로 서서히 따라간다)
        if (!finishedRef.current && progressRef.current >= SHOUT_RACE_FINISH_PROGRESS) {
          finishedRef.current = true
          visualProgressRef.current = SHOUT_RACE_FINISH_PROGRESS
          const elapsedMs = startedAt !== null ? now - startedAt : SHOUT_RACE_ROUND_TIMEOUT_MS
          socket.emit('shoutRace:finish', { elapsedMs })
          setPhase('finished')
        } else {
          const progressGap = progressRef.current - visualProgressRef.current
          visualProgressRef.current += progressGap * VISUAL_PROGRESS_FOLLOW_RATE * dtSec
        }

        // 도로/산/구름/바퀴/시작선/결승선 — 전부 같은 visualProgressRef 하나로 위치를 정하므로
        // 서로 다른 속도로 움직이는 것처럼 어긋나 보일 수 없다
        const worldFrac = visualProgressRef.current / SHOUT_RACE_FINISH_PROGRESS
        roadOffsetRef.current = worldFrac * ROAD_TOTAL_PX
        mountainsOffsetRef.current = worldFrac * MOUNTAINS_TOTAL_PX
        cloudsOffsetRef.current = worldFrac * CLOUDS_TOTAL_PX
        wheelRotationRef.current = worldFrac * WHEEL_TOTAL_DEG

        const startLine = startLineRef.current
        if (startLine) startLine.style.left = `${CAR_LEFT_PERCENT - START_LINE_TRAVEL_PERCENT * worldFrac}%`
        const finishLine = finishLineRef.current
        if (finishLine) finishLine.style.left = `${CAR_LEFT_PERCENT + FINISH_LINE_TRAVEL_PERCENT * (1 - worldFrac)}%`
      } else {
        // 완주 후("finished")엔 더 이상 진행률에 묶이지 않고, 마지막 위치에서부터 낮은 고정 속도로
        // 계속 굴러간다 — 시작선/결승선은 건드리지 않아 완주 순간의 정확한 위치(결승선=내 차 위치)에 그대로 남는다
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
  }, [phase, socket, startedAt])

  // 진행률을 주기적으로 서버에 보고
  useEffect(() => {
    if (phase !== 'racing') return
    const interval = window.setInterval(() => {
      socket.emit('shoutRace:progress', { progress: progressRef.current })
    }, PROGRESS_EMIT_MS)
    return () => window.clearInterval(interval)
  }, [phase, socket])

  // 화면에 보여줄 내 진행률/데시벨은 따로 주기적으로만 state에 반영 (매 프레임 리렌더 방지) —
  // 신호등 연출 중(countdown)엔 두 루프(캘리브레이션/레이스) 다 안 돌아서 dbRef가 갱신되지 않으므로 건너뛴다
  useEffect(() => {
    if (phase === 'countdown') return
    const interval = window.setInterval(() => {
      setMyProgress(progressRef.current)
      setCurrentDb(dbRef.current)
    }, DISPLAY_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [phase])

  // 상대방 진행률 브로드캐스트 수신 (본인 것은 이 값이 아니라 로컬 progressRef가 항상 최신이라 그걸 쓴다)
  useEffect(() => {
    const onUpdate = (data: { progress: Record<PlayerId, number> }) => setOpponentProgress(data.progress)
    socket.on('shoutRace:update', onUpdate)
    return () => {
      socket.off('shoutRace:update', onUpdate)
    }
  }, [socket])

  // 화면이 붙기 전에 지나간 브로드캐스트를 놓쳤을 수 있으니, 붙자마자 다시 요청해 맞춘다
  useEffect(() => {
    socket.emit('round:requestResync')
  }, [socket, roundKey])

  // 차량 색은 신호등(countdown)에서 이미 확정되고 go에서도 같은 값이 반복되므로, 둘 중 먼저 도착한 쪽을 쓴다
  const colorSignal = goSignal ?? countdownSignal
  const mySlot = playerId !== null ? (colorSignal?.slotOfPlayer[playerId] ?? null) : null
  const slotColors = colorSignal?.slotColors ?? []

  return {
    phase,
    micError,
    myProgress,
    opponentProgress,
    currentDb,
    countdownLight,
    slotColors,
    mySlot,
    startedAt,
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
