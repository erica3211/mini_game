import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Socket } from 'socket.io-client'
import { clearCatchmindCanvas, drawFullBoard, fitCatchmindCanvas, strokeSegment } from '../lib/catchmindDraw'
import type { CatchmindGuesserResult, CatchmindStroke, ClientToServerEvents, PlayerId, ServerToClientEvents } from '../lib/partyProtocol'
import { useMonotonicStartedAt } from './useMonotonicStartedAt'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LocalStatus = 'waiting' | 'running' | 'finished'

export interface CatchmindTurnStartSignal {
  turnIndex: number
  totalTurns: number
  drawerId: PlayerId
  strokes: CatchmindStroke[]
  elapsedMs: number
}

export interface CatchmindWordSignal {
  turnIndex: number
  word: string
}

export interface CatchmindTurnEndInfo {
  turnIndex: number
  drawerId: PlayerId
  word: string
  correctGuessers: CatchmindGuesserResult[]
  drawerPoints: number
}

export type CatchmindChatEntry =
  | { id: number; kind: 'chat'; playerId: PlayerId; text: string }
  | { id: number; kind: 'correct'; playerId: PlayerId; points: number }
  | { id: number; kind: 'reveal'; drawerId: PlayerId; word: string }

// 포인터 이동을 모아 서버로 보내는 주기 — pixelCanvas의 PAINT_FLUSH_MS와 같은 이유(소켓 과다 전송 방지)
const STROKE_FLUSH_MS = 40

let chatIdSeq = 0

/**
 * 그림판의 진짜 상태(서버)와 별개로, 내가 그리는 획은 서버 응답을 기다리지 않고 즉시 화면에 반영한다
 * (낙관적 반영, pixelCanvas와 동일한 이유). 대신 서버가 나에게 다시 중계하는 내 획 이벤트는 무시해서
 * 같은 선을 두 번 그리지 않는다 — 비출제자만 중계 이벤트로 캔버스를 재생한다.
 */
