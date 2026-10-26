import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  ACROSTIC_VOTE_MS,
  ACROSTIC_WRITE_MS,
  type AcrosticVoteSignal,
  type AcrosticWriteSignal,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

// 화면에 보이는 마감이 다 되기 살짝 전에 자동 제출/투표를 보낸다 (scavengerHunt/telepathy와 같은 이유)
const AUTO_SUBMIT_MARGIN_MS = 800

/**
 * 작성 단계(acrostic:writeStart)와 투표 단계(acrostic:voteStart)를 한 화면에서 이어서 다룬다.
 * 두 신호는 useGameSession이 세션 내내 미리 구독해둔 값이고, 투표 신호가 오면 투표 단계로 넘어간다.
 * roundKey가 바뀌면(=새 라운드) 로컬 상태를 리셋한다.
 */
export function useAcrosticRound(
  socket: PartySocket,
  roundKey: string,
  writeSignal: AcrosticWriteSignal | null,
  voteSignal: AcrosticVoteSignal | null,
) {
  const word = writeSignal?.word ?? voteSignal?.word ?? ''
  const chars = [...word]

  // 줄마다 "첫 글자를 뺀 나머지"만 입력받는다 — 첫 글자는 화면에 고정되어 있고 제출할 때 서버로 합쳐서 보낸다
  const [rests, setRests] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [rejection, setRejection] = useState<string | null>(null)
  // 투표 단계: 제출 전에는 눌러서 바꿀 수 있는 "임시 선택", 투표(기권 포함) 후에는 확정된 값
  const [selected, setSelected] = useState<number | null>(null)
  const [voted, setVoted] = useState(false)

  const inVotePhase = voteSignal !== null
  const writeStartedAt = useMonotonicStartedAt(`${roundKey}-write`, writeSignal, submitted || inVotePhase ? 'finished' : 'running')
  const voteStartedAt = useMonotonicStartedAt(`${roundKey}-vote`, voteSignal, voted ? 'finished' : 'running')

  useEffect(() => {
    setRests([])
    setSubmitted(false)
    setRejection(null)
    setSelected(null)
    setVoted(false)
  }, [roundKey])

  // 작성 신호가 도착하면 입력칸을 줄 수만큼 준비한다. 재접속으로 이미 낸 내용이 있으면 그대로 복원한다
  useEffect(() => {
    if (!writeSignal) return
    setRests((prev) => {
      if (writeSignal.submitted && writeSignal.lines) return writeSignal.lines.map((line) => [...line].slice(1).join(''))
      return prev.length === [...writeSignal.word].length ? prev : [...writeSignal.word].map(() => '')
    })
    if (writeSignal.submitted) setSubmitted(true)
  }, [writeSignal])

  useEffect(() => {
    if (!voteSignal?.voted) return
    setVoted(true)
    setSelected(voteSignal.myVote)
  }, [voteSignal])

  useEffect(() => {
    const onRejected = ({ reason }: { reason: string }) => {
      setRejection(reason)
      setSubmitted(false)
    }
    socket.on('acrostic:submitRejected', onRejected)
    return () => {
      socket.off('acrostic:submitRejected', onRejected)
    }
  }, [socket])

  const setRest = useCallback((index: number, value: string) => {
    setRejection(null)
    setRests((prev) => prev.map((rest, i) => (i === index ? value : rest)))
  }, [])

  // 모든 줄에 첫 글자 말고 한 글자 이상 있어야 제출할 수 있다 (서버도 같은 기준으로 다시 검증한다)
  const canSubmit = !submitted && rests.length === chars.length && rests.every((rest) => [...rest.trim()].length >= 1)

  const submit = useCallback(() => {
    if (!canSubmit) return
    socket.emit('acrostic:submit', { lines: chars.map((char, i) => `${char}${rests[i].trim()}`) })
    setSubmitted(true)
    setRejection(null)
  }, [socket, canSubmit, chars, rests])

  const select = useCallback(
    (poemId: number) => {
      if (voted || poemId === voteSignal?.myPoemId) return
      setSelected(poemId)
    },
    [voted, voteSignal],
  )

  const vote = useCallback(
    (poemId: number | null) => {
      if (voted || !voteSignal) return
      socket.emit('acrostic:vote', { poemId })
      setSelected(poemId)
      setVoted(true)
    },
    [socket, voted, voteSignal],
  )

  // 마감 직전엔 작성을 다 해놨지만 제출 버튼을 안 눌렀어도 자동 제출하고, 투표 단계에선 골라만 놓았다면 그 선택으로 투표한다.
  // 작성이 덜 됐거나 아무것도 안 골랐으면 아무것도 하지 않는다(작성은 미제출, 투표는 서버가 기권으로 처리)
  const submitRef = useRef(submit)
  const voteRef = useRef(() => {
    if (selected !== null) vote(selected)
  })
  useEffect(() => {
    submitRef.current = submit
    voteRef.current = () => {
      if (selected !== null) vote(selected)
    }
  }, [submit, vote, selected])

  useEffect(() => {
    if (writeStartedAt === null || inVotePhase) return
    const delayMs = ACROSTIC_WRITE_MS - (performance.now() - writeStartedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => submitRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [writeStartedAt, inVotePhase])

  useEffect(() => {
    if (voteStartedAt === null) return
    const delayMs = ACROSTIC_VOTE_MS - (performance.now() - voteStartedAt) - AUTO_SUBMIT_MARGIN_MS
    const timer = window.setTimeout(() => voteRef.current(), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [voteStartedAt])

  return {
    chars,
    rests,
    setRest,
    canSubmit,
    submit,
    submitted,
    rejection,
    selected,
    select,
    vote,
    voted,
    writeStartedAt,
    voteStartedAt,
  }
}
