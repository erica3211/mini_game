import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import type { OlympicsZoneDuel } from './protocol'
import { mirrorCell } from './sports'
import soccerKicker from './assets/soccer-kicker.png'
import soccerKickerNoBall from './assets/soccer-kicker-noball.png'
import soccerKeeper from './assets/soccer-keeper.png'
import pingpongRed from './assets/pingpong-red.png'
import pingpongBlue from './assets/pingpong-blue.png'
import pingpongTable from './assets/scene-pingpong-table.svg'

// 축구 승부차기·탁구 화면 — 공격하는 쪽(키커·치는 쪽)과 막는 쪽(골키퍼·받는 쪽)이 서로 모르게 칸을 고르고, 둘 다 고르면 함께 공개한다

/** 종목마다 다른 말과 그림 */
const TEXT = {
  soccer: {
    attacker: '키커',
    defender: '골키퍼',
    attackIcon: '⚽',
    defendIcon: '🧤',
    attackHint: '골대에서 공을 보낼 칸을 고르세요! 골키퍼가 같은 칸을 막으면 선방이에요.',
    defendHint: '키커가 찰 것 같은 칸을 고르세요! 마주 보고 있어서 키커의 왼쪽은 내 오른쪽이에요. 같은 곳이면 선방!',
    attackButton: '차기!',
    defendButton: '막기!',
    rules: '키커가 고른 곳을 골키퍼가 맞히면 선방, 못 맞히면 골! 둘이 마주 보고 있어서 키커의 왼쪽은 골키퍼의 오른쪽이에요. 팀당 5번씩 차고, 비기면 한 번씩 더 차요(서든데스).',
  },
  pingpong: {
    attacker: '치는 쪽',
    defender: '받는 쪽',
    attackIcon: '🟠',
    defendIcon: '',
    attackHint: '공을 보낼 줄을 고르세요! 상대가 같은 줄을 받으면 받아넘겨요.',
    defendHint: '공이 올 것 같은 줄을 고르세요! 마주 보고 있어서 상대의 왼쪽 줄은 내 오른쪽이에요. 같은 줄이면 받아넘겨요.',
    attackButton: '치기!',
    defendButton: '받기!',
    rules: '친 줄을 받는 쪽이 맞히면 받아넘기고(공격권이 넘어가요), 못 맞히면 친 쪽이 1점! 둘이 마주 보고 있어서 상대의 왼쪽 줄은 내 오른쪽이에요. 서브는 점수가 날 때마다 바뀌어요. 먼저 5점을 따는 팀이 이겨요.',
  },
} as const

const ZONE_NAMES = {
  soccer: ['왼쪽 위', '가운데 위', '오른쪽 위', '왼쪽 아래', '가운데 아래', '오른쪽 아래'],
  pingpong: ['왼쪽 줄', '가운데 줄', '오른쪽 줄'],
} as const

// 축구·탁구 공개 연출의 시간표(ms) — styles.css의 애니메이션 지연과 같아야 한다. 공이 날아가 닿고(0~600) → 결과가 보인다
const LAND_MS = 650

/** 누구 화면인가(칸을 고르는 쪽 기준) — kicker: 치는·차는 쪽, keeper: 받는·막는 쪽. 키커는 골대 앞에서 골대를 막은 골키퍼를, 골키퍼는 골대 안에서 차기 직전의 키커를 본다. 구경하는 사람과 공개 연출은 골대 앞 장면에 둘 다 나온다 */
type SceneView = 'kicker' | 'keeper' | 'watch'

