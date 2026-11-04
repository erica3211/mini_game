import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamRgb } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import type { BaseballOutcome, BaseballPitchType, BaseballSwingType, OlympicsBaseball } from './protocol'
import { mirrorCell, mirrorSwing, pitchZone, swingCells } from './sports'
import pitcherImg from './assets/baseball-pitcher.png'
import catcherBatterImg from './assets/baseball-catcher-batter.png'

// 야구 화면 — 투수는 구종(모양)과 칸을, 타자는 스윙 모양과 칸을 서로 모르게 고르고, 둘 다 고르면 함께 공개해 결과를 가린다.
// 고르는 동안 고른 칸을 기준으로 모양이 어떻게 칠해지는지 바로 그려 준다 (고른 칸은 더 진하게)

const PITCHES: { id: BaseballPitchType; label: string; glyph: string }[] = [
  { id: 'fastball', label: '직구', glyph: 'ㅡ' },
  { id: 'curve', label: '커브', glyph: 'ㅣ' },
  { id: 'slider', label: '슬라이더', glyph: '╱' },
  { id: 'changeup', label: '체인지업', glyph: '╲' },
]
const SWINGS: { id: BaseballSwingType; label: string; glyph: string }[] = [
  { id: 'row', label: '가로', glyph: 'ㅡ' },
  { id: 'column', label: '세로', glyph: 'ㅣ' },
  { id: 'down', label: '대각선', glyph: '╲' },
  { id: 'up', label: '대각선', glyph: '╱' },
]
const pitchOf = (type: BaseballPitchType | null) => PITCHES.find((pitch) => pitch.id === type)
const swingOf = (type: BaseballSwingType | null) => SWINGS.find((swing) => swing.id === type)
const WRAP_HINT = '대각선은 판 끝에서 반대쪽으로 이어져서 어느 칸을 골라도 3칸이에요'

// 결과 연출의 시간표(ms) — styles.css의 애니메이션 지연과 같아야 한다. 공이 날아와 닿고(0~650) → 결과가 보이고 공이 날아가거나 남는다
const LAND_MS = 650

const OUTCOME_TEXT: Record<BaseballOutcome, string> = {
  strike: '헛스윙! 스트라이크',
  foul: '파울!',
  hit: '안타! 🎉',
  homerun: '홈런!! 🎆',
}
/** 왜 그런 결과가 나왔는지 */
const OUTCOME_REASON: Record<BaseballOutcome, string> = {
  strike: '모양은 같았지만 다른 줄이었어요',
  foul: '모양이 달라서 한 칸만 겹쳤어요',
  hit: '같은 모양, 같은 줄이에요',
  homerun: '투수가 고른 칸과 같은 칸이에요',
}

/** 모양을 3x3 칸 위에 작게 그린 그림 (버튼 안에 넣는다) */
function ShapeIcon({ cells }: { cells: number[] }) {
  return (
    <span className="party-oly-bb-icon" aria-hidden="true">
      {Array.from({ length: 9 }, (_, cell) => (
        <i key={cell} className={cells.includes(cell) ? 'party-oly-bb-icon-on' : undefined} />
      ))}
    </span>
  )
}

interface GridProps {
  /** 공개된 칠해진 칸 */
  zone?: number[]
  /** 공개된 투수가 고른 칸 */
  target?: number | null
  /** 공개된 타자가 칠한 칸과 기준 칸 */
  swing?: number[]
  swingAnchor?: number | null
  /** 고르는 동안 미리 보는 모양 */
  preview?: number[]
  tone?: 'pitch' | 'swing'
  /** 지금 고른 기준 칸 (더 진하게) */
  selected?: number | null
  onSelect?: (cell: number) => void
  revealKey?: string
}

