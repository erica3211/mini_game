import type { CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { useShoutRaceRound } from '../../hooks/useShoutRaceRound'
import { SHOUT_RACE_ROUND_TIMEOUT_MS, type ClientToServerEvents, type PlayerId, type PlayerInfo, type ServerToClientEvents } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { elapsedMs: number } | null
  countdownSignal: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number } | null
  goSignal: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number } | null
  playerId: PlayerId | null
  players: PlayerInfo[]
  howToPlay: string
}

const LIGHT_LABELS = ['🔴', '🟡', '🟢']

export function ShoutRaceGame({ socket, roundKey, startSignal, countdownSignal, goSignal, playerId, players, howToPlay }: Props) {
  const {
    phase,
    micError,
    myProgress,
    opponentProgress,
    currentDb,
    countdownLight,
    slotColors,
    mySlot,
    startedAt,
    stageRef,
    startLineRef,
    finishLineRef,
    roadLineRef,
    mountainsRef,
    cloudsRef,
    wheelFrontRef,
    wheelBackRef,
  } = useShoutRaceRound(socket, roundKey, startSignal, countdownSignal, goSignal, playerId)

  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myColor = mySlot !== null ? (slotColors[mySlot] ?? '#3b82f6') : '#3b82f6'

  const trackEntries = goSignal
    ? Object.entries(goSignal.slotOfPlayer).map(([id, slot]) => ({
        id,
        nickname: nicknameOf(id),
        color: slotColors[slot] ?? '#3b82f6',
        progress: id === playerId ? myProgress : (opponentProgress[id] ?? 0),
        isMe: id === playerId,
      }))
    : []

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {micError && <p className="party-round-hint">{micError}</p>}

      {phase === 'calibrating' && !micError && (
        <p className="party-round-hint">🎙️ 잠깐 조용히 해주세요... 마이크 소음 기준을 맞추는 중이에요.</p>
      )}

      {phase === 'countdown' && (
        <div className="party-shoutrace-lights">
          {LIGHT_LABELS.map((label, index) => (
            <span
              key={label}
              className={`party-shoutrace-light${index === countdownLight ? ' party-shoutrace-light-active' : ''} party-shoutrace-light-${index}`}
            >
              {label}
            </span>
          ))}
          {countdownLight === 2 && <span className="party-shoutrace-light-start">Start!</span>}
        </div>
      )}

      {(phase === 'calibrating' || phase === 'racing') && !micError && (
        <p className="party-shoutrace-db-meter">🔊 {currentDb === null ? '측정 중...' : `${Math.round(currentDb)} dB`}</p>
      )}

      {goSignal && (
        <div className="party-race-track">
          <span className="party-race-track-flag">🏁 START</span>
          <div className="party-race-track-bar">
            {trackEntries.map((entry) => (
              <div
                key={entry.id}
                className={`party-race-track-dot${entry.isMe ? ' party-race-track-dot-me' : ''}`}
                style={{ left: `${entry.progress}%`, '--dot-color': entry.color } as CSSProperties}
              >
                <span className="party-race-track-nickname">{entry.nickname}</span>
                <span className="party-race-track-dot-mark" />
              </div>
            ))}
          </div>
          <span className="party-race-track-flag">FINISH 🏁</span>
        </div>
      )}

      {goSignal && startedAt !== null && phase === 'racing' && (
        <RemainingTime startedAt={startedAt} timeoutMs={SHOUT_RACE_ROUND_TIMEOUT_MS} />
      )}

      {phase === 'finished' && <p className="party-race-finished">🏆 결승선 통과! 다른 플레이어를 기다리는 중...</p>}

      {/* 소리 측정(calibrating) 중엔 차/도로/게이지를 아예 렌더하지 않는다 — 신호등이 뜨는 순간(countdown)부터
          비로소 화면에 나타나고, 그때 이미 확정된 내 색으로 칠해져 있다. countdown 동안은 CSS가
          [data-phase="countdown"]로 모든 애니메이션을 멈춰 정지된 상태로만 보여준다 */}
      {phase !== 'calibrating' && (
        <div ref={stageRef} className="party-race-root" style={{ '--car-color': myColor } as CSSProperties}>
          <div className="party-race-stage">
            <div className="party-race-sky" />
            <div ref={cloudsRef} className="party-race-clouds" />
            <div ref={mountainsRef} className="party-race-mountains" />
            <div className="party-race-speedlines" />
            <div className="party-race-road">
              <div ref={roadLineRef} className="party-race-road-line" />
            </div>
            {/* 시작선/결승선은 이 블록 전체와 마찬가지로 신호등이 뜨는 순간(countdown)부터 보인다 — 진행률이
                아직 0이므로 formula상 시작선은 정확히 차 위치에, 결승선은 멀리 오른쪽에 있는 "출발 대기"
                상태로 자연스럽게 자리잡고, tick 루프는 racing에서만 도니 그 전까진 가만히 있다 */}
            <div ref={startLineRef} className="party-race-startline" style={{ left: '30%' }} />
            <div ref={finishLineRef} className="party-race-finishline" style={{ left: '250%' }} />
            <div className="party-race-car">
              <div className="party-race-car-flames">
                <span className="party-race-flame party-race-flame-1" />
                <span className="party-race-flame party-race-flame-2" />
                <span className="party-race-flame party-race-flame-3" />
              </div>
              <div className="party-race-car-body">
                <div className="party-race-car-cabin" />
                <div ref={wheelFrontRef} className="party-race-car-wheel party-race-car-wheel-front" />
                <div ref={wheelBackRef} className="party-race-car-wheel party-race-car-wheel-back" />
              </div>
            </div>
          </div>

          <svg className="party-race-gauge" viewBox="0 0 200 110" aria-hidden="true">
            <path d="M10,100 A90,90 0 0 1 190,100" className="party-race-gauge-track" />
            <path d="M10,100 A90,90 0 0 1 190,100" className="party-race-gauge-fill" pathLength={100} />
            <g className="party-race-gauge-needle-pivot">
              <line x1="100" y1="100" x2="100" y2="25" className="party-race-gauge-needle" />
            </g>
            <circle cx="100" cy="100" r="7" className="party-race-gauge-hub" />
          </svg>
        </div>
      )}
    </div>
  )
}
