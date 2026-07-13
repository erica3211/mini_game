import { Link } from 'react-router-dom'

const games = [
  {
    path: '/number-baseball',
    emoji: '⚾',
    title: '숫자야구',
    description: '서로 다른 세 자리 숫자를 5번 안에 맞혀보세요.',
  },
  {
    path: '/hangul-baseball',
    emoji: '🇰🇷',
    title: '한글야구',
    description: '자음·모음 5개로 이루어진 조합을 5번 안에 맞혀보세요.',
  },
  {
    path: '/black-jack',
    emoji: '🂡🂢🂣',
    title: '블랙잭',
    description: '21에 가장 가까운 숫자를 만들어 5명의 딜러를 파산시켜보세요.',
  },
] as const

export function Home() {
  return (
    <section>
      <h1 className="page-title">미니게임 모음집</h1>
      <p className="page-subtitle">하고 싶은 게임을 골라보세요!</p>
      <div className="game-grid">
        {games.map((game) => (
          <Link key={game.path} to={game.path} className="game-card">
            <span className="game-emoji">{game.emoji}</span>
            <span className="game-title">{game.title}</span>
            <span className="game-description">{game.description}</span>
          </Link>
        ))}
        <div className="game-card game-card-soon">
          <span className="game-emoji">🎮</span>
          <span className="game-title">다음 게임</span>
          <span className="game-description">준비 중이에요.</span>
        </div>
      </div>
    </section>
  )
}