/** 공개 연출: 공이 날아와 투수가 고른 칸에 닿으면 칠해진 모양이 나타나고, 안타는 공이 날아가고 홈런은 더 크고 높게 날아가며, 헛스윙·파울은 공이 그 칸에 1초쯤 남았다가 사라진다 */
function ReplayStage({ reveal, stepKey }: { reveal: NonNullable<OlympicsBaseball['reveal']>; stepKey: string }) {
  // 서버는 값을 투수 기준으로 저장하고, 이 화면은 홈에서 마운드를 보는 타자 시점이라 모두 좌우를 뒤집어 그린다
  // (타자가 고른 칸·모양은 고른 그대로, 투수가 고른 칸은 타자 눈에 보이는 자리로)
  const target = mirrorCell(reveal.target)
  const col = target % 3
  const row = Math.floor(target / 3)
  // 타구가 뻗는 쪽: 고른 칸이 왼쪽 줄이면 왼쪽, 오른쪽 줄이면 오른쪽, 가운데면 곧게 앞으로 (파울은 가운데여도 한쪽으로 빠진다)
  const style = {
    '--fx': (col + 0.5) / 3,
    '--fy': (row + 0.5) / 3,
    '--dx': `${(col - 1) * 4}rem`,
    '--dxf': col === 2 ? '7rem' : '-7rem',
  } as CSSProperties
  return (
    <BaseballScene view="watch">
      <div className="party-oly-bb-stage" key={stepKey}>
        <ZoneGrid zone={reveal.zone.map(mirrorCell)} target={target} swing={reveal.swing.map(mirrorCell)} swingAnchor={mirrorCell(reveal.swingCell)} />
        <div className="party-oly-bb-fx" style={style} aria-hidden="true">
          <span className={`party-oly-bb-fly party-oly-bb-fly-${reveal.outcome}`}>
            <span className="party-oly-bb-arc">⚾</span>
          </span>
        </div>
      </div>
    </BaseballScene>
  )
}

/** 점수표 — 결과가 어떻게 정해지는지 항상 작게 보여준다 */
function Rules() {
  return (
    <ul className="party-oly-bb-rules" aria-label="야구 규칙 요약">
      <li className="party-oly-bb-rule-hit">
        <strong>안타 +2점</strong>
        <span>투수와 같은 모양, 같은 줄</span>
      </li>
      <li>
        <strong>파울</strong>
        <span>모양이 달라 한 칸만 겹침 (스트라이크 1개, 2스트라이크 뒤에는 안 늘어요)</span>
      </li>
      <li>
        <strong>헛스윙</strong>
        <span>같은 모양인데 다른 줄 (스트라이크 1개)</span>
      </li>
      <li className="party-oly-bb-rule-homerun">
        <strong>홈런 +3점</strong>
        <span>투수가 고른 칸과 같은 칸</span>
      </li>
    </ul>
  )
}

/** 누구 화면인가 — 투수는 마운드에서 포수와 타자를, 타자는 홈에서 마운드의 투수를 본다. 구경하는 사람과 공개 연출은 타자 쪽 장면에 둘 다 나온다 */
type SceneView = 'pitcher' | 'batter' | 'watch'

/**
 * 야구 장면 — 투수 화면은 홈 플레이트 쪽(백스톱·타석) 그림 위에 포수와 타자가 서 있고 스트라이크존 칸이 그 위에 겹친다.
 * 타자 화면은 홈에서 본 야구장(조명탑·전광판·잔디·마운드) 위에 마운드의 투수가 서 있고, 칸이 화면 전체를 덮는다.
 */
function BaseballScene({ view, children }: { view: SceneView; children: ReactNode }) {
  const scene = view === 'pitcher' ? 'pitch' : 'bat'
  return (
    <div className={`party-oly-bb-sc party-oly-bb-sc-${scene}`}>
      {view !== 'pitcher' && <img className="party-oly-bb-sc-pitcher" src={pitcherImg} alt="" draggable={false} />}
      {view !== 'batter' && <img className="party-oly-bb-sc-pair" src={catcherBatterImg} alt="" draggable={false} />}
      <div className="party-oly-bb-sc-grid">{children}</div>
    </div>
  )
}