export function useCatchmindRound(
  socket: PartySocket,
  roundKey: string,
  turnStart: CatchmindTurnStartSignal | null,
  wordSignal: CatchmindWordSignal | null,
  playerId: PlayerId | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const turnIndex = turnStart?.turnIndex ?? -1
  const turnKey = `${roundKey}-${turnIndex}`
  const isDrawer = turnStart !== null && playerId !== null && playerId === turnStart.drawerId

  const [finishedTurnKey, setFinishedTurnKey] = useState<string | null>(null)
  const [hintLength, setHintLength] = useState<number | null>(null)
  const [guessed, setGuessed] = useState(false)
  const [chat, setChat] = useState<CatchmindChatEntry[]>([])
  const [lastTurnEnd, setLastTurnEnd] = useState<CatchmindTurnEndInfo | null>(null)

  const myWord = isDrawer && wordSignal?.turnIndex === turnIndex ? wordSignal.word : null
  const status: LocalStatus = !turnStart ? 'waiting' : finishedTurnKey === turnKey ? 'finished' : 'running'
  const startedAt = useMonotonicStartedAt(turnKey, turnStart, status)

  // 출제자 본인 획의 스타일/마지막 점 — 다음 pointermove가 왔을 때 이어 그리기 위해 기억
  const myStyleRef = useRef<{ color: string; width: number } | null>(null)
  const myLastPointRef = useRef<{ x: number; y: number } | null>(null)
  const pendingPointsRef = useRef<{ x: number; y: number }[]>([])
  // 비출제자 화면에서 지금 중계되고 있는 획의 스타일/마지막 점
  const remoteStyleRef = useRef<{ color: string; width: number } | null>(null)
  const remoteLastPointRef = useRef<{ x: number; y: number } | null>(null)

  // 새 턴 시작 / 재접속 스냅샷 — 캔버스를 서버가 보낸 스냅샷으로 통째로 맞춘다
  useEffect(() => {
    const canvas = canvasRef.current
    if (!turnStart || !canvas) return
    fitCatchmindCanvas(canvas)
    drawFullBoard(canvas, turnStart.strokes)
    remoteLastPointRef.current = null
    remoteStyleRef.current = null
    myLastPointRef.current = null
  }, [turnStart, canvasRef])

  // 턴이 바뀌면 이번 턴 전용 로컬 상태를 초기화한다 (채팅 기록은 게임이 끝날 때까지 유지)
  useEffect(() => {
    setHintLength(null)
    setGuessed(false)
    pendingPointsRef.current = []
  }, [turnKey])

  // roundKey(=새 게임 슬롯)가 바뀌면 채팅 기록도 비운다
  useEffect(() => {
    setChat([])
    setLastTurnEnd(null)
  }, [roundKey])

  useEffect(() => {
    const onHintRevealed = (data: { length: number }) => setHintLength(data.length)
    const onChatMessage = (data: { playerId: PlayerId; text: string }) => {
      setChat((prev) => [...prev.slice(-49), { id: chatIdSeq++, kind: 'chat', playerId: data.playerId, text: data.text }])
    }
    const onCorrectGuess = (data: { playerId: PlayerId; points: number }) => {
      if (data.playerId === playerId) setGuessed(true)
      setChat((prev) => [
        ...prev.slice(-49),
        { id: chatIdSeq++, kind: 'correct', playerId: data.playerId, points: data.points },
      ])
    }
    const onTurnEnd = (data: CatchmindTurnEndInfo) => {
      setLastTurnEnd(data)
      setFinishedTurnKey(`${roundKey}-${data.turnIndex}`)
      setChat((prev) => [...prev.slice(-49), { id: chatIdSeq++, kind: 'reveal', drawerId: data.drawerId, word: data.word }])
    }
    const onStrokeStart = (data: { color: string; width: number; x: number; y: number }) => {
      if (isDrawer) return
      const canvas = canvasRef.current
      if (!canvas) return
      remoteStyleRef.current = { color: data.color, width: data.width }
      remoteLastPointRef.current = { x: data.x, y: data.y }
      strokeSegment(canvas, data.color, data.width, null, [{ x: data.x, y: data.y }])
    }
    const onStrokePoints = (data: { points: { x: number; y: number }[] }) => {
      if (isDrawer) return
      const canvas = canvasRef.current
      const style = remoteStyleRef.current
      if (!canvas || !style || data.points.length === 0) return
      strokeSegment(canvas, style.color, style.width, remoteLastPointRef.current, data.points)
      remoteLastPointRef.current = data.points[data.points.length - 1]
    }
    const onStrokeEnd = () => {
      if (isDrawer) return
      remoteLastPointRef.current = null
    }
    const onClear = () => {
      if (isDrawer) return
      const canvas = canvasRef.current
      if (canvas) clearCatchmindCanvas(canvas)
      remoteLastPointRef.current = null
    }
    // 래스터 캔버스라 획 하나만 지울 수 없어서, 서버가 확정해준 "남은 획 전체"로 다시 그린다.
    // 출제자 본인도 로컬엔 남은 획 목록이 없으니(그냥 픽셀만 있음) 서버 응답으로 함께 다시 그린다.
    const onUndo = (data: { strokes: CatchmindStroke[] }) => {
      const canvas = canvasRef.current
      if (canvas) drawFullBoard(canvas, data.strokes)
      remoteLastPointRef.current = null
      myLastPointRef.current = null
    }

    socket.on('catchmind:hintRevealed', onHintRevealed)
    socket.on('catchmind:chatMessage', onChatMessage)
    socket.on('catchmind:correctGuess', onCorrectGuess)
    socket.on('catchmind:turnEnd', onTurnEnd)
    socket.on('catchmind:strokeStart', onStrokeStart)
    socket.on('catchmind:strokePoints', onStrokePoints)
    socket.on('catchmind:strokeEnd', onStrokeEnd)
    socket.on('catchmind:clear', onClear)
    socket.on('catchmind:undo', onUndo)
    return () => {
      socket.off('catchmind:hintRevealed', onHintRevealed)
      socket.off('catchmind:chatMessage', onChatMessage)
      socket.off('catchmind:correctGuess', onCorrectGuess)
      socket.off('catchmind:turnEnd', onTurnEnd)
      socket.off('catchmind:strokeStart', onStrokeStart)
      socket.off('catchmind:strokePoints', onStrokePoints)
      socket.off('catchmind:strokeEnd', onStrokeEnd)
      socket.off('catchmind:clear', onClear)
      socket.off('catchmind:undo', onUndo)
    }
  }, [socket, isDrawer, playerId, roundKey, canvasRef])

  // 모아둔 좌표를 주기적으로 서버에 전송
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (pendingPointsRef.current.length === 0) return
      socket.emit('catchmind:strokePoints', { points: pendingPointsRef.current })
      pendingPointsRef.current = []
    }, STROKE_FLUSH_MS)
    return () => window.clearInterval(interval)
  }, [socket])

  const beginStroke = useCallback(
    (color: string, width: number, x: number, y: number) => {
      if (!isDrawer || status !== 'running') return
      const canvas = canvasRef.current
      if (canvas) strokeSegment(canvas, color, width, null, [{ x, y }])
      myStyleRef.current = { color, width }
      myLastPointRef.current = { x, y }
      pendingPointsRef.current = []
      socket.emit('catchmind:strokeStart', { color, width, x, y })
    },
    [isDrawer, status, socket, canvasRef],
  )

  const continueStroke = useCallback(
    (x: number, y: number) => {
      if (!isDrawer || status !== 'running' || !myLastPointRef.current) return
      const canvas = canvasRef.current
      const style = myStyleRef.current
      if (canvas && style) strokeSegment(canvas, style.color, style.width, myLastPointRef.current, [{ x, y }])
      myLastPointRef.current = { x, y }
      pendingPointsRef.current.push({ x, y })
    },
    [isDrawer, status, canvasRef],
  )

  const endStroke = useCallback(() => {
    if (!isDrawer || !myLastPointRef.current) return
    if (pendingPointsRef.current.length > 0) {
      socket.emit('catchmind:strokePoints', { points: pendingPointsRef.current })
      pendingPointsRef.current = []
    }
    socket.emit('catchmind:strokeEnd')
    myLastPointRef.current = null
  }, [isDrawer, socket])

  const clearBoard = useCallback(() => {
    if (!isDrawer) return
    const canvas = canvasRef.current
    if (canvas) clearCatchmindCanvas(canvas)
    myLastPointRef.current = null
    pendingPointsRef.current = []
    socket.emit('catchmind:clear')
  }, [isDrawer, socket, canvasRef])

  const undoStroke = useCallback(() => {
    if (!isDrawer) return
    socket.emit('catchmind:undo')
  }, [isDrawer, socket])

  const submitGuess = useCallback(
    (text: string) => {
      if (isDrawer || guessed || status !== 'running' || !text.trim()) return
      socket.emit('catchmind:guess', { text })
    },
    [isDrawer, guessed, status, socket],
  )

  return {
    status,
    startedAt,
    isDrawer,
    drawerId: turnStart?.drawerId ?? null,
    turnIndex,
    totalTurns: turnStart?.totalTurns ?? 0,
    myWord,
    hintLength,
    guessed,
    chat,
    lastTurnEnd,
    beginStroke,
    continueStroke,
    endStroke,
    clearBoard,
    undoStroke,
    submitGuess,
  }
}
