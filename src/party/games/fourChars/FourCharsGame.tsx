import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { useFourCharsRound } from './useFourCharsRound'
import {
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
  type TeamInfo,
} from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { FOUR_CHARS_TURN_MS, type FourCharsTurnSignal } from './protocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  turnSignal: FourCharsTurnSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 이번 라운드의 팀 배정 */
  teams: TeamInfo[]
}

export function FourCharsGame({ socket, roundKey, turnSignal, playerId, players, teams }: Props) {
  const { text, changeText, canAnswer, submit, startedAt, hasSubmitted, typingNow } = useFourCharsRound(socket, roundKey, turnSignal, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const inputRef = useRef<HTMLInputElement>(null)

  const turnRef = useRef<HTMLParagraphElement>(null)

  // 내가 답할 차례가 되면 바로 입력할 수 있게 포커스를 준다.
  // 브라우저가 알아서 입력창을 끌어올리면 키보드에 문제가 가려지므로(모바일) 자동 스크롤은 끄고(preventScroll),
  // 차례 안내·문제·입력창이 키보드 위에 한 화면으로 보이도록 "누구 차례인지" 줄이 화면 맨 위에 오게 직접 부드럽게 맞춘다.
  // 스크롤은 손가락으로 쓰는 기기(모바일)에서만 하고, 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다
  const turnIndex = turnSignal?.turnIndex
  useEffect(() => {
    if (!canAnswer) return
    inputRef.current?.focus({ preventScroll: true })
    if (window.matchMedia('(pointer: coarse)').matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      turnRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [canAnswer, turnIndex])

  if (!turnSignal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const { result } = turnSignal
  const turnTeam = teams.find((team) => team.id === turnSignal.teamId)
  const myTeam = teamOf(teams, playerId)
  const isMyTeamTurn = myTeam?.id === turnSignal.teamId
  const isAnswerer = turnSignal.answererId === playerId
  const myTeamState = turnSignal.teamStates.find((state) => state.teamId === myTeam?.id)
  // 결과가 나오면 가려진 칸을 채운다 — 맞혔다면 팀이 쓴 답을, 아니면 대표 정답을 보여준다
  const filledAnswer = (() => {
    if (!result) return []
    const typed = result.correct && result.submitted ? [...result.submitted] : []
    if (typed.length === 4) return turnSignal.chars[0] === null ? typed.slice(0, 2) : typed.slice(2)
    return typed.length === 2 ? typed : [...result.answer]
  })()

  const guide = (() => {
    if (result) return null
    if (isAnswerer) return hasSubmitted ? '제출했어요! 결과를 기다리는 중...' : '내 차례예요! 가려진 두 글자를 입력하세요. 답은 한 번만 낼 수 있어요.'
    if (isMyTeamTurn) return `${nicknameOf(turnSignal.answererId)}님이 답을 입력해요. 같이 의논해서 도와주세요!`
    return `${turnTeam?.name ?? '다른 팀'}이 푸는 중이에요. 우리 차례를 준비하세요!`
  })()

  return (
    <div className="party-round-stage party-fourchars-stage">
      <p className="party-fourchars-cycle">
        {turnSignal.cycle + 1}바퀴째 <span className="party-fourchars-cycle-max">(최대 {turnSignal.maxCycles}바퀴)</span>
      </p>

      <ul className="party-fourchars-teams">
        {turnSignal.teamStates.map((state) => {
          const team = teams.find((t) => t.id === state.teamId)
          const isCurrent = state.teamId === turnSignal.teamId
          return (
            <li
              key={state.teamId}
              className={[
                'party-fourchars-team',
                teamColorClass(state.teamId),
                isCurrent && !result ? 'party-fourchars-team-current' : '',
                state.alive ? '' : 'party-fourchars-team-out',
              ].join(' ')}
            >
              <span>
                {teamEmoji(state.teamId)} {team?.name ?? '팀'}
              </span>
              <span>{state.alive ? `정답 ${state.correct}개` : '탈락'}</span>
            </li>
          )
        })}
      </ul>

      <p ref={turnRef} className="party-fourchars-turn">
        <strong>
          {teamEmoji(turnSignal.teamId)} {turnTeam?.name ?? '팀'}
        </strong>{' '}
        차례 · 답하는 사람 <strong>{nicknameOf(turnSignal.answererId)}</strong>
        {isAnswerer && ' (나)'}
      </p>

      {turnSignal.category ? (
        <span className="party-fourchars-category">힌트 · {turnSignal.category}</span>
      ) : (
        !result && <span className="party-fourchars-category party-fourchars-category-locked">💡 힌트는 10초 남으면 열려요</span>
      )}

      <div className="party-fourchars-chars" aria-label="네 글자 퀴즈">
        {turnSignal.chars.map((char, index) => {
          const blank = char === null
          const revealed = blank && result !== null
          // 가려진 칸 안에서의 순서 (앞 두 칸이면 0~1, 뒤 두 칸이면 2~3 → 0~1)
          const blankOrder = turnSignal.chars[0] === null ? index : index - 2
          return (
            <span
              key={index}
              className={[
                'party-fourchars-char',
                blank ? 'party-fourchars-char-blank' : '',
                revealed ? (result.correct ? 'party-fourchars-char-right' : 'party-fourchars-char-wrong') : '',
              ].join(' ')}
            >
              {blank ? (revealed ? filledAnswer[blankOrder] : '?') : char}
            </span>
          )
        })}
      </div>

      {!result && startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={FOUR_CHARS_TURN_MS} />}
      {guide && <p className="party-round-hint">{guide}</p>}

      {!result && !isAnswerer && (
        <p className="party-fourchars-typing" aria-live="polite">
          ✍️ {nicknameOf(turnSignal.answererId)}님이 쓰는 중: <strong className="party-fourchars-typing-text">{typingNow || ' '}</strong>
        </p>
      )}

      {!result && canAnswer && (
        <form
          className="party-fourchars-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <input
            ref={inputRef}
            className="party-fourchars-input"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            placeholder="가려진 두 글자"
            maxLength={8}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn-primary" disabled={text.trim().length === 0}>
            제출
          </button>
        </form>
      )}

      {result && (
        <div className={`party-fourchars-result ${result.correct ? 'party-fourchars-result-right' : 'party-fourchars-result-wrong'}`}>
          <p className="party-fourchars-result-title">
            {result.correct ? '⭕ 정답!' : result.timedOut ? '⏰ 시간 초과!' : '❌ 틀렸어요'}
          </p>
          <p>
            {result.correct && result.submitted !== null ? (
              <>
                입력: <strong>{result.submitted}</strong>
              </>
            ) : (
              <>
                정답은 <strong>{result.answer}</strong> ({result.word})
                {result.submitted !== null && <> · 입력: {result.submitted}</>}
              </>
            )}
          </p>
          {!result.correct && <p className="party-fourchars-meaning">{result.meaning}</p>}
          {!result.correct && (
            <p className="party-round-hint">
              {teams.find((team) => team.id === result.teamId)?.name ?? '팀'}은 이번 바퀴가 끝나면 탈락해요.
            </p>
          )}
        </div>
      )}

      {myTeamState && !myTeamState.alive && !result && <p className="party-round-hint">우리 팀은 탈락했어요. 남은 팀을 구경해요!</p>}
    </div>
  )
}
