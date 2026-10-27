import type { ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { useLiarQuizRound } from '../../hooks/useLiarQuizRound'
import {
  LIARQUIZ_GUESS_MS,
  LIARQUIZ_LIE_MAX_LENGTH,
  LIARQUIZ_WRITE_MS,
  type ClientToServerEvents,
  type LiarQuizGuessSignal,
  type LiarQuizSpectatorChoice,
  type LiarQuizWriteSignal,
  type PlayerId,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { LiarQuizQuestion, LiarQuizTurnCard } from './LiarQuizTurnCard'
import { RemainingTime } from './RemainingTime'

// 구경하는 사람에게만 작성자가 실려 온다(맞히는 사람은 null). 진짜 정답과 랜덤 보기는 작성자가 없어 "?"로 보인다
function authorLabelOf(authorIds: PlayerId[] | undefined, isMine: boolean, nicknameOf: (id: PlayerId) => string): string | null {
  if (authorIds === undefined) return null
  if (isMine) return '내 거짓말'
  if (authorIds.length === 0) return '❓'
  return `✍️ ${authorIds.map(nicknameOf).join(', ')}`
}

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  writeSignal: LiarQuizWriteSignal | null
  guessSignal: LiarQuizGuessSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function LiarQuizGame({ socket, roundKey, writeSignal, guessSignal, playerId, players }: Props) {
  const round = useLiarQuizRound(socket, roundKey, playerId, writeSignal, guessSignal)
  const signal = guessSignal ?? writeSignal
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'

  if (!signal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const guesser = nicknameOf(signal.guesserId)
  const header = (
    <p className="party-liar-turn-label">
      {signal.turnIndex + 1} / {signal.totalTurns} 번째 · {round.isGuesser ? '내가 맞히는 차례!' : `${guesser}님이 맞히는 차례`}
    </p>
  )

  // ── 공개 ──
  if (guessSignal?.reveal) {
    return (
      <div className="party-round-stage">
        <LiarQuizTurnCard result={guessSignal.reveal} nicknameOf={nicknameOf} />
        <p className="party-round-hint">
          {signal.turnIndex + 1 < signal.totalTurns ? '곧 다음 차례가 시작돼요...' : '곧 결과가 나와요...'}
        </p>
      </div>
    )
  }

  // ── 맞히기 단계 ──
  if (guessSignal) {
    const selected = guessSignal.choices.find((choice) => choice.id === round.selectedId) ?? null
    return (
      <div className="party-round-stage">
        {header}
        {round.guessStartedAt !== null && !round.confirmed && (
          <RemainingTime startedAt={round.guessStartedAt} timeoutMs={LIARQUIZ_GUESS_MS} />
        )}
        <LiarQuizQuestion question={guessSignal.question} fill={selected?.text ?? null} />
        <p className="party-round-hint">
          {round.isGuesser
            ? round.confirmed
              ? '확정했어요! 결과를 기다리는 중...'
              : '진짜 정답이라고 생각하는 보기를 고르세요'
            : selected
              ? `🤔 ${guesser}님이 "${selected.text}"을(를) 고민 중...`
              : `🤔 ${guesser}님이 고르는 중...`}
        </p>

        <ul className="party-liar-choices">
          {guessSignal.choices.map((choice) => {
            const isSelected = round.selectedId === choice.id
            const authorIds = (choice as LiarQuizSpectatorChoice).authorIds
            const isMine = playerId !== null && authorIds?.includes(playerId) === true
            const authorLabel = authorLabelOf(authorIds, isMine, nicknameOf)
            const classes = ['party-liar-choice', isSelected ? (round.isGuesser ? 'party-liar-choice-selected' : 'party-liar-choice-hovered') : '']
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  className={classes.join(' ')}
                  onClick={() => round.pick(choice.id)}
                  disabled={!round.isGuesser || round.confirmed}
                  aria-pressed={isSelected}
                >
                  <span className="party-liar-choice-text">{choice.text}</span>
                  {authorLabel && (
                    <span className={`party-liar-author${isMine ? ' party-liar-author-mine' : ''}`}>{authorLabel}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {round.isGuesser && !round.confirmed && (
          <button type="button" className="btn btn-primary" onClick={round.confirm} disabled={round.selectedId === null}>
            이걸로 확정
          </button>
        )}
      </div>
    )
  }

  // ── 작성 단계 ──
  if (!writeSignal) return null
  const writeData = writeSignal
  const timer = round.writeStartedAt !== null && !round.submitted && (
    <RemainingTime startedAt={round.writeStartedAt} timeoutMs={LIARQUIZ_WRITE_MS} />
  )

  // 맞히는 사람과 거짓말을 쓰는 사람이 공유하는 틀 — 안쪽만 역할에 따라 다르다
  const frame = (body: ReactNode) => (
    <div className="party-round-stage">
      {header}
      {timer}
      <LiarQuizQuestion question={writeData.question} fill={null} />
      {body}
    </div>
  )

  if (round.isGuesser) {
    return frame(
      <p className="party-round-hint">
        친구들이 그럴듯한 거짓말을 쓰는 중이에요... ({writeData.submittedCount}/{writeData.totalLiars})
      </p>,
    )
  }

  return frame(
    <>
      <p className="party-liar-answer-hint">
        진짜 정답: <strong>{writeData.answer}</strong>
      </p>
      <p className="party-round-hint">{guesser}님을 속일 그럴듯하거나 웃긴 가짜 정답을 써보세요!</p>

      <input
        className="party-liar-input"
        type="text"
        value={round.text}
        onChange={(e) => round.setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') round.submit()
        }}
        maxLength={LIARQUIZ_LIE_MAX_LENGTH}
        disabled={round.submitted}
        placeholder="가짜 정답"
        aria-label="가짜 정답 입력"
      />
      {round.rejection && <p className="error">{round.rejection}</p>}

      {round.submitted ? (
        <p className="party-round-hint">
          제출 완료! 다른 사람들을 기다리는 중... ({writeData.submittedCount}/{writeData.totalLiars})
        </p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={round.submit} disabled={!round.canSubmit}>
          제출하기
        </button>
      )}
    </>,
  )
}
