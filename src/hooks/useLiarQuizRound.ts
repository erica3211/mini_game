import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  LIARQUIZ_WRITE_MS,
  type ClientToServerEvents,
  type LiarQuizGuessSignal,
  type LiarQuizWriteSignal,
  type PlayerId,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { clearDraft, loadDraft, saveDraft } from '../lib/sessionDraft'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type LiarQuizPhase = 'waiting' | 'write' | 'guess' | 'reveal'

// 화면에 보이는 마감이 다 되기 살짝 전에 자동 제출을 보낸다 (scavengerHunt/telepathy/acrostic과 같은 이유)
const AUTO_SUBMIT_MARGIN_MS = 800

/**
 * 한 턴의 작성 단계(liarQuiz:writeStart) → 맞히기 단계(liarQuiz:guessStart) → 공개(guessStart.reveal)를 한 화면에서 이어서 다룬다.
 * 신호는 useGameSession이 세션 내내 미리 구독해둔 값이고, 진행 현황·구경하는 사람에게 중계되는 임시 선택·공개도 거기서 신호에 합쳐져 온다.
 * 새 턴의 작성 신호가 오면 맞히기 신호는 비워지므로, "맞히기 신호가 있으면 맞히기(또는 공개) 단계"로 판단하면 된다.
 * 맞히는 사람이 누르는 보기는 서버가 마감 시점에 마지막 임시 선택을 확정으로 쳐주므로, 맞히기 단계에는 자동 확정 타이머가 필요 없다.
 */
export function useLiarQuizRound(
  socket: PartySocket,
  roundKey: string,
  playerId: PlayerId | null,
  writeSignal: LiarQuizWriteSignal | null,
  guessSignal: LiarQuizGuessSignal | null,
) {
  const turnIndex = guessSignal?.turnIndex ?? writeSignal?.turnIndex ?? null
  const turnKey = `${roundKey}-${turnIndex}`
  const isGuesser = (guessSignal ?? writeSignal)?.guesserId === playerId
  let phase: LiarQuizPhase = 'waiting'
  if (guessSignal) phase = guessSignal.reveal ? 'reveal' : 'guess'
  else if (writeSignal) phase = 'write'
  // 쓰던 거짓말은 새로고침해도 남도록 턴별로 임시 저장한다 (서버는 제출 전의 글을 모른다)
  const draftKey = `liarquiz_${turnKey}`

  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [rejection, setRejection] = useState<string | null>(null)
  // 맞히는 사람 본인의 임시 선택 (구경하는 사람은 신호의 pickedId를 본다) / 확정 여부
  const [localPick, setLocalPick] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const turnIndexRef = useRef(turnIndex)
  turnIndexRef.current = turnIndex

  const writeStartedAt = useMonotonicStartedAt(`${turnKey}-write`, writeSignal, submitted || guessSignal ? 'finished' : 'running')
  const guessStartedAt = useMonotonicStartedAt(`${turnKey}-guess`, guessSignal, confirmed || phase === 'reveal' ? 'finished' : 'running')

  useEffect(() => {
    setText('')
    setSubmitted(false)
    setRejection(null)
    setLocalPick(null)
    setConfirmed(false)
  }, [turnKey])

  // 재접속으로 이미 낸 거짓말이 있으면 그대로 복원하고, 없으면 쓰다 만 초안을 복원한다
  const myLie = writeSignal?.myLie ?? null
  useEffect(() => {
    if (myLie !== null) {
      setText(myLie)
      setSubmitted(true)
      return
    }
    const saved = loadDraft<string>(draftKey)
    if (typeof saved === 'string') setText(saved)
  }, [myLie, draftKey])

  // 재접속한 맞히는 사람은 서버가 기억하는 임시 선택을 이어받는다
  const serverPick = guessSignal?.pickedId ?? null
  useEffect(() => {
    if (isGuesser && serverPick !== null) setLocalPick((prev) => prev ?? serverPick)
  }, [isGuesser, serverPick])

  useEffect(() => {
    if (!submitted && text !== '') saveDraft(draftKey, text)
  }, [text, submitted, draftKey])

  useEffect(() => {
    const onRejected = (data: { turnIndex: number; reason: string }) => {
      if (data.turnIndex !== turnIndexRef.current) return
      setRejection(data.reason)
      setSubmitted(false)
    }
    socket.on('liarQuiz:submitRejected', onRejected)
    return () => {
      socket.off('liarQuiz:submitRejected', onRejected)
    }
  }, [socket])

  const changeText = useCallback((value: string) => {
    setRejection(null)
    setText(value)
  }, [])

  const canSubmit = phase === 'write' && !isGuesser && !submitted && text.trim().length > 0

  const submit = useCallback(() => {
    if (!canSubmit || turnIndex === null) return
    socket.emit('liarQuiz:submit', { turnIndex, text: text.trim() })
    clearDraft(draftKey)
    setSubmitted(true)
    setRejection(null)
  }, [socket, canSubmit, turnIndex, text, draftKey])

  const pick = useCallback(
    (choiceId: number) => {
      if (!isGuesser || phase !== 'guess' || confirmed || turnIndex === null || choiceId === localPick) return
      setLocalPick(choiceId)
      socket.emit('liarQuiz:pick', { turnIndex, choiceId, confirm: false })
    },
    [socket, isGuesser, phase, confirmed, turnIndex, localPick],
  )

  const confirm = useCallback(() => {
    if (!isGuesser || phase !== 'guess' || confirmed || turnIndex === null || localPick === null) return
    socket.emit('liarQuiz:pick', { turnIndex, choiceId: localPick, confirm: true })
    setConfirmed(true)
  }, [socket, isGuesser, phase, confirmed, turnIndex, localPick])

  // 마감 직전엔 거짓말을 써놨지만 제출 버튼을 안 눌렀어도 자동 제출한다. 아무것도 안 썼으면 미제출로 둔다
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  useEffect(() => {
    if (writeStartedAt === null || phase !== 'write') return
    const delayMs = LIARQUIZ_WRITE_MS - (performance.now() - writeStartedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [writeStartedAt, phase])

  return {
    phase,
    isGuesser,
    text,
    setText: changeText,
    canSubmit,
    submit,
    submitted,
    rejection,
    selectedId: isGuesser ? localPick : serverPick,
    pick,
    confirm,
    confirmed,
    writeStartedAt,
    guessStartedAt,
  }
}
