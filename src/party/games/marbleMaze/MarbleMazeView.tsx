import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { formatMarbleTime, type MarbleEndSignal, type MarbleProgressSignal } from './protocol'

// 구슬 탈출 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

/** 진행 목록의 한 줄에 붙는 모양(css 클래스) — 내 줄, 눌러서 구경할 수 있는 줄, 지금 구경 중인 줄 */
export function watchRowClass(playerId: string, myId: string | null, onWatch: ((playerId: string) => void) | undefined, watchingId: string | null | undefined): string | undefined {
  const classes = [playerId === myId ? 'party-mb-player-mine' : '', onWatch ? 'party-mb-player-watchable' : '', onWatch && watchingId === playerId ? 'party-mb-player-watching' : ''].filter(Boolean)
  return classes.length > 0 ? classes.join(' ') : undefined
}

/** 눌러서 구경할 수 있는 줄이면 버튼처럼 동작하게 하는 속성 (키보드로도 누를 수 있다) */
export function watchRowProps(playerId: string, onWatch: ((playerId: string) => void) | undefined) {
  if (!onWatch) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => onWatch(playerId),
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onWatch(playerId)
    },
  }
}

interface PlayersProps {
  players: PlayerInfo[]
  progress: MarbleProgressSignal['players']
  myId: string | null
  /** 먼저 끝낸 사람이 이름을 눌러 그 사람의 화면을 구경할 수 있다 — 주어지면 이름 줄이 눌러진다 */
  onWatch?: (playerId: string) => void
  /** 지금 구경 중인 사람 */
  watchingId?: string | null
}

/** 모두의 진행 — 출구까지 어디쯤 왔는지 막대로 보여 준다. 탈출한 사람(빠른 순)이 위, 그다음 멀리 간 순 */
export function MarblePlayers({ players, progress, myId, onWatch, watchingId }: PlayersProps) {
  const rows = progress
    .map((row) => ({ ...row, nickname: players.find((p) => p.id === row.playerId)?.nickname ?? '???' }))
    .sort((a, b) => {
      if (a.finishedMs !== null || b.finishedMs !== null) return (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity)
      return b.progress - a.progress
    })
  return (
    <ul className="party-mb-players">
      {rows.map((row) => (
        <li
          key={row.playerId}
          className={watchRowClass(row.playerId, myId, onWatch, watchingId)}
          {...watchRowProps(row.playerId, onWatch)}
        >
          <span className="party-mb-player-name">{row.playerId === myId ? '나' : row.nickname}</span>
          <span className="party-mb-bar" aria-hidden="true">
            <span className="party-mb-bar-fill" style={{ width: `${Math.round(row.progress * 100)}%` }} />
          </span>
          <span className="party-mb-player-sub">{row.finishedMs !== null ? `🏁 ${formatMarbleTime(row.finishedMs)}` : `${Math.round(row.progress * 100)}%`}</span>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: MarbleEndSignal
  players: PlayerInfo[]
  myId: string | null
}

/** 끝난 뒤의 결과 상자 — 이긴 사람, 순위(탈출 시간·구멍에 빠진 횟수 / 못 나왔으면 출구까지 간 정도) */
export function MarbleEnd({ end, players, myId }: EndProps) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const sorted = [...end.players].sort((a, b) => a.rank - b.rank)
  const winners = sorted.filter((row) => row.rank === 1 && row.finishedMs !== null)
  return (
    <div className="party-mb-end">
      <p className="party-mb-end-title">
        {winners.length === 0 ? '😵 아무도 탈출하지 못했어요!' : winners.length === end.players.length && end.players.length > 1 ? '🤝 모두 같은 시간이에요!' : `🏆 ${winners.map((row) => nicknameOf(row.playerId)).join(', ')} 탈출 1등!`}
      </p>
      <ol className="party-mb-end-list">
        {sorted.map((row) => (
          <li key={row.playerId} className={row.playerId === myId ? 'party-mb-player-mine' : undefined}>
            <span>
              {row.rank}위 {row.playerId === myId ? '나' : nicknameOf(row.playerId)}
            </span>
            <span className="party-mb-end-detail">
              <strong>{row.finishedMs !== null ? formatMarbleTime(row.finishedMs) : `출구까지 ${Math.round(row.progress * 100)}%`}</strong> · 구멍 {row.falls}번
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export type DpadKey = 'up' | 'down' | 'left' | 'right'

const DPAD: { key: DpadKey; label: string; name: string }[] = [
  { key: 'up', label: '▲', name: '위' },
  { key: 'left', label: '◀', name: '왼쪽' },
  { key: 'right', label: '▶', name: '오른쪽' },
  { key: 'down', label: '▼', name: '아래' },
]

/** 상하좌우 버튼 — 키보드 방향키처럼 ㅗ 모양으로 놓는다. 누르고 있는 동안 그쪽으로 기울인 것과 같다 (센서 없이 방향키로 하는 사람만 본다) */
export function MarbleDpad({ onKey }: { onKey: (key: DpadKey, down: boolean) => void }) {
  return (
    <div className="party-mb-dpad" role="group" aria-label="방향 버튼">
      {DPAD.map(({ key, label, name }) => (
        <button
          key={key}
          type="button"
          className={`party-mb-dpad-btn party-mb-dpad-${key}`}
          aria-label={name}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            onKey(key, true)
          }}
          onPointerUp={() => onKey(key, false)}
          onPointerCancel={() => onKey(key, false)}
          onLostPointerCapture={() => onKey(key, false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
