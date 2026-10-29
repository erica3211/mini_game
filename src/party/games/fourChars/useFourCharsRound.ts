import { useCallback, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { type ClientToServerEvents, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { FourCharsTurnSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * 네글자 퀴즈 한 턴의 화면 상태. 턴 신호(fourChars:turn)와 그 뒤에 이어지는 힌트·결과는 useGameSession이 세션 내내 받아 하나의 신호로 합쳐 둔다.
 * 답은 턴마다 한 번만 낼 수 있어서, 낸 턴(라운드+턴 번호)을 기억해 두고 같은 턴에는 입력창을 다시 열지 않는다.
 */
export function useFourCharsRound(socket: PartySocket, roundKey: string, signal: FourCharsTurnSignal | null, playerId: string | null) {
  const [text, setText] = useState('')
  const [submittedKey, setSubmittedKey] = useState<string | null>(null)

  const turnKey = `${roundKey}-${signal?.turnIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(turnKey, signal, signal?.result ? 'finished' : 'running')

  const canAnswer = signal !== null && signal.result === null && signal.answererId === playerId && submittedKey !== turnKey

  const submit = useCallback(() => {
    if (!signal || !canAnswer) return
    const trimmed = text.trim()
    if (!trimmed) return
    socket.emit('fourChars:submit', { text: trimmed })
    setSubmittedKey(turnKey)
    setText('')
  }, [socket, signal, canAnswer, text, turnKey])

  return { text, setText, canAnswer, submit, startedAt, hasSubmitted: signal !== null && submittedKey === turnKey }
}
