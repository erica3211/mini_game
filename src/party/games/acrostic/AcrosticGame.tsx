import type { Socket } from 'socket.io-client'
import { useAcrosticRound } from './useAcrosticRound'
import {
  ACROSTIC_LINE_MAX_LENGTH,
  ACROSTIC_VOTE_MS,
  ACROSTIC_WRITE_MS,
  type AcrosticVoteSignal,
  type AcrosticWriteSignal,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  writeSignal: AcrosticWriteSignal | null
  voteSignal: AcrosticVoteSignal | null
}

export function AcrosticGame({ socket, roundKey, writeSignal, voteSignal }: Props) {
  const round = useAcrosticRound(socket, roundKey, writeSignal, voteSignal)

  if (!writeSignal && !voteSignal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const header = (
    <p className="party-acrostic-word" aria-label={`제시어 ${round.chars.join('')}`}>
      {round.chars.map((char, i) => (
        <span className="party-acrostic-word-char" key={i}>
          {char}
        </span>
      ))}
    </p>
  )

  // ── 투표 단계 ──
  if (voteSignal) {
    return (
      <div className="party-round-stage">
        {header}
        {round.voteStartedAt !== null && !round.voted && (
          <RemainingTime startedAt={round.voteStartedAt} timeoutMs={ACROSTIC_VOTE_MS} />
        )}
        <p className="party-round-hint">
          {round.voted ? '투표 완료! 다른 사람들을 기다리는 중...' : '가장 마음에 드는 작품에 투표하세요 (내 작품 제외)'}
        </p>

        <ul className="party-acrostic-poems">
          {voteSignal.poems.map((poem) => {
            const isMine = poem.id === voteSignal.myPoemId
            const isPicked = round.selected === poem.id
            return (
              <li key={poem.id}>
                <button
                  type="button"
                  className={['party-acrostic-poem', isPicked ? 'party-acrostic-poem-selected' : '', isMine ? 'party-acrostic-poem-mine' : ''].join(' ')}
                  onClick={() => round.select(poem.id)}
                  disabled={round.voted || isMine}
                  aria-pressed={isPicked}
                >
                  {isMine && <span className="party-acrostic-poem-badge">내 작품</span>}
                  {isPicked && round.voted && <span className="party-acrostic-poem-badge">✔️ 내 투표</span>}
                  {poem.lines.map((line, i) => (
                    <span className="party-acrostic-poem-line" key={i}>
                      <strong>{[...line][0]}</strong>
                      {[...line].slice(1).join('')}
                    </span>
                  ))}
                </button>
              </li>
            )
          })}
        </ul>

        {!round.voted && (
          <div className="party-acrostic-actions">
            <button type="button" className="btn btn-primary" onClick={() => round.vote(round.selected)} disabled={round.selected === null}>
              이 작품에 투표
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => round.vote(null)}>
              기권
            </button>
          </div>
        )}
        {round.voted && round.selected === null && <p className="party-round-hint">기권했어요</p>}
      </div>
    )
  }

  // ── 작성 단계 ──
  return (
    <div className="party-round-stage">
      {header}
      {round.writeStartedAt !== null && !round.submitted && (
        <RemainingTime startedAt={round.writeStartedAt} timeoutMs={ACROSTIC_WRITE_MS} />
      )}

      <ul className="party-acrostic-lines">
        {round.chars.map((char, i) => (
          <li className="party-acrostic-line" key={i}>
            <span className="party-acrostic-line-char">{char}</span>
            <input
              className="party-acrostic-line-input"
              type="text"
              value={round.rests[i] ?? ''}
              onChange={(e) => round.setRest(i, e.target.value)}
              maxLength={ACROSTIC_LINE_MAX_LENGTH - 1}
              disabled={round.submitted}
              placeholder="이어서 써주세요"
              aria-label={`${i + 1}번째 줄, ${char}(으)로 시작`}
            />
          </li>
        ))}
      </ul>

      {round.rejection && <p className="error">{round.rejection}</p>}

      {round.submitted ? (
        <p className="party-round-hint">제출 완료! 다른 사람들을 기다리는 중...</p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={round.submit} disabled={!round.canSubmit}>
          제출하기
        </button>
      )}
    </div>
  )
}
