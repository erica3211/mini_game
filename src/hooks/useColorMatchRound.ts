import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { COLOR_MATCH_SATURATION_BY_ROUND, hslToRgb } from '../lib/colorMath'
import { COLOR_MATCH_SUB_ROUND_MS, type ClientToServerEvents, type RgbColor, type ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { subRoundIndex: number; answerColor: RgbColor; elapsedMs: number }

// 서버가 실제로 세부 라운드를 마감하기 전에 여유를 두고 먼저 자동 제출한다 (경매 게임과 같은 이유)
const AUTO_SUBMIT_MARGIN_MS = 200
const DEFAULT_HUE = 200
const DEFAULT_LIGHTNESS = 50
// 드래그 1px당 색상각/명도가 얼마나 움직이는지 — 지도에 보이는 범위(ColorMatchGame.tsx의
// MAP_HUE_SPAN/MAP_LIGHTNESS_SPAN)와 맞춰서, 지도 한쪽 끝까지 드래그하면 보이는 만큼만 움직이도록 좁혔다
const HUE_PER_PIXEL = 0.15
const LIGHTNESS_PER_PIXEL = 0.15

/**
 * roundKey + subRoundIndex로 시드를 고정해서, 세부 라운드가 바뀔 때마다(=새 정답이 나올 때마다)
 * 핀 위치를 초기화한다. startSignal은 useGameSession이 세션 내내 미리 구독해둔
 * colorMatch:roundStart 신호다 — 최초 시작과 재접속 시 재개 모두 이 신호로 전달된다.
 */
export function useColorMatchRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [hue, setHue] = useState(DEFAULT_HUE)
  const [lightness, setLightness] = useState(DEFAULT_LIGHTNESS)
  const [result, setResult] = useState<{ matchPercent: number; grade: string } | null>(null)

  const subRoundIndex = startSignal?.subRoundIndex ?? 0
  const saturation = COLOR_MATCH_SATURATION_BY_ROUND[subRoundIndex]
  const subRoundKey = `${roundKey}-${startSignal?.subRoundIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(subRoundKey, startSignal, status)

  // subRoundKey(문자열)가 실제로 바뀔 때만 핀 위치/결과를 초기화한다
  useEffect(() => {
    setHue(DEFAULT_HUE)
    setLightness(DEFAULT_LIGHTNESS)
    setResult(null)
    setStatus('waiting')
  }, [subRoundKey])

  // 재접속으로 같은 세부 라운드 신호가 다시 와도(중복 startSignal) 위 리셋은 건너뛰고 running으로만 전환한다
  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    const onResult = (data: { subRoundIndex: number; matchPercent: number; grade: string }) => {
      if (data.subRoundIndex !== startSignal?.subRoundIndex) return
      setResult({ matchPercent: data.matchPercent, grade: data.grade })
    }
    socket.on('colorMatch:subRoundResult', onResult)
    return () => {
      socket.off('colorMatch:subRoundResult', onResult)
    }
  }, [socket, startSignal])

  const color = hslToRgb(hue, saturation, lightness)

  const drag = useCallback(
    (deltaX: number, deltaY: number) => {
      if (status !== 'running') return
      // 큰 폭의(특히 음수) 드래그 델타가 한 번에 들어와도 항상 [0,360) 범위로 정규화되도록 모듈러를 두 번 적용한다
      setHue((prev) => (((prev + deltaX * HUE_PER_PIXEL) % 360) + 360) % 360)
      setLightness((prev) => Math.min(100, Math.max(0, prev - deltaY * LIGHTNESS_PER_PIXEL)))
    },
    [status],
  )

  const submit = useCallback(() => {
    if (status !== 'running') return
    socket.emit('colorMatch:submit', { color })
    setStatus('submitted')
  }, [socket, status, color])

  // 5초가 다 될 때까지 몇 번이든 다시 골라도 되고, 시간이 다 되면 그 순간 색이 자동 제출된다
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  useEffect(() => {
    if (startedAt === null) return
    const delayMs = COLOR_MATCH_SUB_ROUND_MS - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return {
    status,
    hue,
    lightness,
    color,
    saturation,
    drag,
    result,
    startedAt,
    answerColor: startSignal?.answerColor ?? null,
    subRoundIndex,
  }
}
