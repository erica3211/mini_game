import type { CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { matchingPrefixLength, useTypeRaceRound, type TypeRaceStartSignal } from '../../hooks/useTypeRaceRound'
import { TYPE_RACE_ROUND_TIMEOUT_MS, type ClientToServerEvents, type PlayerId, type PlayerInfo, type ServerToClientEvents } from '../../lib/partyProtocol'
import { RemainingTime } from './RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  startSignal: TypeRaceStartSignal | null
  playerId: PlayerId | null
  players: PlayerInfo[]
  howToPlay: string
}

export function TypeRaceGame({ socket, roundKey, startSignal, playerId, players, howToPlay }: Props) {
  const {
    phase,
    sentences,
    sentenceIndex,
    typedValue,
    matchedLen,
    shakeIndex,
    cpm,
    myProgress,
    opponentProgress,
    opponentLive,
    spectatingId,
    setSpectatingId,
    slotColors,
    startedAt,
    inputRef,
    handleChange,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTypeRaceRound(socket, roundKey, startSignal, playerId)

  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'

  const trackEntries = startSignal
    ? Object.entries(startSignal.slotOfPlayer).map(([id, slot]) => ({
        id,
        nickname: nicknameOf(id),
        color: slotColors[slot] ?? '#3b82f6',
        progress: id === playerId ? myProgress : (opponentProgress[id] ?? 0),
        isMe: id === playerId,
      }))
    : []

  const currentSentence = sentences[sentenceIndex] ?? ''
  const spectateTarget = spectatingId !== null ? opponentLive[spectatingId] : undefined
  const spectateSentence = spectateTarget ? (sentences[spectateTarget.sentenceIndex] ?? '') : ''
  // 상대방의 typed도 나처럼 오타가 안 지워진 채로 올 수 있으므로, typed.length가 아니라 실제로 맞게
  // 친 접두사 길이로 채점해야 한다 (안 그러면 오타 뒤 글자까지 전부 초록색으로 잘못 표시된다)
  const spectateMatchedLen = spectateTarget ? matchingPrefixLength(spectateTarget.typed, spectateSentence) : 0

  return (
    <div className="party-round-stage">
      <div className="rules">
        <p>{howToPlay}</p>
      </div>

      {startedAt !== null && phase === 'racing' && (
        <RemainingTime startedAt={startedAt} timeoutMs={TYPE_RACE_ROUND_TIMEOUT_MS} />
      )}
      
      {phase === 'racing' && (
        <>
          <p className="party-typerace-cpm">⌨️ {cpm}타/분</p>
          <p className="party-typerace-sentence-progress">
            문장 {sentenceIndex + 1} / {sentences.length}
          </p>
          <p className="party-typerace-prompt" onClick={() => inputRef.current?.focus()}>
            {currentSentence.split('').map((char, i) => {
              const stateClass =
                i < matchedLen
                  ? 'party-typerace-char-correct'
                  : i === shakeIndex
                    ? 'party-typerace-char-wrong'
                    : i === matchedLen
                      ? 'party-typerace-char-cursor'
                      : ''
              return (
                <span key={i} className={`party-typerace-char ${stateClass}`.trim()}>
                  {char}
                </span>
              )
            })}
          </p>
          <input
            ref={inputRef}
            className="party-typerace-input"
            value={typedValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </>
      )}

      {startSignal && (
        <div className="party-race-track">
          <span className="party-race-track-flag">🏁 START</span>
          <div className="party-race-track-bar">
            {trackEntries.map((entry) => {
              const clickable = phase === 'finished' && !entry.isMe
              return (
                <div
                  key={entry.id}
                  className={`party-race-track-dot${entry.isMe ? ' party-race-track-dot-me' : ''}${clickable ? ' party-race-track-dot-clickable' : ''}`}
                  style={{ left: `${entry.progress}%`, '--dot-color': entry.color } as CSSProperties}
                  onClick={clickable ? () => setSpectatingId(entry.id) : undefined}
                >
                  <span className="party-race-track-nickname">{entry.nickname}</span>
                  <span className="party-race-track-dot-mark" />
                </div>
              )
            })}
          </div>
          <span className="party-race-track-flag">FINISH 🏁</span>
        </div>
      )}



      {phase === 'finished' && (
        <>
          <p className="party-race-finished">🏆 완주! 다른 플레이어를 기다리는 중...</p>
          {spectateTarget && spectatingId !== null ? (
            <div className="party-typerace-spectate">
              <div className="party-typerace-spectate-header">
                <span className="party-typerace-spectate-nickname">👀 {nicknameOf(spectatingId)}님이 치는 중</span>
                <button type="button" className="party-typerace-spectate-close" onClick={() => setSpectatingId(null)}>
                  닫기
                </button>
              </div>
              <p className="party-typerace-spectate-prompt">
                {spectateSentence.split('').map((char, i) => {
                  const stateClass =
                    i < spectateMatchedLen
                      ? 'party-typerace-char-correct'
                      : i === spectateMatchedLen && spectateTarget.typed.length > spectateMatchedLen
                        ? 'party-typerace-char-wrong'
                        : i === spectateMatchedLen
                          ? 'party-typerace-char-cursor'
                          : ''
                  return (
                    <span key={i} className={`party-typerace-char ${stateClass}`.trim()}>
                      {char}
                    </span>
                  )
                })}
              </p>
              <div className="party-typerace-input party-typerace-input-readonly">{spectateTarget.typed}</div>
            </div>
          ) : (
            <p className="party-typerace-waiting">위 트랙에서 아직 달리는 사람의 색을 눌러 구경해보세요.</p>
          )}
        </>
      )}
    </div>
  )
}