/** 키커 화면의 앞 잔디에 놓인 공 */
function SoccerBall() {
  return (
    <svg className="party-oly-sc-ball" viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="37" rx="13" ry="3" fill="#000" fillOpacity="0.22" />
      <circle cx="20" cy="19" r="16" fill="#fff" stroke="#1f2937" strokeWidth="2" />
      <polygon points="20,10 27,15 24.5,23.5 15.5,23.5 13,15" fill="#1f2937" />
      <path d="M20 10 V3.5 M27 15 L33 12.5 M24.5 23.5 L29 29.5 M15.5 23.5 L11 29.5 M13 15 L7 12.5" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 축구 장면 — 키커 화면은 골대 정면(밤 경기장) 그림 위에 골대를 지키는 골키퍼가 서 있고, 골키퍼 화면은 골대 안에서 내다본 경기장 그림 앞에 키커가 서 있다.
 * 칸(children)은 골대 입구 위에 반투명으로 겹친다. 탁구·야구는 칸 자체에 연한 배경이 깔려 있어서 그대로 보여 준다.
 */
function ZoneScene({
  kind,
  view,
  kicked = false,
  defendCol,
  children,
}: {
  kind: OlympicsZoneDuel['kind']
  view: SceneView
  /** 공을 이미 찼다 — 키커 그림에서 공을 뺀다 */
  kicked?: boolean
  /** 결과 공개: 막는 쪽(골키퍼·받는 쪽)이 실제로 막으러 간 열(0 왼쪽·1 가운데·2 오른쪽) — 그쪽으로 움직인다 */
  defendCol?: number
  children: ReactNode
}) {
  if (kind === 'pingpong') {
    // 탁구: 치는 쪽 화면은 건너편의 파란 유니폼 선수, 받는 쪽 화면은 빨간 유니폼 선수가 탁구대 너머에 서 있다. 선수는 탁구대 뒤 레이어이고, 칸은 탁구대 위에 겹친다
    return (
      <div className={`party-oly-pp party-oly-pp-${view}${defendCol !== undefined ? ` party-oly-pp-def-${defendCol}` : ''}`} style={defendCol !== undefined ? ({ '--dcol': defendCol } as CSSProperties) : undefined}>
        {view !== 'keeper' && <img className="party-oly-pp-player party-oly-pp-blue" src={pingpongBlue} alt="" draggable={false} />}
        {view !== 'kicker' && <img className="party-oly-pp-player party-oly-pp-red" src={pingpongRed} alt="" draggable={false} />}
        <img className="party-oly-pp-table" src={pingpongTable} alt="" draggable={false} />
        <div className="party-oly-pp-grid">{children}</div>
      </div>
    )
  }
  if (kind !== 'soccer') return <>{children}</>
  const scene = view === 'keeper' ? 'save' : 'kick'
  return (
    <div className={`party-oly-sc party-oly-sc-${scene}${defendCol !== undefined ? ` party-oly-sc-def-${defendCol}` : ''}`}>
      {view !== 'keeper' && <img className="party-oly-sc-keeper" src={soccerKeeper} alt="" draggable={false} />}
      {view !== 'kicker' && (
        <>
          <img className={`party-oly-sc-kicker${kicked ? ' party-oly-sc-swap-off' : ''}`} src={soccerKicker} alt="" draggable={false} />
          <img className={`party-oly-sc-kicker${kicked ? '' : ' party-oly-sc-swap-off'}`} src={soccerKickerNoBall} alt="" draggable={false} />
        </>
      )}
      {view === 'kicker' && <SoccerBall />}
      <div className="party-oly-sc-grid">{children}</div>
    </div>
  )
}

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

/** 칸 번호의 가운데 위치 — 칸 영역 안의 비율(0~1) */
const zoneFraction = (kind: OlympicsZoneDuel['kind'], zone: number) =>
  kind === 'soccer' ? { x: ((zone % 3) + 0.5) / 3, y: (Math.floor(zone / 3) + 0.5) / 2 } : { x: (zone + 0.5) / 3, y: 0.5 }

/**
 * 축구·탁구 공개 연출 — 공이 장면 속 선수에게서 출발해 고른 칸에 닿고(0.65초), 그 뒤 움직임은 결과에 따라 다르다.
 * 축구: 키커 발에서 골대로 날아가 — 골이면 그물에 박혀 흔들리다가 사라지고, 선방이면 골키퍼 손에 맞고 튕겨 나온다.
 * 탁구: 치는 쪽(파란 선수) 라켓에서 나와 탁구대의 고른 줄에 튕기고 — 받아넘기면 받는 쪽(빨간 선수) 라켓에 맞고 다시 돌아가고, 못 받으면 선수를 지나쳐 날아간다.
 * 공이 출발하는 곳과 받는 쪽 라켓의 위치는 장면 그림에 맞춰 styles.css에 정해 두었다.
 */
/** 탁구 공개: 공의 포물선 높이(장면 높이의 %)와, 못 막았을 때 찍힌 뒤 튕겨 나가는 방향(장면 너비·높이의 %) — 고른 줄(왼쪽·가운데·오른쪽)마다 다르다 */
const PINGPONG_ARC_HEIGHT = [40, 44, 34] as const
const PINGPONG_EXIT = [
  { x: -6.5, y: -26 },
  { x: -5, y: -37 },
  { x: -2, y: -31 },
] as const

function ZoneReplay({ kind, reveal, stepKey }: { kind: OlympicsZoneDuel['kind']; reveal: NonNullable<OlympicsZoneDuel['reveal']>; stepKey: string }) {
  const ball = zoneFraction(kind, reveal.attackZone)
  // 튕겨 나가는 쪽: 고른 칸이 왼쪽 줄이면 왼쪽, 오른쪽 줄이면 오른쪽, 가운데면 곧게 위로
  const col = kind === 'soccer' ? reveal.attackZone % 3 : reveal.attackZone
  // 막는 쪽이 간 열 — 서버가 저장한 값(공격하는 쪽 기준 위치)이라 장면에 보이는 그대로다. 위·아래 칸은 상관없이 왼쪽·가운데·오른쪽으로만 움직인다
  const defendCol = kind === 'soccer' ? reveal.defendZone % 3 : reveal.defendZone
  const style = {
    '--fx': ball.x,
    '--fy': ball.y,
    '--dx': `${(col - 1) * 3.5}rem`,
    ...(kind === 'pingpong' ? { '--ah': PINGPONG_ARC_HEIGHT[col], '--ox': PINGPONG_EXIT[col].x, '--oy': PINGPONG_EXIT[col].y } : {}),
  } as CSSProperties
  const stopped = reveal.result === 'saved' || reveal.result === 'return'
  const motion = kind === 'soccer' ? (stopped ? 'party-oly-sc-ball-saved' : 'party-oly-sc-ball-goal') : stopped ? 'party-oly-pp-ball-return' : 'party-oly-pp-ball-point'
  return (
    <ZoneScene kind={kind} view="watch" kicked defendCol={defendCol}>
      <div className="party-oly-zd-stage" key={stepKey}>
        <ZoneGrid kind={kind} attackZone={reveal.attackZone} defendZone={reveal.defendZone} attackIcon="" defendIcon="" hideIcons />
        <div className="party-oly-bb-fx" style={style} aria-hidden="true">
          <span className={`party-oly-bb-fly ${motion}`}>
            <span className={`party-oly-bb-arc${kind === 'pingpong' ? ' party-oly-pp-ballshape' : ''}`}>{kind === 'soccer' ? '⚽' : ''}</span>
          </span>
        </div>
      </div>
    </ZoneScene>
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
            <ZoneScene kind={kind} view="watch">
              <ZoneGrid kind={kind} attackIcon={text.attackIcon} defendIcon={text.defendIcon} />
            </ZoneScene>
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
            {text.attacker} {ZONE_NAMES[kind][reveal.attackZone]} · {text.defender} {ZONE_NAMES[kind][mirrorCell(reveal.defendZone)]}
            {reveal.result === 'saved' && ' — 마주 보고 같은 곳을 막았어요.'}
            {reveal.result === 'goal' && ' — 다른 곳이라 골이에요.'}
            {reveal.result === 'return' && ' — 마주 보고 같은 줄을 받아서 이제 받은 쪽이 쳐요.'}
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
      <ZoneScene kind={kind} view={role === 'atk' ? 'kicker' : 'keeper'}>
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
      </ZoneScene>
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
