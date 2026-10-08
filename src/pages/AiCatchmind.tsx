import { useRef, useState } from 'react'
import { BRUSH_THIN, CatchmindToolbar } from '../components/CatchmindToolbar'
import { RemainingTime } from '../components/party/RemainingTime'
import { RulesBox } from '../components/RulesBox'
import { SoloIntro } from '../components/SoloIntro'
import { useAiCatchmind } from '../hooks/useAiCatchmind'
import { useCanvasPointerDrawing } from '../hooks/useCanvasPointerDrawing'
import { DOODLE_CLASSES } from '../lib/doodleLabels'
import type { DoodleGuess } from '../lib/doodleNet'
import { CATCHMIND_COLORS, CATCHMIND_TURN_TIMEOUT_MS } from '../lib/partyProtocol'

const nameOf = (classIndex: number) => DOODLE_CLASSES[classIndex][1]
const percent = (probability: number) => `${Math.round(probability * 100)}%`

/** 1순위 확신도에 따라 AI가 하는 한마디 */
function aiLine(guesses: DoodleGuess[]): string {
  const [first, second] = guesses
  if (!first) return '그림을 그려주세요! 👀'
  if (first.probability < 0.25) return '음... 잘 모르겠어요 🤔 조금 더 그려주세요!'
  // 2순위는 어느 정도 그럴듯할 때만 같이 언급한다 — 3%짜리 후보를 "아니면?" 하고 꺼내면 어색하다
  if (first.probability < 0.5 && second && second.probability >= 0.15)
    return `혹시 ${nameOf(first.index)}? 아니면 ${nameOf(second.index)}...?`
  if (first.probability < 0.5) return `음... ${nameOf(first.index)}...?`
  if (first.probability < 0.8) return `${nameOf(first.index)} 같은데요?`
  return `${nameOf(first.index)}! 이건 확실해요!`
}

export function AiCatchmind() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useAiCatchmind(canvasRef)
  const { phase, prompt, lastResult } = game
  const [color, setColor] = useState(CATCHMIND_COLORS[0])
  const [width, setWidth] = useState(BRUSH_THIN)

  const drawingProps = useCanvasPointerDrawing(canvasRef, phase === 'drawing', {
    onBegin: (point) => game.beginStroke(color, width, point),
    onMove: game.continueStroke,
    onEnd: () => {},
  })

  const isPlaying = (phase === 'drawing' || phase === 'revealed') && prompt !== undefined

  return (
    <section className="game-page game-page-fill">
      <h1 className="page-title">🎨 AI 캐치마인드</h1>

      {phase === 'intro' && game.modelStatus === 'loading' && <p className="aicm-message">AI를 깨우는 중... 🤖</p>}
      {phase === 'intro' && game.modelStatus === 'error' && (
        <div className="banner banner-lost">
          <p className="banner-answer">AI 모델을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해주세요.</p>
          <button type="button" className="btn btn-primary" onClick={game.retryModel}>
            다시 불러오기
          </button>
        </div>
      )}
      {phase === 'intro' && game.modelStatus === 'ready' && (
        <SoloIntro onStart={game.start}>
          제시어 <strong>{game.total}개</strong>를 그려서 AI에게 맞혀보게 하세요!
          {game.bestScore > 0 && (
            <>
              <br />내 최고기록은 <strong>{game.bestScore}점</strong>이에요.
            </>
          )}
        </SoloIntro>
      )}

      {isPlaying && (
        <div className="aicm-stage">
          <div className="aicm-status">
            <span>
              문제 <strong>{game.index + 1}</strong> / {game.total}
            </span>
            <span>
              점수 <strong>{game.totalScore}</strong>
            </span>
          </div>

          {phase === 'drawing' && game.startedAt !== null && (
            <RemainingTime key={game.index} startedAt={game.startedAt} timeoutMs={CATCHMIND_TURN_TIMEOUT_MS} />
          )}

          <p className="party-catchmind-word">제시어: {nameOf(prompt)}</p>

          <canvas ref={canvasRef} className="party-catchmind-board party-catchmind-board-drawable" {...drawingProps} />

          {phase === 'drawing' && (
            <>
              <div className="aicm-ai" aria-live="polite">
                <span className="aicm-ai-avatar" aria-hidden="true">
                  🤖
                </span>
                <div className="aicm-ai-bubble">
                  <p className="aicm-ai-line">{aiLine(game.guesses)}</p>
                  {game.guesses.length > 0 && (
                    <ol className="aicm-guesses">
                      {game.guesses.map((g) => (
                        <li key={g.index}>
                          {nameOf(g.index)} <span className="aicm-guess-percent">{percent(g.probability)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              <CatchmindToolbar
                color={color}
                width={width}
                onColorChange={setColor}
                onWidthChange={setWidth}
                onUndo={game.undoStroke}
                onClear={game.clearBoard}
              />
              <button type="button" className="btn btn-secondary aicm-giveup" onClick={game.giveUp}>
                포기하기
              </button>
            </>
          )}

          {phase === 'revealed' && lastResult && (
            <div className={`banner ${lastResult.correct ? 'banner-won' : 'banner-lost'} aicm-reveal`}>
              <p className="banner-title">
                {lastResult.correct ? `🤖 "${nameOf(prompt)}!" AI가 맞혔어요! +${lastResult.score}점 🎉` : 'AI가 못 맞혔어요 😢'}
              </p>
              {!lastResult.correct && game.guesses[0] && (
                <p className="banner-answer">AI는 마지막에 {nameOf(game.guesses[0].index)}(이)라고 생각했어요.</p>
              )}
              <button type="button" className="btn btn-primary" onClick={game.next} autoFocus>
                {game.index + 1 < game.total ? '다음 문제' : '결과 보기'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <div className="banner banner-won">
          <p className="banner-title">
            총점 {game.totalScore}점{game.isNewBest && ' · 최고기록 달성! 🏆'}
          </p>
          <p className="banner-answer">
            {game.results.filter((r) => r.correct).length} / {game.total}개 성공 · 최고기록 {game.bestScore}점
          </p>
          <ul className="aicm-results">
            {game.results.map((r) => (
              <li key={r.prompt} className={r.correct ? 'aicm-result-correct' : 'aicm-result-wrong'}>
                <img src={r.snapshot} alt={`${nameOf(r.prompt)} 그림`} />
                <span className="aicm-result-word">{nameOf(r.prompt)}</span>
                <span className="aicm-result-detail">
                  {r.correct && r.elapsedMs !== null ? `${(r.elapsedMs / 1000).toFixed(1)}초 · +${r.score}점` : '실패 · 0점'}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={game.start} autoFocus>
            다시 하기
          </button>
        </div>
      )}

      <RulesBox
        summary={
          <>
            제시어를 그리면 <strong>AI가 실시간으로 추측</strong>해요. AI의 1순위 추측이 제시어가 되면 성공! 한 판은{' '}
            <strong>{game.total}문제</strong>, 문제당 <strong>60초</strong>예요.
            <br />
            AI가 빨리 맞힐수록 점수가 높아요(최대 100점). AI는 색은 보지 않고 선의 모양만 봐요 — 특징을 살려 간단하게
            그릴수록 잘 맞혀요. AI는 내 브라우저 안에서만 돌아서 그림이 어디로도 전송되지 않아요.
          </>
        }
      />
    </section>
  )
}
