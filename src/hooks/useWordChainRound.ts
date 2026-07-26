import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'submitted'
type StartSignal = { chosung: string[]; elapsedMs: number }

const SHAKE_DURATION_MS = 300
const TOAST_DURATION_MS = 1500

export interface CorrectToast {
  id: number
  playerId: PlayerId
}

/**
 * roundKey가 바뀌면(=새 라운드) 로컬 상태를 리셋한다.
 * startSignal은 useGameSession이 세션 내내 미리 구독해둔 wordChain:roundStart 신호다 —
 * 최초 시작과 재접속 시 재개 모두 이 신호로 전달된다.
 */
export function useWordChainRound(socket: PartySocket, roundKey: string, startSignal: StartSignal | null) {
  const [status, setStatus] = useState<LocalStatus>('waiting')
  const [chosung, setChosung] = useState<string[]>([])
  const [guess, setGuess] = useState('')
  const [isWrong, setIsWrong] = useState(false)
  const [toasts, setToasts] = useState<CorrectToast[]>([])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, status)

  useEffect(() => {
    setStatus('waiting')
    setChosung([])
    setGuess('')
    setIsWrong(false)
    setToasts([])
  }, [roundKey])

  useEffect(() => {
    if (!startSignal || status === 'submitted') return
    setChosung(startSignal.chosung)
    setStatus('running')
  }, [startSignal, status])

  useEffect(() => {
    const onGuessResult = ({ correct }: { correct: boolean }) => {
      if (correct) {
        setStatus('submitted')
        return
      }
      setIsWrong(true)
      window.setTimeout(() => setIsWrong(false), SHAKE_DURATION_MS)
    }
    const onCorrectAnswer = ({ playerId }: { playerId: PlayerId }) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, playerId }])
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS)
    }
    socket.on('wordChain:guessResult', onGuessResult)
    socket.on('wordChain:correctAnswer', onCorrectAnswer)
    return () => {
      socket.off('wordChain:guessResult', onGuessResult)
      socket.off('wordChain:correctAnswer', onCorrectAnswer)
    }
  }, [socket])

  const submit = useCallback(() => {
    if (status !== 'running' || !guess.trim()) return
    socket.emit('wordChain:submit', { guess })
    setGuess('')
  }, [socket, status, guess])

  return { status, chosung, guess, setGuess, submit, isWrong, toasts, startedAt }
}
