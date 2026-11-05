import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { watchRowClass, watchRowProps } from '../marbleMaze/MarbleMazeView'
import { formatMarbleTime } from '../marbleMaze/protocol'
import type { TreasureEndSignal, TreasureProgressSignal } from './protocol'

// 어둠 속 보물찾기 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다. 모양(css)은 구슬 탈출(party-mb-*)을 그대로 쓴다

interface PlayersProps {
  players: PlayerInfo[]
  progress: TreasureProgressSignal['players']
  total: number
  myId: string | null
  /** 먼저 끝낸 사람이 이름을 눌러 그 사람의 화면을 구경할 수 있다 — 주어지면 이름 줄이 눌러진다 */
  onWatch?: (playerId: string) => void
  /** 지금 구경 중인 사람 */
  watchingId?: string | null
}

/** 모두의 진행 — 보물을 몇 개 찾았는지 막대로 보여 준다. 다 찾은 사람(빠른 순)이 위, 그다음 많이 찾은 순 */
export function TreasurePlayers({ players, progress, total, myId, onWatch, watchingId }: PlayersProps) {
  const rows = progress
    .map((row) => ({ ...row, nickname: players.find((p) => p.id === row.playerId)?.nickname ?? '???' }))
    .sort((a, b) => {
      if (a.finishedMs !== null || b.finishedMs !== null) return (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity)
      return b.found - a.found
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
            <span className="party-mb-bar-fill" style={{ width: `${total > 0 ? Math.round((row.found / total) * 100) : 0}%` }} />
          </span>
          <span className="party-mb-player-sub">{row.finishedMs !== null ? `💎 ${formatMarbleTime(row.finishedMs)}` : `💎 ${row.found}/${total}`}</span>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: TreasureEndSignal
  players: PlayerInfo[]
  myId: string | null
}

/** 끝난 뒤의 결과 상자 — 이긴 사람, 순위(보물을 다 찾은 시간 / 다 못 찾았으면 찾은 개수) */
export function TreasureEnd({ end, players, myId }: EndProps) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const sorted = [...end.players].sort((a, b) => a.rank - b.rank)
  const winners = sorted.filter((row) => row.rank === 1 && row.finishedMs !== null)
  return (
    <div className="party-mb-end">
      <p className="party-mb-end-title">
        {winners.length === 0 ? '😵 보물을 다 찾은 사람이 없어요!' : winners.length === end.players.length && end.players.length > 1 ? '🤝 모두 같은 시간이에요!' : `🏆 ${winners.map((row) => nicknameOf(row.playerId)).join(', ')} 보물 사냥 1등!`}
      </p>
      <ol className="party-mb-end-list">
        {sorted.map((row) => (
          <li key={row.playerId} className={row.playerId === myId ? 'party-mb-player-mine' : undefined}>
            <span>
              {row.rank}위 {row.playerId === myId ? '나' : nicknameOf(row.playerId)}
            </span>
            <span className="party-mb-end-detail">
              <strong>{row.finishedMs !== null ? formatMarbleTime(row.finishedMs) : `보물 ${row.found}/${end.total}개`}</strong>
              {row.finishedMs !== null ? ` · 보물 ${end.total}개` : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
