import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { JjukkumiPlayers, type PlayerRow } from './JjukkumiView'
import { jjukkumiStageTitle, type JjukkumiEndSignal, type JjukkumiPositionsSignal, type JjukkumiStateSignal, type RedLightLight } from './protocol'
import { RedLightScene, type ScenePlayer } from './RedLightScene'
import { useJjukkumiSprites } from './sprites'
import { useShake } from './useShake'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: JjukkumiStateSignal | null
  positions: JjukkumiPositionsSignal | null
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
  /** 게임이 모두 끝났을 때 보여 줄 최종 순위 상자 */
  children?: ReactNode
}

/** 'shake' 폰을 흔들어서, 'button' 버튼을 누르고 있는 동안 (센서가 없는 기기·컴퓨터) */
type ControlMode = 'shake' | 'button'

/** 영희가 하는 말 — 뒤돌아 있는 동안 한 글자씩 나온다 */
const SENTENCE = '무궁화 꽃이 피었습니다'
const SENTENCE_LETTERS = SENTENCE.replace(/ /g, '').length

/** 말하는 중이면 지금까지 말한 만큼만 잘라서 돌려준다 (띄어쓰기는 글자 수에 세지 않는다) */
function spokenText(letters: number): string {
  let shown = 0
  let text = ''
  for (const char of SENTENCE) {
    if (char !== ' ') {
      if (shown >= letters) break
      shown += 1
    }
    text += char
  }
  return text
}

const LIGHT_BADGE: Record<RedLightLight, string> = { back: '🟢 움직여!', side: '🟡 조심…', front: '🔴 멈춰!!' }

