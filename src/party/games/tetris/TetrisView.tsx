import { memo, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import type { PlayerInfo, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { pieceCells, previewCells } from './pieces'
import { TETRIS_ACTION_LABEL, TETRIS_COLS, TETRIS_ROLE_LABEL, TETRIS_ROWS, type TetrisAction, type TetrisActive, type TetrisAssignment, type TetrisEndSignal } from './protocol'

// 테트리스 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

const teamNameOf = (teams: TeamInfo[], teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

interface BoardProps {
  /** 굳은 칸 — 줄마다 '0'~'7' */
  rows: string[]
  /** 내려오는 블록 (이미 rows에 합쳐 있으면 생략) */
  active?: TetrisActive | null
  /** 착지 그림자 */
  ghost?: TetrisActive | null
  /** 가득 차서 깜박이는 줄들 */
  clearing?: number[]
  /** 작은 판(구경용) */
  mini?: boolean
}

/** 판 — 칸 하나가 i 하나다. 내려오는 블록과 그림자는 굳은 칸 위에 덧씌워 그린다 */
export const TetrisBoard = memo(function TetrisBoard({ rows, active = null, ghost = null, clearing = [], mini = false }: BoardProps) {
  const cells: string[] = []
  for (let y = 0; y < TETRIS_ROWS; y++) for (let x = 0; x < TETRIS_COLS; x++) cells.push(rows[y]?.[x] ?? '0')
  const overlay = new Map<number, string>()
  if (ghost) for (const [x, y] of pieceCells(ghost.piece, ghost.rot, ghost.x, ghost.y)) if (y >= 0 && y < TETRIS_ROWS) overlay.set(y * TETRIS_COLS + x, 'g')
  if (active) for (const [x, y] of pieceCells(active.piece, active.rot, active.x, active.y)) if (y >= 0 && y < TETRIS_ROWS) overlay.set(y * TETRIS_COLS + x, String(active.piece))
  return (
    <div className={`party-tt-grid${mini ? ' party-tt-grid-mini' : ''}`} aria-hidden="true">
      {cells.map((cell, index) => {
        const over = overlay.get(index)
        const kind = over === 'g' ? (cell === '0' ? 'g' : cell) : (over ?? cell)
        const blink = clearing.includes(Math.floor(index / TETRIS_COLS)) ? ' party-tt-clearing' : ''
        return <i key={index} className={(kind === '0' ? 'party-tt-cell' : kind === 'g' ? 'party-tt-cell party-tt-ghost' : `party-tt-cell party-tt-fill party-tt-c${kind}`) + blink} />
      })}
    </div>
  )
})

/** 다음 블록 미리보기 */
export function TetrisNext({ next }: { next: number[] }) {
  return (
    <div className="party-tt-next" aria-label="다음 블록">
      {next.map((piece, index) => (
        <div key={index} className="party-tt-next-box">
          {previewCells(piece).map(([x, y], i) => (
            <i key={i} className={`party-tt-next-cell party-tt-c${piece}`} style={{ left: `${x * 25}%`, top: `${y * 25}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface PadProps {
  action: TetrisAction
  enabled: boolean
  onPress: (action: TetrisAction) => void
  /** 손을 뗐다 — 빠르게 내리기는 이때 멈춘다 */
  onRelease: (action: TetrisAction) => void
}

// 왼쪽·오른쪽은 꾹 누르고 있으면 반복해서 보낸다 (회전은 한 번씩만, 빠르게 내리기는 누르고 있는 동안 이어진다)
const REPEAT_DELAY_MS = 260
const REPEAT_MS = 110

/** 조작 버튼 — 내 담당이 아니면 흐리게 막아 둔다 */
export function TetrisPadButton({ action, enabled, onPress, onRelease }: PadProps) {
  const timers = useRef<{ delay?: number; repeat?: number }>({})
  const stop = () => {
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.repeat)
  }
  const release = () => {
    stop()
    onRelease(action)
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (!enabled) stop()
  }, [enabled])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!enabled) return
    onPress(action)
    if (action === 'rotate' || action === 'down') return
    stop()
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => onPress(action), REPEAT_MS)
    }, REPEAT_DELAY_MS)
  }

  return (
    <button
      type="button"
      className={`party-tt-pad party-tt-pad-${action}${enabled ? '' : ' party-tt-pad-off'}`}
      disabled={!enabled}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={{ left: '왼쪽', right: '오른쪽', rotate: '회전', down: '빠르게 내리기', stop: '' }[action]}
    >
      {TETRIS_ACTION_LABEL[action]}
    </button>
  )
}

interface RolesProps {
  roles: TetrisAssignment[]
  playerId: string | null
  nicknameOf: (playerId: string) => string
}

/** 팀원들의 담당 — 내 줄이 맨 위 */
export function TetrisRoles({ roles, playerId, nicknameOf }: RolesProps) {
  const sorted = [...roles].sort((a, b) => Number(b.playerId === playerId) - Number(a.playerId === playerId))
  return (
    <ul className="party-tt-roles">
      {sorted.map((assignment) => (
        <li key={assignment.playerId} className={assignment.playerId === playerId ? 'party-tt-role-mine' : undefined}>
          <span className="party-tt-role-name">{assignment.playerId === playerId ? '나' : nicknameOf(assignment.playerId)}</span>
          <span className="party-tt-role-chip">{TETRIS_ROLE_LABEL[assignment.role]}</span>
        </li>
      ))}
    </ul>
  )
}

interface ScoresProps {
  teams: TeamInfo[]
  scores: Record<number, number>
  myTeamId?: number
}

/** 팀별 점수 현황 */
export function TetrisScores({ teams, scores, myTeamId }: ScoresProps) {
  return (
    <ul className="party-tt-scores">
      {teams.map((team) => (
        <li key={team.id} className={`${teamColorClass(team.id)}${team.id === myTeamId ? ' party-tt-score-mine' : ''}`} style={{ '--tt-team': `rgb(${teamRgb(team.id)})` } as CSSProperties}>
          <span>
            {teamEmoji(team.id)} {team.name}
          </span>
          <strong>{scores[team.id] ?? 0}점</strong>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: TetrisEndSignal
  teams: TeamInfo[]
  playerId: string | null
  players: PlayerInfo[]
}

/** 끝난 뒤의 결과 상자 — 이긴 팀, 팀 순위(지운 줄·판 비움), 내가 누른 횟수 */
export function TetrisEnd({ end, teams, playerId }: EndProps) {
  const winnerNames = end.teams.filter((team) => team.rank === 1).map((team) => teamNameOf(teams, team.teamId))
  const mine = end.players.find((player) => player.playerId === playerId)
  return (
    <div className="party-tt-end">
      <p className="party-tt-end-title">{winnerNames.length === teams.length ? '🤝 모두 비겼어요!' : `🏆 ${winnerNames.join(', ')} 승리!`}</p>
      <ol className="party-tt-end-list">
        {[...end.teams]
          .sort((a, b) => a.rank - b.rank || a.teamId - b.teamId)
          .map((team) => (
            <li key={team.teamId} className={teamColorClass(team.teamId)}>
              <span>
                {team.rank}위 {teamEmoji(team.teamId)} {teamNameOf(teams, team.teamId)}
              </span>
              <span className="party-tt-end-detail">
                <strong>{team.score}점</strong> · 지운 줄 {team.lines}
                {team.topouts > 0 ? ` · 판 비움 ${team.topouts}번` : ''}
              </span>
            </li>
          ))}
      </ol>
      {mine && <p className="party-tt-note">내가 누른 횟수: {mine.inputs}번</p>}
    </div>
  )
}
