import type { Socket } from 'socket.io-client'
import { useMinorityRound } from './useMinorityRound'
import { type ClientToServerEvents, type PlayerInfo, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { MINORITY_SUB_ROUND_MS, MINORITY_SUB_ROUNDS, type MinorityStartSignal } from './protocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: MinorityStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function MinorityGame({ socket, roundKey, startSignal, playerId, players }: Props) {
  const { status, selected, reveal, startedAt, select, submit } = useMinorityRound(socket, roundKey, startSignal)
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
  // 공개 단계에서 쪽별로 누가 골랐는지 모아서 보여준다
  const pickersOf = (choice: 0 | 1) =>
    reveal ? Object.entries(reveal.picks).filter(([, pick]) => pick.choice === choice).map(([id]) => id) : []

  return (
    <div className="party-round-stage">
      <p className="party-minority-round-label">
        {startSignal.subRoundIndex + 1} / {MINORITY_SUB_ROUNDS} 라운드
      </p>

      {startedAt !== null && status === 'running' && <RemainingTime startedAt={startedAt} timeoutMs={MINORITY_SUB_ROUND_MS} />}
      {status === 'running' && !revealed && <p className="party-round-hint">더 적은 사람이 고른 쪽이 이겨요!</p>}
      {status === 'submitted' && !revealed && <p className="party-round-hint">다른 사람들을 기다리는 중...</p>}

      <ul className="party-minority-options">
        {startSignal.options.map((option) => {
          const pickers = pickersOf(option.id)
          const isMine = selected === option.id
          // 소수 쪽만 초록 — 점수가 나는 쪽과 같은 기준이라, 동수이거나 한쪽에 몰렸으면 아무 쪽도 초록이 아니다
          const isWinner = revealed && reveal.minoritySide === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                className={[
                  'party-minority-option',
                  isMine && !revealed ? 'party-minority-option-selected' : '',
                  isWinner ? 'party-minority-option-winner' : '',
                  revealed ? 'party-minority-option-revealed' : '',
                ].join(' ')}
                onClick={() => select(option.id)}
                disabled={status !== 'running' || revealed}
                aria-pressed={isMine}
              >
                <span className="party-minority-option-label">{option.label}</span>
                {revealed && (
                  <span className="party-minority-option-pickers">
                    {pickers.length}명{pickers.length > 0 && ` · ${pickers.map(nicknameOf).join(', ')}`}
                  </span>
                )}
                {isMine && revealed && <span className="party-minority-option-mine">✔️ 내 선택</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {status === 'running' && !revealed && (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={selected === null}>
          이걸로 정했어요
        </button>
      )}

      {revealed && (
        <p className="party-minority-result-score">
          {reveal.minoritySide === null
            ? '소수가 없어서 모두 0점이에요'
            : myScore
              ? `소수 성공! +${myScore}점`
              : '이번엔 다수였어요... 0점'}
        </p>
      )}
    </div>
  )
}