/** 스테이지 1 — 무궁화 꽃이 피었습니다. 폰을 흔들거나 버튼을 눌러 앞으로 가고, 영희가 앞을 볼 때는 멈춘다 */
export function RedLightStage({ socket, roundKey, state, positions, end, playerId, players, children }: Props) {
  const sprites = useJjukkumiSprites()
  // enable·read는 값이 바뀌지 않게 만들어져 있어서, 아래 효과가 매번 다시 시작되지 않는다 (useShake가 돌려주는 객체는 렌더마다 새로 만들어지니 통째로 쓰지 않는다)
  const { enable: enableShake, read: readShake } = useShake()
  const [mode, setMode] = useState<ControlMode | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)
  /** 구경하려고 고른 사람 */
  const [watchingId, setWatchingId] = useState<string | null>(null)
  /** 화면에 보여 주는 "지금 움직이는 정도" (0~1) */
  const [liveLevel, setLiveLevel] = useState(0)
  const held = useRef(false)

  // 새 판이면 처음부터
  useEffect(() => {
    setMode(null)
    setSensorError(null)
    setWatchingId(null)
    held.current = false
  }, [roundKey])

  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  // 이 신호를 받은 시각 — 영희가 방향을 바꾼 뒤 얼마나 지났는지를 재는 기준이다
  const stateAt = useMemo(() => performance.now(), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const startSignal = useMemo(() => (state?.phase === 'run' ? { elapsedMs: state.elapsedMs } : null), [state])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end ? 'finished' : 'running')
  const elapsed = startedAt === null ? null : now - startedAt
  const countingDown = state?.phase === 'run' && elapsed !== null && elapsed < 0

  const meInStage = !!playerId && !!state?.players.some((p) => p.playerId === playerId)
  const myStatus = state?.statuses.find((row) => row.playerId === playerId)?.status ?? null
  const running = state?.phase === 'run' && elapsed !== null && elapsed >= 0 && myStatus === 'run' && !end
  const ready = !!playerId && !!state?.readyIds.includes(playerId)

  // 준비 시간이 끝날 때까지 조종 방법을 고르지 않았으면 버튼으로 한다
  const phase = state?.phase
  useEffect(() => {
    if (phase === 'run') setMode((current) => current ?? 'button')
  }, [phase])

  // 준비 단계가 끝나기까지 남은 시간
  const prepEndsInMs = state?.prepEndsInMs ?? 0
  const prepDeadline = useMemo(() => performance.now() + prepEndsInMs, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const prepSeconds = Math.max(0, Math.ceil((prepDeadline - now) / 1000))

  // 손가락으로 쓰는 기기(모바일)에서는 달리기가 시작될 때 장면과 조종 버튼이 한 화면에 보이도록 위치를 맞춘다
  const playRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase !== 'run' || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [phase, roundKey])

  // ---- 조종: 폰 흔들기 / 버튼 꾹 누르기 / 키보드(스페이스·위 방향키) ----
  useEffect(() => {
    const isHoldKey = (event: KeyboardEvent) => event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W'
    const down = (event: KeyboardEvent) => {
      if (!isHoldKey(event)) return
      event.preventDefault()
      held.current = true
    }
    const up = (event: KeyboardEvent) => {
      if (!isHoldKey(event)) return
      held.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const readLevel = useCallback(() => (mode === 'shake' ? readShake() : held.current ? 1 : 0), [mode, readShake])

  // 달리는 동안 0.08초마다 움직이는 정도를 서버에 알린다 — 바뀌었을 때, 그리고 움직이는 동안은 신호가 끊기지 않게 주기적으로
  useEffect(() => {
    if (!running || !mode) return
    let lastSent = 0
    let lastAt = 0
    const timer = window.setInterval(() => {
      const level = readLevel()
      setLiveLevel(level)
      const at = performance.now()
      if (Math.abs(level - lastSent) > 0.03 || (level > 0 && at - lastAt > 250)) {
        socket.emit('jjukkumi:level', { level: Math.round(level * 100) / 100 })
        lastSent = level
        lastAt = at
      }
    }, 80)
    return () => {
      window.clearInterval(timer)
      socket.emit('jjukkumi:level', { level: 0 })
      setLiveLevel(0)
    }
  }, [running, mode, readLevel, socket])

  // 준비 단계에서 센서가 잘 되는지 보여 주려고 흔드는 정도를 계속 읽는다
  useEffect(() => {
    if (running || mode !== 'shake') return
    const timer = window.setInterval(() => setLiveLevel(readShake()), 100)
    return () => window.clearInterval(timer)
  }, [running, mode, readShake])

  const chooseShake = async () => {
    if (enabling) return
    setEnabling(true)
    setSensorError(null)
    const result = await enableShake()
    setEnabling(false)
    if (result === 'ok') {
      setMode('shake')
      if (state?.phase === 'prep') socket.emit('jjukkumi:ready')
    } else {
      setSensorError(result === 'denied' ? '센서 사용이 허용되지 않았어요. 브라우저 설정에서 허용하거나, 아래 ‘버튼으로 하기’를 눌러 주세요.' : '이 기기에서는 흔들기 센서를 쓸 수 없어요. 아래 ‘버튼으로 하기’를 눌러 주세요(컴퓨터는 스페이스바도 돼요).')
    }
  }
  const chooseButton = () => {
    setMode('button')
    if (state?.phase === 'prep') socket.emit('jjukkumi:ready')
  }

  if (!state || !sprites) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  // ---- 장면에 그릴 사람들 ----
  const positionOf = new Map(positions?.players.map((row) => [row.playerId, row]))
  const rows: PlayerRow[] = state.players.map((player) => {
    const status = state.statuses.find((row) => row.playerId === player.playerId)
    const position = positionOf.get(player.playerId)
    return { playerId: player.playerId, character: player.character, status: position?.status ?? status?.status ?? 'run', progress: position?.progress ?? status?.progress ?? 0, atMs: status?.atMs ?? null }
  })
  const scenePlayers: ScenePlayer[] = rows.map((row) => ({
    ...row,
    nickname: players.find((p) => p.id === row.playerId)?.nickname ?? '???',
    level: positionOf.get(row.playerId)?.level ?? 0,
  }))
  const light = state.light ? { state: state.light.state, startedAt: stateAt - state.light.phaseElapsedMs } : null
  const lightState: RedLightLight | null = state.light?.state ?? null
  const phaseElapsed = light ? now - light.startedAt : 0
  // 영희가 말하는 중이면 지금까지 말한 글자만, 말이 끝났으면 다 보여 준다
  const say = state.phase === 'prep' || countingDown || !state.light ? '' : lightState === 'back' ? spokenText(Math.ceil(Math.min(1, phaseElapsed / Math.max(1, state.light.sayMs)) * SENTENCE_LETTERS)) : SENTENCE

  // 달리는 중에는 구경할 수 없고, 통과하거나 탈락했거나(또는 앞서 탈락해서 구경만 하는 사람이면) 목록에서 이름을 눌러 그 사람을 골라 볼 수 있다
  const canWatch = !running && !countingDown && state.phase !== 'prep'
  const toggleWatch = (id: string) => setWatchingId((current) => (current === id ? null : id))
  const watchedName = watchingId ? (players.find((p) => p.id === watchingId)?.nickname ?? '???') : ''

  const board = (
    <div className="jk-scene" data-light={lightState ?? 'idle'}>
      <RedLightScene sprites={sprites} players={scenePlayers} light={light} myId={meInStage ? playerId : null} watchingId={canWatch ? watchingId : null} />
      {lightState && state.phase === 'run' && <span className="jk-badge">{LIGHT_BADGE[lightState]}</span>}
      {countingDown && (
        <div className="jk-overlay" role="timer">
          <strong key={Math.ceil(-elapsed! / 1000)}>{Math.ceil(-elapsed! / 1000)}</strong>
          <span>{mode === 'shake' ? '📱 폰을 들고 준비하세요!' : '곧 출발해요!'}</span>
        </div>
      )}
    </div>
  )

  const title = (
    <p className="jk-title">
      🐙 쭈꾸미 게임 <span className="jk-title-stage">{state.stage.index + 1}/{state.stage.count} · {jjukkumiStageTitle(state.stage.id)}</span>
    </p>
  )

  // ---- 준비 단계 ----
  if (state.phase === 'prep' && !end) {
    return (
      <div className="party-round-stage jk-stage">
        {title}
        <p className="jk-say jk-say-idle">영희가 뒤돌아 있어요…</p>
        {board}
        {meInStage ? (
          <div className="jk-prep">
            {!ready && (
              <>
                <p className="party-mb-note">폰을 흔들면 내 캐릭터(노란 테두리)가 앞으로 가요. 영희가 앞을 볼 때는 딱 멈춰야 해요! 모두 준비되면 3·2·1 뒤에 출발해요. {prepSeconds}초 안에 고르지 않으면 버튼으로 시작해요.</p>
                <button type="button" className="btn btn-primary" disabled={enabling} onClick={chooseShake}>
                  {enabling ? '센서를 켜는 중…' : '📳 폰 흔들기로 하기'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={chooseButton}>
                  🔘 버튼으로 하기 (센서 없이)
                </button>
                {sensorError && <p className="party-mb-error">{sensorError}</p>}
              </>
            )}
            {ready && (
              <>
                {mode === 'shake' && (
                  <div className="jk-meter" aria-label="흔드는 세기">
                    <span className="jk-meter-label">폰을 흔들어서 센서를 확인해 보세요</span>
                    <span className="jk-meter-bar">
                      <i style={{ width: `${Math.round(liveLevel * 100)}%` }} />
                    </span>
                  </div>
                )}
                <p className="party-mb-note">
                  ✅ 준비 완료! 다른 사람을 기다려요 ({state.readyIds.length}/{state.players.length}명 준비) · {prepSeconds}초 안에 시작해요 (안 고른 사람은 버튼으로 해요)
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="party-mb-note">👀 이번 판은 구경만 해요. 곧 시작해요!</p>
        )}
        <JjukkumiPlayers players={players} rows={rows} myId={playerId} watchingId={null} />
      </div>
    )
  }

  // ---- 달리는 중 · 끝난 뒤 ----
  const finishedMe = meInStage && myStatus !== 'run'
  return (
    <div ref={playRef} className="party-round-stage jk-stage">
      {title}
      {startedAt !== null && !countingDown && state.phase === 'run' && !end && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}
      <p className={`jk-say${lightState === 'front' ? ' jk-say-stop' : ''}`}>{lightState === 'front' ? '멈춰!!' : say || ' '}</p>
      {board}

      {!end && meInStage && myStatus === 'passed' && <p className="party-mb-banner party-mb-banner-win">🏁 통과했어요! 다른 사람들이 끝나길 기다려요</p>}
      {!end && meInStage && myStatus === 'out' && <p className="party-mb-banner party-mb-banner-lose">😵 탈락했어요! 이름을 눌러서 다른 사람을 구경해 보세요</p>}
      {!end && !meInStage && <p className="party-mb-banner">👀 앞에서 탈락해서 구경만 해요</p>}

      {!end && running && mode === 'shake' && (
        <div className="jk-controls">
          <div className="jk-meter" aria-label="흔드는 세기">
            <span className="jk-meter-label">폰을 흔들어서 앞으로! (영희가 앞을 보면 멈춰요)</span>
            <span className="jk-meter-bar">
              <i style={{ width: `${Math.round(liveLevel * 100)}%` }} />
            </span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('button')}>
            🔘 버튼으로 바꾸기
          </button>
        </div>
      )}
      {!end && running && mode === 'button' && (
        <div className="jk-controls">
          <button
            type="button"
            className="jk-hold"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              held.current = true
            }}
            onPointerUp={() => {
              held.current = false
            }}
            onPointerCancel={() => {
              held.current = false
            }}
            onLostPointerCapture={() => {
              held.current = false
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            꾹 눌러서 전진!
          </button>
          <p className="party-mb-note">누르고 있는 동안 앞으로 가고, 떼면 멈춰요. (컴퓨터는 스페이스바)</p>
          <button type="button" className="btn btn-secondary" disabled={enabling} onClick={chooseShake}>
            {enabling ? '센서를 켜는 중…' : '📳 폰 흔들기로 바꾸기'}
          </button>
          {sensorError && <p className="party-mb-error">{sensorError}</p>}
        </div>
      )}

      {canWatch && watchingId && (
        <p className="party-mb-watching">
          👀 {watchedName}님을 보는 중
          <button type="button" className="btn btn-secondary" onClick={() => setWatchingId(null)}>
            그만 보기
          </button>
        </p>
      )}
      {canWatch && !watchingId && !end && finishedMe && <p className="party-mb-note">👀 이름을 누르면 그 캐릭터에 파란 테두리가 둘러져요</p>}

      <JjukkumiPlayers players={players} rows={rows} myId={playerId} onWatch={canWatch ? toggleWatch : undefined} watchingId={canWatch ? watchingId : null} />

      {children}
    </div>
  )
}
