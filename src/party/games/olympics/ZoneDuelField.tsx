import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import type { OlympicsZoneDuel } from './protocol'

// 축구 승부차기·탁구 화면 — 공격하는 쪽(키커·치는 쪽)과 막는 쪽(골키퍼·받는 쪽)이 서로 모르게 칸을 고르고, 둘 다 고르면 함께 공개한다

/** 종목마다 다른 말과 그림 */
const TEXT = {
  soccer: {
    attacker: '키커',
    defender: '골키퍼',
    attackIcon: '⚽',
    defendIcon: '🧤',
    attackHint: '골대에서 공을 보낼 칸을 고르세요! 골키퍼가 같은 칸을 막으면 선방이에요.',
    defendHint: '키커가 찰 것 같은 칸을 고르세요! 같은 칸이면 선방이에요.',
    attackButton: '차기!',
    defendButton: '막기!',
    rules: '키커가 고른 칸을 골키퍼가 맞히면 선방, 못 맞히면 골! 팀당 5번씩 차고, 비기면 한 번씩 더 차요(서든데스).',
  },
  pingpong: {
    attacker: '치는 쪽',
    defender: '받는 쪽',
    attackIcon: '🟠',
    defendIcon: '',
    attackHint: '공을 보낼 줄을 고르세요! 상대가 같은 줄을 받으면 받아넘겨요.',
    defendHint: '공이 올 것 같은 줄을 고르세요! 같은 줄이면 받아넘겨서 이제 내가 쳐요.',
    attackButton: '치기!',
    defendButton: '받기!',
    rules: '친 줄을 받는 쪽이 맞히면 받아넘기고(공격권이 넘어가요), 못 맞히면 친 쪽이 1점! 서브는 점수가 날 때마다 바뀌어요. 먼저 5점을 따는 팀이 이겨요.',
  },
} as const

const ZONE_NAMES = {
  soccer: ['왼쪽 위', '가운데 위', '오른쪽 위', '왼쪽 아래', '가운데 아래', '오른쪽 아래'],
  pingpong: ['왼쪽 줄', '가운데 줄', '오른쪽 줄'],
} as const

// 축구·탁구 공개 연출의 시간표(ms) — styles.css의 애니메이션 지연과 같아야 한다. 공이 날아가 닿고(0~600) → 결과가 보인다
const LAND_MS = 650

interface GridProps {
  kind: OlympicsZoneDuel['kind']
  /** 지금 고른 칸 */
  selected?: number | null
  /** 공개된 공격·수비 칸 */
  attackZone?: number | null
  defendZone?: number | null
  attackIcon: string
  defendIcon: string
  onSelect?: (zone: number) => void
  /** 고르는 중인 쪽 색 */
  tone?: 'atk' | 'def'
  /** 칸 안의 공·장갑 그림을 그리지 않는다 (연출이 따로 그린다) */
  hideIcons?: boolean
}

