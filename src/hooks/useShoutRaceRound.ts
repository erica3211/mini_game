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
// 소리를 전혀 안 내도 도로가 아주 느리게 흐르는 "아이들링" 최소 속도 비율 (완전 정지/후진은 없다)
const IDLE_SPEED_FLOOR = 0.06
// 최고 데시벨을 계속 유지했을 때 결승선(진행률 100)까지 걸리는 시간(초) — 나머지는 20초 제한시간 안에서
// 숨쉬며 끊어질 때를 감안한 여유
const SECONDS_TO_FINISH_AT_MAX = 3.5
const MAX_PROGRESS_PER_SEC = SHOUT_RACE_FINISH_PROGRESS / SECONDS_TO_FINISH_AT_MAX
// 진행률을 서버로 보내는 주기
const PROGRESS_EMIT_MS = 150
// 화면에 보이는 숫자/상대방 위치 갱신 주기 — 매 프레임 setState하면 리렌더가 과해진다
const DISPLAY_REFRESH_MS = 100

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
  countdownSignal: { elapsedMs: number } | null,
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

  // shoutRace:go 도착 → 레이스 시작. 아직 스스로 캘리브레이션을 못 마쳤다면(재접속 등) 기본값으로 대체한다
  useEffect(() => {
    if (!goSignal) return
    if (noiseFloorRef.current === null) noiseFloorRef.current = DEFAULT_NOISE_FLOOR_DB
    setPhase((prev) => (prev === 'finished' ? prev : 'racing'))
  }, [goSignal])

  // 레이스 진행 중 매 프레임: dB를 읽어 진행률에 반영하고, 시각 연출용 CSS 변수를 직접 갱신한다
  useEffect(() => {
    if (phase !== 'racing') return
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now

      const analyser = analyserRef.current
      const buffer = bufferRef.current
      const noiseFloor = noiseFloorRef.current ?? DEFAULT_NOISE_FLOOR_DB
      const db = analyser && buffer ? readDb(analyser, buffer) : Number.NEGATIVE_INFINITY
      if (analyser && buffer) dbRef.current = db
      const normalized = clamp01((db - noiseFloor - DEADZONE_DB) / DB_RANGE)
      const speedFactor = IDLE_SPEED_FLOOR + (1 - IDLE_SPEED_FLOOR) * normalized ** ACCEL_EXPONENT

      if (!finishedRef.current) {
        progressRef.current = Math.min(SHOUT_RACE_FINISH_PROGRESS, progressRef.current + speedFactor * MAX_PROGRESS_PER_SEC * dtSec)
      }

      const stage = stageRef.current
      if (stage) {
        stage.style.setProperty('--shoutrace-speed', speedFactor.toFixed(3))
        stage.dataset.boosting = normalized > 0.35 ? 'true' : 'false'
        stage.dataset.maxspeed = normalized > 0.85 ? 'true' : 'false'
      }

      if (!finishedRef.current && progressRef.current >= SHOUT_RACE_FINISH_PROGRESS) {
        finishedRef.current = true
        const elapsedMs = startedAt !== null ? now - startedAt : SHOUT_RACE_ROUND_TIMEOUT_MS
        socket.emit('shoutRace:finish', { elapsedMs })
        setPhase('finished')
      }

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

  const mySlot = playerId !== null ? (goSignal?.slotOfPlayer[playerId] ?? null) : null
  const slotColors = goSignal?.slotColors ?? []

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
  }
}
