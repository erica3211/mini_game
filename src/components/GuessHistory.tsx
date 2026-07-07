import type { GuessRecord } from '../hooks/useBaseballGame'

interface Props {
  history: GuessRecord[]
  /** badges: 1S 1B 배지 표시(숫자야구) / tiles: 자리별 색깔 타일(한글야구) */
  display?: 'badges' | 'tiles'
  /** tiles 모드에서 추측을 읽을 수 있는 글자로 함께 표시 (ㄱㅏㅣㅁㅣ → 개미) */
  formatGuess?: (guess: string[]) => string
}

function ResultBadges({ strike, ball }: { strike: number; ball: number }) {
  if (strike === 0 && ball === 0) {
    return <span className="badge badge-out">OUT</span>
  }
  return (
    <>
      {strike > 0 && <span className="badge badge-strike">{strike}S</span>}
      {ball > 0 && <span className="badge badge-ball">{ball}B</span>}
    </>
  )
}

export function GuessHistory({ history, display = 'badges', formatGuess }: Props) {
  if (history.length === 0) {
    return <p className="history-empty">아직 시도한 기록이 없어요.</p>
  }
  return (
    <ol className="history">
      {history.map((record, i) => (
        <li key={i} className="history-row">
          <span className="history-turn">{i + 1}회</span>
          {display === 'tiles' ? (
            <>
              <span className="history-tiles">
                {record.guess.map((symbol, j) => (
                  <span key={j} className={`tile tile-${record.marks[j]}`}>
                    {symbol}
                  </span>
                ))}
              </span>
              {formatGuess && <span className="history-word">{formatGuess(record.guess)}</span>}
            </>
          ) : (
            <>
              <span className="history-guess">{record.guess.join(' ')}</span>
              <span className="history-result">
                <ResultBadges strike={record.strike} ball={record.ball} />
              </span>
            </>
          )}
        </li>
      ))}
    </ol>
  )
}
