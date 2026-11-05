import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { MarbleBoard } from './MarbleBoard'
import { MarbleDpad, MarbleEnd, MarblePlayers, type DpadKey } from './MarbleMazeView'
import { buildWorld } from './physics'
import { formatMarbleTime, type MarbleEndSignal, type MarblePositionsSignal, type MarbleProgressSignal, type MarbleStateSignal } from './protocol'
import { useTilt } from './useTilt'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: MarbleStateSignal | null
  progress: MarbleProgressSignal | null
  end: MarbleEndSignal | null
  /** 모두의 구슬 위치 — 먼저 끝난 뒤 다른 사람의 화면을 구경할 때 쓴다 */
  positions: MarblePositionsSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

/** 'sensor' 폰을 기울여서, 'touch' 방향 버튼이나 방향키로 */
type ControlMode = 'sensor' | 'touch'

// 폰을 평평하게 두고 기준 자세를 재는 시간 — 이 시간 동안 센서 값의 평균이 기준이 된다 (styles.css의 .party-mb-measure 애니메이션 시간과 같아야 한다)
const CALIBRATION_MS = 3_000

export function MarbleMazeGame({ socket, roundKey, state, progress, end, positions, playerId, players }: Props) {
  const tilt = useTilt()
  const [mode, setMode] = useState<ControlMode | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)
  const [falls, setFalls] = useState(0)
  const [finished, setFinished] = useState(false)
  const [calibration, setCalibration] = useState<'measuring' | 'steady' | 'shaky' | null>(null)
  /** 구경 중인 사람 — 먼저 탈출한 뒤 이름을 눌러 고른다 */
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const calibrationTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(calibrationTimer.current), [])

  // 새 판이면 처음부터
  useEffect(() => {
    setMode(null)
    setSensorError(null)
    setFalls(0)
    setFinished(false)
    setCalibration(null)
    setWatchingId(null)
    window.clearTimeout(calibrationTimer.current)
  }, [roundKey])

  const world = useMemo(() => (state ? buildWorld(state.maze) : null), [state?.maze]) // eslint-disable-line react-hooks/exhaustive-deps

  // 달리기 시작 시각 — 서버가 알려 준 경과 시간(카운트다운 중에는 음수)으로 맞춘다
  const startSignal = useMemo(() => (state?.phase === 'run' ? { elapsedMs: state.elapsedMs } : null), [state])
  const startedAt = useMonotonicStartedAt(roundKey, startSignal, end ? 'finished' : 'running')
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  const elapsed = startedAt === null ? null : now - startedAt
  const countingDown = elapsed !== null && elapsed < 0
  // 새로고침해서 돌아오면 로컬 상태는 사라지지만, 서버가 알려 주는 내 탈출 기록은 남아 있다
  const myFinishedMs = progress?.players.find((row) => row.playerId === playerId)?.finishedMs ?? null
  const done = finished || myFinishedMs !== null
  const running = state?.phase === 'run' && elapsed !== null && elapsed >= 0 && !done && !end
  // 탈출을 마친 사람만 다른 사람의 화면을 볼 수 있다 (아직 가는 사람이 남의 길을 보면 안 되니까). 라운드가 끝난 뒤에는 누구나 볼 수 있다. 내 이름을 누르면 내 화면으로 돌아온다
  const canWatch = done || !!end
  const watchedPosition = canWatch && watchingId && watchingId !== playerId ? (positions?.players.find((row) => row.playerId === watchingId) ?? { x: world?.start.x ?? 1.5, y: world?.start.y ?? 1.5 }) : null
  const watchedName = watchingId ? (players.find((p) => p.id === watchingId)?.nickname ?? '???') : ''
  const toggleWatch = (id: string) => setWatchingId((current) => (id === playerId || current === id ? null : id))

  // 준비 단계가 끝나기까지 남은 시간 (상태를 받을 때마다 서버가 알려 준 값으로 다시 맞춘다)
  const prepEndsInMs = state?.prepEndsInMs ?? 0
  const prepDeadline = useMemo(() => performance.now() + prepEndsInMs, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const prepSeconds = Math.max(0, Math.ceil((prepDeadline - now) / 1000))

  const ready = !!playerId && !!state?.readyIds.includes(playerId)

  // 준비 시간이 끝날 때까지 조종 방법을 고르지 않았으면 방향키(버튼)로 한다
  const phase = state?.phase
  useEffect(() => {
    if (phase === 'run') setMode((current) => current ?? 'touch')
  }, [phase])

  // 손가락으로 쓰는 기기(모바일)에서는 달리기가 시작될 때 시간·진행률·미로·조종 버튼이 한 화면에 보이도록 위치를 맞춘다.
  // 움직임을 줄이는 설정을 켠 사람에게는 애니메이션 없이 바로 옮긴다
  const playRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase !== 'run' || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [phase, roundKey])

  // ---- 조종: 센서 / 터치로 끌기 / 방향키 ----
  const keys = useRef({ left: false, right: false, up: false, down: false })
  useEffect(() => {
    const names: Record<string, keyof typeof keys.current> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' }
    const handle = (down: boolean) => (event: KeyboardEvent) => {
      const name = names[event.key.length === 1 ? event.key.toLowerCase() : event.key]
      if (!name) return
      event.preventDefault()
      keys.current[name] = down
    }
    const onKeyDown = handle(true)
    const onKeyUp = handle(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
  const getTilt = useCallback(() => {
    if (mode === 'sensor') return tilt.read()
    const k = keys.current
    return { x: (k.right ? 1 : 0) - (k.left ? 1 : 0), y: (k.down ? 1 : 0) - (k.up ? 1 : 0) }
  }, [mode, tilt])
  /** 상하좌우 버튼 — 누르는 동안 방향키를 누른 것과 같다 */
  const pressKey = (key: DpadKey, down: boolean) => {
    keys.current[key] = down
  }
  // ---- 기준 자세: 센서를 켠 직후 폰을 평평하게 두고 3초 동안 센서 값을 모아서 평균을 기준으로 삼는다 ----
  const measureBaseline = () => {
    window.clearTimeout(calibrationTimer.current)
    tilt.startCalibration()
    setCalibration('measuring')
    calibrationTimer.current = window.setTimeout(() => {
      const { steady } = tilt.finishCalibration()
      if (steady) {
        setCalibration('steady')
        socket.emit('marbleMaze:ready')
      } else {
        setCalibration('shaky')
      }
    }, CALIBRATION_MS)
  }

  // ---- 시작 전 준비: 센서 허용 (iOS는 버튼을 눌러야 한다) ----
  const chooseSensor = async () => {
    if (enabling) return
    setEnabling(true)
    setSensorError(null)
    const result = await tilt.enable()
    setEnabling(false)
    if (result === 'ok') {
      setMode('sensor')
      // 이미 달리는 중에 다시 들어왔다면 지금 자세를 기준으로 삼고, 아니면 폰을 평평하게 두고 기준 자세를 잰 뒤 준비 완료다
      if (state?.phase === 'run') {
        tilt.recalibrate()
        setCalibration('steady')
      } else {
        measureBaseline()
      }
    } else {
      setSensorError(result === 'denied' ? '센서 사용이 허용되지 않았어요. 브라우저 설정에서 허용하거나, 아래 ‘터치로 하기’를 눌러 주세요.' : '이 기기에서는 기울기 센서를 쓸 수 없어요. 아래 ‘터치로 하기’를 눌러 주세요(컴퓨터는 방향키도 돼요).')
    }
  }
  const chooseTouch = () => {
    setMode('touch')
    if (state?.phase !== 'run') socket.emit('marbleMaze:ready')
  }

  if (!state || !world) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const board = (
    <div className="party-mb-board">
      <MarbleBoard
        world={world}
        running={running}
        done={done}
        getTilt={getTilt}
        onFall={setFalls}
        onFinish={(count) => {
          setFinished(true)
          socket.emit('marbleMaze:finish', { falls: count })
        }}
        onProgress={(p, count) => socket.emit('marbleMaze:progress', { progress: p, falls: count })}
        onPosition={(x, y) => socket.emit('marbleMaze:pos', { x, y })}
        watch={watchedPosition}
      />
      {countingDown && (
        <div className="party-mb-overlay party-mb-overlay-count" role="timer">
          <strong key={Math.ceil(-elapsed! / 1000)}>{Math.ceil(-elapsed! / 1000)}</strong>
          <span>{mode === 'sensor' ? '📱 폰을 들고 준비하세요! 곧 출발해요' : '곧 출발해요!'}</span>
        </div>
      )}
      {calibration === 'measuring' && (
        <div className="party-mb-overlay" role="status">
          <strong>📱</strong>
          <span>폰을 평평하게 두고 가만히 있어요! 이 자세가 기준이 돼요</span>
          <span className="party-mb-measure" aria-hidden="true">
            <i />
          </span>
        </div>
      )}
    </div>
  )

  // ---- 준비 단계 ----
  if (state.phase === 'prep' && !end) {
    return (
      <div className="party-round-stage party-mb-stage">
        <p className="party-mb-title">🔮 구슬 탈출 준비</p>
        {board}
        {!ready && calibration !== 'measuring' && calibration !== 'shaky' ? (
          <div className="party-mb-prep">
            <p className="party-mb-note">폰을 세로로 들고, 아래 버튼을 눌러 조종 방법을 골라 주세요. ‘기울기로 하기’를 누르면 3초 동안 폰을 평평하게 두어 기준 자세를 재요. 모두 준비되면 3·2·1 뒤에 출발해요. {prepSeconds}초 안에 고르지 않으면 방향 버튼으로 시작해요.</p>
            <button type="button" className="btn btn-primary" disabled={enabling} onClick={chooseSensor}>
              {enabling ? '센서를 켜는 중…' : '📱 기울기로 하기'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={chooseTouch}>
              ⬆️ 방향 버튼으로 하기 (센서 없이)
            </button>
            {sensorError && <p className="party-mb-error">{sensorError}</p>}
          </div>
        ) : null}
        {calibration === 'shaky' && !ready && (
          <div className="party-mb-prep">
            <p className="party-mb-error">기준을 잴 때 폰이 흔들렸어요. 폰을 평평하게 두고 다시 재 주세요.</p>
            <button type="button" className="btn btn-primary" onClick={measureBaseline}>
              📐 기준 다시 재기
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setCalibration('steady')
                socket.emit('marbleMaze:ready')
              }}
            >
              그대로 시작 준비
            </button>
          </div>
        )}
        {ready && (
          <p className="party-mb-note">
            ✅ 준비 완료! 다른 사람을 기다려요 ({state.readyIds.length}/{players.length}명 준비) · {prepSeconds}초 안에 시작해요 (안 고른 사람은 방향 버튼으로 해요)
          </p>
        )}
      </div>
    )
  }

  // ---- 달리는 중 ----
  return (
    <div ref={playRef} className="party-round-stage party-mb-stage">
      {startedAt !== null && !countingDown && !end && !done && <RemainingTime startedAt={startedAt} timeoutMs={state.durationMs} />}

      <MarblePlayers players={players} progress={progress?.players ?? []} myId={playerId} onWatch={canWatch ? toggleWatch : undefined} watchingId={watchingId} />
      {canWatch && !watchedPosition && <p className="party-mb-note">👀 다른 사람의 이름을 누르면 그 사람의 화면을 구경할 수 있어요</p>}
      {canWatch && watchedPosition && (
        <p className="party-mb-watching">
          👀 {watchedName}님의 화면을 보는 중
          <button type="button" className="btn btn-secondary" onClick={() => setWatchingId(null)}>
            내 화면으로
          </button>
        </p>
      )}

      {board}

      {!end && done && (
        <p className="party-mb-banner party-mb-banner-win">
          🏁 탈출했어요!{myFinishedMs !== null ? ` ${formatMarbleTime(myFinishedMs)}` : ''} 다른 사람이 끝나길 기다려요
        </p>
      )}
      {!end && !done && (
        <p className="party-mb-note">
          구멍에 빠진 횟수 {falls}번
        </p>
      )}

      {!end && !done && mode === 'sensor' && (
        <div className="party-mb-actions">
          {calibration === 'shaky' && <p className="party-mb-error">기준을 잴 때 폰이 흔들렸어요. 폰을 평평하게 들고 다시 잡아 주세요.</p>}
          <button type="button" className={`btn ${calibration === 'shaky' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { tilt.recalibrate(); setCalibration('steady') }}>
            📐 지금 자세로 기준 다시 잡기
          </button>
        </div>
      )}
      {!end && !done && mode === 'touch' && (
        <div className="party-mb-actions">
          <MarbleDpad onKey={pressKey} />
          <p className="party-mb-note">버튼을 누르고 있으면 그쪽으로 굴러가요. (컴퓨터는 방향키)</p>
          <button type="button" className="btn btn-secondary" disabled={enabling} onClick={chooseSensor}>
            {enabling ? '센서를 켜는 중…' : '📱 기울기로 바꾸기'}
          </button>
          {sensorError && <p className="party-mb-error">{sensorError}</p>}
        </div>
      )}

      {end && <MarbleEnd end={end} players={players} myId={playerId} />}
    </div>
  )
}
