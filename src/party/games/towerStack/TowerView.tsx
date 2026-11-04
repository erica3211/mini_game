import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import type { PlayerInfo, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { TowerSnapshot } from './TowerSnapshot'
import { TOWER_COLORS, TOWER_DROP_DANGER_S, TOWER_DROP_WARN_S, TOWER_ROLE_LABEL, TOWER_SHAPES, type TowerAssignment, type TowerEndSignal, type TowerMode } from './protocol'

// 타워쌓기 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

const teamNameOf = (teams: TeamInfo[], teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

/** 남은 기회 — 남은 만큼 채운 하트, 쓴 만큼 빈 하트 */
export function TowerChances({ left, total }: { left: number; total: number }) {
  return (
    <span className="party-tw-chances" aria-label={`남은 기회 ${left}번`}>
      {Array.from({ length: total }, (_, i) => (i < left ? '❤️' : '🖤')).join('')}
    </span>
  )
}

/** 블록이 저절로 떨어질 때까지 남은 시간 — 5초부터 주황색, 3초부터 빨간색으로 흔들린다 (deadline은 performance.now() 기준) */
export function TowerDropTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    setNow(performance.now())
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [deadline])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  const level = seconds <= TOWER_DROP_DANGER_S ? 'danger' : seconds <= TOWER_DROP_WARN_S ? 'warn' : 'calm'
  return (
    <span className={`party-tw-drop-timer party-tw-drop-${level}`} aria-label={`${seconds}초 뒤에 저절로 떨어져요`}>
      ⏱ {seconds}초
    </span>
  )
}

/** 끝나기 전 카운트다운 — 큰 숫자 3·2·1이 탑 위에 뜬다 (deadline은 performance.now() 기준) */
export function TowerEndingCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    setNow(performance.now())
    const timer = window.setInterval(() => setNow(performance.now()), 80)
    return () => window.clearInterval(timer)
  }, [deadline])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return (
    <div className="party-tw-ending" role="timer" aria-label={`${seconds}초 뒤에 끝나요`}>
      {/* key가 바뀔 때마다 숫자가 새로 나타나는 효과가 다시 재생된다 */}
      <strong key={seconds}>{seconds}</strong>
    </div>
  )
}

/** 다음 블록 미리보기 */
export function TowerNext({ next }: { next: number[] }) {
  return (
    <div className="party-tw-next" aria-label="다음 블록">
      <span>다음</span>
      {next.map((kind, index) => (
        <div key={index} className="party-tw-next-box">
          {TOWER_SHAPES[kind].map(([x, y], i) => (
            <i key={i} className="party-tw-next-cell" style={{ left: `${x * 25}%`, top: `${y * 50}%`, background: TOWER_COLORS[kind] }} />
          ))}
        </div>
      ))}
    </div>
  )
}

type PadAction = 'left' | 'right' | 'rotate' | 'drop'

const PAD_LABEL: Record<PadAction, { icon: string; name: string }> = {
  left: { icon: '◀', name: '왼쪽' },
  right: { icon: '▶', name: '오른쪽' },
  rotate: { icon: '⟳', name: '돌리기' },
  drop: { icon: '⬇', name: '떨어뜨리기' },
}

interface PadProps {
  action: PadAction
  enabled: boolean
  onPress: (action: PadAction) => void
  /** 손을 뗐다 — 이동은 이때 멈춘다 */
  onRelease: (action: PadAction) => void
}

/** 조작 버튼 — 내 담당이 아니면 흐리게 막아 둔다. 이동은 누르고 있는 동안 이어진다 */
export function TowerPadButton({ action, enabled, onPress, onRelease }: PadProps) {
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (enabled) onPress(action)
  }
  const release = () => onRelease(action)
  return (
    <button
      type="button"
      className={`party-tw-pad party-tw-pad-${action}${enabled ? '' : ' party-tw-pad-off'}`}
      disabled={!enabled}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={PAD_LABEL[action].name}
    >
      <span className="party-tw-pad-icon">{PAD_LABEL[action].icon}</span>
      <span className="party-tw-pad-name">{PAD_LABEL[action].name}</span>
    </button>
  )
}

