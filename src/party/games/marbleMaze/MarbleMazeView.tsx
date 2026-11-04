import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { formatMarbleTime, type MarbleEndSignal, type MarbleProgressSignal } from './protocol'

// 구슬 탈출 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

interface PlayersProps {
  players: PlayerInfo[]
  progress: MarbleProgressSignal['players']
  myId: string | null
}

/** 모두의 진행 — 출구까지 어디쯤 왔는지 막대로 보여 준다. 탈출한 사람(빠른 순)이 위, 그다음 멀리 간 순 */
export function MarblePlayers({ players, progress, myId }: PlayersProps) {
  const rows = progress
    .map((row) => ({ ...row, nickname: players.find((p) => p.id === row.playerId)?.nickname ?? '???' }))
    .sort((a, b) => {
      if (a.finishedMs !== null || b.finishedMs !== null) return (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity)
      return b.progress - a.progress
    })
  return (
    <ul className="party-mb-players">
      {rows.map((row) => (
        <li key={row.playerId} className={row.playerId === myId ? 'party-mb-player-mine' : undefined}>
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
