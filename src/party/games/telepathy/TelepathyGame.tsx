import type { Socket } from 'socket.io-client'
import { useTelepathyRound } from './useTelepathyRound'
import {
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
  type TeamInfo,
} from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { TELEPATHY_SUB_ROUND_MS, TELEPATHY_SUB_ROUNDS, type TelepathyStartSignal } from './protocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: TelepathyStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 팀전이면 이번 라운드의 팀 배정 (개인전이면 빈 배열) */
  teams?: TeamInfo[]
}

export function TelepathyGame({ socket, roundKey, startSignal, playerId, players, teams = [] }: Props) {
  const { status, selectedCardId, reveal, startedAt, select, submit } = useTelepathyRound(socket, roundKey, startSignal)
  // 팀전이면 이름 앞에 그 사람의 팀 색을 붙여 누가 어느 팀인지 한눈에 보이게 한다
  const nicknameOf = (id: string) => {
    const name = players.find((p) => p.id === id)?.nickname ?? '???'
    const team = teamOf(teams, id)
    return team ? `${teamEmoji(team.id)} ${name}` : name
  }

  if (!startSignal || status === 'waiting') {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const revealed = reveal !== null
  const isTeamGame = teams.length > 0
  const myTeam = teamOf(teams, playerId)
  const myTeamResult = reveal?.teams?.find((result) => result.teamId === myTeam?.id)
  const myScore = reveal && playerId ? (reveal.picks[playerId]?.score ?? 0) : null
  // 공개 단계에서 카드별로 누가 골랐는지 모아서 보여준다
  const pickersOf = (cardId: number) =>
    reveal ? Object.entries(reveal.picks).filter(([, pick]) => pick.cardId === cardId).map(([id]) => id) : []
  // 개인전은 협동이라 전원이 같은 카드를 골라 점수가 났을 때만 그 카드를 초록으로 강조한다
  const everyoneMatched = reveal ? Object.values(reveal.picks).some((pick) => pick.score > 0) : false

  return (
    <div className="party-round-stage">
      <p className="party-telepathy-round-label">
        {startSignal.subRoundIndex + 1} / {TELEPATHY_SUB_ROUNDS} 라운드
      </p>
      <p className="party-telepathy-prompt">{startSignal.prompt}</p>

      {startedAt !== null && status === 'running' && <RemainingTime startedAt={startedAt} timeoutMs={TELEPATHY_SUB_ROUND_MS} />}
      {status === 'running' && !revealed && (
        <p className="party-round-hint">
          {isTeamGame ? '팀원 모두 같은 카드를 골라야 점수를 받아요! 서로 통할까요?' : '모두가 같은 카드를 골라야 다 같이 점수를 받아요! 서로 통할까요?'}
        </p>
      )}
      {status === 'submitted' && !revealed && <p className="party-round-hint">다른 사람들을 기다리는 중...</p>}

      <ul className="party-telepathy-cards">
        {startSignal.cards.map((card) => {
          const pickers = pickersOf(card.id)
          const isMine = selectedCardId === card.id
          // 모두가 고른 카드만 초록 — 의견이 갈리면 아무 카드도 초록이 아니다
          // (팀전은 점수가 팀 안의 일치 여부로 정해져서 카드를 강조하지 않는다)
          const isTop = revealed && !isTeamGame && everyoneMatched && pickers.length > 0
          return (
            <li key={card.id}>
              <button
                type="button"
                className={[
                  'party-telepathy-card',
                  isMine && !revealed ? 'party-telepathy-card-selected' : '',
                  isTop ? 'party-telepathy-card-top' : '',
                  revealed ? 'party-telepathy-card-revealed' : '',
                ].join(' ')}
                onClick={() => select(card.id)}
                disabled={status !== 'running' || revealed}
                aria-pressed={isMine}
              >
                {isMine && revealed && <span className="party-telepathy-card-mine">✔️ 내 선택</span>}
                <span className="party-telepathy-card-label">{card.label}</span>
                {revealed && (
                  <span className="party-telepathy-card-pickers">
                    {pickers.length === 0 ? '아무도 안 골랐어요' : pickers.map(nicknameOf).join(', ')}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {status === 'running' && !revealed && (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={selectedCardId === null}>
          이걸로 정했어요
        </button>
      )}

      {revealed && isTeamGame && (
        <>
          <p className="party-telepathy-result-score">
            {myTeamResult?.unanimous ? `우리 팀이 통했어요! +${myTeamResult.points}점` : '팀원들의 선택이 달랐어요... 0점'}
          </p>
          <ul className="party-team-standings">
            {(reveal?.teams ?? []).map((result) => {
              const team = teams.find((t) => t.id === result.teamId)
              const cardLabel = startSignal.cards.find((card) => card.id === result.cardId)?.label
              return (
                <li key={result.teamId} className={`party-team-standing ${teamColorClass(result.teamId)}`}>
                  <div className="party-team-standing-head">
                    <span>
                      {teamEmoji(result.teamId)} {team?.name ?? '팀'}
                    </span>
                    <span>{result.unanimous ? `✅ 만장일치 +${result.points}점` : '❌ 의견이 갈렸어요'}</span>
                  </div>
                  {result.unanimous && cardLabel && <div className="party-team-standing-mates">{cardLabel}</div>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {revealed && !isTeamGame && (
        <p className="party-telepathy-result-score">
          {myScore ? `모두 통했어요! 다 같이 +${myScore}점` : '의견이 갈렸어요... 모두 0점'}
        </p>
      )}
    </div>
  )
}
