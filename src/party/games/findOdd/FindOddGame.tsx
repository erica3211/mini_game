import { useEffect, useRef, type CSSProperties } from 'react'
import type { Socket } from 'socket.io-client'
import { useFindOddRound } from './useFindOddRound'
import { FIND_ODD_ROUND_MS, type FindOddRoundSignal } from './protocol'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  signal: FindOddRoundSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

export function FindOddGame({ socket, roundKey, signal, playerId, players }: Props) {
  const { startedAt, foundIds, iFound, locked, wrongIndex, result, canTap, tap } = useFindOddRound(socket, roundKey, signal, playerId)
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const playRef = useRef<HTMLDivElement>(null)

  // 손가락으로 쓰는 기기(모바일)에서는 라운드가 시작될 때 판이 한 화면에 보이도록 위치를 맞춘다 (움직임을 줄이는 설정이면 바로 옮긴다)
  const roundIndex = signal?.roundIndex
  useEffect(() => {
    if (roundIndex === undefined || !window.matchMedia('(pointer: coarse)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    playRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [roundIndex, roundKey])

  if (!signal) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  const myResult = result?.results.find((r) => r.playerId === playerId)
  const totals = result?.totals ?? signal.totals

  const hint = (() => {
    if (result) return myResult?.foundMs != null ? `찾았어요! +${myResult.points}점` : '아쉽게도 못 찾았어요... 0점'
    if (iFound) return '찾았어요! 다른 사람을 기다리는 중...'
    if (locked) return '틀렸어요! 잠깐 기다리세요...'
    return '모양이 다른 글자 하나를 찾아 누르세요!'
  })()

  return (
    <div className="party-round-stage party-odd-stage">
      <div ref={playRef} className="party-odd-play">
        <p className="party-odd-round">
          {signal.roundIndex + 1} <span className="party-odd-round-max">/ {signal.totalRounds} 라운드</span>
        </p>
        {startedAt !== null && !result && <RemainingTime startedAt={startedAt} timeoutMs={FIND_ODD_ROUND_MS} />}

        <ul className="party-odd-players">
          {players.map((player) => (
            <li key={player.id} className={player.id === playerId ? 'party-odd-player-me' : ''}>
              <span>
                {foundIds.includes(player.id) ? '✅' : '🔎'} {nicknameOf(player.id)}
                {player.id === playerId && ' (나)'}
              </span>
              <span>{totals[player.id] ?? 0}점</span>
            </li>
          ))}
        </ul>

        <div
          className={`party-odd-grid${locked ? ' party-odd-grid-locked' : ''}`}
          style={{ '--odd-cols': signal.cols } as CSSProperties}
          role="group"
          aria-label="글자 판"
        >
          {signal.cells.map((cell, index) => {
            const isAnswer = result !== null && index === result.answerIndex
            return (
              <button
                key={index}
                type="button"
                className={[
                  'party-odd-cell',
                  isAnswer ? 'party-odd-cell-answer' : '',
                  wrongIndex === index && locked ? 'party-odd-cell-wrong' : '',
                  result !== null && !isAnswer ? 'party-odd-cell-dim' : '',
                ].join(' ')}
                disabled={!canTap}
                onClick={() => tap(index)}
              >
                {cell}
              </button>
            )
          })}
        </div>

        <p className={`party-round-hint party-odd-hint${locked ? ' party-odd-hint-wrong' : ''}`}>{hint}</p>

        {result && (
          <ul className="party-odd-result">
            {[...result.results]
              .sort((a, b) => (a.foundMs ?? Infinity) - (b.foundMs ?? Infinity))
              .map((r) => (
                <li key={r.playerId} className={r.playerId === playerId ? 'party-odd-player-me' : ''}>
                  <span>
                    {r.foundMs !== null ? '✅' : '❌'} {nicknameOf(r.playerId)}
                  </span>
                  <span>{r.foundMs !== null ? `${(r.foundMs / 1000).toFixed(2)}초 · +${r.points}점` : '못 찾음'}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
