import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { jjukkumiStageTitle, type BridgeSide, type BridgeStateSignal, type JjukkumiEndSignal } from './protocol'
import { playerSpriteName, spriteUrl } from './sprites'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: BridgeStateSignal | null
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 게임이 모두 끝났을 때 보여 줄 최종 순위 상자 */
  children?: ReactNode
}

// 다리 그림의 배치 — 모두 다리 판에 대한 비율(%)이다. 위에서 아래로 도착 발판 → 다리 칸(맨 위가 마지막 칸) → 출발 발판 순서로 가로줄이 쌓여 있다
const RAIL_X = [12, 47, 53, 88]
const LANE_CENTER: Record<BridgeSide, number> = { left: 29.5, right: 70.5 }
const PANEL_WIDTH = 28
const ROW_GAP = 2.4
/** 한 사람의 얼굴로 쓸 캐릭터 번호 — 사람마다 늘 같게(모두의 화면에서 같게) 이름 대신 id로 정한다 */
const characterOf = (id: string) => [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4

/** 유리가 깨질 때 흩어지는 조각들 — 판 한가운데에서 가장자리 두 점을 이은 삼각형 여덟 개다. dx·dy는 조각이 날아가는 방향(판 크기에 대한 %), rot는 도는 정도 */
const SHARDS = [
  { clip: 'polygon(50% 50%, 0 0, 50% 0)', dx: -30, dy: 180, rot: -50 },
  { clip: 'polygon(50% 50%, 50% 0, 100% 0)', dx: 24, dy: 200, rot: 40 },
  { clip: 'polygon(50% 50%, 100% 0, 100% 50%)', dx: 60, dy: 170, rot: 70 },
  { clip: 'polygon(50% 50%, 100% 50%, 100% 100%)', dx: 40, dy: 230, rot: -30 },
  { clip: 'polygon(50% 50%, 100% 100%, 50% 100%)', dx: 10, dy: 250, rot: 25 },
  { clip: 'polygon(50% 50%, 50% 100%, 0 100%)', dx: -20, dy: 240, rot: -60 },
  { clip: 'polygon(50% 50%, 0 100%, 0 50%)', dx: -55, dy: 210, rot: 55 },
  { clip: 'polygon(50% 50%, 0 50%, 0 0)', dx: -45, dy: 190, rot: -35 },
]

/** 다리 양옆에 줄지어 선 노란 조명 */
function Lights({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`jk-bridge-lights jk-bridge-lights-${side}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ animationDelay: `${((i * 7 + (side === 'left' ? 0 : 3)) % 14) * 0.18}s` }} />
      ))}
    </div>
  )
}

/**
 * 스테이지 5 — 징검다리. 어두운 곳에 자주색 철판 사이로 유리가 깔린 다리가 있고 양옆에 노란 조명이 줄지어 있다. 칸마다 유리 두 장 중 하나만 진짜(안전)다.
 * 남은 사람들이 랜덤 순서로 한 명씩 건너고, 깨지는 유리를 밟으면 탈락한다. 깨진 유리는 깨진 채로, 무사히 밟은 유리는 발자국이 남은 채로 있어서 뒷사람이 보고 알 수 있다.
 */
export function BridgeStage({ socket, roundKey, state, end, playerId, players, children }: Props) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  // 이 신호를 받은 시각 — 이번 칸의 남은 시간을 재는 기준이다
  const stateAt = useMemo(() => performance.now(), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const startSignal = useMemo(() => (state && state.phase !== 'ended' ? { elapsedMs: state.elapsedMs } : null), [state])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end || state?.phase === 'ended' ? 'finished' : 'running')
  const elapsed = startedAt === null ? null : now - startedAt

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const meInStage = !!playerId && state.order.includes(playerId)
  const myStatus = state.statuses.find((s) => s.playerId === playerId)?.status
  const cur = state.current
  const isMyTurn = !!playerId && cur === playerId
  const canPick = state.phase === 'pick' && isMyTurn
  const last = state.last
  const resultNow = state.phase === 'result' ? last : null
  const secondsLeft = Math.max(0, Math.ceil((stateAt + state.phaseEndsInMs - now) / 1000))
  const rowsCount = state.steps + 2
  const slotTop = (slot: number) => (slot * 100) / rowsCount
  const slotHeight = 100 / rowsCount

  // 건너는 사람이 서 있는 자리 — 출발 발판, 또는 방금 건넌(밟은) 유리 위
  const walker = cur ?? state.order[0]
  const walkerProgress = walker ? (state.progress[walker] ?? 0) : 0
  let stand: { x: number; slot: number } = { x: 50, slot: rowsCount - 1 }
  if (resultNow && resultNow.playerId === walker && resultNow.side) {
    stand = { x: LANE_CENTER[resultNow.side], slot: state.steps - resultNow.step }
  } else if (walkerProgress > 0 && state.stepped[walkerProgress - 1]) {
    stand = { x: LANE_CENTER[state.stepped[walkerProgress - 1]!], slot: state.steps - (walkerProgress - 1) }
  }
  const walkerFalls = !!resultNow && !resultNow.ok && resultNow.playerId === walker
  const walkerDone = state.statuses.find((s) => s.playerId === walker)?.status === 'passed' && !!resultNow
  if (walkerDone) stand = { x: 50, slot: 0 }

  const pick = (side: BridgeSide) => {
    if (canPick) socket.emit('jjukkumi:bridge:pick', { side })
  }

  const message = (() => {
    if (state.phase === 'ended') return '🌉 다리 건너기가 끝났어요!'
    if (state.phase === 'intro') return '🌉 한 칸에 유리가 두 장, 하나만 진짜예요! 깨지는 유리를 밟으면 탈락이에요'
    if (resultNow) {
      const who = nicknameOf(resultNow.playerId)
      if (resultNow.ok) return walkerDone ? `🎉 ${who}님이 다리를 다 건넜어요!` : `✔ ${resultNow.playerId === playerId ? '안전해요!' : `${who}님이 안전한 유리를 밟았어요`}`
      return resultNow.side === null ? `⏰ 시간 초과… ${who}님 탈락` : `💥 유리가 깨졌어요! ${who}님 탈락`
    }
    if (!cur) return ''
    return isMyTurn ? `내 차례예요! ${state.step + 1}/${state.steps}번째 칸 · ⏳ ${secondsLeft}초 안에 골라요` : `${nicknameOf(cur)}님 차례 · ${state.step + 1}/${state.steps}번째 칸 · ⏳ ${secondsLeft}초`
  })()

  return (
    <div className="party-round-stage jk-stage jk-bridge-stage">
      <p className="jk-title">
        🐙 쭈꾸미 게임{' '}
        <span className="jk-title-stage">
          {state.stage.index + 1}/{state.stage.count} · {jjukkumiStageTitle(state.stage.id)}
        </span>
      </p>
      {startedAt !== null && elapsed !== null && elapsed >= 0 && state.phase !== 'ended' && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      <p className={`jk-bridge-msg${isMyTurn && state.phase === 'pick' ? ' jk-bridge-msg-mine' : ''}`} role="status">
        {message}
      </p>

      {/* 다리 */}
      <div className="jk-bridge" data-turn={canPick ? 'mine' : 'other'}>
        <Lights side="left" />
        <Lights side="right" />
        {/* 자주색 철판 — 세로 기둥과 칸 사이의 가로 판 */}
        {RAIL_X.map((x) => (
          <span key={x} className="jk-bridge-rail" style={{ left: `${x}%` }} aria-hidden="true" />
        ))}
        {Array.from({ length: rowsCount + 1 }, (_, slot) =>
          (['left', 'right'] as const).map((side) => (
            <span key={`${slot}-${side}`} className="jk-bridge-bar" style={{ top: `${slotTop(slot)}%`, left: `${RAIL_X[side === 'left' ? 0 : 2]}%`, width: `${RAIL_X[side === 'left' ? 1 : 3] - RAIL_X[side === 'left' ? 0 : 2]}%` }} aria-hidden="true" />
          )),
        )}
        <span className="jk-bridge-plate jk-bridge-plate-finish" style={{ top: `${slotTop(0)}%`, height: `${slotHeight}%` }}>
          🏁 도착
        </span>
        <span className="jk-bridge-plate jk-bridge-plate-start" style={{ top: `${slotTop(rowsCount - 1)}%`, height: `${slotHeight}%` }}>
          출발
        </span>

        {/* 유리 */}
        {Array.from({ length: state.steps }, (_, step) => {
          const slot = state.steps - step
          const isRow = state.phase === 'pick' && step === state.step
          return (['left', 'right'] as const).map((side) => {
            const brokenHere = state.broken[step] === side
            const steppedHere = state.stepped[step] === side
            const breaking = !!resultNow && !resultNow.ok && resultNow.step === step && resultNow.side === side
            const classes = ['jk-glass', brokenHere && !breaking ? 'jk-glass-broken' : '', breaking ? 'jk-glass-breaking' : '', steppedHere ? 'jk-glass-stepped' : '', isRow ? 'jk-glass-turn' : '', canPick && isRow ? 'jk-glass-pick' : '']
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={`${step}-${side}`}
                type="button"
                className={classes}
                style={{ left: `${LANE_CENTER[side] - PANEL_WIDTH / 2}%`, top: `${slotTop(slot) + ROW_GAP / 2}%`, width: `${PANEL_WIDTH}%`, height: `${slotHeight - ROW_GAP}%` }}
                disabled={!(canPick && isRow)}
                onClick={() => pick(side)}
                aria-label={`${step + 1}번째 칸 ${side === 'left' ? '왼쪽' : '오른쪽'} 유리`}
              >
                {steppedHere && <span className="jk-glass-mark">👣</span>}
                {breaking && (
                  <span key={resultNow!.seq} className="jk-shards" aria-hidden="true">
                    {SHARDS.map((shard, index) => (
                      <i key={index} style={{ clipPath: shard.clip, '--dx': `${shard.dx}%`, '--dy': `${shard.dy}%`, '--rot': `${shard.rot}deg`, animationDelay: `${index * 0.02}s` } as CSSProperties} />
                    ))}
                  </span>
                )}
              </button>
            )
          })
        })}

        {/* 건너는 사람 */}
        {walker && state.phase !== 'ended' && (
          <span className="jk-walker" style={{ left: `${stand.x}%`, top: `${slotTop(stand.slot) + slotHeight * 0.94}%` }}>
            <img
              key={resultNow?.seq ?? 0}
              className={`jk-walker-img${walkerFalls ? ' jk-walker-fall' : resultNow?.ok ? ' jk-walker-hop' : ''}`}
              src={spriteUrl(playerSpriteName(characterOf(walker)))}
              alt=""
              draggable={false}
            />
            <em className="jk-walker-name">{walker === playerId ? '나' : nicknameOf(walker)}</em>
          </span>
        )}
      </div>

      <p className="party-mb-note">깨진 유리는 깨진 채로 남고, 무사히 밟은 유리에는 발자국(👣)이 남아요. 아무도 안 밟은 유리는 그대로예요. 앞사람의 흔적을 잘 보세요!</p>

      {!end && meInStage && myStatus === 'passed' && <p className="party-mb-banner party-mb-banner-win">🌉 다리를 다 건넜어요! 다른 사람들이 끝나길 기다려요</p>}
      {!end && meInStage && myStatus === 'out' && <p className="party-mb-banner party-mb-banner-lose">😵 탈락했어요! 다른 사람들이 건너는 걸 구경해요</p>}
      {!end && !meInStage && <p className="party-mb-banner">👀 앞에서 탈락해서 구경만 해요</p>}

      {/* 건너는 차례 */}
      <ol className="jk-bridge-queue">
        {state.order.map((id, index) => {
          const status = state.statuses.find((s) => s.playerId === id)?.status ?? 'run'
          const here = id === cur && state.phase !== 'ended'
          const label = status === 'passed' ? '✔ 통과' : status === 'out' ? `✖ 탈락 (${state.progress[id] ?? 0}칸)` : here ? `▶ 건너는 중 (${state.progress[id] ?? 0}/${state.steps})` : '대기'
          return (
            <li key={id} className={`${here ? 'jk-bridge-queue-now' : ''}${id === playerId ? ' jk-bridge-queue-mine' : ''}${status === 'out' ? ' jk-bridge-queue-out' : ''}`}>
              <span className="jk-bridge-queue-no">{index + 1}</span>
              <span className="jk-bridge-queue-name">{id === playerId ? `${nicknameOf(id)} (나)` : nicknameOf(id)}</span>
              <span className="jk-bridge-queue-state">{label}</span>
            </li>
          )
        })}
      </ol>

      {children}
    </div>
  )
}
