import { useEffect, useRef, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import type { MemoryStateSignal } from './protocol'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf, teamRgb } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: MemoryStateSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

const RESULT_TEXT: Record<'match' | 'miss' | 'timeout', string> = {
  match: '🎉 짝을 맞췄어요! 한 번 더!',
  miss: '😅 짝이 아니에요. 위치를 기억하세요!',
  timeout: '⏰ 시간이 지나서 다음 팀으로 넘어가요.',
}

export function MemoryCardsGame({ socket, roundKey, state, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)
  // 턴마다 남은 시간을 새로 잰다
  const startedAt = useMonotonicStartedAt(`${roundKey}-${state?.turnNumber ?? 'none'}`, state, state?.canFlip ? 'running' : 'finished')

  // 손가락으로 쓰는 기기(모바일)에서는 게임이 시작될 때 카드판이 화면 가운데에 오도록 부드럽게 스크롤한다 — 내 차례마다가 아니라 판마다 한 번만.
  // 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다. 마우스로 쓰는 웹에서는 하지 않는다
  const gridRef = useRef<HTMLDivElement>(null)
  const scrolledRoundRef = useRef<string | null>(null)
  const hasState = state !== null
  useEffect(() => {
    if (!hasState || scrolledRoundRef.current === roundKey) return
    scrolledRoundRef.current = roundKey
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gridRef.current?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [hasState, roundKey])

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const teamName = (teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'
  const isFlipper = state.flipperId === playerId
  const myTurn = !state.ended && state.turnTeamId === myTeam?.id
  const canTap = state.canFlip && isFlipper && !state.ended

  const headline = (() => {
    if (state.ended) return '🏁 모든 짝을 찾았어요!'
    const who = `${teamEmoji(state.turnTeamId)} ${teamName(state.turnTeamId)}`
    if (isFlipper) return `${who} 차례 — 내가 뒤집어요!`
    return myTurn ? `${who} 차례 — ${nicknameOf(state.flipperId)}님이 뒤집어요` : `${who} 차례 · ${nicknameOf(state.flipperId)}님`
  })()

  return (
    <div className="party-round-stage party-memory-stage">
      <ul className="party-memory-scores">
        {teams.map((team) => (
          <li
            key={team.id}
            className={`party-memory-score ${teamColorClass(team.id)}${team.id === state.turnTeamId && !state.ended ? ' party-memory-score-turn' : ''}`}
          >
            <span>
              {teamEmoji(team.id)} {team.name}
            </span>
            <strong>
              {state.scores[team.id] ?? 0} / {state.totalPairs}쌍
            </strong>
          </li>
        ))}
      </ul>

      <p className="party-memory-headline">{headline}</p>
      {state.canFlip && !state.ended && startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={state.turnMs} />}
      {state.lastResult && !state.ended && <p className="party-memory-result">{RESULT_TEXT[state.lastResult]}</p>}

      <div ref={gridRef} className="party-memory-grid" style={{ '--memory-cols': state.columns } as CSSProperties} role="group" aria-label="카드판">
        {state.cards.map((face, index) => {
          const matchedTeam = state.matchedBy[index]
          const faceUp = face !== null
          return (
            <button
              key={index}
              type="button"
              className={`party-memory-card${faceUp ? ' party-memory-card-up' : ''}${matchedTeam !== null ? ' party-memory-card-matched' : ''}`}
              style={matchedTeam !== null ? ({ '--memory-team': `rgb(${teamRgb(matchedTeam)})` } as CSSProperties) : undefined}
              disabled={!canTap || faceUp}
              onClick={() => socket.emit('memoryCards:flip', { index })}
              aria-label={faceUp ? face : '뒤집힌 카드'}
            >
              {faceUp ? face : '❔'}
            </button>
          )
        })}
      </div>

      {!state.ended && (
        <p className="party-round-hint">
          {canTap ? '카드 두 장을 눌러 짝을 찾으세요!' : '다른 사람의 카드가 어디 있는지 기억해 두세요.'}
        </p>
      )}
    </div>
  )
}