interface RolesProps {
  roles: TowerAssignment[]
  playerId: string | null
  nicknameOf: (playerId: string) => string
}

/** 팀원들의 담당 — 내 줄이 맨 위 */
export function TowerRoles({ roles, playerId, nicknameOf }: RolesProps) {
  const sorted = [...roles].sort((a, b) => Number(b.playerId === playerId) - Number(a.playerId === playerId))
  return (
    <ul className="party-tw-roles">
      {sorted.map((assignment) => (
        <li key={assignment.playerId} className={assignment.playerId === playerId ? 'party-tw-role-mine' : undefined}>
          <span className="party-tw-role-name">{assignment.playerId === playerId ? '나' : nicknameOf(assignment.playerId)}</span>
          <span className="party-tw-role-chip">{TOWER_ROLE_LABEL[assignment.role]}</span>
        </li>
      ))}
    </ul>
  )
}

/** 점수 표시 — 높이로 겨루면 cm, 블록 수로 겨루면 개 */
const scoreText = (mode: TowerMode, score: number) => (mode === 'count' ? `${score}개` : `${score}cm`)

interface ScoresProps {
  mode: TowerMode
  teams: TeamInfo[]
  scores: Record<number, number>
  chances: Record<number, number>
  total: number
  myTeamId?: number
}

/** 팀별 최고 높이와 남은 기회 */
export function TowerScores({ mode, teams, scores, chances, total, myTeamId }: ScoresProps) {
  return (
    <ul className="party-tw-scores">
      {teams.map((team) => (
        <li key={team.id} className={`${teamColorClass(team.id)}${team.id === myTeamId ? ' party-tw-score-mine' : ''}`} style={{ '--tw-team': `rgb(${teamRgb(team.id)})` } as CSSProperties}>
          <span>
            {teamEmoji(team.id)} {team.name}
          </span>
          <strong>{scoreText(mode, scores[team.id] ?? 0)}</strong>
          <TowerChances left={chances[team.id] ?? total} total={total} />
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: TowerEndSignal
  teams: TeamInfo[]
  playerId: string | null
  players: PlayerInfo[]
}

/** 끝난 뒤의 결과 상자 — 이긴 팀, 팀 순위마다 끝난 시점의 탑 모습과 높이, 내가 누른 횟수 */
export function TowerEnd({ end, teams, playerId }: EndProps) {
  const winnerNames = end.teams.filter((team) => team.rank === 1).map((team) => teamNameOf(teams, team.teamId))
  const mine = end.players.find((player) => player.playerId === playerId)
  return (
    <div className="party-tw-end">
      <p className="party-tw-end-title">{winnerNames.length === teams.length ? '🤝 모두 비겼어요!' : `🏆 ${winnerNames.join(', ')} 승리!`}</p>
      <p className="party-tw-note">{end.mode === 'count' ? '끝난 순간 탑에 남아 있는 블록 수로 순위를 정해요. (12개를 모두 쌓은 팀끼리는 함께 1등)' : '끝난 순간의 탑 높이로 순위를 정해요.'}</p>
      <ol className="party-tw-end-list">
        {[...end.teams]
          .sort((a, b) => a.rank - b.rank || a.teamId - b.teamId)
          .map((team) => (
            <li key={team.teamId} className={teamColorClass(team.teamId)}>
              <span className="party-tw-end-head">
                {team.rank}위 {teamEmoji(team.teamId)} {teamNameOf(teams, team.teamId)}
              </span>
              <TowerSnapshot bodies={team.bodies} height={team.height} showHeight={end.mode === 'height'} />
              <span className="party-tw-end-detail">
                <strong>{scoreText(end.mode, team.score)}</strong> · 떨어진 블록 {team.falls}
              </span>
            </li>
          ))}
      </ol>
      {mine && <p className="party-tw-note">내가 누른 횟수: {mine.inputs}번</p>}
    </div>
  )
}
