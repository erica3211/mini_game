import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { NumberBaseball } from './pages/NumberBaseball'
import { HangulBaseball } from './pages/HangulBaseball'
import { BlackJack } from './pages/BlackJack'
import { PartyGame } from './pages/PartyGame'
import { PartyRoom } from './pages/PartyRoom'

export function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <Link to="/" className="site-logo">
          🎮 미니게임
        </Link>
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/number-baseball" element={<NumberBaseball />} />
          <Route path="/hangul-baseball" element={<HangulBaseball />} />
          <Route path="/black-jack" element={<BlackJack />} />
          <Route path="/party" element={<PartyGame />} />
          <Route path="/party/:roomCode" element={<PartyRoom />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
