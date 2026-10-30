import { useEffect, useRef, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { useStroopRound } from './useStroopRound'
import { STROOP_COLORS, type StroopQuestionSignal } from './protocol'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  signal: StroopQuestionSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function StroopGame({ socket, roundKey, signal, playerId, players }: Props) {
  const { startedAt, answeredIds, iAnswered, locked, wrongChoice, result, canChoose, choose } = useStroopRound(socket, roundKey, signal, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const playRef = useRef<HTMLDivElement>(null)

  // 손가락으로 쓰는 기기(모바일)에서는 문제가 시작될 때 글자와 보기가 한 화면에 보이도록 위치를 맞춘다 (움직임을 줄이는 설정이면 바로 옮긴다)
  const questionIndex = signal?.questionIndex
  useEffect(() => {
    if (questionIndex === undefined || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [questionIndex, roundKey])

  if (!signal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const totals = result?.totals ?? signal.totals
  const isInk = signal.type === 'ink'
  // 글자를 눌러서 답하는 유형(보기 색 동그라미가 없는 유형)
  const isTap = !isInk
  const isChain = signal.type === 'chain' || signal.type === 'chainRev'
  const colorName = (index: number) => STROOP_COLORS[index]?.name ?? '?'
  const colorValue = (index: number) => STROOP_COLORS[index]?.value ?? '#111'
  // 두 단계 유형에서 거쳐 가는 글자(첫 단계에서 찾는 글자) — chain은 물어본 글자, chainRev는 그 색으로 칠해진 글자
  const viaIndex = signal.type === 'chain' ? signal.target : signal.type === 'chainRev' ? signal.words.findIndex((w) => w.ink === signal.target) : -1
  const colorChip = (index: number) => (
    <strong style={{ color: colorValue(index) }} className="party-stroop-prompt-color">
      {colorName(index)}
    </strong>
  )
  // 묻는 말 — 유형마다 다르다
  const prompt = (() => {
    switch (signal.type) {
      case 'ink':
        return (
          <>
            <strong>‘{colorName(signal.words[signal.target].nameColor)}’</strong>이라고 적힌 글자의 <strong>색</strong>은?
          </>
        )
      case 'word':
        return (
          <>
            {colorChip(signal.target)}으로 쓰인 <strong>글자</strong>를 누르세요!
          </>
        )
      case 'chain':
        return (
          <>
            <strong>‘{colorName(signal.words[signal.target].nameColor)}’</strong>이라고 적힌 글자의 <strong>색과 같은 이름</strong>의 글자를 누르세요!
          </>
        )
      case 'chainRev':
        return (
          <>
            {colorChip(signal.target)}으로 칠해진 글자가 <strong>말하는 색</strong>으로 칠해진 글자를 누르세요!
          </>
        )
    }
  })()

  const hint = (() => {
    if (result) {
      const mine = result.results.find((r) => r.playerId === playerId)
      return mine?.answeredMs != null ? `맞혔어요! +${mine.points}점` : '아쉽게도 못 맞혔어요... 0점'
    }
    if (iAnswered) return '맞혔어요! 다른 사람을 기다리는 중...'
    if (locked) return '틀렸어요! 잠깐 기다리세요...'
    if (isChain) return '두 단계예요! 먼저 한 글자를 찾고, 거기서 이어지는 글자를 누르세요.'
    return isInk ? '글자의 뜻이 아니라 칠해진 색을 보세요!' : '글자의 뜻이 아니라 칠해진 색을 보고 찾으세요!'
  })()

  return (
    <div className="party-round-stage party-stroop-stage">
      <div ref={playRef} className="party-stroop-play">
        <p className="party-stroop-round">
          {signal.questionIndex + 1} <span className="party-stroop-round-max">/ {signal.totalQuestions} 문제</span>
        </p>
        {startedAt !== null && !result && <RemainingTime startedAt={startedAt} timeoutMs={signal.timeoutMs} />}

        <ul className="party-stroop-players">
          {players.map((player) => (
            <li key={player.id} className={player.id === playerId ? 'party-stroop-player-me' : ''}>
              <span>
                {answeredIds.includes(player.id) ? '✅' : '🎨'} {nicknameOf(player.id)}
                {player.id === playerId && ' (나)'}
              </span>
              <span>{totals[player.id] ?? 0}점</span>
            </li>
          ))}
        </ul>

        <p className="party-stroop-prompt">{prompt}</p>

        {/* 글자 칩은 밝은 회색 바탕 위에 칠해서 어떤 색이든(검정 포함) 두 모드에서 똑같이 보인다 */}
        <div className={`party-stroop-words${locked ? ' party-stroop-words-locked' : ''}`}>
          {signal.words.map((word, index) => {
            const isAnswer = result !== null && isTap && index === result.answer
            const isVia = result !== null && isChain && index === viaIndex
            return (
              <button
                key={index}
                type="button"
                className={[
                  'party-stroop-word',
                  isTap ? 'party-stroop-word-tappable' : '',
                  isVia ? 'party-stroop-word-via' : '',
                  isAnswer ? 'party-stroop-word-answer' : '',
                  isTap && wrongChoice === index && locked ? 'party-stroop-word-wrong' : '',
                  result !== null && isTap && !isAnswer && !isVia ? 'party-stroop-word-dim' : '',
                ].join(' ')}
                style={{ color: colorValue(word.ink) } as CSSProperties}
                disabled={isInk || !canChoose}
                onClick={() => choose(index)}
              >
                {colorName(word.nameColor)}
              </button>
            )
          })}
        </div>

        {isInk && (
          <div className={`party-stroop-options${locked ? ' party-stroop-words-locked' : ''}`} role="group" aria-label="색 고르기">
            {signal.options.map((color) => {
              const isAnswer = result !== null && color === result.answer
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={colorName(color)}
                  className={[
                    'party-stroop-swatch',
                    isAnswer ? 'party-stroop-swatch-answer' : '',
                    wrongChoice === color && locked ? 'party-stroop-swatch-wrong' : '',
                    result !== null && !isAnswer ? 'party-stroop-word-dim' : '',
                  ].join(' ')}
                  style={{ background: colorValue(color) }}
                  disabled={!canChoose}
                  onClick={() => choose(color)}
                />
              )
            })}
          </div>
        )}

        <p className={`party-round-hint party-stroop-hint${locked ? ' party-stroop-hint-wrong' : ''}`}>{hint}</p>

        {result && (
          <ul className="party-stroop-result">
            {[...result.results]
              .sort((a, b) => (a.answeredMs ?? Infinity) - (b.answeredMs ?? Infinity))
              .map((r) => (
                <li key={r.playerId} className={r.playerId === playerId ? 'party-stroop-player-me' : ''}>
                  <span>
                    {r.answeredMs !== null ? '✅' : '❌'} {nicknameOf(r.playerId)}
                  </span>
                  <span>{r.answeredMs !== null ? `${(r.answeredMs / 1000).toFixed(2)}초 · +${r.points}점` : '못 맞힘'}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
