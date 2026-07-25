import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyLoading } from '../components/party/PartyLoading'
import { useGameSession } from '../hooks/useGameSession'

export function PartyGame() {
  const navigate = useNavigate()
  const session = useGameSession()
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await session.createRoom(nickname.trim())
    setSubmitting(false)
    if (result.ok) navigate(`/party/${result.roomCode}`)
    else setError(result.error)
  }

  if (!session.connected) {
    return <PartyLoading message="서버에 연결하는 중이에요. 잠들어 있던 서버라면 최대 1분 정도 걸릴 수 있어요." />
  }

  if (submitting) {
    return <PartyLoading message="방 만드는 중..." />
  }

  return (
    <section className="game-page">
      <h1 className="page-title">🎉 함께하는 파티게임</h1>
      <p className="page-subtitle">닉네임을 입력하고 방을 만들어 친구들을 초대해보세요.</p>

      <form className="guess-form" onSubmit={handleCreate}>
        <input
          className="guess-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          maxLength={20}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={submitting || !nickname.trim()}>
          방 만들기
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