/** 3x3 칸 */
function ZoneGrid({ zone = [], target = null, swing = [], swingAnchor = null, preview = [], tone = 'pitch', selected = null, onSelect, revealKey }: GridProps) {
  return (
    <div className="party-oly-bb-grid" key={revealKey}>
      {Array.from({ length: 9 }, (_, cell) => {
        const classes = ['party-oly-bb-cell']
        if (preview.includes(cell)) classes.push(`party-oly-bb-pv-${tone}`)
        if (selected === cell) classes.push(`party-oly-bb-sel-${tone}`)
        if (zone.includes(cell)) classes.push('party-oly-bb-zone')
        if (target === cell) classes.push('party-oly-bb-target')
        if (swing.includes(cell)) classes.push('party-oly-bb-swing')
        if (swingAnchor === cell) classes.push('party-oly-bb-swing-anchor')
        return (
          <button key={cell} type="button" className={classes.join(' ')} disabled={!onSelect} onClick={() => onSelect?.(cell)} aria-label={`${Math.floor(cell / 3) + 1}행 ${(cell % 3) + 1}열`}>
          </button>
        )
      })}
    </div>
  )
}

interface Props {
  baseball: OlympicsBaseball
  roundId: string
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  teams: TeamInfo[]
  myTeamId: number | undefined
  iAmRep: boolean
  nameOf: (teamId: number) => string
  nicknameOf: (teamId: number) => string
}

export function BaseballField({ baseball, roundId, socket, teams, myTeamId, iAmRep, nameOf, nicknameOf }: Props) {
  const { phase, batterTeamId, pitcherTeamId, reveal } = baseball
  const iAmPitcher = iAmRep && myTeamId === pitcherTeamId
  const iAmBatter = iAmRep && myTeamId === batterTeamId
  const stepKey = `${roundId}-${baseball.pitchNo}-${phase}`
  const startedAt = useMonotonicStartedAt(stepKey, { elapsedMs: baseball.elapsedMs }, phase === 'reveal' ? 'finished' : 'running')

  // 공이 닿기 전에 점수·스트라이크가 먼저 바뀌어 보이지 않도록, 공이 닿을 때까지는 고르는 단계에서 본 값을 보여 준다
  const lastPick = useRef<OlympicsBaseball | null>(null)
  if (phase === 'pick') lastPick.current = baseball
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    if (phase !== 'reveal') return
    const timer = setTimeout(() => setSettled(true), LAND_MS)
    return () => clearTimeout(timer)
  }, [stepKey, phase])
  const board = phase === 'reveal' && !settled && lastPick.current ? lastPick.current : baseball

  return (
    <div className="party-oly-bb" style={{ '--pitch-rgb': teamRgb(pitcherTeamId), '--swing-rgb': teamRgb(batterTeamId) } as CSSProperties}>
      <Rules />
      <p className="party-oly-caption">야구 경기 점수 <small>(이 종목 안에서 낸 점수 — 많은 팀이 1등)</small></p>
      <ul className="party-oly-bb-board">
        {teams.map((team) => {
          const finished = board.out.includes(team.id)
          return (
            <li key={team.id} className={`party-oly-bb-score ${teamColorClass(team.id)}${team.id === batterTeamId && !finished ? ' party-oly-bb-score-batting' : ''}`}>
              <span>
                {teamEmoji(team.id)} {team.name}
              </span>
              <strong>{board.score[team.id] ?? 0}점</strong>
              <small>
                안타 {board.hits[team.id] ?? 0}
                {(board.homeruns[team.id] ?? 0) > 0 && ` · 홈런 ${board.homeruns[team.id]}`}
              </small>
              <span className="party-oly-bb-strikes" aria-label={`스트라이크 ${board.strikes[team.id] ?? 0}`}>
                {'●'.repeat(board.strikes[team.id] ?? 0)}
                {'○'.repeat(Math.max(0, 3 - (board.strikes[team.id] ?? 0)))}
              </span>
              {finished && <small className="party-oly-bb-finished">공격 끝</small>}
            </li>
          )
        })}
      </ul>

      <p className="party-oly-bb-info">
        {baseball.pitchNo + 1}번째 공 · 타자 <strong>{nameOf(batterTeamId)}</strong> {nicknameOf(batterTeamId)} · 투수 <strong>{nameOf(pitcherTeamId)}</strong> {nicknameOf(pitcherTeamId)}
      </p>

      {phase === 'pick' &&
        (iAmPitcher ? (
          <PitchControls key={stepKey} socket={socket} startedAt={startedAt} maxMs={baseball.maxMs} alreadySent={baseball.pitcherReady} />
        ) : iAmBatter ? (
          <SwingControls key={stepKey} socket={socket} startedAt={startedAt} maxMs={baseball.maxMs} alreadySent={baseball.batterReady} />
        ) : (
          <div className="party-oly-bb-wait">
            <BaseballScene view="watch">
              <ZoneGrid />
            </BaseballScene>
            <p className="party-oly-stage-hint">
              투수 {baseball.pitcherReady ? '✔' : '…'} · 타자 {baseball.batterReady ? '✔' : '…'} 서로 모르게 고르는 중이에요
              {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={baseball.maxMs} />}
            </p>
          </div>
        ))}

      {phase === 'reveal' && reveal && (
        <div className="party-oly-bb-reveal">
          <ReplayStage reveal={reveal} stepKey={stepKey} />
          <p className={`party-oly-bb-outcome party-oly-bb-outcome-${reveal.outcome}`} key={`${stepKey}-outcome`}>
            {reveal.outcome === 'foul' && !reveal.strikeAdded ? '파울! 2스트라이크라 그대로예요' : OUTCOME_TEXT[reveal.outcome]}
            {reveal.points > 0 && ` +${reveal.points}점`}
          </p>
          <p className="party-oly-bb-legend">
            투수 {pitchOf(reveal.pitchType)?.label} {pitchOf(reveal.pitchType)?.glyph} · 타자 {swingOf(mirrorSwing(reveal.swingType))?.label} {swingOf(mirrorSwing(reveal.swingType))?.glyph} — {OUTCOME_REASON[reveal.outcome]}.
            <br />
            투수 팀 색으로 칠해진 칸이 존, 그중 진한 칸이 투수가 고른 칸, 타자 팀 색 테두리가 타자가 휘두른 곳이에요.
            {reveal.batterOut && ' 삼진 아웃! 이 팀의 공격은 끝났어요.'}
            {reveal.limitReached && ' 10점을 채워서 이 팀의 공격은 끝났어요!'}
          </p>
        </div>
      )}
    </div>
  )
}

