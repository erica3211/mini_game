import { useState } from 'react'
import { MIN_PLAYERS_TO_START, type GameId } from '../../lib/partyProtocol'
import type { GameSession } from '../../hooks/useGameSession'

interface Props {
  session: GameSession
}

export function PartyLobby({ session }: Props) {
  const state = session.roomState!
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/party/${state.code}`

  const connectedPlayers = state.players.filter((p) => p.connected)
  const allReady = connectedPlayers.every((p) => p.ready)
  const canStart = connectedPlayers.length >= MIN_PLAYERS_TO_START && allReady

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
        {state.players.map((p) => (
          <li key={p.id} className="party-player-row">
            <span>
              {p.isHost && '👑 '}
              {p.nickname}
              {!p.connected && ' (연결 끊김)'}
            </span>
            <span className={p.ready ? 'badge badge-strike' : 'badge badge-out'}>{p.ready ? '준비완료' : '대기중'}</span>
          </li>
        ))}
      </ul>

      {session.me && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => session.setReady(!session.me!.ready)}
        >
          {session.me.ready ? '준비 취소' : '준비 완료'}
        </button>
      )}

      {session.isHost && (
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
              onChange={(e) => session.updateConfig({ totalRounds: Number(e.target.value) })}
            />
          </label>

          <label className="party-config-row">
            <input
              type="checkbox"
              checked={state.config.randomOrder}
              onChange={(e) => session.updateConfig({ randomOrder: e.target.checked })}
            />
            무작위 순서
          </label>

          <ul className="party-game-list">
            {state.gameCatalog.map((game) => (
              <li key={game.id} className="party-game-row">
                <label>
                  <input
                    type="checkbox"
                    disabled={game.comingSoon}
                    checked={state.config.selectedGames.includes(game.id)}
                    onChange={() => toggleGame(game.id)}
                  />
                  {game.emoji} {game.title}
                  {game.comingSoon && <span className="party-coming-soon"> (준비중)</span>}
                </label>
              </li>
            ))}
          </ul>

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
        </div>
      )}
    </section>
  )
}
