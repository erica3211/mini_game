import { useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import type { BaseballOutcome, BaseballPitchType, BaseballSwingType, OlympicsBaseball } from './protocol'
import { pitchZone, swingCells } from './sports'

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

const OUTCOME_TEXT: Record<BaseballOutcome, string> = {
  strike: '헛스윙! 스트라이크',
  foul: '파울! 스트라이크',
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
  /** 공개된 투수가 고른 칸 (⚾) */
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
        <span>투수가 고른 칸(⚾)과 같은 칸</span>
      </li>
    </ul>
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
            {target === cell ? <span className="party-oly-bb-ball">⚾</span> : null}
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

  return (
    <div className="party-oly-bb">
      <Rules />
      <p className="party-oly-caption">야구 경기 점수 <small>(이 종목 안에서 낸 점수 — 많은 팀이 1등)</small></p>
      <ul className="party-oly-bb-board">
        {teams.map((team) => {
          const finished = baseball.out.includes(team.id)
          return (
            <li key={team.id} className={`party-oly-bb-score ${teamColorClass(team.id)}${team.id === batterTeamId && !finished ? ' party-oly-bb-score-batting' : ''}`}>
              <span>
                {teamEmoji(team.id)} {team.name}
              </span>
              <strong>{baseball.score[team.id] ?? 0}점</strong>
              <small>
                안타 {baseball.hits[team.id] ?? 0}
                {(baseball.homeruns[team.id] ?? 0) > 0 && ` · 홈런 ${baseball.homeruns[team.id]}`}
              </small>
              <span className="party-oly-bb-strikes" aria-label={`스트라이크 ${baseball.strikes[team.id] ?? 0}`}>
                {'●'.repeat(baseball.strikes[team.id] ?? 0)}
                {'○'.repeat(Math.max(0, 3 - (baseball.strikes[team.id] ?? 0)))}
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
          <PitchControls key={stepKey} socket={socket} startedAt={startedAt} maxMs={baseball.maxMs} />
        ) : iAmBatter ? (
          <SwingControls key={stepKey} socket={socket} startedAt={startedAt} maxMs={baseball.maxMs} />
        ) : (
          <div className="party-oly-bb-wait">
            <ZoneGrid />
            <p className="party-oly-stage-hint">
              투수 {baseball.pitcherReady ? '✔' : '…'} · 타자 {baseball.batterReady ? '✔' : '…'} 서로 모르게 고르는 중이에요
              {startedAt !== null && <RemainingTime startedAt={startedAt} timeoutMs={baseball.maxMs} />}
            </p>
          </div>
        ))}

      {phase === 'reveal' && reveal && (
        <div className="party-oly-bb-reveal">
          <ZoneGrid zone={reveal.zone} target={reveal.target} swing={reveal.swing} swingAnchor={reveal.swingCell} revealKey={stepKey} />
          <p className={`party-oly-bb-outcome party-oly-bb-outcome-${reveal.outcome}`} key={`${stepKey}-outcome`}>
            {reveal.outcome === 'foul' && !reveal.strikeAdded ? '파울! 2스트라이크라 그대로예요' : OUTCOME_TEXT[reveal.outcome]}
            {reveal.points > 0 && ` +${reveal.points}점`}
          </p>
          <p className="party-oly-bb-legend">
            투수 {pitchOf(reveal.pitchType)?.label} {pitchOf(reveal.pitchType)?.glyph} · 타자 {swingOf(reveal.swingType)?.label} {swingOf(reveal.swingType)?.glyph} — {OUTCOME_REASON[reveal.outcome]}.
            <br />
            붉은 칸이 칠해진 곳, 진한 붉은 칸의 ⚾가 투수가 고른 칸, 파란 테두리가 타자가 휘두른 곳이에요.
            {reveal.batterOut && ' 삼진 아웃! 이 팀의 공격은 끝났어요.'}
            {reveal.limitReached && ' 10점을 채워서 이 팀의 공격은 끝났어요!'}
          </p>
        </div>
      )}
    </div>
  )
}

/** 투수: 구종(모양)과 목표 칸 — 고르면 칠해질 모양이 바로 그려진다 */
function PitchControls({ socket, startedAt, maxMs }: { socket: Socket<ServerToClientEvents, ClientToServerEvents>; startedAt: number | null; maxMs: number }) {
  const [pitch, setPitch] = useState<BaseballPitchType | null>(null)
  const [cell, setCell] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
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
      <ZoneGrid tone="pitch" preview={preview} selected={cell} onSelect={sent ? undefined : chooseCell} />
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
function SwingControls({ socket, startedAt, maxMs }: { socket: Socket<ServerToClientEvents, ClientToServerEvents>; startedAt: number | null; maxMs: number }) {
  const [swing, setSwing] = useState<BaseballSwingType | null>(null)
  const [cell, setCell] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
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
        투수는 어떤 모양(ㅡ ㅣ ╲ ╱)을 던질까요? 같은 모양, 같은 줄로 치면 안타! 투수가 고른 칸과 같은 칸이면 홈런!
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
      <ZoneGrid tone="swing" preview={swing !== null && cell !== null ? swingCells(swing, cell) : []} selected={cell} onSelect={sent ? undefined : chooseCell} />
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

