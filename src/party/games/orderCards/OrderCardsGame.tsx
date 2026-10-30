import type { Socket } from 'socket.io-client'
import type { OrderCardsEndSignal, OrderCardsStanding, OrderCardsStateSignal } from './protocol'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: OrderCardsStateSignal | null
  standings: OrderCardsStanding[]
  end: OrderCardsEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

const hearts = (lives: number, maxLives: number) => '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, maxLives - lives))

export function OrderCardsGame({ socket, roundKey, state, standings, end, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)
  // 라운드마다 시작 시각을 새로 잰다 — 같은 라운드 안에서 상태가 여러 번 와도 시작 시각은 뒤로 가지 않는다
  const startedAt = useMonotonicStartedAt(`${roundKey}-${state?.round ?? 'none'}`, state, state?.phase === 'playing' ? 'running' : 'finished')

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const playing = state.phase === 'playing'
  const lowest = state.hand[0]
  const canPlay = playing && lowest !== undefined

  const banner = (() => {
    if (state.phase === 'done') return '🎉 모든 라운드를 마쳤어요! 다른 팀을 기다리는 중...'
    if (state.phase === 'out') return '💥 목숨이 모두 떨어졌어요. 다른 팀을 기다리는 중...'
    if (state.phase === 'between' && state.roundResult) {
      const result = state.roundResult
      if (result.timedOut) return '⏰ 시간이 지나서 목숨이 하나 줄었어요. 다음 라운드를 준비하세요!'
      return result.mistakes > 0 ? `⚠️ 실수 ${result.mistakes}번! 그래도 라운드를 마쳤어요. 다음 라운드를 준비하세요!` : '✅ 실수 없이 클리어! 다음 라운드를 준비하세요!'
    }
    return null
  })()

  return (
    <div className="party-round-stage party-order-stage">
      <p className="party-order-round">
        {state.round + 1} <span className="party-order-round-max">/ {state.totalRounds} 라운드</span>
      </p>
      <p className="party-order-lives" aria-label={`목숨 ${state.lives}개`}>
        {hearts(state.lives, state.maxLives)}
      </p>
      {playing && startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={state.roundMs} />}

      <p className="party-order-rule">말 없이! 숫자가 작을수록 먼저 내요. 내 차례가 왔다고 느낄 때 "내기"를 누르세요.</p>

      {banner && <p className="party-order-banner">{banner}</p>}

      <div className="party-order-hand" aria-label="내 카드">
        {state.hand.length === 0 ? (
          <span className="party-order-hand-empty">{playing ? '내 카드를 모두 냈어요' : ' '}</span>
        ) : (
          state.hand.map((card, index) => (
            <span key={card} className={`party-order-card${index === 0 ? ' party-order-card-next' : ''}`}>
              {card}
            </span>
          ))
        )}
      </div>

      <button type="button" className="party-order-play" disabled={!canPlay} onClick={() => socket.emit('orderCards:play')}>
        {canPlay ? `내기 (${lowest})` : '내기'}
      </button>

      <ul className="party-order-counts">
        {Object.entries(state.handCounts).map(([id, count]) => (
          <li key={id} className={id === playerId ? 'party-order-counts-me' : ''}>
            {nicknameOf(id)}
            {id === playerId && ' (나)'} · {count}장
          </li>
        ))}
      </ul>

      <ol className="party-order-played" aria-label="나온 카드">
        {state.played.map((entry, index) => (
          <li key={index} className={entry.discarded ? 'party-order-played-discard' : ''}>
            <strong>{entry.card}</strong>
            <span>
              {nicknameOf(entry.playerId)}
              {entry.discarded && ' · 버려짐'}
            </span>
          </li>
        ))}
      </ol>

      <ul className="party-order-standings">
        {standings.map((standing) => (
          <li key={standing.teamId} className={`party-order-standing ${teamColorClass(standing.teamId)}${standing.teamId === myTeam?.id ? ' party-order-standing-mine' : ''}`}>
            <span>
              {teamEmoji(standing.teamId)} {teams.find((team) => team.id === standing.teamId)?.name ?? '팀'}
            </span>
            <span>
              {standing.phase === 'done' ? '🏁 끝' : standing.phase === 'out' ? '💥 탈락' : `${standing.round + 1}라운드`} · {hearts(standing.lives, state.maxLives)}
            </span>
          </li>
        ))}
      </ul>

      {end && <p className="party-round-hint">모든 팀이 끝났어요! 결과를 확인하는 중...</p>}
    </div>
  )
}
