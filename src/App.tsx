import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { NumberBaseball } from './pages/NumberBaseball'
import { HangulBaseball } from './pages/HangulBaseball'
import { BlackJack } from './pages/BlackJack'
import { ChoseongQuiz } from './pages/ChoseongQuiz'
import { AiCatchmind } from './pages/AiCatchmind'
import { MouseHunterSpotsDebug } from './pages/MouseHunterSpotsDebug'
import { PartyGame } from './pages/PartyGame'
import { PartyRoom } from './pages/PartyRoom'
import { ThemeToggle } from './components/ThemeToggle'
import { useVisualViewportTop } from './hooks/useVisualViewportTop'

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
