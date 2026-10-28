import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryPicker } from '../../shared/components/CategoryPicker'
import { ConfirmModal } from '../../shared/components/ConfirmModal'
import { Modal } from '../../shared/components/Modal'
import { useWordChainCategories } from '../games/wordChain/useWordChainCategories'
import {
  DEFAULT_GAME_MIN_PLAYERS,
  MIN_PLAYERS_TO_START,
  type GameId,
  type PlayerInfo,
} from '../../shared/lib/partyProtocol'
import { WORD_CHAIN_MIN_CANDIDATES } from '../games/wordChain/protocol'
import type { GameSession } from './useGameSession'

const GAMES_PER_PAGE = 10

interface Props {
  session: GameSession
}

function readyBadge(p: PlayerInfo) {
  if (!p.connected) return { className: 'badge badge-out', label: '연결끊김' }
  if (p.ready) return { className: 'badge badge-strike', label: '준비완료' }
  return { className: 'badge badge-ball', label: '대기중' }
}

export function PartyLobby({ session }: Props) {
  const navigate = useNavigate()
  const state = session.roomState!
  const [copied, setCopied] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [gamePage, setGamePage] = useState(0)
  // 방장 권한을 넘길지 확인 중인 참가자 (null이면 확인창이 닫혀 있다)
  const [transferTarget, setTransferTarget] = useState<PlayerInfo | null>(null)
  const inviteUrl = `${window.location.origin}/party/${state.code}`

  const connectedPlayers = state.players.filter((p) => p.connected)
  // 방장은 '게임 시작' 버튼을 누르는 행위 자체가 곧 준비 의사 표시라 준비완료 여부를 따로 검사하지 않는다
  const allReady = connectedPlayers.filter((p) => !p.isHost).every((p) => p.ready)
  // 인원이 모자라 지금은 할 수 없는 게임인지 — 이런 게임은 이미 골라 뒀더라도 선택은 서버에 남겨 두고(사람이 돌아오면 다시 살아난다),
  // 화면에서는 선택 해제된 것처럼 비활성으로 보여주며 "시작할 수 있는 게임" 수에도 세지 않는다
  const needsMorePlayers = (game: (typeof state.gameCatalog)[number]) =>
    connectedPlayers.length < (game.minPlayers ?? DEFAULT_GAME_MIN_PLAYERS)
  // 필요 인원이 적은 게임이 앞, 같으면 소요 시간이 짧은 게임이 앞 (같으면 카탈로그 순서 유지)
  const sortedGames = [...state.gameCatalog].sort(
    (a, b) =>
      (a.minPlayers ?? DEFAULT_GAME_MIN_PLAYERS) - (b.minPlayers ?? DEFAULT_GAME_MIN_PLAYERS) ||
      a.playTimeSeconds - b.playTimeSeconds,
  )
  const pageCount = Math.max(1, Math.ceil(sortedGames.length / GAMES_PER_PAGE))
  const currentPage = Math.min(gamePage, pageCount - 1)
  const pagedGames = sortedGames.slice(currentPage * GAMES_PER_PAGE, (currentPage + 1) * GAMES_PER_PAGE)
  const hasSelectedGame = state.gameCatalog.some((g) => state.config.selectedGames.includes(g.id) && !needsMorePlayers(g))
  // 초성 퀴즈 카테고리: null은 전체. 고른 카테고리의 문제가 너무 적으면 같은 문제가 반복되므로 시작할 수 없다 (서버도 같은 기준으로 막는다)
  const wordChainSelected = state.config.selectedGames.includes('wordChain')
  const wordChainCategories = useWordChainCategories(wordChainSelected)
  const categoryNames = (wordChainCategories ?? []).map((c) => c.category)
  const selectedCategories = state.config.wordChainCategories ?? categoryNames
  const candidateCount = wordChainCategories
    ? wordChainCategories.filter((c) => selectedCategories.includes(c.category)).reduce((sum, c) => sum + c.count, 0)
    : null
  const tooFewWords = wordChainSelected && candidateCount !== null && candidateCount < WORD_CHAIN_MIN_CANDIDATES
  const categorySummary =
    selectedCategories.length === categoryNames.length
      ? '전체'
      : selectedCategories.length === 0
        ? '선택 없음'
        : selectedCategories.length <= 2
          ? selectedCategories.join(', ')
          : `${selectedCategories[0]} 외 ${selectedCategories.length - 1}개`
  // 소켓이 끊긴 동안 보낸 요청은 서버에 닿기 전에 사라질 수 있어서, 다시 연결될 때까지 시작·설정 변경을 막는다
  const offline = !session.connected || session.rejoining
  const canStart = !offline && connectedPlayers.length >= MIN_PLAYERS_TO_START && allReady && hasSelectedGame && !tooFewWords
  const configLocked = !session.isHost || offline
  // comingSoon 게임과 인원이 모자란 게임은 카드 자체가 선택 불가능하니 "전체 선택"의 대상에서도 제외한다
  const playableGames = state.gameCatalog.filter((g) => !g.comingSoon && !needsMorePlayers(g))
  const allGamesSelected = playableGames.length > 0 && playableGames.every((g) => state.config.selectedGames.includes(g.id))
  // 지금 선택돼 보이는 게임 수 — 카드의 선택 표시와 같은 기준이다 (인원이 모자란 게임은 세지 않는다)
  const selectedGameCount = playableGames.filter((g) => state.config.selectedGames.includes(g.id)).length
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

  const handleLeave = () => {
    session.leaveRoom()
    navigate('/')
  }

  const toggleGame = (gameId: GameId) => {
    const selected = state.config.selectedGames
    const next = selected.includes(gameId) ? selected.filter((id) => id !== gameId) : [...selected, gameId]
    session.updateConfig({ selectedGames: next })
  }

  // 전부 고르면 null(전체)로 보내 방 상태가 커지지 않게 한다
  const updateCategories = (next: string[]) => {
    session.updateConfig({ wordChainCategories: next.length === categoryNames.length ? null : next })
  }

  const toggleCategory = (category: string) => {
    updateCategories(
      selectedCategories.includes(category)
        ? selectedCategories.filter((name) => name !== category)
        : categoryNames.filter((name) => name === category || selectedCategories.includes(name)),
    )
  }

  const toggleAllGames = () => {
    session.updateConfig({ selectedGames: allGamesSelected ? [] : playableGames.map((g) => g.id) })
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
      {session.isHost && connectedPlayers.length > 1 && (
        <p className="party-player-hint">참가자를 누르면 방장 권한을 넘길 수 있어요.</p>
      )}
      <ul className="party-player-list">
        {sortedPlayers.map((p) => {
          const badge = readyBadge(p)
          // 방장은 연결되어 있는 다른 참가자를 눌러 방장 권한을 넘길 수 있다
          const canTransfer = session.isHost && p.id !== session.playerId && p.connected
          return (
            <li
              key={p.id}
              className={`party-player-row${canTransfer ? ' party-player-row-clickable' : ''}`}
              {...(canTransfer
                ? {
                    role: 'button',
                    tabIndex: 0,
                    title: '눌러서 방장 권한 넘기기',
                    onClick: () => setTransferTarget(p),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setTransferTarget(p)
                      }
                    },
                  }
                : {})}
            >
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
          <div className="party-final-actions">
            <button type="button" className="btn btn-primary" disabled={!canStart} onClick={session.start}>
              게임 시작
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleLeave}>
              나가기
            </button>
          </div>
          {!canStart && (
            <p className="error">
              {offline
                ? '연결이 끊겼어요. 다시 연결되면 시작할 수 있어요.'
                : connectedPlayers.length < MIN_PLAYERS_TO_START
                ? `파티게임은 혼자서 할 수 없어요. 최소 ${MIN_PLAYERS_TO_START}명이 필요해요.`
                : !hasSelectedGame
                  ? '최소 1개 이상의 게임을 선택해주세요.'
                  : tooFewWords
                    ? `초성 퀴즈 문제 후보가 ${WORD_CHAIN_MIN_CANDIDATES}개 이상 되도록 카테고리를 골라주세요.`
                    : '모든 참가자가 준비완료 상태여야 시작할 수 있어요.'}
            </p>
          )}
        </>
      ) : (
        session.me && (
          <div className="party-final-actions">
            <button type="button" className="btn btn-primary" disabled={offline} onClick={() => session.setReady(!session.me!.ready)}>
              {session.me.ready ? '준비 취소' : '준비 완료'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleLeave}>
              나가기
            </button>
          </div>
        )
      )}

      <div className="party-config">
        <h2 className="party-section-title">게임 설정</h2>

        <div className="party-config-row">
          라운드 수
          <div className="party-config-stepper">
            <button
              type="button"
              className="party-config-stepper-btn"
              disabled={configLocked || state.config.totalRounds <= 1}
              onClick={() => session.updateConfig({ totalRounds: state.config.totalRounds - 1 })}
              aria-label="라운드 수 줄이기"
            >
              −
            </button>
            <span className="party-config-stepper-value">{state.config.totalRounds}</span>
            <button
              type="button"
              className="party-config-stepper-btn"
              disabled={configLocked || state.config.totalRounds >= 20}
              onClick={() => session.updateConfig({ totalRounds: state.config.totalRounds + 1 })}
              aria-label="라운드 수 늘리기"
            >
              +
            </button>
          </div>
        </div>

        <label className="party-config-row">
          <input
            type="checkbox"
            checked={allGamesSelected}
            disabled={configLocked}
            onChange={toggleAllGames}
          />
          전체 선택
        </label>

        <label className="party-config-row">
          <input
            type="checkbox"
            checked={state.config.randomOrder}
            disabled={configLocked}
            onChange={(e) => session.updateConfig({ randomOrder: e.target.checked })}
          />
          무작위 순서
        </label>

        <div className="party-config-row party-config-summary">현재 선택된 게임 : {selectedGameCount}개</div>

        <div className="party-game-list">
          {pagedGames.map((game) => {
            const notEnoughPlayers = needsMorePlayers(game)
            const selected = state.config.selectedGames.includes(game.id) && !notEnoughPlayers
            return (
              <div
                key={game.id}
                className={`party-game-card${selected ? ' party-game-card-selected' : ''}${configLocked || game.comingSoon || notEnoughPlayers ? ' party-game-card-disabled' : ''}`}
              >
                <button
                  type="button"
                  className="party-game-card-main"
                  disabled={configLocked || game.comingSoon || notEnoughPlayers}
                  aria-pressed={selected}
                  onClick={() => toggleGame(game.id)}
                >
                  <span className="party-game-card-title">
                    {game.emoji} {game.title}
                    {game.comingSoon && <span className="party-coming-soon"> (준비중)</span>}
                    {!game.comingSoon && notEnoughPlayers && (
                      <span className="party-coming-soon"> ({game.minPlayers}명 이상 필요)</span>
                    )}
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
                {game.id === 'telestration' && selected && (
                  <div className="party-game-extra">
                    <span>
                      제시어:{' '}
                      <strong>{state.config.telestrationWordMode === 'custom' ? '직접 입력' : '랜덤'}</strong>
                    </span>
                    {session.isHost && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={offline}
                        onClick={() =>
                          session.updateConfig({
                            telestrationWordMode: state.config.telestrationWordMode === 'custom' ? 'random' : 'custom',
                          })
                        }
                      >
                        {state.config.telestrationWordMode === 'custom' ? '랜덤으로 변경' : '직접 입력으로 변경'}
                      </button>
                    )}
                  </div>
                )}
                {game.id === 'liarQuiz' && selected && (
                  <div className="party-game-extra">
                    <span>
                      문제: <strong>{state.config.liarQuizQuestionMode === 'custom' ? '직접 입력' : '랜덤'}</strong>
                    </span>
                    {session.isHost && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={offline}
                        onClick={() =>
                          session.updateConfig({
                            liarQuizQuestionMode: state.config.liarQuizQuestionMode === 'custom' ? 'random' : 'custom',
                          })
                        }
                      >
                        {state.config.liarQuizQuestionMode === 'custom' ? '랜덤으로 변경' : '직접 입력으로 변경'}
                      </button>
                    )}
                  </div>
                )}
                {game.id === 'wordChain' && selected && wordChainCategories && (
                  <div className="party-game-extra">
                    <span className={tooFewWords ? 'party-game-extra-warn' : undefined}>
                      카테고리: <strong>{categorySummary}</strong><br/>문제 후보 {candidateCount}개
                      {tooFewWords && ` (${WORD_CHAIN_MIN_CANDIDATES}개 이상 필요)`}
                    </span>
                    {session.isHost && (
                      <button type="button" className="btn btn-secondary" disabled={offline} onClick={() => setCategoryModalOpen(true)}>
                        변경
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {pageCount > 1 && (
          <nav className="party-game-pager" aria-label="게임 목록 페이지">
            <button
              type="button"
              className="party-game-pager-btn"
              disabled={currentPage <= 0}
              onClick={() => setGamePage(currentPage - 1)}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, page) => (
              <button
                key={page}
                type="button"
                className={`party-game-pager-btn${page === currentPage ? ' party-game-pager-btn-current' : ''}`}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => setGamePage(page)}
              >
                {page + 1}
              </button>
            ))}
            <button
              type="button"
              className="party-game-pager-btn"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setGamePage(currentPage + 1)}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </nav>
        )}

        <Modal
          open={categoryModalOpen && session.isHost && wordChainSelected && wordChainCategories !== null}
          title="초성 퀴즈 카테고리"
          onClose={() => setCategoryModalOpen(false)}
        >
          <CategoryPicker
            categories={categoryNames}
            selected={selectedCategories}
            onToggle={toggleCategory}
            onSelectAll={() => updateCategories(categoryNames)}
            onClear={() => updateCategories([])}
          >
            <p>
              선택한 카테고리 <strong>{selectedCategories.length}개</strong> · 문제 후보 <strong>{candidateCount}개</strong>
            </p>
            {tooFewWords && (
              <p className="category-picker-warn">문제 후보가 {WORD_CHAIN_MIN_CANDIDATES}개 이상 되어야 시작할 수 있어요.</p>
            )}
            {!tooFewWords && selectedCategories.length === 1 && <p>하나만 고르면 카테고리가 처음부터 보여요.</p>}
          </CategoryPicker>
        </Modal>
      </div>

      <ConfirmModal
        open={transferTarget !== null && session.isHost}
        message={`방장 권한을 '${transferTarget?.nickname ?? ''}'님께 넘겨드릴까요?`}
        onConfirm={() => {
          if (transferTarget) session.transferHost(transferTarget.id)
          setTransferTarget(null)
        }}
        onCancel={() => setTransferTarget(null)}
      />
    </section>
  )
}
