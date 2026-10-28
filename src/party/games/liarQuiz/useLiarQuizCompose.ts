import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  LIARQUIZ_COMPOSE_MS,
  LIARQUIZ_FAKE_MAX_COUNT,
  type ClientToServerEvents,
  type LiarQuizComposeSignal,
  type LiarQuizQuestionDraft,
  type ServerToClientEvents,
} from '../../../shared/lib/partyProtocol'
import { clearDraft, loadDraft, saveDraft } from '../../core/sessionDraft'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

// 화면에 보이는 마감이 다 되기 살짝 전에 자동 제출을 보낸다 (거짓말 작성 단계와 같은 이유)
const AUTO_SUBMIT_MARGIN_MS = 800
// 가짜 답안 입력칸은 처음에 이만큼 보여주고, 필요하면 최대 LIARQUIZ_FAKE_MAX_COUNT개까지 늘린다
const INITIAL_FAKE_INPUTS = 2

/** 문제 안의 빈칸 개수 — 서버와 같은 기준(밑줄 3개 이상이 이어진 곳이 빈칸 하나)이다 */
export const countBlanks = (text: string) => (text.match(/_{3,}/g) ?? []).length

/** 문제를 낼 수 없는 이유 (낼 수 있으면 null). 서버도 같은 기준으로 다시 검증한다 */
function validationError(text: string, answer: string): string | null {
  const blanks = countBlanks(text)
  if (text.trim() === '') return '문제를 입력해주세요.'
  if (blanks === 0) return '문제에 빈칸을 넣어주세요.'
  if (blanks > 1) return '빈칸(___)은 하나만 넣을 수 있어요.'
  if (answer.trim() === '') return '정답을 입력해주세요.'
  return null
}

/**
 * 직접 문제 만들기의 문제 입력 단계(liarQuiz:composeStart). 문제 문장·정답·가짜 답안(선택)을 입력받아 한 번만 낸다.
 * 쓰던 내용은 새로고침해도 남도록 라운드별로 임시 저장하고, 이미 낸 문제는 서버가 돌려주는 값으로 복원한다.
 * 이 훅을 쓰는 화면은 문제 입력 단계에서만 뜨므로, 라운드가 바뀌면 key로 통째로 다시 만들어진다
 */
export function useLiarQuizCompose(socket: PartySocket, roundKey: string, signal: LiarQuizComposeSignal) {
  const draftKey = `liarquiz_compose_${roundKey}`
  // 처음 한 번만 읽는다: 이미 낸 문제(재접속) > 쓰다 만 초안
  const [initial] = useState(() => signal.mine ?? loadDraft<LiarQuizQuestionDraft>(draftKey))

  const [text, setTextState] = useState(initial?.text ?? '')
  const [answer, setAnswerState] = useState(initial?.answer ?? '')
  const [fakes, setFakes] = useState<string[]>(() => {
    const saved = initial?.fakes ?? []
    return [...saved, ...Array.from({ length: Math.max(0, INITIAL_FAKE_INPUTS - saved.length) }, () => '')]
  })
  const [submitted, setSubmitted] = useState(signal.submitted)
  const [rejection, setRejection] = useState<string | null>(null)

  const startedAt = useMonotonicStartedAt(`${roundKey}-compose`, signal, submitted ? 'finished' : 'running')

  useEffect(() => {
    if (!submitted) saveDraft(draftKey, { text, answer, fakes })
  }, [text, answer, fakes, submitted, draftKey])

  useEffect(() => {
    const onRejected = ({ reason }: { reason: string }) => {
      setRejection(reason)
      setSubmitted(false)
    }
    socket.on('liarQuiz:questionRejected', onRejected)
    return () => {
      socket.off('liarQuiz:questionRejected', onRejected)
    }
  }, [socket])

  const setText = useCallback((value: string) => {
    setRejection(null)
    setTextState(value)
  }, [])
  const setAnswer = useCallback((value: string) => {
    setRejection(null)
    setAnswerState(value)
  }, [])
  const setFake = useCallback((index: number, value: string) => {
    setRejection(null)
    setFakes((prev) => prev.map((fake, i) => (i === index ? value : fake)))
  }, [])
  const addFake = useCallback(() => setFakes((prev) => (prev.length < LIARQUIZ_FAKE_MAX_COUNT ? [...prev, ''] : prev)), [])

  const canSubmit = !submitted && validationError(text, answer) === null

  // 버튼은 항상 누를 수 있고, 낼 수 없는 문제면 이유를 빨간 글씨로 알려준다
  const submit = useCallback(() => {
    if (submitted) return
    const error = validationError(text, answer)
    if (error) {
      setRejection(error)
      return
    }
    socket.emit('liarQuiz:submitQuestion', {
      text: text.trim(),
      answer: answer.trim(),
      fakes: fakes.map((fake) => fake.trim()).filter(Boolean),
    })
    clearDraft(draftKey)
    setSubmitted(true)
    setRejection(null)
  }, [socket, submitted, text, answer, fakes, draftKey])

  // 마감 직전에 다 써놨지만 제출 버튼을 안 눌렀어도 자동 제출한다. 덜 썼으면 미제출로 두고(안내 문구도 띄우지 않고),
  // 그 몫은 문항 은행의 문제로 채워진다
  const autoSubmitRef = useRef(() => {})
  useEffect(() => {
    autoSubmitRef.current = () => {
      if (canSubmit) submit()
    }
  }, [canSubmit, submit])

  useEffect(() => {
    if (startedAt === null) return
    const delayMs = LIARQUIZ_COMPOSE_MS - (performance.now() - startedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => autoSubmitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return {
    text,
    setText,
    answer,
    setAnswer,
    fakes,
    setFake,
    addFake,
    canAddFake: fakes.length < LIARQUIZ_FAKE_MAX_COUNT,
    canSubmit,
    submit,
    submitted,
    rejection,
    startedAt,
  }
}
