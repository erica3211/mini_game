import { useEffect, useState, type CSSProperties } from 'react'
import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { SPY_COLS, type SpyCard, type SpyEvent, type SpyOwner, type SpyTeamStatus, type SpyWordsEndSignal } from './protocol'

// 스파이 단어판 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

export const teamNameOf = (teams: TeamInfo[], teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

const ownerColor = (owner: SpyOwner): string => (typeof owner === 'number' ? `rgb(${teamRgb(owner)})` : owner === 'assassin' ? '#111827' : '#9ca3af')

interface BoardProps {
  cards: SpyCard[]
  /** 고른(확정 전) 칸 — 고른 순서대로 */
  candidates?: number[]
  /** 칸을 누를 수 있는가 (차례인 팀의 요원일 때) */
  canPick?: boolean
  onPick?: (index: number) => void
  /** 방금 열린 칸 — 잠깐 눈에 띄게 한다 */
  justRevealed?: ReadonlySet<number>
}

/** 5×5 단어판 — 열린 칸은 주인 색으로 칠하고, 정답을 아는 사람(스파이 마스터·끝난 뒤)에게는 안 열린 칸의 주인이 테두리로 보인다 */
export function SpyBoard({ cards, candidates = [], canPick = false, onPick, justRevealed }: BoardProps) {
  return (
    <div className="party-spy-board" style={{ '--spy-cols': SPY_COLS } as CSSProperties} role="grid">
      {cards.map((card, index) => {
        const open = card.revealed !== null
        const owner = card.revealed ?? card.key ?? null
        const order = candidates.indexOf(index)
        const classes = [
          'party-spy-card',
          open ? 'party-spy-card-open' : '',
          !open && card.key !== undefined ? 'party-spy-card-key' : '',
          owner === 'assassin' ? 'party-spy-card-assassin' : '',
          owner === 'neutral' ? 'party-spy-card-neutral' : '',
          order >= 0 ? 'party-spy-card-picked' : '',
          justRevealed?.has(index) ? 'party-spy-card-new' : '',
          canPick && !open ? 'party-spy-card-pickable' : '',
        ]
        return (
          <button
            key={index}
            type="button"
            role="gridcell"
            className={classes.filter(Boolean).join(' ')}
            style={owner !== null ? ({ '--spy-color': ownerColor(owner) } as CSSProperties) : undefined}
            aria-disabled={!canPick || open}
            onClick={() => {
              if (canPick && !open) onPick?.(index)
            }}
          >
            <span className="party-spy-word">{card.word}</span>
            {owner === 'assassin' && <span className="party-spy-mark">☠️</span>}
            {order >= 0 && <span className="party-spy-order">{order + 1}</span>}
          </button>
        )
      })}
    </div>
  )
}

interface TeamsProps {
  teams: TeamInfo[]
  statuses: SpyTeamStatus[]
  turnTeamId?: number
  myTeamId?: number
  nicknameOf: (playerId: string) => string
}

/** 팀별 남은 단어 수와 스파이 마스터 */
export function SpyTeams({ teams, statuses, turnTeamId, myTeamId, nicknameOf }: TeamsProps) {
  return (
    <ul className="party-spy-teams">
      {statuses.map((status) => (
        <li
          key={status.teamId}
          className={`${teamColorClass(status.teamId)}${status.teamId === turnTeamId ? ' party-spy-team-turn' : ''}${status.eliminated ? ' party-spy-team-out' : ''}`}
        >
          <span className="party-spy-team-name">
            {teamEmoji(status.teamId)} {teamNameOf(teams, status.teamId)}
            {status.teamId === myTeamId && ' (우리)'}
          </span>
          <span className="party-spy-team-info">
            {status.eliminated ? '☠️ 탈락' : `남은 단어 ${status.remaining}`} · 🕵️ {nicknameOf(status.spymasterId)}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface EventsProps {
  events: SpyEvent[]
  cards: SpyCard[]
  teams: TeamInfo[]
}

const ownerLabel = (teams: TeamInfo[], owner: SpyOwner, byTeamId: number): string =>
  owner === 'assassin' ? '함정! ☠️' : owner === 'neutral' ? '중립' : owner === byTeamId ? '우리 팀 단어 ✔' : `${teamNameOf(teams, owner)} 단어`

/** 최근에 있었던 일 — 새 것이 위 */
export function SpyEvents({ events, cards, teams }: EventsProps) {
  const lines = [...events].reverse().slice(0, 6)
  if (lines.length === 0) return null
  return (
    <ul className="party-spy-events">
      {lines.map((event, index) => (
        <li key={`${events.length - index}-${event.kind}`} className={index === 0 ? 'party-spy-event-latest' : undefined}>
          {event.kind === 'hint' && (
            <>
              {teamEmoji(event.teamId)} {teamNameOf(teams, event.teamId)} 힌트: <strong>{event.word} {event.count}</strong>
            </>
          )}
          {event.kind === 'reveal' && (
            <>
              {teamEmoji(event.teamId)} “{cards[event.index]?.word}” → {ownerLabel(teams, event.owner, event.teamId)}
            </>
          )}
          {event.kind === 'pass' && (
            <>
              {teamEmoji(event.teamId)} {teamNameOf(teams, event.teamId)} 턴 넘김
              {event.reason === 'timeout' ? ' (시간 초과)' : event.reason === 'absent' ? ' (자리 비움)' : ''}
            </>
          )}
          {event.kind === 'eliminated' && (
            <>
              ☠️ {teamEmoji(event.teamId)} {teamNameOf(teams, event.teamId)} 탈락!
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

interface ClockProps {
  /** 이 단계가 시작된 시각(performance.now 기준) */
  phaseStartedAt: number
  phaseMs: number
  totalStartedAt: number
  totalMs: number
}

const formatClock = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** 이번 단계의 남은 시간과 전체 남은 시간 */
export function SpyClock({ phaseStartedAt, phaseMs, totalStartedAt, totalMs }: ClockProps) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(timer)
  }, [])
  const phaseLeft = phaseMs - (now - phaseStartedAt)
  return (
    <p className="party-spy-clock">
      <span className={phaseLeft <= 10_000 ? 'party-spy-clock-urgent' : undefined}>⏳ {Math.max(0, Math.ceil(phaseLeft / 1000))}초</span>
      <span className="party-spy-clock-total">전체 {formatClock(totalMs - (now - totalStartedAt))}</span>
    </p>
  )
}

interface EndProps {
  end: SpyWordsEndSignal
  teams: TeamInfo[]
}

const END_TITLES: Record<SpyWordsEndSignal['reason'], string> = {
  completed: '단어를 모두 찾았어요!',
  lastTeam: '함정에 걸려서 한 팀만 남았어요!',
  time: '시간이 다 됐어요!',
}

/** 끝난 뒤의 결과 상자 — 이긴 팀과 팀 순위 */
export function SpyEnd({ end, teams }: EndProps) {
  const winners = end.teams.filter((team) => team.rank === 1).map((team) => teamNameOf(teams, team.teamId))
  return (
    <div className="party-spy-end">
      <p className="party-spy-end-title">{END_TITLES[end.reason]}</p>
      <p className="party-spy-end-winner">{winners.length === teams.length ? '🤝 모두 비겼어요!' : `🏆 ${winners.join(', ')} 승리!`}</p>
      <ol className="party-spy-end-list">
        {[...end.teams]
          .sort((a, b) => a.rank - b.rank || a.teamId - b.teamId)
          .map((team) => (
            <li key={team.teamId} className={teamColorClass(team.teamId)}>
              <span>
                {team.rank}위 {teamEmoji(team.teamId)} {teamNameOf(teams, team.teamId)}
              </span>
              <strong>{team.eliminated ? '☠️ 함정을 열어 탈락' : team.remaining === 0 ? '단어를 모두 찾음' : `남은 단어 ${team.remaining}개`}</strong>
            </li>
          ))}
      </ol>
    </div>
  )
}
