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

function swatchOf(color: ScavengerHuntColorTarget): string {
  // hueMin > hueMax면 0도를 넘어가는 색상(빨강)이라 중앙값을 0도로 잡는다
  const hue = color.hueMin <= color.hueMax ? (color.hueMin + color.hueMax) / 2 : 0
  const saturation = Math.round(Math.max(color.satMin, 0.5) * 100)
  const lightness = color.valMax <= 0.3 ? 15 : 50
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // 카메라 스트림은 이 컴포넌트가 마운트돼 있는 동안(=게임 슬롯 전체, 세부 라운드 3개 내내) 한 번만 요청해서 계속 재사용한다
  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setCameraError('카메라를 사용할 수 없어요. 브라우저 카메라 권한을 허용했는지 확인해주세요.'))

    // 사물 인식 라운드를 실제로 만나기 전에 미리 모델을 받아둬서, 첫 촬영 때 판정이 느려지는 걸 줄인다
    preloadCocoSsdModel()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
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

          {cameraError && <p className="party-round-hint">{cameraError}</p>}

          {!cameraError && (
            <div className="party-scavengerhunt-camera">
              <video
                ref={videoRef}
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
