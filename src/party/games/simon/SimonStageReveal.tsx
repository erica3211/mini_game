import type { SimonStageResult } from '../../../shared/lib/partyProtocol'
import { SIMON_CLIENT_TYPES } from './simonInputTypes'
import { SimonChip } from './SimonPad'

interface Props {
  result: SimonStageResult
  nicknameOf: (playerId: string) => string
}

/** 단계 하나의 정답과 참가자별 입력을 위치별로 비교해서 보여준다 (게임 화면의 공개 단계와 결과 화면에서 같이 쓴다) */
export function SimonStageReveal({ result, nicknameOf }: Props) {
  const { inputType, sequence } = result
  return (
    <div className="party-simon-reveal">
      <div className="party-simon-reveal-header">
        <span>
          {result.stageIndex + 1}단계 · {SIMON_CLIENT_TYPES[inputType].icon} {SIMON_CLIENT_TYPES[inputType].title}
          {result.groupLabel ? ` (${result.groupLabel})` : ''} · {sequence.length}개
        </span>
      </div>
      <p className="party-simon-reveal-label">정답</p>
      <div className="party-simon-chips" aria-label="정답">
        {sequence.map((symbol, i) => (
          <SimonChip key={i} inputType={inputType} symbolKey={symbol} />
        ))}
      </div>
      <ul className="party-simon-reveal-players">
        {Object.entries(result.players)
          .sort(([, a], [, b]) => b.score - a.score)
          .map(([playerId, player]) => (
            <li key={playerId}>
              <div className="party-simon-reveal-player-head">
                <span>{nicknameOf(playerId)}</span>
                <span>
                  {player.answer === null
                    ? '미제출 · 0점'
                    : `${player.correct}/${sequence.length} 정답 · ${((player.elapsedMs ?? 0) / 1000).toFixed(1)}초 · ${player.score}점`}
                </span>
              </div>
              {player.answer !== null && (
                <div className="party-simon-chips">
                  {sequence.map((symbol, i) =>
                    player.answer![i] === undefined ? (
                      <span key={i} className="party-simon-chip party-simon-chip-wrong">
                        ?
                      </span>
                    ) : (
                      <SimonChip key={i} inputType={inputType} symbolKey={player.answer![i]} wrong={player.answer![i] !== symbol} />
                    ),
                  )}
                </div>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}
