import type { CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { useShoutRaceRound } from '../../hooks/useShoutRaceRound'
import { SHOUT_RACE_ROUND_TIMEOUT_MS, type ClientToServerEvents, type PlayerId, type PlayerInfo, type ServerToClientEvents } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: { elapsedMs: number } | null
  countdownSignal: { elapsedMs: number } | null
  goSignal: { slotColors: string[]; slotOfPlayer: Record<PlayerId, number>; elapsedMs: number } | null
  playerId: PlayerId | null
  players: PlayerInfo[]
  howToPlay: string
}

const LIGHT_LABELS = ['🔴', '🟡', '🟢']

export function ShoutRaceGame({ socket, roundKey, startSignal, countdownSignal, goSignal, playerId, players, howToPlay }: Props) {
  const { phase, micError, myProgress, opponentProgress, currentDb, countdownLight, slotColors, mySlot, startedAt, stageRef } =
    useShoutRaceRound(socket, roundKey, startSignal, countdownSignal, goSignal, playerId)

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
        <div className="party-shoutrace-track">
          <span className="party-shoutrace-track-flag">🏁 START</span>
          <div className="party-shoutrace-track-bar">
            {trackEntries.map((entry) => (
              <div
                key={entry.id}
                className={`party-shoutrace-track-dot${entry.isMe ? ' party-shoutrace-track-dot-me' : ''}`}
                style={{ left: `${entry.progress}%`, '--dot-color': entry.color } as CSSProperties}
              >
                <span className="party-shoutrace-track-nickname">{entry.nickname}</span>
                <span className="party-shoutrace-track-dot-mark" />
              </div>
            ))}
          </div>
          <span className="party-shoutrace-track-flag">FINISH 🏁</span>
        </div>
      )}

      {goSignal && startedAt !== null && phase === 'racing' && (
        <RemainingTime startedAt={startedAt} timeoutMs={SHOUT_RACE_ROUND_TIMEOUT_MS} />
      )}

      {phase === 'finished' && <p className="party-shoutrace-finished">🏆 결승선 통과! 다른 플레이어를 기다리는 중...</p>}

      <div ref={stageRef} className="party-shoutrace-root" style={{ '--car-color': myColor } as CSSProperties}>
        <div className="party-shoutrace-stage">
          <div className="party-shoutrace-sky" />
          <div className="party-shoutrace-city" />
          <div className="party-shoutrace-speedlines" />
          <div className="party-shoutrace-road" />
          <div className="party-shoutrace-car">
            <div className="party-shoutrace-car-flames">
              <span className="party-shoutrace-flame party-shoutrace-flame-1" />
              <span className="party-shoutrace-flame party-shoutrace-flame-2" />
              <span className="party-shoutrace-flame party-shoutrace-flame-3" />
            </div>
            <div className="party-shoutrace-car-body">
              <div className="party-shoutrace-car-cabin" />
              <div className="party-shoutrace-car-wheel party-shoutrace-car-wheel-front" />
              <div className="party-shoutrace-car-wheel party-shoutrace-car-wheel-back" />
            </div>
          </div>
        </div>

        <svg className="party-shoutrace-gauge" viewBox="0 0 200 110" aria-hidden="true">
          <path d="M10,100 A90,90 0 0 1 190,100" className="party-shoutrace-gauge-track" />
          <path d="M10,100 A90,90 0 0 1 190,100" className="party-shoutrace-gauge-fill" pathLength={100} />
          <g className="party-shoutrace-gauge-needle-pivot">
            <line x1="100" y1="100" x2="100" y2="25" className="party-shoutrace-gauge-needle" />
          </g>
          <circle cx="100" cy="100" r="7" className="party-shoutrace-gauge-hub" />
        </svg>
      </div>
    </div>
  )
}
