import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { useSimonRound } from './useSimonRound'
import {
  SIMON_STAGES,
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
  type SimonStartSignal,
} from '../../../shared/lib/partyProtocol'
import { SIMON_CLIENT_TYPES } from './simonInputTypes'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { SimonChip, SimonPad } from './SimonPad'
import { SimonStageReveal } from './SimonStageReveal'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: SimonStartSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function SimonGame({ socket, roundKey, startSignal, playerId, players }: Props) {
  const { status, phase, litIndex, shownCount, answer, reveal, canInput, inputStartedAt, press, undo, submit } = useSimonRound(
    socket,
    roundKey,
    startSignal,
  )
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const inputType = startSignal?.inputType
  const alphabet = startSignal?.alphabet

  // 물리 키보드: 방향키/숫자키로 누르고, Backspace로 지우고, Enter로 제출한다
  useEffect(() => {
    if (!canInput || !inputType || !alphabet) return
    const type = SIMON_CLIENT_TYPES[inputType]
    const onKeyDown = (event: KeyboardEvent) => {
      // 키를 꾹 누르면 같은 심볼이 연달아 쌓이므로 반복 입력은 무시한다
      if (event.repeat) return
      if (event.key === 'Backspace') {
        undo()
        return
      }
      if (event.key === 'Enter') {
        submit()
        return
      }
      const key = type.keyFor?.(event, alphabet)
      if (key) {
        event.preventDefault()
        press(key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canInput, inputType, alphabet, press, undo, submit])

  if (!startSignal || status === 'waiting') {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const type = SIMON_CLIENT_TYPES[startSignal.inputType]
  const length = startSignal.sequence.length
  const myResult = reveal && playerId ? reveal.players[playerId] : null
  const litKey = phase === 'flash' && litIndex !== null ? startSignal.sequence[litIndex] : null
  // 순서를 보여주는 동안에는 입력 칸을 켜진 순서대로 채워 보여주고, 순서가 사라져 입력이 열리면 비워서 내가 외운 걸로 채우게 한다
  const slotSymbols = phase === 'flash' ? startSignal.sequence.slice(0, shownCount) : answer

  let hint = '잘 보세요!'
  if (reveal) hint = ''
  else if (status === 'submitted') hint = '다른 사람들을 기다리는 중...'
  else if (phase === 'input') hint = '순서대로 입력하세요'
  else if (phase === 'intro') hint = '곧 깜빡이기 시작해요. 순서를 외우세요!'

  return (
    <div className="party-round-stage">
      <p className="party-simon-stage-label">
        {startSignal.stageIndex + 1} / {SIMON_STAGES} 단계 · {type.icon} {type.title}
        {startSignal.groupLabel ? ` (${startSignal.groupLabel})` : ''} · {length}개
      </p>

      {/* 입력이 열리는 순간 남은 시간이 생겨도 아래 버튼이 밀려 내려가지 않도록, 자리를 처음부터 잡아 둔다 */}
      {!reveal && (
        <div className="party-simon-timer">
          {inputStartedAt !== null && status === 'running' && phase === 'input' && (
            <RemainingTime startedAt={inputStartedAt} timeoutMs={startSignal.timing.inputMs} />
          )}
        </div>
      )}
      {hint && <p className="party-round-hint">{hint}</p>}

      {!reveal && (
        <>
          {/* 입력 칸은 처음부터 버튼판 위에 보여서 몇 개를 외워야 하는지 알 수 있고, 점멸할 때마다 앞에서부터 채워진다 */}
          <div className="party-simon-slots" aria-label="입력 칸">
            {Array.from({ length }, (_, i) =>
              slotSymbols[i] === undefined ? (
                <span key={i} className="party-simon-slot" />
              ) : (
                <SimonChip key={i} inputType={startSignal.inputType} symbolKey={slotSymbols[i]} />
              ),
            )}
          </div>

          <SimonPad inputType={startSignal.inputType} alphabet={startSignal.alphabet} litKey={litKey} locked={!canInput} onPress={press} />

          {status === 'running' && phase === 'input' && (
            <div className="party-simon-actions">
              <button type="button" className="btn" onClick={undo} disabled={answer.length === 0}>
                지우기
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submit()} disabled={answer.length < length}>
                제출
              </button>
            </div>
          )}
        </>
      )}

      {reveal && (
        <>
          <p className="party-simon-result-score">
            {myResult && myResult.answer !== null
              ? `+${myResult.score}점 (정확도 ${myResult.accuracyScore} + 속도 ${myResult.speedBonus})`
              : '미제출... 0점'}
          </p>
          <SimonStageReveal result={reveal} nicknameOf={nicknameOf} />
        </>
      )}
    </div>
  )
}
