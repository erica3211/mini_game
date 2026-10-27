import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { analyzeScavengerHuntCapture, createResultThumbnail } from '../lib/scavengerHuntVision'
import {
  SCAVENGER_HUNT_SUB_ROUND_MS,
  type ClientToServerEvents,
  type ScavengerHuntRoundTarget,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number; submitted?: boolean }
type SubRoundResult = { matchPercent: number; matchScore: number; speedScore: number; roundScore: number }

// 촬영한 사진/일치율은 브라우저 화면 안에만 있어서 새로고침하면 사라진다 — 서버는 사진을 모르니(분석은 기기 안에서 한다),
// 세부 라운드마다 sessionStorage에 임시 저장해 두었다가 새로고침 후 같은 세부 라운드로 돌아오면 그대로 복원한다.
// 저장은 실패해도(용량 초과·저장소 차단 등) 게임 진행에는 영향이 없어야 해서 모든 접근을 try/catch로 감싼다
// 키 접두사는 lib/sessionDraft의 'party_draft_'로 시작해야 한다 — 그래야 라운드가 끝났을 때 clearAllDrafts가 같이 비워서,
// 이전 방·이전 판에서 찍은 사진이 같은 번호의 새 라운드에 되살아나지 않는다 (roundKey에는 방 코드가 없다)
const CAPTURE_STORAGE_PREFIX = 'party_draft_scavenger_capture_'

interface SavedCapture {
  matchPercent: number
  image: string
  thumbnail: string | null
}

function saveCapture(subRoundKey: string, capture: SavedCapture) {
  try {
    // 지난 세부 라운드의 사진은 용량만 차지하니 지우고 지금 것만 남긴다
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(CAPTURE_STORAGE_PREFIX)) sessionStorage.removeItem(key)
    }
    sessionStorage.setItem(CAPTURE_STORAGE_PREFIX + subRoundKey, JSON.stringify(capture))
  } catch {
    // no-op
  }
}

function loadCapture(subRoundKey: string): SavedCapture | null {
  try {
    const raw = sessionStorage.getItem(CAPTURE_STORAGE_PREFIX + subRoundKey)
    return raw ? (JSON.parse(raw) as SavedCapture) : null
  } catch {
    return null
  }
}

function clearCapture(subRoundKey: string) {
  try {
    sessionStorage.removeItem(CAPTURE_STORAGE_PREFIX + subRoundKey)
  } catch {
    // no-op
  }
}

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
  // 결과 화면에서 다른 참가자에게 공개할 작은 썸네일 — capturedImage(로컬 미리보기용 원본 화질)와는
  // 별개로, 서버에 제출할 때 이것만 함께 보낸다
  const capturedThumbnailRef = useRef<string | null>(null)
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
    // 새로고침했다면 같은 세부 라운드에서 찍어 둔 사진/일치율을 되살린다
    const saved = loadCapture(subRoundKey)
    setCapturedMatchPercent(saved?.matchPercent ?? null)
    setCapturedImage(saved?.image ?? null)
    capturedThumbnailRef.current = saved?.thumbnail ?? null
    setResult(null)
  }, [subRoundKey])

  // 재접속으로 같은 세부 라운드 신호가 다시 와도(중복 startSignal) 위 리셋은 건너뛰고 running으로만 전환한다
  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    // 이미 제출한 사람이 새로고침·재접속하면 다시 촬영 화면이 뜨지 않고 제출 완료 상태로 복원한다 (채점 결과는 곧 서버가 보내준다)
    setStatus(startSignal.submitted ? 'submitted' : 'running')
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
        const image = canvas.toDataURL('image/jpeg', 0.85)
        const thumbnail = createResultThumbnail(canvas)
        setCapturedMatchPercent(matchPercent)
        setCapturedImage(image)
        capturedThumbnailRef.current = thumbnail
        saveCapture(keyAtCapture, { matchPercent, image, thumbnail })
      } finally {
        setAnalyzing(false)
      }
    },
    [target, status],
  )

  const retake = useCallback(() => {
    clearCapture(subRoundKeyRef.current)
    setCapturedMatchPercent(null)
    setCapturedImage(null)
    capturedThumbnailRef.current = null
  }, [])

  const submit = useCallback(() => {
    if (status !== 'running' || capturedMatchPercent === null) return
    socket.emit('scavengerHunt:submit', { matchPercent: capturedMatchPercent, photo: capturedThumbnailRef.current ?? undefined })
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
