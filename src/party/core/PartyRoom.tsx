import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { PartyFinalResults } from './PartyFinalResults'
import { PartyLoading } from './PartyLoading'
import { PartyLobby } from './PartyLobby'
import { PartyRoundActive } from './PartyRoundActive'
import { PartyRoundCountdown } from './PartyRoundCountdown'
import { PartyRoundResults } from './PartyRoundResults'
import { partyBasePath } from './partyPaths'
import { useGameSession } from './useGameSession'

export function PartyRoom() {
  const { roomCode = '' } = useParams()
  const session = useGameSession(roomCode)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 방 종류와 다른 주소(/party로 팀전 방에 들어온 경우 등)로 들어왔다면, 방 정보를 받는 대로 맞는 주소로 바로잡는다
  const roomMode = session.roomState?.mode
  useEffect(() => {
    if (roomMode && !pathname.startsWith(partyBasePath(roomMode))) navigate(`${partyBasePath(roomMode)}/${roomCode}`, { replace: true })
  }, [roomMode, pathname, roomCode, navigate])
  // 이 방 화면에서 다른 곳(홈 로고, 뒤로가기 등)으로 앱 안에서 이동하면 방에서 나간 것으로 처리한다 — 안 그러면 화면만 바뀌고
  // 서버에는 계속 참가자로 남아 있어서(소켓이 앱 전체에서 하나라 끊기지도 않는다) 다른 사람 눈에는 방에 있는 것으로 보이고, 게임이 그 사람을 기다린다.
  // 새로고침·탭 닫기는 이 정리 코드가 돌지 않고 소켓만 끊겨서 그대로 재접속할 수 있다. 방 주소끼리의 이동(개인전↔팀전 주소 바로잡기)은 나가기가 아니다
  const playerIdRef = useRef(session.playerId)
  const leaveRoomRef = useRef(session.leaveRoom)
  useEffect(() => {
    playerIdRef.current = session.playerId
    leaveRoomRef.current = session.leaveRoom
  })
  useEffect(
    () => () => {
      if (!playerIdRef.current) return
      const [, base, code] = window.location.pathname.split('/')
      const stillInThisRoom = (base === 'party' || base === 'teamParty') && code?.toUpperCase() === roomCode.toUpperCase()
      if (!stillInThisRoom) leaveRoomRef.current()
    },
    [roomCode],
  )

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

  // 이미 방에 들어와 있던 사람은 소켓이 잠깐 끊겨도 화면을 로딩으로 갈아엎지 않는다 —
  // 갈아엎으면 그 사이의 터치가 사라지고 스크롤도 맨 위로 돌아간다 (카카오톡 인앱 브라우저처럼 연결이 자주 끊기는 환경)
  const inRoom = Boolean(session.playerId && session.roomState)
  const reconnecting = !session.connected || session.rejoining

  if (!session.connected && !inRoom) {
    return <PartyLoading message="서버에 연결하는 중이에요. 잠들어 있던 서버라면 최대 1분 정도 걸릴 수 있어요." />
  }

  if (session.rejoining && !inRoom) {
    return <PartyLoading message="접속하는 중..." />
  }

  if (submitting) {
    return <PartyLoading message="입장하는 중..." />
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
    return <PartyLoading message="방 정보를 불러오는 중..." />
  }

  return (
    <>
      {reconnecting && (
        <output className="party-reconnect-banner">연결이 불안정해요. 다시 연결하는 중…</output>
      )}
      {renderPhase(session)}
    </>
  )
}

function renderPhase(session: ReturnType<typeof useGameSession>) {
  switch (session.roomState!.phase) {
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
