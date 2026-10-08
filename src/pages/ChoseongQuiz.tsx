import { RemainingTime } from '../components/party/RemainingTime'
import { RulesBox } from '../components/RulesBox'
import { useChoseongQuiz } from '../hooks/useChoseongQuiz'
import { WORD_CHAIN_ROUND_TIMEOUT_MS } from '../lib/partyProtocol'

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`

export function ChoseongQuiz() {
  const quiz = useChoseongQuiz()
  const { phase, current, lastResult } = quiz

  return (
    <section className="game-page game-page-fill">
      <h1 className="page-title">ㄱㄴㄷ 초성 퀴즈</h1>

      {phase === 'loading' && <p className="cq-message">문제를 불러오는 중...</p>}

      {phase === 'error' && (
        <div className="banner banner-lost">
          <p className="banner-answer">문제를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>
          <button type="button" className="btn btn-primary" onClick={quiz.restart}>
            다시 불러오기
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <div className="cq-intro">
          <p className="cq-message">
            초성 <strong>{quiz.total}문제</strong>에 도전해보세요!
            {quiz.bestScore > 0 && (
              <>
                <br />내 최고기록은 <strong>{quiz.bestScore}점</strong>이에요.
              </>
            )}
          </p>
          <button type="button" className="btn btn-primary" onClick={quiz.start} autoFocus>
            시작하기
          </button>
        </div>
      )}

      {(phase === 'playing' || phase === 'revealed') && current && (
        <div className="cq-stage">
          <div className="cq-status">
            <span>
              문제 <strong>{quiz.index + 1}</strong> / {quiz.total}
            </span>
            <span>
              점수 <strong>{quiz.totalScore}</strong>
            </span>
          </div>

          {phase === 'playing' && quiz.startedAt !== null && (
            <RemainingTime key={quiz.index} startedAt={quiz.startedAt} timeoutMs={WORD_CHAIN_ROUND_TIMEOUT_MS} />
          )}

          <div className="cq-chosung">
            {current.chosung.map((c, i) => (
              <span key={i} className="cq-chosung-cell">
                {c}
              </span>
            ))}
          </div>

          {phase === 'playing' && (
            <>
              <div className="cq-hints">
                <p>
                  카테고리: <strong>{quiz.hintLevel >= 1 ? current.category : '???'}</strong>
                </p>
                <p>
                  뜻: <strong>{quiz.hintLevel >= 2 ? current.definition : '???'}</strong>
                </p>
              </div>

              <form
                className="cq-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  quiz.submit()
                }}
              >
                <input
                  type="text"
                  className={`cq-input${quiz.isWrong ? ' cq-input-shake' : ''}`}
                  value={quiz.guess}
                  onChange={(e) => quiz.setGuess(e.target.value)}
                  placeholder="정답을 입력하세요"
                  aria-label="정답 입력"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary">
                  제출
                </button>
              </form>
              <button type="button" className="btn btn-secondary cq-pass" onClick={quiz.pass}>
                패스
              </button>
            </>
          )}

          {phase === 'revealed' && lastResult && (
            <div className={`banner ${lastResult.correct ? 'banner-won' : 'banner-lost'} cq-reveal`}>
              <p className="banner-title">
                {lastResult.correct ? `정답! +${lastResult.score}점 🎉` : '아쉬워요 😢'}
              </p>
              <p className="banner-answer">
                정답은 <strong>{current.word}</strong> ({current.category})
              </p>
              <p className="cq-definition">{current.definition}</p>
              <button type="button" className="btn btn-primary" onClick={quiz.next} autoFocus>
                {quiz.index + 1 < quiz.total ? '다음 문제' : '결과 보기'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <div className="banner banner-won">
          <p className="banner-title">
            총점 {quiz.totalScore}점{quiz.isNewBest && ' · 최고기록 달성! 🏆'}
          </p>
          <p className="banner-answer">
            {quiz.results.filter((r) => r.correct).length} / {quiz.total}문제 정답 · 최고기록 {quiz.bestScore}점
          </p>
          <ol className="cq-results">
            {quiz.results.map((r) => (
              <li key={r.word}className={r.correct ? 'cq-result-correct' : 'cq-result-wrong'}>
                <span className="cq-result-word">{r.word}</span>
                <span className="cq-result-detail">
                  {r.correct && r.elapsedMs !== null ? `${formatSeconds(r.elapsedMs)} · +${r.score}점` : '실패 · 0점'}
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-primary" onClick={quiz.restart} autoFocus>
            다시 하기
          </button>
        </div>
      )}

      <RulesBox
        summary={
          <>
            초성을 보고 정답 단어를 맞혀보세요. 한 판은 <strong>{quiz.total || 10}문제</strong>, 문제당 제한시간은{' '}
            <strong>60초</strong>예요.
            <br />
            10초 뒤엔 <strong>카테고리</strong>, 20초 뒤엔 <strong>뜻</strong>이 힌트로 공개돼요. 빨리 맞힐수록 점수가 높고(최대
            100점), 틀려도 몇 번이든 다시 입력할 수 있어요. 모르겠으면 <strong>패스</strong>!
          </>
        }
      />
    </section>
  )
}
