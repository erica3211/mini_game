import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../shared/components/Modal'
import type { RoomMode } from '../shared/lib/partyProtocol'
import { partyBasePath } from '../party/core/partyPaths'
import { RoomCodeInput } from '../party/core/RoomCodeInput'

// 방 번호는 서버가 만든 4글자(영문 대문자·숫자)다
const ROOM_CODE_LENGTH = 4

const games = [
  {
    path: '/number-baseball',
    emoji: '⚾',
    title: '숫자야구',
    description: '서로 다른 세 자리 숫자를 5번 안에 맞혀보세요.',
  },
  {
    path: '/hangul-baseball',
    emoji: '🇰🇷',
    title: '한글야구',
    description: '자음·모음 5개로 이루어진 조합을 5번 안에 맞혀보세요.',
  },
  {
    path: '/black-jack',
    emoji: '🂡🂢🂣',
    title: '블랙잭',
    description: '21에 가장 가까운 숫자를 만들어 5명의 딜러를 파산시켜보세요.',
  },
  {
    path: '/choseong-quiz',
    emoji: 'ㄱㄴㄷ',
    title: '초성 퀴즈',
    description: '주어진 초성으로 이루어진 단어를 맞혀보세요.',
  },
  {
    path: '/catchmind',
    emoji: '🎨',
    title: 'AI 캐치마인드',
    description: '내가 그린 그림을 AI가 맞혀요. 얼마나 빨리 알아볼까요?',
  },
  {
    path: '/suika',
    emoji: '🍉',
    title: '수박게임',
    description: '같은 과일끼리 합쳐서 점점 키워 수박을 만들어보세요.',
  },
] as const

export function Home() {
  const navigate = useNavigate()
  // 파티게임 방 만들기를 누르면 개인전/팀전 중 어느 방식으로 만들지 먼저 묻는다
  const [modeModalOpen, setModeModalOpen] = useState(false)
  // 파티게임 참가하기: 방 종류(개인전/팀전)와 방 번호를 입력해 들어간다
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinMode, setJoinMode] = useState<RoomMode>('individual')
  const [joinCode, setJoinCode] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  // 참가하기 카드를 누르는 바로 그 순간에 팝업을 그리고 첫 칸에 포커스를 준다 — 모바일 브라우저는 사용자가 누른 순간이 아닌 때의
  // 포커스(autoFocus 등)를 막는 경우가 많아서, 막히면 키보드도 안 올라오고 화면도 스크롤되지 않는다
  const openJoinModal = () => {
    flushSync(() => {
      setJoinCode('')
      setJoinError(null)
      setJoinModalOpen(true)
    })
    codeInputRef.current?.focus()
  }

  // 입장하기: 방이 있는지 서버에 먼저 물어보고, 없으면 그 자리에서 알려준다. 있으면 그 방의 실제 종류(개인전/팀전) 주소로 들어간다
  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()
    if (joinCode.length !== ROOM_CODE_LENGTH || joining) return
    setJoinError(null)
    setJoining(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SOCKET_URL as string}/rooms/${joinCode}`)
      const room = (await response.json()) as { exists: boolean; mode: RoomMode | null }
      if (room.exists && room.mode) navigate(`${partyBasePath(room.mode)}/${joinCode}`)
      else setJoinError('존재하지 않는 방이에요. 방 번호를 다시 확인해 주세요.')
    } catch {
      setJoinError('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <section>
      <h1 className="page-title">미니게임 모음집</h1>
      <p className="page-subtitle">하고 싶은 게임을 골라보세요!</p>
      <div className="game-grid">
        {games.map((game) => (
          <Link key={game.path} to={game.path} className="game-card">
            <span className="game-emoji">{game.emoji}</span>
            <span className="game-title">{game.title}</span>
            <span className="game-description">{game.description}</span>
          </Link>
        ))}
        <div className="game-card game-card-soon">
          <span className="game-emoji">🎮</span>
          <span className="game-title">다음 게임</span>
          <span className="game-description">준비 중이에요.</span>
        </div>
      </div>

      <h2 className="page-title party-section-heading">함께하는 파티게임</h2>
      <p className="page-subtitle">방을 만들어 링크를 공유하면 여러 명이 함께 라운드를 돌며 겨룰 수 있어요.</p>
      <div className="game-grid">
        <button type="button" className="game-card game-card-button" onClick={() => setModeModalOpen(true)}>
          <span className="game-emoji">🎉</span>
          <span className="game-title">파티게임 방 만들기</span>
          <span className="game-description">여러 라운드를 돌며 최종 점수로 우승자를 가려요.</span>
        </button>
        <button type="button" className="game-card game-card-button" onClick={openJoinModal}>
          <span className="game-emoji">🚪</span>
          <span className="game-title">파티게임 참가하기</span>
          <span className="game-description">친구가 만든 방 번호를 입력해서 들어가요.</span>
        </button>
      </div>

      <Modal
        open={joinModalOpen}
        title="파티게임 참가하기"
        doneLabel="닫기"
        onClose={() => setJoinModalOpen(false)}
        actions={
          // 팝업 아래 줄의 닫기 버튼 옆에 놓이지만, 위의 폼을 제출한다
          <button type="submit" form="party-join-form" className="btn btn-primary" disabled={joinCode.length !== ROOM_CODE_LENGTH || joining}>
            {joining ? '확인하는 중...' : '입장하기'}
          </button>
        }
      >
        <form id="party-join-form" className="party-join-form" onSubmit={handleJoin}>
          <div className="party-mode-options">
            {(
              [
                { mode: 'individual', emoji: '👤', label: '개인전' },
                { mode: 'team', emoji: '👥', label: '팀전' },
              ] as const
            ).map((option) => (
              <button
                key={option.mode}
                type="button"
                className={`party-mode-option${joinMode === option.mode ? ' party-mode-option-selected' : ''}`}
                aria-pressed={joinMode === option.mode}
                onClick={() => setJoinMode(option.mode)}
              >
                <span className="party-mode-option-emoji">{option.emoji}</span>
                <span className="party-mode-option-label">{option.label}</span>
              </button>
            ))}
          </div>
          <div className="party-join-code-row">
            <span className="party-join-code-label">방 번호 :</span>
            <RoomCodeInput
              inputRef={codeInputRef}
              length={ROOM_CODE_LENGTH}
              onChange={(code) => {
                setJoinCode(code)
                setJoinError(null)
              }}
            />
          </div>
          {joinError && <p className="error">{joinError}</p>}
        </form>
      </Modal>

      <Modal open={modeModalOpen} title="어떤 방식으로 할까요?" doneLabel="닫기" onClose={() => setModeModalOpen(false)}>
        <div className="party-mode-options">
          <button type="button" className="party-mode-option" onClick={() => navigate('/party')}>
            <span className="party-mode-option-emoji">👤</span>
            <span className="party-mode-option-label">개인전</span>
          </button>
          <button type="button" className="party-mode-option" onClick={() => navigate('/teamParty')}>
            <span className="party-mode-option-emoji">👥</span>
            <span className="party-mode-option-label">팀전</span>
          </button>
        </div>
      </Modal>
    </section>
  )
}
