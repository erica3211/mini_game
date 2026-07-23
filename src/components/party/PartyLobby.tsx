import { useState } from 'react'
import { MIN_PLAYERS_TO_START, type GameId, type PlayerInfo } from '../../lib/partyProtocol'
import type { GameSession } from '../../hooks/useGameSession'

interface Props {
  session: GameSession
}

function readyBadge(p: PlayerInfo) {
  if (!p.connected) return { className: 'badge badge-out', label: '연결끊김' }
  if (p.ready) return { className: 'badge badge-strike', label: '준비완료' }
  return { className: 'badge badge-ball', label: '대기중' }
}

export function PartyLobby({ session }: Props) {
  const state = session.roomState!
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/party/${state.code}`

  const connectedPlayers = state.players.filter((p) => p.connected)
  // 방장은 '게임 시작' 버튼을 누르는 행위 자체가 곧 준비 의사 표시라 준비완료 여부를 따로 검사하지 않는다
  const allReady = connectedPlayers.filter((p) => !p.isHost).every((p) => p.ready)
  const canStart = connectedPlayers.length >= MIN_PLAYERS_TO_START && allReady
  // 방장을 맨 위로, 그다음은 연결 끊긴 사람을 맨 뒤로
  const sortedPlayers = [...state.players].sort((a, b) => {
    if (a.isHost !== b.isHost) return Number(b.isHost) - Number(a.isHost)
    return Number(b.connected) - Number(a.connected)
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleGame = (gameId: GameId) => {
    const selected = state.config.selectedGames
    const next = selected.includes(gameId) ? selected.filter((id) => id !== gameId) : [...selected, gameId]
    session.updateConfig({ selectedGames: next })
  }

  return (
    <section className="game-page">
      <h1 className="page-title">🎉 파티게임 대기실</h1>
      <p className="page-subtitle">방 코드 {state.code}</p>

      <div className="party-invite">
        <input className="party-invite-input" readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-primary" onClick={handleCopy}>
          {copied ? '복사됨!' : '링크 복사'}
        </button>
      </div>

      <h2 className="party-section-title">참가자 ({connectedPlayers.length}명)</h2>
      <ul className="party-player-list">
        {sortedPlayers.map((p) => {
          const badge = readyBadge(p)
          return (
            <li key={p.id} className="party-player-row">
              <span>
                {p.isHost && '👑 '}
                {p.nickname}
                {p.id === session.playerId && ' (나)'}
              </span>
              {!p.isHost && <span className={badge.className}>{badge.label}</span>}
            </li>
          )
        })}
      </ul>

      {session.isHost ? (
        <>
          <button type="button" className="btn btn-primary" disabled={!canStart} onClick={session.start}>
            게임 시작
          </button>
          {!canStart && (
            <p className="error">
              {connectedPlayers.length < MIN_PLAYERS_TO_START
                ? `최소 ${MIN_PLAYERS_TO_START}명이 필요해요.`
                : '모든 참가자가 준비완료 상태여야 시작할 수 있어요.'}
            </p>
          )}
        </>
      ) : (
        session.me && (
          <button type="button" className="btn btn-primary" onClick={() => session.setReady(!session.me!.ready)}>
            {session.me.ready ? '준비 취소' : '준비 완료'}
          </button>
        )
      )}

      <div className="party-config">
        <h2 className="party-section-title">게임 설정</h2>

        <label className="party-config-row">
          라운드 수
          <input
            type="number"
            min={1}
            max={20}
            className="party-config-number"
            value={state.config.totalRounds}
            disabled={!session.isHost}
            onChange={(e) => session.updateConfig({ totalRounds: Number(e.target.value) })}
          />
        </label>

        <label className="party-config-row">
          <input
            type="checkbox"
            checked={state.config.randomOrder}
            disabled={!session.isHost}
            onChange={(e) => session.updateConfig({ randomOrder: e.target.checked })}
          />
          무작위 순서
        </label>

        <div className="party-game-list">
          {state.gameCatalog.map((game) => {
            const selected = state.config.selectedGames.includes(game.id)
            return (
              <button
                key={game.id}
                type="button"
                className={`party-game-card${selected ? ' party-game-card-selected' : ''}`}
                disabled={!session.isHost || game.comingSoon}
                aria-pressed={selected}
                onClick={() => toggleGame(game.id)}
              >
                <span className="party-game-card-title">
                  {game.emoji} {game.title}
                  {game.comingSoon && <span className="party-coming-soon"> (준비중)</span>}
                </span>
                <span className="party-game-card-desc">"{game.description}"</span>
                <span className="party-game-card-meta">
                  <span>⏱️ {game.playTimeSeconds}초 소요</span>
                  <span>
                    {game.modeCategory.icon} {game.modeCategory.name}
                  </span>
                  <span>
                    {game.mechanismCategory.icon} {game.mechanismCategory.name}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
