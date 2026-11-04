import { useCallback, useEffect, useRef } from 'react'

/** 폰을 기준 자세에서 이만큼(도) 기울이면 끝까지 기울인 것이다 — 구슬이 너무 예민하거나 둔하면 이 값을 고친다 (작을수록 예민하다) */
export const TILT_FULL_DEGREES = 22
/** 이보다 작은 기울기는 손떨림으로 보고 무시한다(도) */
export const TILT_DEAD_ZONE_DEGREES = 1.5
/** 기준 자세를 잴 때 쓰는 구간 — 카운트다운 3초 중 마지막 2초의 평균을 쓴다 */
const CALIBRATION_WINDOW_MS = 2_000
/** 기준을 잴 때 이 값(도)보다 많이 흔들렸으면 "움직임이 있었다"고 알려 준다 */
const STEADY_SPREAD_DEGREES = 3

export type TiltEnableResult = 'ok' | 'denied' | 'unsupported'

interface Reading {
  beta: number
  gamma: number
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

/** 기울인 각도(도)를 -1~1로 — 손떨림 구간은 0으로 두고, 끝까지 기울이면 ±1이다 */
function normalize(degrees: number): number {
  const magnitude = Math.abs(degrees)
  if (magnitude < TILT_DEAD_ZONE_DEGREES) return 0
  return Math.sign(degrees) * clamp((magnitude - TILT_DEAD_ZONE_DEGREES) / (TILT_FULL_DEGREES - TILT_DEAD_ZONE_DEGREES), 1)
}

/** 화면이 돌아간 정도(0·90·180·270) */
function screenAngle(): number {
  const angle = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : ((window as unknown as { orientation?: number }).orientation ?? 0)
  return ((angle % 360) + 360) % 360
}

/**
 * 폰 기울기 센서(deviceorientation). 처음 잡은 자세가 아니라 "기준 자세"에서 얼마나 기울였는지로 구슬을 굴린다:
 * 출발 전 카운트다운 동안 폰을 평평하게 두면 그때 센서 값의 평균이 기준이 된다(startCalibration → finishCalibration).
 * iOS는 사용자가 버튼을 눌러야 센서를 쓸 수 있어서, enable()은 버튼을 누르는 순간(클릭 처리 안에서) 불러야 한다.
 */
export function useTilt() {
  const latest = useRef<Reading | null>(null)
  const neutral = useRef<Reading>({ beta: 0, gamma: 0 })
  const samples = useRef<{ at: number; beta: number; gamma: number }[] | null>(null)
  const listening = useRef(false)
  const onOrientation = useRef((event: DeviceOrientationEvent) => {
    // 센서가 없는 기기(컴퓨터)는 값이 null로 온다
    if (event.beta === null || event.gamma === null) return
    latest.current = { beta: event.beta, gamma: event.gamma }
    samples.current?.push({ at: performance.now(), beta: event.beta, gamma: event.gamma })
  }).current

  useEffect(
    () => () => {
      window.removeEventListener('deviceorientation', onOrientation)
      listening.current = false
    },
    [onOrientation],
  )

  /** 센서를 켠다 — iOS는 허용을 물어본다. 값이 실제로 들어오는지도 잠깐 확인한다 */
  const enable = useCallback(async (): Promise<TiltEnableResult> => {
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported'
    const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    if (typeof request === 'function') {
      try {
        if ((await request.call(DeviceOrientationEvent)) !== 'granted') return 'denied'
      } catch {
        return 'denied'
      }
    }
    if (!listening.current) {
      window.addEventListener('deviceorientation', onOrientation)
      listening.current = true
    }
    const deadline = performance.now() + 1_500
    while (performance.now() < deadline) {
      if (latest.current) return 'ok'
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    return 'unsupported'
  }, [onOrientation])

  /** 기준 자세 재기 시작 — 이때부터 들어오는 센서 값을 모은다 */
  const startCalibration = useCallback(() => {
    samples.current = []
  }, [])

  /** 모은 값 중 마지막 2초의 평균을 기준 자세로 삼는다 — 폰이 많이 흔들렸으면 steady가 false다 */
  const finishCalibration = useCallback((): { steady: boolean } => {
    const collected = samples.current ?? []
    samples.current = null
    const recent = collected.filter((sample) => sample.at >= performance.now() - CALIBRATION_WINDOW_MS)
    if (recent.length === 0) {
      if (latest.current) neutral.current = { ...latest.current }
      return { steady: latest.current !== null }
    }
    const mean = (pick: (s: (typeof recent)[number]) => number) => recent.reduce((sum, s) => sum + pick(s), 0) / recent.length
    const beta = mean((s) => s.beta)
    const gamma = mean((s) => s.gamma)
    neutral.current = { beta, gamma }
    const spread = Math.max(...recent.map((s) => Math.max(Math.abs(s.beta - beta), Math.abs(s.gamma - gamma))))
    return { steady: spread <= STEADY_SPREAD_DEGREES }
  }, [])

  /** 지금 자세를 기준으로 다시 잡는다 */
  const recalibrate = useCallback(() => {
    if (latest.current) neutral.current = { ...latest.current }
  }, [])

  /** 기준에서 기울인 정도 — x는 오른쪽, y는 아래쪽이 +이고 각각 -1~1이다 */
  const read = useCallback((): { x: number; y: number } => {
    const current = latest.current
    if (!current) return { x: 0, y: 0 }
    let db = current.beta - neutral.current.beta
    const dg = current.gamma - neutral.current.gamma
    if (db > 180) db -= 360
    if (db < -180) db += 360
    // 화면이 돌아가 있으면 센서의 가로·세로를 화면에 맞게 바꾼다
    const [ax, ay] = ((): [number, number] => {
      switch (screenAngle()) {
        case 90:
          return [db, -dg]
        case 180:
          return [-dg, -db]
        case 270:
          return [-db, dg]
        default:
          return [dg, db]
      }
    })()
    return { x: normalize(ax), y: normalize(ay) }
  }, [])

  return { enable, startCalibration, finishCalibration, recalibrate, read }
}