/** 투수: 구종(모양)과 목표 칸 — 고르면 칠해질 모양이 바로 그려진다 */
function PitchControls({ socket, startedAt, maxMs, alreadySent }: { socket: Socket<ServerToClientEvents, ClientToServerEvents>; startedAt: number | null; maxMs: number; alreadySent: boolean }) {
  const [pitch, setPitch] = useState<BaseballPitchType | null>(null)
  const [cell, setCell] = useState<number | null>(null)
  // 새로고침으로 돌아온 경우에도 팀이 이미 보냈으면 보낸 상태로 시작한다
  const [sent, setSent] = useState(alreadySent)
  // 고를 때마다 서버에 알려 둔다 — 버튼을 누르기 전에 시간이 다 되어도 고른 대로 진행된다
  const choosePitch = (next: BaseballPitchType) => {
    setPitch(next)
    socket.emit('olympics:draft', { pitch: next, cell: cell ?? undefined })
  }
  const chooseCell = (next: number) => {
    setCell(next)
    socket.emit('olympics:draft', { pitch: pitch ?? undefined, cell: next })
  }
  const selected = pitchOf(pitch)
  const preview = pitch !== null && cell !== null ? pitchZone(pitch, cell) : []
  return (
    <div className="party-oly-bb-controls">
      <p className="party-oly-stage-hint">
        던질 구종과 칸을 고르세요! 타자는 어떤 모양을 칠지 몰라요.
        {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={maxMs} />}
      </p>
      <div className="party-oly-bb-options">
        {PITCHES.map((item) => (
          <button key={item.id} type="button" className={`btn btn-secondary party-oly-bb-option${pitch === item.id ? ' party-oly-bb-option-on' : ''}`} onClick={() => choosePitch(item.id)} disabled={sent}>
            <ShapeIcon cells={pitchZone(item.id, 4)} />
            {item.label} {item.glyph}
          </button>
        ))}
      </div>
      <p className="party-oly-bb-legend">{selected ? `${selected.label}: 고른 칸을 지나는 ${selected.glyph} 줄이 칠해져요. ${selected.glyph === '╲' || selected.glyph === '╱' ? WRAP_HINT : ''}` : '구종을 고르면 칠해지는 모양을 알려줘요'}</p>
      <BaseballScene view="pitcher">
        <ZoneGrid tone="pitch" preview={preview} selected={cell} onSelect={sent ? undefined : chooseCell} />
      </BaseballScene>
      <button
        type="button"
        className="btn btn-primary party-oly-bb-confirm"
        disabled={pitch === null || cell === null || sent}
        onClick={() => {
          if (pitch === null || cell === null) return
          setSent(true)
          socket.emit('olympics:pick', { pitch, cell })
        }}
      >
        {sent ? '던졌어요! 타자를 기다려요' : '던지기!'}
      </button>
    </div>
  )
}

