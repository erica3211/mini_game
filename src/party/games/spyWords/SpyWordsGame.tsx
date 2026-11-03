import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { SPY_MAX_COUNT, SPY_MIN_COUNT, spyHintError, type SpyWordsEndSignal, type SpyWordsStateSignal } from './protocol'
import { SpyBoard, SpyClock, SpyEnd, SpyEvents, SpyTeams, teamNameOf } from './SpyWordsView'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: SpyWordsStateSignal | null
  end: SpyWordsEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  teams: TeamInfo[]
}

// 방금 열린 칸을 눈에 띄게 하는 시간
const NEW_REVEAL_MS = 1_400

export function SpyWordsGame({ socket, roundKey, state, end, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const myTeam = teamOf(teams, playerId)

  const [word, setWord] = useState('')
  const [count, setCount] = useState(2)
  const [hintError, setHintError] = useState<string | null>(null)

  // 이 단계(힌트·고르기)가 시작된 시각 — 새 단계 신호가 도착한 때 서버가 알려 준 경과 시간으로 맞춘다
  const phaseStartedAt = useMemo(() => (state ? performance.now() - state.phaseElapsedMs : 0), [state?.phaseNo, roundKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalStartedAt = useMemo(() => (state ? performance.now() - state.totalElapsedMs : 0), [state === null, roundKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 새 단계가 시작되면 힌트 입력을 비운다
  useEffect(() => {
    setWord('')
    setHintError(null)
  }, [state?.phaseNo, roundKey])

  // 방금 열린 칸 — 처음 받은 상태(새로고침해서 돌아온 경우 포함)에 이미 열려 있던 칸은 눈에 띄게 하지 않는다
  const revealedRef = useRef<Set<number>>(new Set())
  const seenRef = useRef(false)
  const [justRevealed, setJustRevealed] = useState<ReadonlySet<number>>(new Set())
  useEffect(() => {
    revealedRef.current = new Set()
    seenRef.current = false
    setJustRevealed(new Set())
  }, [roundKey])
  useEffect(() => {
    if (!state) return
    const now = new Set(state.cards.flatMap((card, index) => (card.revealed !== null ? [index] : [])))
    const fresh = [...now].filter((index) => !revealedRef.current.has(index))
    const firstSeen = !seenRef.current
    seenRef.current = true
    revealedRef.current = now
    if (firstSeen || fresh.length === 0) return
    setJustRevealed(new Set(fresh))
    const timer = window.setTimeout(() => setJustRevealed(new Set()), NEW_REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [state?.cards]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const ended = state.phase === 'ended' || end !== null
  const turnTeam = state.teams.find((team) => team.teamId === state.turnTeamId)
  const isSpymaster = state.teams.some((team) => team.spymasterId === playerId)
  const myTurn = myTeam?.id === state.turnTeamId
  // 요원: 우리 팀 팀원 중 스파이 마스터가 아닌 사람 (혼자인 팀은 스파이 마스터가 요원도 한다)
  const iAmAgent = !!myTeam && (!isSpymaster || myTeam.memberIds.length === 1)
  const canGiveHint = !ended && state.phase === 'hint' && myTurn && turnTeam?.spymasterId === playerId
  const canPick = !ended && state.phase === 'guess' && myTurn && iAmAgent
  const boardWords = state.cards.map((card) => card.word)

  const submitHint = (event: FormEvent) => {
    event.preventDefault()
    const error = spyHintError(word, boardWords)
    setHintError(error)
    if (error) return
    socket.emit('spyWords:hint', { word: word.trim(), count })
  }

  const turnName = turnTeam ? `${teamEmoji(turnTeam.teamId)} ${teamNameOf(teams, turnTeam.teamId)}` : ''
  const status = ended
    ? null
    : state.phase === 'hint'
      ? canGiveHint
        ? '정답을 보고 우리 팀이 찾을 단어를 힌트로 알려 주세요!'
        : `${turnName} 스파이 마스터가 힌트를 생각하고 있어요`
      : canPick
        ? `힌트 “${state.hint?.word} ${state.hint?.count}”에 맞는 단어를 눌러 고르고(${state.maxPicks}개까지) 확정하세요`
        : `${turnName} 요원들이 단어를 고르고 있어요`

  return (
    <div className="party-round-stage party-spy-stage">
      {!ended && <SpyClock phaseStartedAt={phaseStartedAt} phaseMs={state.phaseMs} totalStartedAt={totalStartedAt} totalMs={state.totalMs} />}

      {!ended && (
        <div className={`party-spy-turn${myTurn ? ' party-spy-turn-mine' : ''}`}>
          <strong>{turnName} 차례</strong>
          {state.hint && state.phase === 'guess' && (
            <span className="party-spy-hint">
              힌트 <strong>{state.hint.word}</strong> · {state.hint.count}
            </span>
          )}
        </div>
      )}
      {status && <p className="party-spy-status">{status}</p>}

      {myTeam && (
        <p className="party-spy-role">{isSpymaster ? '🕵️ 나는 스파이 마스터예요 — 정답이 테두리 색으로 보여요' : '🔍 나는 요원이에요 — 스파이 마스터의 힌트로 단어를 찾아요'}</p>
      )}

      {canGiveHint && (
        <form className="party-spy-hint-form" onSubmit={submitHint}>
          <input
            className="guess-input"
            value={word}
            maxLength={10}
            placeholder="힌트 단어 (한 단어)"
            autoComplete="off"
            onChange={(event) => {
              setWord(event.target.value)
              setHintError(null)
            }}
          />
          <select value={count} onChange={(event) => setCount(Number(event.target.value))} aria-label="찾을 단어 개수">
            {Array.from({ length: SPY_MAX_COUNT - SPY_MIN_COUNT + 1 }, (_, i) => i + SPY_MIN_COUNT).map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={!word.trim()}>
            힌트 주기
          </button>
          {hintError && <p className="party-spy-error">{hintError}</p>}
        </form>
      )}

      <SpyBoard cards={state.cards} candidates={state.candidates} canPick={canPick} onPick={(index) => socket.emit('spyWords:toggle', { index })} justRevealed={justRevealed} />

      {canPick && (
        <div className="party-spy-actions">
          <button type="button" className="btn btn-primary" disabled={state.candidates.length === 0} onClick={() => socket.emit('spyWords:confirm')}>
            확정 ({state.candidates.length}/{state.maxPicks})
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => socket.emit('spyWords:pass')}>
            턴 넘기기
          </button>
        </div>
      )}
      {canPick && <p className="party-spy-note">팀원이 누른 칸도 함께 보여요. 고른 순서대로 열리고, 우리 팀 단어가 아닌 칸을 만나면 거기서 턴이 끝나요.</p>}

      {end && <SpyEnd end={end} teams={teams} />}

      <SpyTeams teams={teams} statuses={state.teams} turnTeamId={ended ? undefined : state.turnTeamId} myTeamId={myTeam?.id} nicknameOf={nicknameOf} />
      <SpyEvents events={state.events} cards={state.cards} teams={teams} />
    </div>
  )
}
