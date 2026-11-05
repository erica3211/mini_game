import { useCallback, useEffect, useRef } from 'react'

export type ShakeEnableResult = 'ok' | 'denied' | 'unsupported'

/** 이보다 약한 흔들림은 손떨림·센서 잡음으로 보고 0으로 친다 (m/s², 샘플 사이 가속도 변화의 평균) */
const SHAKE_FLOOR = 0.5
/** 이만큼 세게 흔들면 level 1이다 */
const SHAKE_FULL = 4
/** 흔들림 평균을 내는 비율 — 클수록 새 값에 빨리 반응한다 (센서 샘플이 초당 60개쯤 들어온다고 보면 0.08초 남짓 평균) */
const SMOOTHING = 0.2

/**
 * 폰 흔들기 센서(devicemotion). 샘플마다 가속도가 직전 샘플에서 얼마나 바뀌었는지를 재서(중력은 빠진다) 부드럽게 평균 낸 값을 0~1의 "움직이는 정도(level)"로 돌려준다.
 * 가만히 들고 있으면 0, 힘껏 흔들면 1이다. iOS는 사용자가 버튼을 눌러야 센서를 쓸 수 있어서, enable()은 버튼을 누르는 순간(클릭 처리 안에서) 불러야 한다.
 */
export function useShake() {
  const smoothed = useRef(0)
  const previous = useRef<{ x: number; y: number; z: number } | null>(null)
  const lastEventAt = useRef(0)
  const listening = useRef(false)
  const received = useRef(false)

  const onMotion = useRef((event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity ?? event.acceleration
    if (!a || a.x === null || a.y === null || a.z === null) return
    received.current = true
    lastEventAt.current = performance.now()
    const current = { x: a.x, y: a.y, z: a.z }
    const prev = previous.current
    previous.current = current
    if (!prev) return
    const change = Math.hypot(current.x - prev.x, current.y - prev.y, current.z - prev.z)
    smoothed.current += (change - smoothed.current) * SMOOTHING
  }).current

  useEffect(
    () => () => {
      window.removeEventListener('devicemotion', onMotion)
      listening.current = false
    },
    [onMotion],
  )

  /** 센서를 켠다 — iOS는 허용을 물어본다. 값이 실제로 들어오는지도 잠깐 확인한다(컴퓨터는 값이 안 들어온다) */
  const enable = useCallback(async (): Promise<ShakeEnableResult> => {
    if (typeof DeviceMotionEvent === 'undefined') return 'unsupported'
    const request = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    if (typeof request === 'function') {
      try {
        if ((await request.call(DeviceMotionEvent)) !== 'granted') return 'denied'
      } catch {
        return 'denied'
      }
    }
    if (!listening.current) {
      window.addEventListener('devicemotion', onMotion)
      listening.current = true
    }
    const deadline = performance.now() + 1_500
    while (performance.now() < deadline) {
      if (received.current) return 'ok'
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    return 'unsupported'
  }, [onMotion])

  /** 지금 흔드는 정도 — 0(가만히)~1(힘껏). 센서 값이 한동안 안 들어오면 0이다 */
  const read = useCallback((): number => {
    if (performance.now() - lastEventAt.current > 400) return 0
    return Math.min(1, Math.max(0, (smoothed.current - SHAKE_FLOOR) / (SHAKE_FULL - SHAKE_FLOOR)))
  }, [])

  return { enable, read }
}
