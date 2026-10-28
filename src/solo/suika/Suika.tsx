import { useRef } from 'react'
import { RulesBox } from '../../shared/components/RulesBox'
import { SoloIntro } from '../shared/SoloIntro'
import { FRUITS } from './fruits'
import { useSuika } from './useSuika'

export function Suika() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useSuika(canvasRef)
  const { phase } = game

  return (
    <section className="game-page game-page-fill">
      <h1 className="page-title">🍉 수박게임</h1>

      {phase === 'intro' && (
        <SoloIntro onStart={game.start}>
          같은 과일끼리 합쳐 <strong>수박</strong>을 만들어보세요!
          {game.bestScore > 0 && (
            <>
              <br />내 최고기록은 <strong>{game.bestScore}점</strong>이에요.
            </>
          )}
        </SoloIntro>
      )}

      {phase !== 'intro' && (
        <div className="sk-stage">
          <div className="sk-status">
            <span>
              점수 <strong>{game.score}</strong>
            </span>
            <span>
              최고기록 <strong>{game.bestScore}</strong>
            </span>
          </div>

          <canvas ref={canvasRef} className="sk-board" {...game.boardProps} />

          {phase === 'finished' && (
            <div className="banner banner-lost">
              <p className="banner-title">
                게임 오버! 총점 {game.score}점{game.isNewBest && ' · 최고기록 달성! 🏆'}
              </p>
              <button type="button" className="btn btn-primary" onClick={game.start} autoFocus>
                다시 하기
              </button>
            </div>
          )}
        </div>
      )}

      <RulesBox
        summary={
          <>
            마우스를 움직이거나 터치한 채 옮겨 위치를 잡고, <strong>클릭하거나 손을 떼면</strong> 과일이 떨어져요. 같은
            과일 둘이 닿으면 다음 단계 과일로 합쳐져요.
            <br />
            <span className="sk-chain" aria-label={FRUITS.map((f) => f.name).join(' → ')}>
              {FRUITS.map((fruit, level) => (
                <span key={fruit.name} className="sk-chain-dot" title={fruit.name} style={{ background: fruit.color, borderColor: fruit.dark }}>
                  {level === FRUITS.length - 1 ? '🍉' : ''}
                </span>
              ))}
            </span>
            <br />
            과일이 위쪽 점선 위로 <strong>2초 넘게</strong> 쌓여 있으면 게임이 끝나요. 큰 과일을 만들수록 점수가 높고,
            수박끼리 만나면 둘 다 사라지며 보너스 점수를 줘요.
          </>
        }
      />
    </section>
  )
}
