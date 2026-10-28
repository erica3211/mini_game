import { useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { TelestrationRevealSignal } from './useTelestrationDrawing'
import { type ClientToServerEvents, type PlayerId, type PlayerInfo, type ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { TELESTRATION_VOTE_TIMEOUT_MS } from './protocol'
import { PartySubRoundCarousel } from '../../core/PartySubRoundCarousel'
import { PartySubRoundPager } from '../../core/PartySubRoundPager'
import { RemainingTime } from '../../../shared/components/RemainingTime'
import { TelestrationStepCard } from './TelestrationStepCard'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  reveal: TelestrationRevealSignal
  playerId: PlayerId | null
  players: PlayerInfo[]
}

const voteKey = (chainIndex: number, stepIndex: number) => `${chainIndex}:${stepIndex}`

const REVEAL_INTERVAL_MS = 1000

/** 제시어(체인)는 옆으로 넘기고, 한 체인 안의 장면들은 "+ 더보기"를 한 번 누르면 1초에 하나씩 아래로 펼쳐진다.
 *  마음에 드는 그림에는 개수 제한 없이 투표할 수 있고(글과 내가 그린 그림 제외), 아무 그림에도 투표하지 않고 기권해도 투표를 마칠 수 있다 */
export function TelestrationVote({ socket, reveal, playerId, players }: Props) {
  const { chains } = reveal
  const [chainIndex, setChainIndex] = useState(0)
  // 체인별로 지금까지 펼친 장면 수 — 처음엔 제시어만 보이고 "+ 더보기"를 누를 때마다 한 장면씩 나온다
  const [shown, setShown] = useState<number[]>(() => chains.map(() => 0))
  const [myVotes, setMyVotes] = useState<Set<string>>(
    () => new Set(reveal.myVotes.map((v) => voteKey(v.chainIndex, v.stepIndex))),
  )
  const [counts, setCounts] = useState<number[][]>(reveal.counts)
  const [done, setDone] = useState(reveal.voteDone)
  const startedAt = useMemo(() => performance.now() - reveal.elapsedMs, [reveal])
  const revealTimers = useRef<Record<number, number>>({})
  const chainBoxRefs = useRef<(HTMLDivElement | null)[]>([])
  // 가장 최근에 장면이 펼쳐진 체인 — 새 장면이 나올 때마다 화면이 그 장면을 따라 내려가게 한다
  const lastRevealedChain = useRef<number | null>(null)

  useEffect(() => {
    const timers = revealTimers.current
    return () => Object.values(timers).forEach((id) => window.clearInterval(id))
  }, [])

  // 누군가 투표/취소할 때마다 서버가 방송하는 최신 표 수로 👍 숫자를 갱신한다
  useEffect(() => {
    const onCounts = (data: { counts: number[][] }) => setCounts(data.counts)
    socket.on('telestration:voteCounts', onCounts)
    return () => {
      socket.off('telestration:voteCounts', onCounts)
    }
  }, [socket])

  useEffect(() => {
    const c = lastRevealedChain.current
    if (c === null) return
    const cards = chainBoxRefs.current[c]?.querySelectorAll('.party-telestration-card')
    cards?.[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [shown])

  const nicknameOf = (id: PlayerId) => players.find((p) => p.id === id)?.nickname ?? '???'

  if (done) {
    return (
      <div className="party-round-stage">
        <div className="party-catchmind-reveal">
          <p>투표 완료! 다른 사람들을 기다리는 중...</p>
        </div>
      </div>
    )
  }

  // 첫 장면은 바로 보여주고, 나머지는 1초 간격으로 끝까지 이어서 펼친다
  const startReveal = (c: number) => {
    if (revealTimers.current[c] !== undefined) return
    const total = chains[c].steps.length
    let count = 0
    const step = () => {
      count += 1
      lastRevealedChain.current = c
      setShown((prev) => prev.map((n, i) => (i === c ? count : n)))
      return count >= total
    }
    if (step()) return
    revealTimers.current[c] = window.setInterval(() => {
      if (!step()) return
      window.clearInterval(revealTimers.current[c])
      delete revealTimers.current[c]
    }, REVEAL_INTERVAL_MS)
  }

  const toggleVote = (c: number, s: number) => {
    const key = voteKey(c, s)
    const voted = !myVotes.has(key)
    setMyVotes((prev) => {
      const next = new Set(prev)
      if (voted) next.add(key)
      else next.delete(key)
      return next
    })
    socket.emit('telestration:vote', { chainIndex: c, stepIndex: s, voted })
  }

  const finish = () => {
    socket.emit('telestration:voteDone')
    setDone(true)
  }

  return (
    <div className="party-round-stage">
      <div className="party-catchmind-header">
        <span>마음에 드는 그림에 투표하세요</span>
        <RemainingTime startedAt={startedAt} timeoutMs={TELESTRATION_VOTE_TIMEOUT_MS} />
      </div>

      <PartySubRoundPager current={chainIndex} total={chains.length} onChange={setChainIndex} unit="제시어" />
      <PartySubRoundCarousel current={chainIndex} onChange={setChainIndex}>
        {chains.map((chain, c) => {
          const shownCount = shown[c]
          return (
            <div
              className="party-telestration-chain party-telestration-box"
              key={c}
              ref={(el) => {
                chainBoxRefs.current[c] = el
              }}
            >
              <p className="party-telestration-instruction">처음 제시어</p>
              <p className="party-catchmind-word">{chain.initialWord}</p>

              {chain.steps.slice(0, shownCount).map((step, s) => {
                const mine = step.playerId === playerId
                const voted = myVotes.has(voteKey(c, s))
                return (
                  <TelestrationStepCard
                    key={s}
                    className="party-telestration-card-enter"
                    record={step}
                    nickname={nicknameOf(step.playerId)}
                    order={s + 1}
                  >
                    {/* 내가 그린 그림에는 투표할 수 없으므로 👍 버튼 자체를 보여주지 않는다 */}
                    {step.kind === 'draw' && !mine && (
                      <button
                        type="button"
                        className={`party-telestration-vote${voted ? ' party-telestration-vote-active' : ''}`}
                        onClick={() => toggleVote(c, s)}
                        title={voted ? '투표 취소' : '이 그림에 투표'}
                      >
                        <span aria-hidden>👍</span>
                        {(counts[c]?.[s] ?? 0) > 0 && <span>{counts[c][s]}</span>}
                      </button>
                    )}
                  </TelestrationStepCard>
                )
              })}

              {shownCount === 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => startReveal(c)}>
                  + 전체 보기
                </button>
              )}
            </div>
          )
        })}
      </PartySubRoundCarousel>

      {/* 투표 마치기와 기권은 서로 다른 버튼이다 — 같은 버튼이면 표를 안 준 채로 눌러 기권하는 일이 너무 쉬워진다.
          이미 표를 준 사람에게 기권은 의미가 없으니(눌러도 표는 그대로라 헷갈린다), 표가 하나라도 있으면 기권 버튼은 아예 숨긴다 */}
      <div className="party-telestration-vote-actions">
        <button type="button" className="btn btn-primary" onClick={finish} disabled={myVotes.size === 0}>
          투표 마치기 ({myVotes.size}표)
        </button>
        {myVotes.size === 0 && (
          <button type="button" className="btn btn-secondary" onClick={finish}>
            기권
          </button>
        )}
      </div>
    </div>
  )
}
