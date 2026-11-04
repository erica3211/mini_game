import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { CONNECTIONS_GROUP_COUNT, CONNECTIONS_WRONG_PENALTY_S, formatConnectionsTime, type ConnectionsEndSignal, type ConnectionsProgressSignal, type ConnectionsSolvedGroup } from './protocol'

// 커넥션스 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

interface GroupColumn {
  group: number
  title: string
  words: string[]
}

/** 묶음들을 세로 열로 나란히 보여 준다 — 위에 이름(공통점), 아래로 단어 5개. 어려운 묶음일수록 다른 색이다. 공간을 적게 차지한다 */
export function ConnectionsGroupColumns({ groups }: { groups: GroupColumn[] }) {
  if (groups.length === 0) return null
  return (
    <ul className="party-cn-solved-list">
      {groups.map((group) => (
        <li key={group.group} className={`party-cn-solved party-cn-level-${group.group}`}>
          <strong>{group.title}</strong>
          {group.words.map((word) => (
            <span key={word} className="party-cn-solved-word">
              {word}
            </span>
          ))}
        </li>
      ))}
    </ul>
  )
}

/** 맞혀서 없앤 그룹 — 맞히기 전부터 자리를 잡아 두어서, 묶음이 늘어도 아래 화면이 밀리지 않는다 */
export function ConnectionsSolvedList({ solved, words }: { solved: ConnectionsSolvedGroup[]; words: string[] }) {
  return (
    <div className="party-cn-solved-slot">
      <ConnectionsGroupColumns groups={solved.map((group) => ({ group: group.group, title: group.title, words: group.cells.map((cell) => words[cell]) }))} />
    </div>
  )
}

interface PlayersProps {
  players: PlayerInfo[]
  progress: ConnectionsProgressSignal['players']
  myId: string | null
}

/** 모두의 진행 — 다 없앤 사람(빠른 순)이 위, 그다음 많이 없앤 순 */
export function ConnectionsPlayers({ players, progress, myId }: PlayersProps) {
  const rows = progress
    .map((row) => ({ ...row, nickname: players.find((p) => p.id === row.playerId)?.nickname ?? '???' }))
    .sort((a, b) => {
      if (a.finishedMs !== null || b.finishedMs !== null) return (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity)
      return b.solved - a.solved || a.wrongs - b.wrongs
    })
  return (
    <ul className="party-cn-players">
      {rows.map((row) => (
        <li key={row.playerId} className={row.playerId === myId ? 'party-cn-player-mine' : undefined}>
          <span className="party-cn-player-name">{row.playerId === myId ? '나' : row.nickname}</span>
          <strong>
            {row.solved}/{CONNECTIONS_GROUP_COUNT}
          </strong>
          <span className="party-cn-player-sub">{row.finishedMs !== null ? `✅ ${formatConnectionsTime(row.finishedMs)}` : `실수 ${row.wrongs}`}</span>
        </li>
      ))}
    </ul>
  )
}

interface EndProps {
  end: ConnectionsEndSignal
  players: PlayerInfo[]
  myId: string | null
}

/** 끝난 뒤의 결과 상자 — 이긴 사람, 순위(기록·실수), 정답, 내 기록 */
export function ConnectionsEnd({ end, players, myId }: EndProps) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const sorted = [...end.players].sort((a, b) => a.rank - b.rank)
  const winners = sorted.filter((row) => row.rank === 1)
  const mine = end.players.find((row) => row.playerId === myId)
  return (
    <div className="party-cn-end">
      <p className="party-cn-end-title">{winners.length === end.players.length && end.players.length > 1 ? '🤝 모두 비겼어요!' : `🏆 ${winners.map((row) => nicknameOf(row.playerId)).join(', ')} 승리!`}</p>
      <ol className="party-cn-end-list">
        {sorted.map((row) => (
          <li key={row.playerId} className={row.playerId === myId ? 'party-cn-player-mine' : undefined}>
            <span>
              {row.rank}위 {row.playerId === myId ? '나' : nicknameOf(row.playerId)}
            </span>
            <span className="party-cn-end-detail">
              <strong>{row.timeMs !== null ? formatConnectionsTime(row.timeMs) : `${row.solved}/${CONNECTIONS_GROUP_COUNT}묶음`}</strong>
              {row.timeMs === null ? ' · 시간 초과' : ''} · 실수 {row.wrongs}
            </span>
          </li>
        ))}
      </ol>
      <div className="party-cn-answer">
        <p className="party-cn-note">정답은 이거였어요</p>
        <ConnectionsGroupColumns groups={end.answer} />
      </div>
      {mine && (
        <p className="party-cn-note">
          {mine.timeMs !== null && mine.finishedMs !== null
            ? `내 기록: ${formatConnectionsTime(mine.timeMs)} (걸린 시간 ${formatConnectionsTime(mine.finishedMs)}${mine.wrongs > 0 ? ` + 틀린 벌점 ${mine.wrongs * CONNECTIONS_WRONG_PENALTY_S}초` : ''})`
            : `내 기록: ${mine.solved}묶음 찾음 · ${mine.wrongs}번 틀림`}
        </p>
      )}
    </div>
  )
}
