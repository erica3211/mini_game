import { ITEMS, STAGES, calculateScore, type Card, type ItemId } from '../lib/blackjack'
import { MIN_BET, useBlackjackGame } from '../hooks/useBlackjackGame'
import { BlackjackCard } from '../components/BlackjackCard'
import { RulesBox } from '../components/RulesBox'
import stage1Img from '../assets/dealers/stage_1.png'
import stage2Img from '../assets/dealers/stage_2.png'
import stage3Img from '../assets/dealers/stage_3.png'
import stage4Img from '../assets/dealers/stage_4.png'
import stage5Img from '../assets/dealers/stage_5.png'

type Game = ReturnType<typeof useBlackjackGame>

const MAX_INVENTORY = 3

const STAGE_IMAGES: Record<number, string> = {
  1: stage1Img,
  2: stage2Img,
  3: stage3Img,
  4: stage4Img,
  5: stage5Img,
}

function roundResultTitle(result: 'win' | 'lose' | 'push' | null): string {
  if (result === 'win') return '승리! 🎉'
  if (result === 'push') return '무승부'
  return '패배 😢'
}

function ShopScreen({ game }: { game: Game }) {
  const { state, stage, addBet, allIn, resetBet, buyItem, startRound } = game

  return (
    <div className="bj-screen">
      <div className="bj-status-bar">
        <span>
          STAGE <strong>{state.stage}</strong> / {STAGES.length}
        </span>
        <span>
          소지금 <strong>{state.money.toLocaleString()}만원</strong>
        </span>
      </div>

      <div className="bj-section">
        <h2 className="bj-section-title">👥 이번 스테이지의 적</h2>
        <div className="bj-enemy-row">
          <img className="bj-enemy-img" src={STAGE_IMAGES[state.stage]} alt={stage.dealerName} />
          <div>
            <p className="bj-enemy">
              <strong>{stage.dealerName}</strong>
              {stage.ability !== 'none' && <span className="bj-enemy-ability"> ({stage.abilityName})</span>}
            </p>
            <p className="bj-enemy-desc">{stage.description}</p>
          </div>
        </div>
      </div>

      <div className="bj-section">
        <h2 className="bj-section-title">🛒 암시장 상점 (최대 {MAX_INVENTORY}개 소지)</h2>
        <div className="bj-inventory-preview">
          <span className="bj-inventory-preview-label">소지한 아이템</span>
          {Array.from({ length: MAX_INVENTORY }, (_, i) => {
            const item = state.inventory[i]
            const config = item ? ITEMS.find((entry) => entry.id === item.id) : null
            return (
              <span key={i} className={`bj-slot ${config ? '' : 'bj-slot-empty'}`}>
                {config ? config.emoji : ''}
              </span>
            )
          })}
        </div>
        <div className="bj-shop-list">
          {ITEMS.map((item) => {
            const disabled = state.inventory.length >= MAX_INVENTORY || state.money < item.price
            return (
              <button
                key={item.id}
                type="button"
                className="bj-shop-item"
                disabled={disabled}
                onClick={() => buyItem(item.id)}
              >
                <span className="bj-shop-item-info">
                  <span className="bj-shop-item-name">
                    {item.emoji} {item.name}
                  </span>
                  <span className="bj-shop-item-desc">{item.description}</span>
                </span>
                <span className="bj-shop-item-price">{item.price.toLocaleString()}만원</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bj-section">
        <h2 className="bj-section-title">💰 판돈 배팅 (최소 {MIN_BET.toLocaleString()}만원)</h2>
        <p className="bj-bet-amount">
          현재 배팅금: <strong>{state.bet.toLocaleString()}만원</strong>
        </p>
        <div className="bj-bet-buttons">
          <button type="button" className="btn" onClick={() => addBet(1000)}>
            +1,000만원
          </button>
          <button type="button" className="btn" onClick={() => addBet(5000)}>
            +5,000만원
          </button>
          <button type="button" className="btn" onClick={allIn}>
            🔥 ALL-IN
          </button>
          <button type="button" className="btn" onClick={resetBet}>
            초기화({MIN_BET.toLocaleString()}만원)
          </button>
        </div>
      </div>

      <button type="button" className="btn btn-primary bj-start-btn" onClick={startRound}>
        ⚔️ 배팅 완료 및 게임 시작
      </button>
    </div>
  )
}

function TableScreen({ game }: { game: Game }) {
  const {
    state,
    stage,
    playerScore,
    dealerScore,
    hit,
    stand,
    removeCard,
    continueRound,
    useXray,
    useInsurance,
    usePickpocket,
    useCounter,
  } = game

  const dealerRevealed = state.phase === 'roundEnd' || state.xrayActive
  const dealerHiddenIndices = stage.ability === 'pokerface' ? [0, 1] : [1]
  const playerFogged = stage.ability === 'fog' && !state.xrayActive && state.phase === 'playing'
  const playerScoreLabel = playerFogged
    ? `${calculateScore(state.playerHand.slice(1))} + ?`
    : `${playerScore}점`

  const itemActions: Partial<Record<ItemId, () => void>> = {
    xray: useXray,
    insurance: useInsurance,
    pickpocket: usePickpocket,
    counter: useCounter,
  }

  return (
    <div className="bj-screen">
      <div className="bj-status-bar">
        <span>
          STAGE {state.stage} <strong>{stage.dealerName}</strong>
        </span>
        <span>
          💰 판돈 <strong>{state.bet.toLocaleString()}만원</strong>
        </span>
      </div>

      <div className="bj-table-area">
        <div className="bj-table-header">
          <span>👤 딜러의 테이블</span>
          <span>점수: {dealerRevealed ? dealerScore : '?'}</span>
        </div>
        <div className="bj-cards">
          {state.dealerHand.map((card, i) => (
            <BlackjackCard key={i} card={card} hidden={dealerHiddenIndices.includes(i) && !dealerRevealed} />
          ))}
        </div>
      </div>

      <div className="bj-notification">📣 {state.message}</div>

      <div className="bj-section">
        <h2 className="bj-section-title">🎒 내 인벤토리 (클릭 시 즉시 발동)</h2>
        {state.inventory.length === 0 ? (
          <p className="bj-empty">보유한 아이템이 없어요.</p>
        ) : (
          <div className="bj-inventory-bar">
            {state.inventory.map((invItem) => {
              const config = ITEMS.find((entry) => entry.id === invItem.id)!
              const action = itemActions[invItem.id]
              return (
                <button
                  key={invItem.uid}
                  type="button"
                  className={`bj-item-btn ${config.activation === 'passive' ? 'bj-item-passive' : ''}`}
                  disabled={config.activation === 'passive' || state.phase !== 'playing' || state.awaitingCardRemoval}
                  onClick={action}
                  title={config.description}
                >
                  {config.emoji} {config.name}
                  {config.activation === 'passive' && <span className="bj-item-tag">대기중</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="bj-table-area">
        <div className="bj-table-header">
          <span>🤠 플레이어의 테이블</span>
          <span>점수: {playerScoreLabel}</span>
        </div>
        <div className="bj-cards">
          {state.playerHand.map((card, i) =>
            state.awaitingCardRemoval ? (
              <button
                key={i}
                type="button"
                className="bj-card-remove-btn"
                onClick={() => removeCard(i)}
                title="이 카드를 제거합니다"
              >
                <BlackjackCard card={card} />
              </button>
            ) : (
              <BlackjackCard key={i} card={card} hidden={i === 0 && playerFogged} />
            ),
          )}
        </div>
      </div>

      {state.awaitingCardRemoval && (
        <div className="bj-card-removal-prompt">🛡️ 제거할 카드를 선택해주세요.</div>
      )}

      {state.phase === 'playing' && !state.awaitingCardRemoval && (
        <div className="bj-actions">
          <button type="button" className="btn bj-stand-btn" onClick={stand}>
            🛑 STAND (멈추기)
          </button>
          <button type="button" className="btn btn-primary bj-hit-btn" onClick={hit}>
            ➕ HIT (카드 받기)
          </button>
        </div>
      )}

      {state.phase === 'roundEnd' && (
        <div className={`banner ${state.roundResult === 'win' ? 'banner-won' : 'banner-lost'}`}>
          <p className="banner-title">
            {roundResultTitle(state.roundResult)}
          </p>
          <p className="banner-answer">{state.message}</p>
          <button type="button" className="btn btn-primary" onClick={continueRound}>
            확인
          </button>
        </div>
      )}
    </div>
  )
}

function GameOverScreen({ game }: { game: Game }) {
  return (
    <div className="banner banner-lost">
      <p className="banner-title">게임 오버 💸</p>
      <p className="banner-answer">
        소지금이 0만원이 되었습니다.
        <br />
        STAGE {game.state.stage}에서 파산했어요.
      </p>
      <button type="button" className="btn btn-primary" onClick={game.resetGame}>
        다시 시작
      </button>
    </div>
  )
}

function VictoryScreen({ game }: { game: Game }) {
  return (
    <div className="banner banner-won">
      <p className="banner-title">최종 승리! 🏆</p>
      <p className="banner-answer">
        5명의 딜러를 모두 물리쳤습니다!
        <br />
        최종 소지금 {game.state.money.toLocaleString()}만원
      </p>
      <button type="button" className="btn btn-primary" onClick={game.resetGame}>
        다시 시작
      </button>
    </div>
  )
}

const RULE_EXAMPLES: { my: Card[]; dealer: Card[]; result: 'win' | 'push' | 'lose'; desc: string }[] = [
  {
    my: [{ suit: '♦', rank: '10' }, { suit: '♠', rank: '7' }],
    dealer: [{ suit: '♣', rank: '9' }, { suit: '♥', rank: '8' }],
    result: 'push',
    desc: '점수가 같으면 무승부, 배팅금은 그대로 돌려받아요.',
  },
  {
    my: [{ suit: '♠', rank: 'K' }, { suit: '♥', rank: '6' }, { suit: '♦', rank: '4' }],
    dealer: [{ suit: '♣', rank: '10' }, { suit: '♠', rank: '9' }],
    result: 'win',
    desc: '내 점수가 더 높으면 승리!',
  },
  {
    my: [{ suit: '♥', rank: 'J' }, { suit: '♦', rank: '5' }, { suit: '♣', rank: '8' }],
    dealer: [{ suit: '♠', rank: '9' }, { suit: '♥', rank: '7' }],
    result: 'lose',
    desc: '21을 넘기면 버스트! 딜러 점수와 상관없이 무조건 패배예요.',
  },
  {
    my: [{ suit: '♦', rank: '9' }, { suit: '♣', rank: '7' }],
    dealer: [{ suit: '♠', rank: 'K' }, { suit: '♥', rank: '9' }, { suit: '♦', rank: '5' }],
    result: 'win',
    desc: '딜러가 버스트되면 내 점수가 낮아도 승리해요.',
  },
]

const RESULT_LABEL: Record<'win' | 'push' | 'lose', string> = { win: '승리', push: '무승부', lose: '패배' }

export function BlackJack() {
  const game = useBlackjackGame()
  const { state } = game

  return (
    <section className="game-page bj-page">
      <h1 className="page-title">🂡 블랙잭</h1>
      <RulesBox
        summary={
          <>
            카드 합이 <strong>21을 넘지 않는 선에서 최대한 21에 가깝게</strong> 만들어 딜러를 이겨보세요.<br /> <strong>J·Q·K</strong>는{' '}
            <strong>10</strong>, <strong>A</strong>는 <strong>1 또는 11</strong>(유리한 쪽)로 계산돼요.<br />  21을 넘기면 즉시{' '}
            <strong>버스트(패배)</strong>! <br /> 5단계에 걸쳐 딜러가 점점 강력한 특수 능력을 갖고, 매 스테이지 시작 전
            상점에서 아이템을 최대 3개까지 사서 대비할 수 있어요.<br />  소지금이 <strong>0원</strong>이 되면 즉시 게임
            오버, <strong>5스테이지</strong>를 모두 깨면 최종 승리예요!
          </>
        }
        example={
          <>
            <p className="rules-example-title">블랙잭 룰이 처음이라면? 대표적인 상황 4가지로 감을 잡아보세요.</p>
            <table className="rules-example-table">
              <colgroup>
                <col style={{ width: '23%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '40%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>내 카드</th>
                  <th>딜러 카드</th>
                  <th>결과</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {RULE_EXAMPLES.map((example, i) => (
                  <tr key={i}>
                    <td>
                      <div className="rules-example-cards">
                        {example.my.map((card, j) => (
                          <BlackjackCard key={j} card={card} size="sm" />
                        ))}
                      </div>
                      <div className="rules-example-score">{calculateScore(example.my)}점</div>
                    </td>
                    <td>
                      <div className="rules-example-cards">
                        {example.dealer.map((card, j) => (
                          <BlackjackCard key={j} card={card} size="sm" />
                        ))}
                      </div>
                      <div className="rules-example-score">{calculateScore(example.dealer)}점</div>
                    </td>
                    <td>
                      <span className={`badge badge-${example.result}`}>{RESULT_LABEL[example.result]}</span>
                    </td>
                    <td>{example.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        }
      />

      {state.phase === 'shop' && <ShopScreen game={game} />}
      {(state.phase === 'playing' || state.phase === 'roundEnd') && <TableScreen game={game} />}
      {state.phase === 'gameOver' && <GameOverScreen game={game} />}
      {state.phase === 'victory' && <VictoryScreen game={game} />}
    </section>
  )
}
