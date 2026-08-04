import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { analyzeScavengerHuntCapture } from '../lib/scavengerHuntVision'
import {
  SCAVENGER_HUNT_SUB_ROUND_MS,
  type ClientToServerEvents,
  type ScavengerHuntRoundTarget,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number }
type SubRoundResult = { matchPercent: number; matchScore: number; speedScore: number; roundScore: number }

// 화면에 보이는 30초가 다 되기 살짝 전에 자동 제출을 보낸다 (colorMatch와 같은 이유) —
// 서버도 SCAVENGER_HUNT_SUBMIT_GRACE_MS만큼 마감을 늦춰주지만, 클라이언트도 여유를 조금 더 둬서
// 느린 모바일 네트워크에서 제출이 늦게 도착해 미제출(0점) 처리되는 일을 줄인다
const AUTO_SUBMIT_MARGIN_MS = 500

/**
 * roundKey + subRoundIndex로 시드를 고정해서, 세부 라운드가 바뀔 때마다(=새 제시어가 나올 때마다) 촬영 상태를 초기화한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 scavengerHunt:roundStart 신호다.
 */
export function useScavengerHuntRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [analyzing, setAnalyzing] = useState(false)
  // null이면 아직 촬영 전(라이브 카메라 표시), 값이 있으면 촬영본 미리보기 + 재촬영/제출 버튼을 보여준다
  const [capturedMatchPercent, setCapturedMatchPercent] = useState<number | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [result, setResult] = useState<SubRoundResult | null>(null)

  const subRoundIndex = startSignal?.subRoundIndex ?? 0
  const target = startSignal?.target ?? null
  const subRoundKey = `${roundKey}-${startSignal?.subRoundIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(subRoundKey, startSignal, status)

  // COCO-SSD 추론은 수백ms~수초가 걸릴 수 있어서, 분석이 끝나기 전에 다음 세부 라운드로 넘어가버릴 수 있다 —
  // 그런 경우 analyzeCapture가 옛 세부 라운드의 결과를 새 세부 라운드 상태에 잘못 채워넣지 않도록 매 렌더마다 최신 키를 담아둔다
  const subRoundKeyRef = useRef(subRoundKey)
  subRoundKeyRef.current = subRoundKey

  // subRoundKey(문자열)가 실제로 바뀔 때만 촬영 상태/결과를 초기화한다 — 카메라 스트림 자체는
  // 이 훅이 아니라 컴포넌트가 게임 슬롯 전체 동안 계속 들고 있는다 (세부 라운드마다 권한을 다시 묻지 않도록)
  useEffect(() => {
    setStatus('waiting')
    setAnalyzing(false)
    setCapturedMatchPercent(null)
    setCapturedImage(null)
    setResult(null)
  }, [subRoundKey])

  // 재접속으로 같은 세부 라운드 신호가 다시 와도(중복 startSignal) 위 리셋은 건너뛰고 running으로만 전환한다
  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    const onResult = (data: SubRoundResult & { subRoundIndex: number }) => {
      if (data.subRoundIndex !== startSignal?.subRoundIndex) return
      setResult(data)
    }
    socket.on('scavengerHunt:subRoundResult', onResult)
    return () => {
      socket.off('scavengerHunt:subRoundResult', onResult)
    }
  }, [socket, startSignal])

  const analyzeCapture = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!target || status !== 'running') return
      const keyAtCapture = subRoundKeyRef.current
      setAnalyzing(true)
      try {
        const matchPercent = await analyzeScavengerHuntCapture(canvas, target)
        // 분석이 끝난 사이 다음 세부 라운드로 넘어갔다면(=subRoundKey가 바뀌었다면) 이 결과는 이미
        // 지나간 세부 라운드의 것이니 버린다 — 그대로 반영하면 새 세부 라운드에 옛 사진/점수가 잘못 채워진다
        if (subRoundKeyRef.current !== keyAtCapture) return
        setCapturedMatchPercent(matchPercent)
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.85))
      } finally {
        setAnalyzing(false)
      }
    },
    [target, status],
  )

  const retake = useCallback(() => {
    setCapturedMatchPercent(null)
    setCapturedImage(null)
  }, [])

  const submit = useCallback(() => {
    if (status !== 'running' || capturedMatchPercent === null) return
    socket.emit('scavengerHunt:submit', { matchPercent: capturedMatchPercent })
    setStatus('submitted')
  }, [socket, status, capturedMatchPercent])

  // 마감 직전엔 촬영은 해놨지만 제출 버튼을 아직 안 눌렀어도 마지막 촬영 결과를 자동 제출한다.
  // 한 번도 촬영하지 않았다면(capturedMatchPercent === null) submit()이 아무 것도 하지 않으므로
  // 그대로 미제출(0점) 처리된다
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  useEffect(() => {
    if (startedAt === null) return
    const delayMs = SCAVENGER_HUNT_SUB_ROUND_MS - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return {
    status,
    analyzing,
    capturedMatchPercent,
    capturedImage,
    result,
    startedAt,
    target,
    subRoundIndex,
    analyzeCapture,
    retake,
    submit,
  }
}