/** 타자: 스윙 모양과 기준 칸 — 고르면 휘두를 모양이 바로 그려진다 */
function SwingControls({ socket, startedAt, maxMs, alreadySent }: { socket: Socket<ServerToClientEvents, ClientToServerEvents>; startedAt: number | null; maxMs: number; alreadySent: boolean }) {
  const [swing, setSwing] = useState<BaseballSwingType | null>(null)
  const [cell, setCell] = useState<number | null>(null)
  // 새로고침으로 돌아온 경우에도 팀이 이미 보냈으면 보낸 상태로 시작한다
  const [sent, setSent] = useState(alreadySent)
  // 고를 때마다 서버에 알려 둔다 — 버튼을 누르기 전에 시간이 다 되어도 고른 대로 진행된다
  const chooseSwing = (next: BaseballSwingType) => {
    setSwing(next)
    socket.emit('olympics:draft', { swing: next, cell: cell ?? undefined })
  }
  const chooseCell = (next: number) => {
    setCell(next)
    socket.emit('olympics:draft', { swing: swing ?? undefined, cell: next })
  }
  const selected = swingOf(swing)
  return (
    <div className="party-oly-bb-controls">
      <p className="party-oly-stage-hint">
        투수는 어떤 모양(ㅡ ㅣ ╲ ╱)을 던질까요? 마주 보고 있어서 투수의 ╱는 내 눈에 ╲로 보여요. 같은 모양, 같은 줄로 치면 안타! 같은 칸이면 홈런!
        {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={maxMs} />}
      </p>
      <div className="party-oly-bb-options">
        {SWINGS.map((item) => (
          <button key={item.id} type="button" className={`btn btn-secondary party-oly-bb-option${swing === item.id ? ' party-oly-bb-option-on' : ''}`} onClick={() => chooseSwing(item.id)} disabled={sent}>
            <ShapeIcon cells={swingCells(item.id, 4)} />
            {item.label} {item.glyph}
          </button>
        ))}
      </div>
      <p className="party-oly-bb-legend">{selected ? `고른 칸을 지나는 ${selected.glyph} 줄을 휘둘러요. ${selected.glyph === '╲' || selected.glyph === '╱' ? WRAP_HINT : ''}` : '모양을 고르고 칸을 누르세요'}</p>
      <BaseballScene view="batter">
        <ZoneGrid tone="swing" preview={swing !== null && cell !== null ? swingCells(swing, cell) : []} selected={cell} onSelect={sent ? undefined : chooseCell} />
      </BaseballScene>
      <button
        type="button"
        className="btn btn-primary party-oly-bb-confirm"
        disabled={swing === null || cell === null || sent}
        onClick={() => {
          if (swing === null || cell === null) return
          setSent(true)
          socket.emit('olympics:pick', { swing, cell })
        }}
      >
        {sent ? '휘둘렀어요! 투수를 기다려요' : '휘두르기!'}
      </button>
    </div>
  )
}

