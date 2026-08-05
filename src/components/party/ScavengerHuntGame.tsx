import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useScavengerHuntRound } from '../../hooks/useScavengerHuntRound'
import {
  SCAVENGER_HUNT_SUB_ROUND_MS,
  SCAVENGER_HUNT_SUB_ROUNDS,
  type ClientToServerEvents,
  type ScavengerHuntColorTarget,
  type ScavengerHuntRoundTarget,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { preloadCocoSsdModel, SCAVENGER_HUNT_GUIDE_FRAME_RATIO } from '../../lib/scavengerHuntVision'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { subRoundIndex: number; target: ScavengerHuntRoundTarget; elapsedMs: number } | null
  howToPlay: string
}

// 목표 색상의 HSV(hue/saturation/value)를 CSS가 이해하는 HSL로 변환해서 미리보기 스와치를 그린다
// (achromatic 색은 saturation이 0으로 저장돼 있어 이 공식을 그대로 써도 자연히 회색조가 나온다)
function swatchOf(color: ScavengerHuntColorTarget): string {
  const { hue, saturation: s, value: v } = color
  const lightness = v * (1 - s / 2)
  const satHsl = lightness <= 0 || lightness >= 1 ? 0 : (v - lightness) / Math.min(lightness, 1 - lightness)
  return `hsl(${hue}, ${Math.round(satHsl * 100)}%, ${Math.round(lightness * 100)}%)`
}

export function ScavengerHuntGame({ socket, roundKey, startSignal, howToPlay }: Props) {
  const {
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
  } = useScavengerHuntRound(socket, roundKey, startSignal)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // <video>에 스트림을 직접 대입하는 콜백 ref — 세부 라운드 전환 등으로 이 엘리먼트가 언마운트/리마운트되어
  // 새 DOM 노드로 교체되더라도(예: 이전엔 status==='waiting'으로 잠깐 리셋되는 순간 카메라 블록 전체가
  // 사라졌다 다시 생기면서 video가 새로 마운트돼 srcObject가 끊기는 버그가 실제로 있었다), 마운트되는
  // 즉시 이미 받아둔 스트림을 다시 붙여준다. 아래에서 카메라 블록 자체도 status와 무관하게 항상 렌더링하도록
  // 옮겼지만, 방어적으로 이 콜백 ref도 함께 둔다
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && streamRef.current) el.srcObject = streamRef.current
  }, [])

  // 카메라 스트림은 이 컴포넌트가 마운트돼 있는 동안(=게임 슬롯 전체, 세부 라운드 3개 내내) 한 번만 요청해서 계속 재사용한다
  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setCameraError('카메라를 사용할 수 없어요. 브라우저 카메라 권한을 허용했는지 확인해주세요.'))

    // 사물 인식 라운드를 실제로 만나기 전에 미리 모델을 받아둬서, 첫 촬영 때 판정이 느려지는 걸 줄인다
    preloadCocoSsdModel()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    void analyzeCapture(canvas)
  }, [analyzeCapture])

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {cameraError && <p className="party-round-hint">{cameraError}</p>}

      {/* 카메라 미리보기는 세부 라운드 상태(status)와 무관하게 컴포넌트가 살아있는 동안 항상 마운트해둔다 —
          예전엔 이 블록이 status==='waiting'일 때(매 세부 라운드 전환마다 잠깐 거치는 상태) 통째로
          사라졌다 다시 생기면서 <video> DOM 노드가 매번 새로 만들어져 이미 붙여둔 스트림이 끊기는
          버그가 있었다 (아이폰에서 라운드마다 카메라 권한을 다시 묻는 것처럼 보였던 원인) */}
      {!cameraError && (
        <div className="party-scavengerhunt-camera">
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted
            className="party-scavengerhunt-video"
            style={{ display: capturedImage ? 'none' : 'block' }}
          />
          {capturedImage && <img src={capturedImage} alt="촬영한 사진" className="party-scavengerhunt-video" />}

          {!capturedImage && (
            <div
              className="party-scavengerhunt-guide-frame"
              style={{ width: `${SCAVENGER_HUNT_GUIDE_FRAME_RATIO * 100}%`, height: `${SCAVENGER_HUNT_GUIDE_FRAME_RATIO * 100}%` }}
            >
              <span className="party-scavengerhunt-guide-hint">물건을 화면 중앙에 꽉 차게 찍어주세요!</span>
            </div>
          )}

          {analyzing && (
            <div className="party-scavengerhunt-analyzing">
              <span className="spinner" aria-hidden="true" />
              <span>판정 중...</span>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {status === 'waiting' && <p className="party-round-hint">곧 시작합니다...</p>}

      {status !== 'waiting' && target && (
        <>
          <p className="party-scavengerhunt-round-label">
            {subRoundIndex + 1} / {SCAVENGER_HUNT_SUB_ROUNDS} 라운드
          </p>

          <p className="party-scavengerhunt-target">
            {target.mode === 'object' && target.object && (
              <>
                📦 이번 제시어: <strong>{target.object.label}</strong>
              </>
            )}
            {target.mode === 'color' && target.color && (
              <>
                🎨 이번 색상: <strong>{target.color.label}</strong>
                <span className="party-scavengerhunt-target-swatch" style={{ background: swatchOf(target.color) }} />
              </>
            )}
          </p>

          {startedAt !== null && status === 'running' && (
            <RemainingTime startedAt={startedAt} timeoutMs={SCAVENGER_HUNT_SUB_ROUND_MS} />
          )}

          {status === 'running' && !capturedImage && !analyzing && !cameraError && (
            <button type="button" className="btn btn-primary party-scavengerhunt-shutter" onClick={handleCapture}>
              📸 촬영하기
            </button>
          )}

          {status === 'running' && capturedImage && !analyzing && (
            <>
              <p className="party-scavengerhunt-preview-percent">일치율 {capturedMatchPercent}%</p>
              <div className="party-scavengerhunt-preview-actions">
                <button type="button" className="btn btn-secondary" onClick={retake}>
                  🔄 재촬영
                </button>
                <button type="button" className="btn btn-primary" onClick={submit}>
                  제출하기
                </button>
              </div>
            </>
          )}

          {status === 'submitted' && !result && <p className="party-round-hint">채점 중...</p>}

          {result && (
            <div className="party-scavengerhunt-result">
              <p className="party-scavengerhunt-result-score">{result.roundScore}점</p>
              <p className="party-scavengerhunt-result-detail">
                일치율 {result.matchScore}점 + 속도 {result.speedScore}점
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
