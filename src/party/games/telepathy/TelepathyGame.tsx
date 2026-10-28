import type { Socket } from 'socket.io-client'
import { useTelepathyRound } from './useTelepathyRound'
import { type ClientToServerEvents, type PlayerInfo, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { TELEPATHY_SUB_ROUND_MS, TELEPATHY_SUB_ROUNDS, type TelepathyStartSignal } from './protocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: TelepathyStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function TelepathyGame({ socket, roundKey, startSignal, playerId, players }: Props) {
  const { status, selectedCardId, reveal, startedAt, select, submit } = useTelepathyRound(socket, roundKey, startSignal)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'

  if (!startSignal || status === 'waiting') {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const revealed = reveal !== null
  const myScore = reveal && playerId ? (reveal.picks[playerId]?.score ?? 0) : null
  // 공개 단계에서 카드별로 누가 골랐는지 모아서 보여준다
  const pickersOf = (cardId: number) =>
    reveal ? Object.entries(reveal.picks).filter(([, pick]) => pick.cardId === cardId).map(([id]) => id) : []
  // 과반수(제출한 사람의 절반 초과) 판정의 기준 인원 — 서버 점수 계산과 같은 기준이다
  const submittedCount = reveal ? Object.values(reveal.picks).filter((pick) => pick.cardId !== null).length : 0

  return (
    <div className="party-round-stage">
      <p className="party-telepathy-round-label">
        {startSignal.subRoundIndex + 1} / {TELEPATHY_SUB_ROUNDS} 라운드
      </p>
      <p className="party-telepathy-prompt">{startSignal.prompt}</p>

      {startedAt !== null && status === 'running' && <RemainingTime startedAt={startedAt} timeoutMs={TELEPATHY_SUB_ROUND_MS} />}
      {status === 'running' && !revealed && <p className="party-round-hint">다른 사람들이 가장 많이 고를 것 같은 카드는?</p>}
      {status === 'submitted' && !revealed && <p className="party-round-hint">다른 사람들을 기다리는 중...</p>}

      <ul className="party-telepathy-cards">
        {startSignal.cards.map((card) => {
          const pickers = pickersOf(card.id)
          const isMine = selectedCardId === card.id
          // 과반수가 고른 카드만 초록 — 점수가 나는 카드와 같은 기준이라, 의견이 갈리면 아무 카드도 초록이 아니다
          const isTop = revealed && pickers.length * 2 > submittedCount
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

      {revealed && (
        <p className="party-telepathy-result-score">
          {myScore ? `통했어요! +${myScore}점` : '이번엔 안 통했어요... 0점'}
        </p>
      )}
    </div>
  )
}
