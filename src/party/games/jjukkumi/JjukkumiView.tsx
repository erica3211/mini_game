import type { PlayerInfo } from '../../../shared/lib/partyProtocol'
import { formatMarbleTime } from '../marbleMaze/protocol'
import { jjukkumiStageTitle, type JjukkumiEndSignal, type JjukkumiPlayerState } from './protocol'
import { playerSpriteName, spriteUrl } from './sprites'

// 쭈꾸미 게임 화면 조각 — 게임 화면과 결과 화면이 똑같이 보이도록 같이 쓴다

export interface PlayerRow {
  playerId: string
  character: number
  /** 얼굴 그림 대신 보여 줄 이모지 (예: 달고나에서 받은 모양) */
  emoji?: string
  /** 상태 글자를 직접 정한다 (없으면 달리는 중·통과·탈락) */
  label?: string
  status: JjukkumiPlayerState
  progress: number
  /** 달리기가 시작된 뒤 통과·탈락한 시각(ms) */
  atMs: number | null
}

interface PlayersProps {
  players: PlayerInfo[]
  rows: PlayerRow[]
  myId: string | null
  /** 이름을 눌러 그 사람을 구경(테두리로 표시)할 수 있는 사람이면 주어진다 — 아직 달리는 사람에게는 주지 않는다 */
  onWatch?: (playerId: string) => void
  watchingId: string | null
}

const STATUS_TEXT: Record<JjukkumiPlayerState, string> = { run: '달리는 중', passed: '✔ 통과', out: '✖ 탈락' }

/** 참가자 목록 — 캐릭터 얼굴, 이름, 어디까지 갔는지(막대), 지금 상태. 통과한 사람(빠른 순) → 달리는 사람(멀리 간 순) → 탈락한 사람(멀리 간 순) */
export function JjukkumiPlayers({ players, rows, myId, onWatch, watchingId }: PlayersProps) {
  const order: Record<JjukkumiPlayerState, number> = { passed: 0, run: 1, out: 2 }
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status]
    if (a.status === 'passed') return (a.atMs ?? 0) - (b.atMs ?? 0)
    return b.progress - a.progress
  })
  return (
    <ul className="jk-players">
      {sorted.map((row) => {
        const nickname = players.find((p) => p.id === row.playerId)?.nickname ?? '???'
        const classes = ['jk-player', row.playerId === myId ? 'jk-player-mine' : '', onWatch ? 'jk-player-watchable' : '', watchingId === row.playerId ? 'jk-player-watching' : '', row.status === 'out' ? 'jk-player-out' : ''].filter(Boolean).join(' ')
        const content = (
          <>
            {row.emoji ? (
              <span className="jk-player-face jk-player-face-emoji" aria-hidden="true">
                {row.emoji}
              </span>
            ) : (
              <img className="jk-player-face" src={spriteUrl(playerSpriteName(row.character))} alt="" draggable={false} />
            )}
            <span className="jk-player-name">{row.playerId === myId ? `${nickname} (나)` : nickname}</span>
            <span className="jk-player-bar" aria-hidden="true">
              <span className="jk-player-bar-fill" style={{ width: `${Math.round(row.progress * 100)}%` }} />
            </span>
            <span className="jk-player-state">{row.label ?? (row.status === 'passed' && row.atMs !== null ? `✔ ${formatMarbleTime(row.atMs)}` : STATUS_TEXT[row.status])}</span>
          </>
        )
        return (
          <li key={row.playerId}>
            {onWatch ? (
              <button type="button" className={classes} onClick={() => onWatch(row.playerId)} aria-pressed={watchingId === row.playerId}>
                {content}
              </button>
            ) : (
              <div className={classes}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface EndProps {
  end: JjukkumiEndSignal
  players: PlayerInfo[]
  myId: string | null
}

/** 끝난 뒤의 결과 상자 — 끝까지 살아남은 사람, 순위(어느 스테이지에서 탈락했는지) */
export function JjukkumiEnd({ end, players, myId }: EndProps) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const sorted = [...end.players].sort((a, b) => a.rank - b.rank)
  const survivors = sorted.filter((row) => row.survived)
  return (
    <div className="jk-end">
      <p className="jk-end-title">
        {survivors.length === 0 ? '😵 아무도 살아남지 못했어요!' : survivors.length === 1 ? `🏆 ${nicknameOf(survivors[0].playerId)} 최후의 생존자!` : `🏆 ${survivors.map((row) => nicknameOf(row.playerId)).join(', ')} 공동 생존!`}
      </p>
      <ol className="jk-end-list">
        {sorted.map((row) => (
          <li key={row.playerId} className={row.playerId === myId ? 'jk-player-mine' : undefined}>
            <span>
              {row.rank}위 {row.playerId === myId ? '나' : nicknameOf(row.playerId)}
            </span>
            <span className="jk-end-detail">{row.survived ? '🏁 끝까지 생존' : `${jjukkumiStageTitle(row.stageId)} 탈락${row.progress !== null && row.stageId === 'redLight' ? ` · ${Math.round(row.progress * 100)}%` : ''}`}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
