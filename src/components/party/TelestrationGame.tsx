import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import {
  useTelestrationDrawing,
  type TelestrationRevealSignal,
  type TelestrationTaskSignal,
  type TelestrationWordPromptSignal,
} from '../../hooks/useTelestrationDrawing'
import {
  CATCHMIND_COLORS,
  TELESTRATION_DRAW_TIMEOUT_MS,
  TELESTRATION_MAX_TEXT_LENGTH,
  TELESTRATION_MAX_WORD_LENGTH,
  TELESTRATION_WORD_TIMEOUT_MS,
  TELESTRATION_WRITE_TIMEOUT_MS,
  type ClientToServerEvents,
  type PlayerId,
  type PlayerInfo,
  type ServerToClientEvents,
} from '../../lib/partyProtocol'
import { BRUSH_THIN, CatchmindToolbar } from '../CatchmindToolbar'
import { CatchmindSnapshot } from './CatchmindSnapshot'
import { RemainingTime } from './RemainingTime'
import { TelestrationVote } from './TelestrationVote'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface Props {
  socket: PartySocket
  task: TelestrationTaskSignal | null
  reveal: TelestrationRevealSignal | null
  wordPrompt: TelestrationWordPromptSignal | null
  playerId: PlayerId | null
  players: PlayerInfo[]
}

export function TelestrationGame({ socket, task, reveal, wordPrompt, playerId, players }: Props) {
  if (reveal) {
    return <TelestrationVote socket={socket} reveal={reveal} playerId={playerId} players={players} />
  }
  if (!task && wordPrompt) {
    return <TelestrationWordEntry socket={socket} prompt={wordPrompt} />
  }
  if (!task) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }
  // 단계가 바뀌면 입력/그림/제출 상태가 통째로 초기화돼야 하므로 stepIndex로 새로 마운트한다
  return <TelestrationStep key={task.stepIndex} socket={socket} task={task} />
}

