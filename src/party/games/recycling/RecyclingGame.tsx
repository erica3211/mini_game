import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { teamOf } from '../../core/PartyTeamBanner'
import { RECYCLING_KINDS, RECYCLING_LANES, recyclingEmoji, type RecyclingStartSignal } from './protocol'
import { RecyclingEnd, RecyclingRoles, RecyclingScores } from './RecyclingView'
import { useRecyclingRound } from './useRecyclingRound'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: RecyclingStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

// 치운 쓰레기가 그 자리에서 사라지는 연출 시간
const FADE_MS = 450
// 담당이 아닌 걸 눌렀을 때 흔들리는 시간
const SHAKE_MS = 500

export function RecyclingGame({ socket, roundKey, startSignal, playerId, players, teams }: Props) {
  const { resolved, wrongAt, scores, end, startedAt, myKinds, tap } = useRecyclingRound(socket, roundKey, startSignal, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)

  // 화면을 매 프레임 다시 그려서 쓰레기를 부드럽게 떨어뜨린다 (끝나면 멈춘다)
  const [frameNow, setFrameNow] = useState(() => performance.now())
  useEffect(() => {
    if (end) return
    let frame = 0
    const loop = () => {
      setFrameNow(performance.now())
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [end])

  if (!startSignal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const elapsedAt = (perfNow: number) => (startedAt === null ? 0 : perfNow - startedAt)
  const elapsed = elapsedAt(frameNow)

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, itemId: number) => {
    event.preventDefault()
    tap(itemId)
  }

  return (
    <div className="party-round-stage party-rc-stage">
      {startedAt !== null && !end && <RemainingTime startedAt={startedAt} timeoutMs={startSignal.durationMs} />}

      <RecyclingScores teams={teams} scores={scores} myTeamId={myTeam?.id} />

      <div className="party-rc-mine" aria-live="polite">
        <span>내 담당</span>
        {myKinds.length === 0 ? (
          <strong>없음</strong>
        ) : (
          myKinds.map((kind) => (
            <strong key={kind} className="party-rc-mine-kind" style={{ '--rc-kind': RECYCLING_KINDS[kind].color } as CSSProperties}>
              {RECYCLING_KINDS[kind].emojis[0]} {RECYCLING_KINDS[kind].name}
            </strong>
          ))
        )}
      </div>

      <div className="party-rc-field">
        {startedAt !== null &&
          !end &&
          startSignal.items.map((item) => {
            const done = resolved[item.id]
            // 치운 쓰레기는 치운 자리에서 잠깐 사라지는 모습을 보여 주고, 그 뒤에는 그리지 않는다
            if (done && frameNow - done.at > FADE_MS) return null
            const at = done ? elapsedAt(done.at) : elapsed
            if (at < item.spawnMs || at > item.spawnMs + item.fallMs) return null
            const progress = (at - item.spawnMs) / item.fallMs
            const mine = myKinds.includes(item.kind)
            const wrong = wrongAt[item.id] !== undefined && frameNow - wrongAt[item.id] < SHAKE_MS
            const classes = ['party-rc-item', mine ? 'party-rc-item-mine' : '', done ? `party-rc-item-${done.state}` : '', wrong ? 'party-rc-item-wrong' : '']
            return (
              <button
                key={item.id}
                type="button"
                className={classes.filter(Boolean).join(' ')}
                style={{ left: `${((item.lane + 0.5) / RECYCLING_LANES) * 100}%`, top: `${progress * 100}%`, '--rc-kind': RECYCLING_KINDS[item.kind].color } as CSSProperties}
                disabled={!!done}
                onPointerDown={(event) => onPointerDown(event, item.id)}
                onContextMenu={(event) => event.preventDefault()}
                aria-label={RECYCLING_KINDS[item.kind].name}
              >
                {recyclingEmoji(item)}
                {done?.state === 'done' && <span className="party-rc-pop party-rc-pop-good">+1</span>}
                {done?.state === 'missed' && <span className="party-rc-pop party-rc-pop-bad">-1</span>}
                {wrong && <span className="party-rc-pop party-rc-pop-bad">-1</span>}
              </button>
            )
          })}
        <div className="party-rc-floor" aria-hidden="true">
          ♻️ 여기에 닿으면 놓친 거예요
        </div>
      </div>

      {end ? (
        <RecyclingEnd end={end} teams={teams} playerId={playerId} players={players} />
      ) : (
        <>
          <RecyclingRoles roles={startSignal.roles} playerId={playerId} nicknameOf={nicknameOf} />
          <p className="party-rc-note">내 담당 쓰레기만 눌러요. 다른 종류를 누르면 -1점이에요!</p>
        </>
      )}
    </div>
  )
}
