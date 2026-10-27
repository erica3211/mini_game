import { useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { countBlanks, useLiarQuizCompose } from '../../hooks/useLiarQuizCompose'
import {
  LIARQUIZ_COMPOSE_MS,
  LIARQUIZ_LIE_MAX_LENGTH,
  LIARQUIZ_QUESTION_MAX_LENGTH,
  type ClientToServerEvents,
  type LiarQuizComposeSignal,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { LiarQuizQuestion } from './LiarQuizTurnCard'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  signal: LiarQuizComposeSignal
}

/** 직접 문제 만들기: 라운드가 시작되면 각자 빈칸 문제를 하나씩 만든다. 내가 낸 문제는 다른 사람이 맞히고, 나는 거짓말을 쓰는 쪽이 된다 */
export function LiarQuizComposeForm({ socket, roundKey, signal }: Props) {
  const compose = useLiarQuizCompose(socket, roundKey, signal)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blanks = countBlanks(compose.text)

  // 커서(또는 선택한 글자) 자리에 빈칸을 넣는다 — 문제 중간에 빈칸을 두기 쉽게 하려는 버튼이다
  const insertBlank = () => {
    const el = textareaRef.current
    if (!el || blanks > 0) return
    const start = el.selectionStart ?? compose.text.length
    const end = el.selectionEnd ?? start
    compose.setText(`${compose.text.slice(0, start)}___${compose.text.slice(end)}`)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 3, start + 3)
    })
  }

  if (compose.submitted) {
    return (
      <div className="party-round-stage">
        <p className="party-liar-turn-label">내 문제를 냈어요!</p>
        <LiarQuizQuestion question={compose.text} fill={compose.answer} />
        <p className="party-round-hint">
          다른 사람들을 기다리는 중... ({signal.submittedCount}/{signal.totalPlayers})
        </p>
      </div>
    )
  }

  return (
    <div className="party-round-stage">
      <p className="party-liar-turn-label">내가 낼 문제를 만들어요</p>
      {compose.startedAt !== null && <RemainingTime startedAt={compose.startedAt} timeoutMs={LIARQUIZ_COMPOSE_MS} />}
      <p className="party-round-hint">
        문제 중간에 빈칸을 두고, 빈칸에 들어갈 정답을 적어주세요. 내가 낸 문제는 다른 사람이 맞혀요.
      </p>

      {blanks === 1 && <LiarQuizQuestion question={compose.text} fill={compose.answer.trim() || null} />}

      <div className="party-liar-compose">
        <textarea
          ref={textareaRef}
          className="party-liar-input party-liar-textarea"
          value={compose.text}
          onChange={(e) => compose.setText(e.target.value)}
          maxLength={LIARQUIZ_QUESTION_MAX_LENGTH}
          rows={3}
          placeholder="예) 내가 제일 좋아하는 음식은 ___이다"
          aria-label="문제"
        />
        <button type="button" className="btn btn-secondary" onClick={insertBlank} disabled={blanks > 0}>
          {blanks > 0 ? '빈칸이 들어갔어요' : '커서 위치에 빈칸 넣기'}
        </button>

        <input
          className="party-liar-input"
          type="text"
          value={compose.answer}
          onChange={(e) => compose.setAnswer(e.target.value)}
          maxLength={LIARQUIZ_LIE_MAX_LENGTH}
          placeholder="빈칸에 들어갈 정답"
          aria-label="정답"
        />

        <p className="party-liar-compose-label">가짜 답안 (선택)</p>
        {compose.fakes.map((fake, i) => (
          <input
            key={i}
            className="party-liar-input"
            type="text"
            value={fake}
            onChange={(e) => compose.setFake(i, e.target.value)}
            maxLength={LIARQUIZ_LIE_MAX_LENGTH}
            placeholder="헷갈리게 만들 가짜 답안"
            aria-label={`가짜 답안 ${i + 1}`}
          />
        ))}
        {compose.canAddFake && (
          <button type="button" className="btn btn-secondary" onClick={compose.addFake}>
            가짜 답안 추가
          </button>
        )}
      </div>

      <button type="button" className="btn btn-primary" onClick={compose.submit}>
        문제 내기
      </button>
      {compose.rejection && <p className="error">{compose.rejection}</p>}
    </div>
  )
}