/** 직접 입력 방식: 라운드 시작 전에 내가 낼 제시어를 하나 적는다 (남이 낸 제시어를 받아 그리게 된다) */
function TelestrationWordEntry({ socket, prompt }: { socket: PartySocket; prompt: TelestrationWordPromptSignal }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(prompt.submitted)
  const [progress, setProgress] = useState<{ submitted: number; total: number } | null>(null)
  const startedAt = useMemo(() => performance.now() - prompt.elapsedMs, [prompt])

  useEffect(() => {
    const onProgress = (data: { stepIndex: number; submitted: number; total: number }) => {
      if (data.stepIndex === -1) setProgress(data)
    }
    socket.on('telestration:progress', onProgress)
    return () => {
      socket.off('telestration:progress', onProgress)
    }
  }, [socket])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || submitted) return
    socket.emit('telestration:submitWord', { text: trimmed })
    setSubmitted(true)
  }

  return (
    <div className="party-round-stage">
      {!submitted && <RemainingTime startedAt={startedAt} timeoutMs={TELESTRATION_WORD_TIMEOUT_MS} />}
      {submitted ? (
        <div className="party-catchmind-reveal">
          <p>제출 완료! 다른 사람들을 기다리는 중...</p>
          {progress && (
            <p>
              {progress.submitted} / {progress.total}명 완료
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="party-telestration-instruction">다른 사람이 그릴 제시어를 하나 적어주세요 (내가 낸 제시어는 나는 안 그려요)</p>
          <form className="party-wordchain-form" onSubmit={onSubmit}>
            <input
              type="text"
              className="party-wordchain-input"
              value={text}
              maxLength={TELESTRATION_MAX_WORD_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 우주를 나는 고양이"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
              제출
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function PromptView({ task }: { task: TelestrationTaskSignal }) {
  const { prompt, kind } = task
  if (prompt.type === 'word') {
    return (
      <>
        <p className="party-telestration-instruction">제시어를 그림으로 표현하세요 (글자·숫자 금지)</p>
        <p className="party-catchmind-word">제시어: {prompt.word}</p>
      </>
    )
  }
  if (prompt.type === 'text') {
    return (
      <>
        <p className="party-telestration-instruction">앞사람이 쓴 글을 그림으로 표현하세요</p>
        <p className="party-telestration-text">“{prompt.text}”</p>
      </>
    )
  }
  return (
    <>
      <p className="party-telestration-instruction">
        {kind === 'write' ? '앞사람의 그림이 무엇인지 글로 적어보세요' : '앞사람의 그림입니다'}
      </p>
      <CatchmindSnapshot strokes={prompt.strokes} />
    </>
  )
}

function TelestrationStep({ socket, task }: { socket: PartySocket; task: TelestrationTaskSignal }) {
  const isDraw = task.kind === 'draw'
  const timeoutMs = isDraw ? TELESTRATION_DRAW_TIMEOUT_MS : TELESTRATION_WRITE_TIMEOUT_MS
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [submitted, setSubmitted] = useState(task.submitted)
  const [color, setColor] = useState(CATCHMIND_COLORS[0])
  const [width, setWidth] = useState(BRUSH_THIN)
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<{ submitted: number; total: number } | null>(null)
  // RemainingTime은 performance.now() 기준 시작 시각을 받는다
  const startedAt = useMemo(() => performance.now() - task.elapsedMs, [task])

  const { drawingProps, undo, clear, getStrokes } = useTelestrationDrawing(canvasRef, isDraw && !submitted, color, width)

  useEffect(() => {
    const onProgress = (data: { stepIndex: number; submitted: number; total: number }) => {
      if (data.stepIndex === task.stepIndex) setProgress(data)
    }
    socket.on('telestration:progress', onProgress)
    return () => {
      socket.off('telestration:progress', onProgress)
    }
  }, [socket, task.stepIndex])

  /** force: 시간이 다 돼서 자동으로 내는 경우 — 글이 비어 있으면 서버가 기본 문구로 채우도록 그냥 둔다 */
  const submit = (force = false) => {
    if (submitted) return
    if (isDraw) {
      socket.emit('telestration:submit', { stepIndex: task.stepIndex, strokes: getStrokes() })
    } else {
      const trimmed = text.trim()
      if (trimmed) socket.emit('telestration:submit', { stepIndex: task.stepIndex, text: trimmed })
      else if (!force) return
    }
    setSubmitted(true)
  }

  // 타이머 콜백은 항상 최신 입력값으로 제출해야 하므로 ref로 최신 submit을 들고 있는다
  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    if (submitted) return
    const remaining = Math.max(0, timeoutMs - (performance.now() - startedAt))
    const id = window.setTimeout(() => submitRef.current(true), remaining)
    return () => window.clearTimeout(id)
  }, [submitted, timeoutMs, startedAt])

  const onSubmitText = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  return (
    <div className="party-round-stage">
      <div className="party-catchmind-header">
        <span>
          {task.stepIndex + 1} / {task.totalSteps} 단계
        </span>
        <span>{isDraw ? '🎨 그리기' : '✏️ 글쓰기'}</span>
      </div>

      {!submitted && <RemainingTime startedAt={startedAt} timeoutMs={timeoutMs} />}

      {submitted ? (
        <div className="party-catchmind-reveal">
          <p>제출 완료! 다른 사람들을 기다리는 중...</p>
          {progress && (
            <p>
              {progress.submitted} / {progress.total}명 완료
            </p>
          )}
        </div>
      ) : (
        <>
          <PromptView task={task} />

          {isDraw ? (
            <>
              <canvas
                ref={canvasRef}
                className="party-catchmind-board party-catchmind-board-drawable"
                {...drawingProps}
              />
              <CatchmindToolbar
                color={color}
                width={width}
                onColorChange={setColor}
                onWidthChange={setWidth}
                onUndo={undo}
                onClear={clear}
              />
              <button type="button" className="btn btn-primary" onClick={() => submit()}>
                다 그렸어요
              </button>
            </>
          ) : (
            <form className="party-wordchain-form" onSubmit={onSubmitText}>
              <input
                type="text"
                className="party-wordchain-input"
                value={text}
                maxLength={TELESTRATION_MAX_TEXT_LENGTH}
                onChange={(e) => setText(e.target.value)}
                placeholder="이 그림을 한 문장으로 설명해보세요"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
                제출
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
