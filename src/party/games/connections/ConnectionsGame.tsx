import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { CONNECTIONS_GROUP_SIZE, CONNECTIONS_WRONG_PENALTY_S, type ConnectionsEndSignal, type ConnectionsNotice, type ConnectionsProgressSignal, type ConnectionsStateSignal } from './protocol'
import { ConnectionsEnd, ConnectionsPlayers, ConnectionsSolvedList } from './ConnectionsView'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: ConnectionsStateSignal | null
  progress: ConnectionsProgressSignal | null
  end: ConnectionsEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

// 방금 낸 결과(맞힘·틀림)를 알려 주는 시간
const NOTICE_MS = 2_500

export function ConnectionsGame({ socket, roundKey, state, progress, end, playerId, players }: Props) {
  const startedAt = useMonotonicStartedAt(roundKey, state, end ? 'finished' : 'running')

  // 지금 고르는 중인 칸 — 낼 때까지는 내 화면에만 있다
  const [selected, setSelected] = useState<number[]>([])
  useEffect(() => setSelected([]), [roundKey])

  // 손가락으로 쓰는 기기(모바일)에서는 퍼즐이 시작될 때 시간·진행률·단어판·제출 버튼이 한 화면에 보이도록 위치를 맞춘다.
  // 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다
  const playRef = useRef<HTMLDivElement>(null)
  const hasState = state !== null
  useEffect(() => {
    if (!hasState || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [hasState, roundKey])
  // 맞히거나 틀리면 고른 것을 비운다
  const solvedCount = state?.solved.length ?? 0
  const wrongs = state?.wrongs ?? 0
  useEffect(() => setSelected([]), [solvedCount, wrongs])

  // 새로 온 알림만 보여 준다 — 처음 받은 상태(새로고침해서 돌아온 경우 포함)에 이미 있던 알림은 보여 주지 않는다
  const [toast, setToast] = useState<ConnectionsNotice | null>(null)
  const seenSeqRef = useRef<number | null>(null)
  useEffect(() => {
    seenSeqRef.current = null
    setToast(null)
  }, [roundKey])
  const noticeSeq = state?.notice?.seq ?? 0
  useEffect(() => {
    if (!state) return
    const first = seenSeqRef.current === null
    const seen = seenSeqRef.current ?? 0
    seenSeqRef.current = noticeSeq
    if (first || !state.notice || noticeSeq <= seen) return
    setToast(state.notice)
    const timer = window.setTimeout(() => setToast(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [noticeSeq]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const solvedCells = new Set(state.solved.flatMap((group) => group.cells))
  const remaining = state.words.map((word, cell) => ({ word, cell })).filter(({ cell }) => !solvedCells.has(cell))
  const selectedSet = new Set(selected)
  const finished = state.finishedMs !== null
  const playing = !end && !finished

  const toggle = (cell: number) => {
    if (!playing) return
    setSelected((prev) => (prev.includes(cell) ? prev.filter((c) => c !== cell) : prev.length < CONNECTIONS_GROUP_SIZE ? [...prev, cell] : prev))
  }
  const submit = () => {
    if (!playing || selected.length !== CONNECTIONS_GROUP_SIZE) return
    socket.emit('connections:submit', { cells: selected })
  }

  const toastText = (notice: ConnectionsNotice) => {
    if (notice.kind === 'right') return '✅ 맞혔어요!'
    return notice.best === CONNECTIONS_GROUP_SIZE - 1 ? '❌ 틀렸어요! 하나만 바꾸면 돼요' : '❌ 틀렸어요'
  }

  return (
    <div ref={playRef} className="party-round-stage party-cn-stage">
      {startedAt !== null && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      <ConnectionsPlayers players={players} progress={progress?.players.map((row) => (row.playerId === playerId ? { ...row, solved: state.solved.length, wrongs: state.wrongs, finishedMs: state.finishedMs } : row)) ?? []} myId={playerId} />

      {/* 알림 칸은 늘 같은 높이로 두어서, 알림이 나타났다 사라져도 아래 화면이 움직이지 않는다 */}
      <div className="party-cn-toast-slot" aria-live="polite">
        {toast && !end ? (
          <p className={`party-cn-toast party-cn-toast-${toast.kind}`}>{toastText(toast)}</p>
        ) : (
          !end && finished && <p className="party-cn-turn">🎉 모든 묶음을 찾았어요! 다른 사람이 끝나길 기다려요</p>
        )}
      </div>

      <ConnectionsSolvedList solved={state.solved} words={state.words} />

      {(remaining.length > 0 || !end) && (
        <div className="party-cn-board" role="group" aria-label="단어판">
          {remaining.map(({ word, cell }) => (
            <button
              key={cell}
              type="button"
              className={`party-cn-cell${selectedSet.has(cell) ? ' party-cn-cell-selected' : ''}${playing ? '' : ' party-cn-cell-locked'}`}
              aria-pressed={selectedSet.has(cell)}
              aria-disabled={!playing}
              onClick={() => toggle(cell)}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {playing && (
        <div className="party-cn-actions">
          <button type="button" className="btn btn-primary" disabled={selected.length !== CONNECTIONS_GROUP_SIZE} onClick={submit}>
            제출 ({selected.length}/{CONNECTIONS_GROUP_SIZE})
          </button>
          <button type="button" className="btn btn-secondary" disabled={selected.length === 0} onClick={() => setSelected([])}>
            선택 지우기
          </button>
        </div>
      )}
      {playing && (
        <p className="party-cn-note">
          공통점이 있는 단어 5개를 골라요. 틀리면 기록에 {CONNECTIONS_WRONG_PENALTY_S}초가 더해져요{state.wrongs > 0 ? ` (지금까지 ${state.wrongs}번 틀림)` : ''}.
        </p>
      )}

      {end && <ConnectionsEnd end={end} players={players} myId={playerId} />}
    </div>
  )
}