/** 칸 — 축구는 골대 3x2, 탁구는 탁구대 3줄 */
function ZoneGrid({ kind, selected = null, attackZone = null, defendZone = null, attackIcon, defendIcon, onSelect, tone = 'atk', hideIcons = false }: GridProps) {
  const count = kind === 'soccer' ? 6 : 3
  return (
    <div className={`party-oly-zd-grid party-oly-zd-grid-${kind}`}>
      {Array.from({ length: count }, (_, zone) => {
        const classes = ['party-oly-zd-cell']
        if (selected === zone) classes.push(`party-oly-zd-sel-${tone}`)
        if (attackZone === zone) classes.push('party-oly-zd-atk')
        if (defendZone === zone) classes.push('party-oly-zd-def')
        return (
          <button key={zone} type="button" className={classes.join(' ')} disabled={!onSelect} onClick={() => onSelect?.(zone)} aria-label={ZONE_NAMES[kind][zone]}>
            {!hideIcons && attackZone === zone && <span className="party-oly-zd-icon">{attackIcon}</span>}
            {!hideIcons && defendZone === zone && <span className="party-oly-zd-icon">{defendIcon}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** 칸 번호(0~5)의 가운데 위치 (골대 안의 %) */
const zoneCenter = (kind: OlympicsZoneDuel['kind'], zone: number) =>
  kind === 'soccer' ? { x: `${((zone % 3) + 0.5) * (100 / 3)}%`, y: `${(Math.floor(zone / 3) + 0.5) * 50}%` } : { x: `${(zone + 0.5) * (100 / 3)}%`, y: '50%' }

/**
 * 축구·탁구 공개 연출 — 야구와 비슷하지만 반대다. 공이 날아와 공격하는 쪽이 고른 칸에 닿고,
 * 막았으면(선방·받아넘김) 공이 날아가 버리고, 못 막았으면(골·득점) 공이 그 칸에 1초쯤 남았다가 사라진다.
 */
function ZoneReplay({ kind, reveal, stepKey }: { kind: OlympicsZoneDuel['kind']; reveal: NonNullable<OlympicsZoneDuel['reveal']>; stepKey: string }) {
  const ball = zoneCenter(kind, reveal.attackZone)
  const style = { '--x': ball.x, '--y': ball.y } as CSSProperties
  return (
    <div className="party-oly-zd-stage" key={stepKey}>
      <ZoneGrid kind={kind} attackZone={reveal.attackZone} defendZone={reveal.defendZone} attackIcon="" defendIcon="" hideIcons />
      <div className="party-oly-bb-fx" style={style} aria-hidden="true">
        <span className={`party-oly-bb-fly ${reveal.result === 'saved' || reveal.result === 'return' ? 'party-oly-bb-fly-hit' : 'party-oly-bb-fly-strike'}`}>{kind === 'soccer' ? '⚽' : '🟠'}</span>
      </div>
    </div>
  )
}

interface Props {
  duel: OlympicsZoneDuel
  roundId: string
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  teams: TeamInfo[]
  myTeamId: number | undefined
  iAmRep: boolean
  nameOf: (teamId: number) => string
  nicknameOf: (teamId: number) => string
}

export function ZoneDuelField({ duel, roundId, socket, teams, myTeamId, iAmRep, nameOf, nicknameOf }: Props) {
  const { kind, phase, attackerTeamId, defenderTeamId, reveal } = duel
  const text = TEXT[kind]
  const iAmAttacker = iAmRep && myTeamId === attackerTeamId
  const iAmDefender = iAmRep && myTeamId === defenderTeamId
  const stepKey = `${roundId}-${duel.step}-${phase}`
  const startedAt = useMonotonicStartedAt(stepKey, { elapsedMs: duel.elapsedMs }, phase === 'reveal' ? 'finished' : 'running')

  // 공이 닿기 전에 점수·킥 결과가 먼저 바뀌어 보이지 않도록, 공이 닿을 때까지는 고르는 단계에서 본 값을 보여 준다
  const lastPick = useRef<OlympicsZoneDuel | null>(null)
  if (phase === 'pick') lastPick.current = duel
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    if (phase !== 'reveal') return
    const timer = setTimeout(() => setSettled(true), LAND_MS)
    return () => clearTimeout(timer)
  }, [stepKey, phase])
  const board = phase === 'reveal' && !settled && lastPick.current ? lastPick.current : duel

  return (
    <div className="party-oly-bb" style={{ '--atk-rgb': teamRgb(attackerTeamId), '--def-rgb': teamRgb(defenderTeamId) } as CSSProperties}>
      <p className="party-oly-zd-rules">{text.rules}</p>
      <p className="party-oly-caption">
        {kind === 'soccer' ? '승부차기 골' : '탁구 점수'} <small>({kind === 'soccer' ? '골이 많은 팀이 1등' : `먼저 ${duel.target}점을 따면 승리`})</small>
      </p>
      <ul className="party-oly-bb-board">
        {teams.map((team) => (
          <li key={team.id} className={`party-oly-bb-score ${teamColorClass(team.id)}${team.id === attackerTeamId ? ' party-oly-bb-score-batting' : ''}`}>
            <span>
              {teamEmoji(team.id)} {team.name}
            </span>
            <strong>{board.score[team.id] ?? 0}</strong>
            {kind === 'soccer' && (
              <span className="party-oly-zd-kicks" aria-label="킥 결과">
                {Array.from({ length: Math.max(board.target, (board.kicks[team.id] ?? []).length) }, (_, index) => {
                  const result = (board.kicks[team.id] ?? [])[index]
                  return <i key={index}>{result === undefined ? '·' : result ? '⚽' : '✖'}</i>
                })}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="party-oly-bb-info">
        {kind === 'soccer' ? (
          <>
            {duel.suddenDeath ? '서든데스! ' : ''}
            {duel.step + 1}번째 킥 · {text.attacker} <strong>{nameOf(attackerTeamId)}</strong> {nicknameOf(attackerTeamId)} · {text.defender} <strong>{nameOf(defenderTeamId)}</strong> {nicknameOf(defenderTeamId)}
          </>
        ) : (
          <>
            {duel.rally > 0 ? `랠리 ${duel.rally}번째 · ` : '서브 · '}
            {text.attacker} <strong>{nameOf(attackerTeamId)}</strong> {nicknameOf(attackerTeamId)} · {text.defender} <strong>{nameOf(defenderTeamId)}</strong> {nicknameOf(defenderTeamId)}
          </>
        )}
      </p>

      {phase === 'pick' &&
        (iAmAttacker || iAmDefender ? (
          <PickControls
            key={stepKey}
            kind={kind}
            socket={socket}
            role={iAmAttacker ? 'atk' : 'def'}
            startedAt={startedAt}
            maxMs={duel.maxMs}
            hint={iAmAttacker ? text.attackHint : text.defendHint}
            button={iAmAttacker ? text.attackButton : text.defendButton}
            attackIcon={text.attackIcon}
            defendIcon={text.defendIcon}
          />
        ) : (
          <div className="party-oly-bb-wait">
            <ZoneGrid kind={kind} attackIcon={text.attackIcon} defendIcon={text.defendIcon} />
            <p className="party-oly-stage-hint">
              {text.attacker} {duel.attackerReady ? '✔' : '…'} · {text.defender} {duel.defenderReady ? '✔' : '…'} 서로 모르게 고르는 중이에요
              {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={duel.maxMs} />}
            </p>
          </div>
        ))}

      {phase === 'reveal' && reveal && (
        <div className="party-oly-bb-reveal">
          <ZoneReplay kind={kind} reveal={reveal} stepKey={stepKey} />
          <p className={`party-oly-bb-outcome party-oly-bb-outcome-${reveal.result === 'goal' || reveal.result === 'point' ? 'hit' : 'strike'}`}>
            {reveal.result === 'goal' && '골! ⚽'}
            {reveal.result === 'saved' && '선방! 🧤'}
            {reveal.result === 'point' && (reveal.scorerTeamId !== null ? `${nameOf(reveal.scorerTeamId)} 득점! +1점` : '득점!')}
            {reveal.result === 'return' && `받아넘겼어요! 랠리 ${reveal.rally + 1}`}
          </p>
          <p className="party-oly-bb-legend">
            {text.attacker} {ZONE_NAMES[kind][reveal.attackZone]} · {text.defender} {ZONE_NAMES[kind][reveal.defendZone]}
            {reveal.result === 'saved' && ' — 같은 칸을 막았어요.'}
            {reveal.result === 'goal' && ' — 다른 칸이라 골이에요.'}
            {reveal.result === 'return' && ' — 같은 줄을 받아서 이제 받은 쪽이 쳐요.'}
            {reveal.result === 'point' && ' — 다른 줄이라 못 받았어요.'}
          </p>
        </div>
      )}
    </div>
  )
}

function PickControls({
  kind,
  socket,
  role,
  startedAt,
  maxMs,
  hint,
  button,
  attackIcon,
  defendIcon,
}: {
  kind: OlympicsZoneDuel['kind']
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  role: 'atk' | 'def'
  startedAt: number | null
  maxMs: number
  hint: string
  button: string
  attackIcon: string
  defendIcon: string
}) {
  const [zone, setZone] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
  // 고를 때마다 서버에 알려 둔다 — 버튼을 누르기 전에 시간이 다 되어도 고른 대로 진행된다
  const choose = (next: number) => {
    setZone(next)
    socket.emit('olympics:draft', { cell: next })
  }
  return (
    <div className="party-oly-bb-controls">
      <p className="party-oly-stage-hint">
        {hint}
        {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={maxMs} />}
      </p>
      <ZoneGrid
        kind={kind}
        selected={zone}
        tone={role}
        attackZone={role === 'atk' ? zone : null}
        defendZone={role === 'def' ? zone : null}
        attackIcon={attackIcon}
        defendIcon={defendIcon}
        onSelect={sent ? undefined : choose}
      />
      <button
        type="button"
        className="btn btn-primary party-oly-bb-confirm"
        disabled={zone === null || sent}
        onClick={() => {
          if (zone === null) return
          setSent(true)
          socket.emit('olympics:pick', { cell: zone })
        }}
      >
        {sent ? '골랐어요! 상대를 기다려요' : button}
      </button>
    </div>
  )
}
