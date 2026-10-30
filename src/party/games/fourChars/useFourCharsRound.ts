import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { type ClientToServerEvents, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import type { FourCharsTurnSignal } from './protocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

// 쓰고 있는 글자를 서버로 보내는 최소 간격 — 한 글자마다 보내면 소켓이 과하게 바빠져서 모아서 보낸다 (마지막 입력은 꼭 보낸다)
const TYPING_FLUSH_MS = 80

/**
 * 네글자 퀴즈 한 턴의 화면 상태. 턴 신호(fourChars:turn)와 그 뒤에 이어지는 힌트·결과는 useGameSession이 세션 내내 받아 하나의 신호로 합쳐 둔다.
 * 답은 턴마다 한 번만 낼 수 있어서, 낸 턴(라운드+턴 번호)을 기억해 두고 같은 턴에는 입력창을 다시 열지 않는다.
 * 답할 사람이 쓰는 글자는 입력할 때마다 서버에 보내(typing) 다른 사람들 화면에 실시간으로 보여준다.
 */
export function useFourCharsRound(socket: PartySocket, roundKey: string, signal: FourCharsTurnSignal | null, playerId: string | null) {
  const [text, setText] = useState('')
  const [submittedKey, setSubmittedKey] = useState<string | null>(null)
  // 다른 사람이 지금 쓰고 있는 글자 — 어느 턴의 것인지 함께 기억해서 지난 턴 글자가 남아 보이지 않게 한다
  const [liveTyping, setLiveTyping] = useState<{ turnIndex: number; text: string } | null>(null)
  const typingTimer = useRef<number | null>(null)
  const pendingText = useRef<string | null>(null)

  const turnKey = `${roundKey}-${signal?.turnIndex ?? 'none'}`
  const startedAt = useMonotonicStartedAt(turnKey, signal, signal?.result ? 'finished' : 'running')

  const canAnswer = signal !== null && signal.result === null && signal.answererId === playerId && submittedKey !== turnKey

  useEffect(() => {
    const onTyping = (data: { turnIndex: number; text: string }) => setLiveTyping({ turnIndex: data.turnIndex, text: data.text })
    socket.on('fourChars:typing', onTyping)
    return () => {
      socket.off('fourChars:typing', onTyping)
    }
  }, [socket])

  const cancelTyping = useCallback(() => {
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
    typingTimer.current = null
    pendingText.current = null
  }, [])

  // 턴이 바뀌거나 화면이 사라지면 보내려던 글자를 버린다
  useEffect(() => cancelTyping, [turnKey, cancelTyping])

  /** 입력창 값이 바뀔 때 — 화면에 반영하고, 다른 사람에게 보일 글자를 모아서 서버로 보낸다 */
  const changeText = useCallback(
    (value: string) => {
      setText(value)
      if (!canAnswer) return
      pendingText.current = value
      if (typingTimer.current !== null) return
      typingTimer.current = window.setTimeout(() => {
        typingTimer.current = null
        if (pendingText.current !== null) socket.emit('fourChars:typing', { text: pendingText.current })
        pendingText.current = null
      }, TYPING_FLUSH_MS)
    },
    [socket, canAnswer],
  )

  const submit = useCallback(() => {
    if (!signal || !canAnswer) return
    const trimmed = text.trim()
    if (!trimmed) return
    cancelTyping()
    socket.emit('fourChars:submit', { text: trimmed })
    setSubmittedKey(turnKey)
    setText('')
  }, [socket, signal, canAnswer, text, turnKey, cancelTyping])

  // 이번 턴에 다른 사람이 쓰고 있는 글자 (답할 사람 본인이거나 결과가 나온 뒤에는 보여주지 않는다)
  const typingNow = signal !== null && signal.result === null && signal.answererId !== playerId && liveTyping?.turnIndex === signal.turnIndex ? liveTyping.text : ''

  return { text, changeText, canAnswer, submit, startedAt, hasSubmitted: signal !== null && submittedKey === turnKey, typingNow }
}
