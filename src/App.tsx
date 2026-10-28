import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { NumberBaseball } from './solo/numberBaseball/NumberBaseball'
import { HangulBaseball } from './solo/hangulBaseball/HangulBaseball'
import { BlackJack } from './solo/blackjack/BlackJack'
import { ChoseongQuiz } from './solo/choseongQuiz/ChoseongQuiz'
import { AiCatchmind } from './solo/aiCatchmind/AiCatchmind'
import { MouseHunterSpotsDebug } from './party/games/mouseHunter/MouseHunterSpotsDebug'
import { PartyGame } from './party/core/PartyGame'
import { PartyRoom } from './party/core/PartyRoom'
import { ThemeToggle } from './shared/components/ThemeToggle'
import { useVisualViewportTop } from './shared/hooks/useVisualViewportTop'

export function App() {
  useVisualViewportTop()

  return (
    <BrowserRouter>
      <header className="site-header">
        <Link to="/" className="site-logo">
          🎮 미니게임
        </Link>
        <ThemeToggle />
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/number-baseball" element={<NumberBaseball />} />
          <Route path="/hangul-baseball" element={<HangulBaseball />} />
          <Route path="/black-jack" element={<BlackJack />} />
          <Route path="/choseong-quiz" element={<ChoseongQuiz />} />
          <Route path="/catchmind" element={<AiCatchmind />} />
          <Route path="/party" element={<PartyGame />} />
          <Route path="/party/:roomCode" element={<PartyRoom />} />
          <Route path="/dev/mouse-spots" element={<MouseHunterSpotsDebug />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
