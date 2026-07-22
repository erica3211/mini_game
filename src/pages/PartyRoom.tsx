import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PartyFinalResults } from '../components/party/PartyFinalResults'
import { PartyLobby } from '../components/party/PartyLobby'
import { PartyRoundActive } from '../components/party/PartyRoundActive'
import { PartyRoundCountdown } from '../components/party/PartyRoundCountdown'
import { PartyRoundResults } from '../components/party/PartyRoundResults'
import { useGameSession } from '../hooks/useGameSession'

export function PartyRoom() {
  const { roomCode = '' } = useParams()
  const session = useGameSession(roomCode)
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim()) return
    setSubmitting(true)
    setJoinError(null)
    const result = await session.joinRoom(roomCode, nickname.trim())
    setSubmitting(false)
    if (!result.ok) setJoinError(result.error)
  }

  if (session.rejoining) {
    return (
      <section className="game-page">
        <p className="page-subtitle">접속하는 중...</p>
      </section>
    )
  }

  if (!session.playerId) {
    return (
      <section className="game-page">
        <h1 className="page-title">🎉 파티게임 입장</h1>
        <p className="page-subtitle">
          방 코드 <strong>{roomCode}</strong>
        </p>
        <form className="guess-form" onSubmit={handleJoin}>
          <input
            className="guess-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={20}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={submitting || !nickname.trim()}>
            입장하기
          </button>
        </form>
        {joinError && <p className="error">{joinError}</p>}
      </section>
    )
  }

  if (!session.roomState) {
    return (
      <section className="game-page">
        <p className="page-subtitle">방 정보를 불러오는 중...</p>
      </section>
    )
  }

  switch (session.roomState.phase) {
    case 'lobby':
      return <PartyLobby session={session} />
    case 'round_countdown':
      return <PartyRoundCountdown session={session} />
    case 'round_active':
      return <PartyRoundActive session={session} />
    case 'round_results':
      return <PartyRoundResults session={session} />
    case 'final_results':
      return <PartyFinalResults session={session} />
  }
}
