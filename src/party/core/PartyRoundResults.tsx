import { useState } from 'react'
import type { GameSession } from './useGameSession'
import { formatWon, signClass } from '../games/auction/auctionFormat'
import { pickAuctionFlavors } from '../games/auction/auctionItems'
import { colorMatchGradeOf, rgbToCss } from '../games/colorMatch/colorMath'
import { type AcrosticRoundMeta } from '../games/acrostic/protocol'
import { auctionItemNumber, type AuctionRoundMeta } from '../games/auction/protocol'
import { type BalloonPopRoundMeta } from '../games/balloonPop/protocol'
import { type CatchmindRoundMeta } from '../games/catchmind/protocol'
import { type ColorMatchRoundMeta } from '../games/colorMatch/protocol'
import { type LiarQuizRoundMeta } from '../games/liarQuiz/protocol'
import { type MinorityRoundMeta } from '../games/minority/protocol'
import { type PixelCanvasRoundMeta } from '../games/pixelCanvas/protocol'
import { type ScavengerHuntRoundMeta } from '../games/scavengerHunt/protocol'
import { SIMON_STAGES, type SimonRoundMeta } from '../games/simon/protocol'
import { type TelepathyRoundMeta } from '../games/telepathy/protocol'
import { type TelestrationRoundMeta } from '../games/telestration/protocol'
import { type TypeRaceRoundMeta } from '../games/typeRace/protocol'
import { type WordChainRoundMeta } from '../games/wordChain/protocol'
import { CatchmindSnapshot } from '../games/catchmind/CatchmindSnapshot'
import { LiarQuizTurnCard } from '../games/liarQuiz/LiarQuizTurnCard'
import { PartyExitToLobbyButton } from './PartyExitToLobbyButton'
import { PartyScoreList } from './PartyScoreList'
import { teamColorClass, teamEmoji } from './PartyTeamBanner'
import { teamScoreRows } from './teamUtils'
import { PartySubRoundCarousel } from './PartySubRoundCarousel'
import { PartySubRoundPager } from './PartySubRoundPager'
import { PixelCanvasSnapshot } from '../games/pixelCanvas/PixelCanvasSnapshot'
import { SimonStageReveal } from '../games/simon/SimonStageReveal'
import { FourCharsRecap } from '../games/fourChars/FourCharsRecap'
import type { FourCharsRoundMeta } from '../games/fourChars/protocol'
import { TelestrationStepCard } from '../games/telestration/TelestrationStepCard'

interface Props {
  session: GameSession
}

export function PartyRoundResults({ session }: Props) {
  const state = session.roomState!
  const lastRound = state.roundHistory[state.roundHistory.length - 1]
  // colorMatch/scavengerHunt처럼 서브라운드가 여러 개인 게임의 결과를 한 번에 하나씩만 보여줄 때 쓰는 페이지
  // 인덱스 — 라운드마다 이 컴포넌트가 새로 마운트되므로(phase가 round_active로 나갔다 돌아옴) 항상 1라운드로 초기화된다
  const [subRoundPage, setSubRoundPage] = useState(0)
  // 팀전이면 이름 앞에 그 사람의 팀 색을 붙여 누가 어느 팀인지 한눈에 보이게 한다
  const teamOfPlayer = (playerId: string) => lastRound.teams?.find((team) => team.memberIds.includes(playerId))
  const plainNicknameOf = (playerId: string) => state.players.find((p) => p.id === playerId)?.nickname ?? '???'
  const nicknameOf = (playerId: string) => {
    const name = state.players.find((p) => p.id === playerId)?.nickname ?? '???'
    const team = teamOfPlayer(playerId)
    return team ? `${teamEmoji(team.id)} ${name}` : name
  }
  const isLastRound = state.currentRoundIndex + 1 >= state.config.totalRounds
  const wordChainMeta = lastRound.gameId === 'wordChain' ? (lastRound.meta as WordChainRoundMeta | undefined) : undefined
  const auctionMeta = lastRound.gameId === 'auction' ? (lastRound.meta as AuctionRoundMeta | undefined) : undefined
  // 베팅 화면과 같은 roundKey로 시드를 고정해야 그때 봤던 물품 이름/이미지가 결과 화면에서도 그대로 재현된다
  const auctionFlavors = auctionMeta ? pickAuctionFlavors(`${lastRound.roundIndex}-${lastRound.gameId}`) : null
  const colorMatchMeta = lastRound.gameId === 'colorMatch' ? (lastRound.meta as ColorMatchRoundMeta | undefined) : undefined
  const pixelCanvasMeta =
    lastRound.gameId === 'pixelCanvas' ? (lastRound.meta as PixelCanvasRoundMeta | undefined) : undefined
  const balloonPopMeta = lastRound.gameId === 'balloonPop' ? (lastRound.meta as BalloonPopRoundMeta | undefined) : undefined
  const scavengerHuntMeta =
    lastRound.gameId === 'scavengerHunt' ? (lastRound.meta as ScavengerHuntRoundMeta | undefined) : undefined
  const telepathyMeta = lastRound.gameId === 'telepathy' ? (lastRound.meta as TelepathyRoundMeta | undefined) : undefined
  const acrosticMeta = lastRound.gameId === 'acrostic' ? (lastRound.meta as AcrosticRoundMeta | undefined) : undefined
  const liarQuizMeta = lastRound.gameId === 'liarQuiz' ? (lastRound.meta as LiarQuizRoundMeta | undefined) : undefined
  const minorityMeta = lastRound.gameId === 'minority' ? (lastRound.meta as MinorityRoundMeta | undefined) : undefined
  const simonMeta = lastRound.gameId === 'simon' ? (lastRound.meta as SimonRoundMeta | undefined) : undefined
  const fourCharsMeta = lastRound.gameId === 'fourChars' ? (lastRound.meta as FourCharsRoundMeta | undefined) : undefined
  const catchmindMeta = lastRound.gameId === 'catchmind' ? (lastRound.meta as CatchmindRoundMeta | undefined) : undefined
  const typeRaceMeta = lastRound.gameId === 'typeRace' ? (lastRound.meta as TypeRaceRoundMeta | undefined) : undefined
  const telestrationMeta =
    lastRound.gameId === 'telestration' ? (lastRound.meta as TelestrationRoundMeta | undefined) : undefined

  const detailOf = (entry: (typeof lastRound.ranking)[number]) => {
    if (entry.disconnected) return ' (연결 끊김)'
    if (lastRound.gameId === 'oneToTwentyFive' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}개 터치)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완료)`
    }
    if (lastRound.gameId === 'shoutRace' && entry.value !== undefined) {
      return entry.dnf ? ` (${entry.value}% 도달)` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완주)`
    }
    if (lastRound.gameId === 'typeRace' && entry.value !== undefined) {
      const avgCpm = typeRaceMeta?.avgCpm[entry.playerId]
      const cpmText = avgCpm !== undefined ? `, 평균 ${avgCpm}타/분` : ''
      return entry.dnf ? ` (${entry.value}% 타이핑${cpmText})` : ` (${(entry.value / 1000).toFixed(2)}초 만에 완주${cpmText})`
    }
    // 픽셀 캔버스는 oneToTwentyFive처럼 dnf(한 칸도 못 칠함)여도 차지한 칸 수를 그대로 보여준다
    if (lastRound.gameId === 'pixelCanvas' && entry.value !== undefined) {
      return ` (${entry.value}칸 차지)`
    }
    // 쥐 세 끼도 pixelCanvas처럼 연속 동작이라 dnf(한 마리도 못 잡음)여도 잡은 수를 그대로 보여준다
    if (lastRound.gameId === 'mouseHunter' && entry.value !== undefined) {
      return ` (${entry.value}마리 잡음)`
    }
    if (entry.dnf) return ' (미제출)'
    if (lastRound.gameId === 'humanTimer' && entry.value !== undefined) {
      return ` (${(entry.value / 1000).toFixed(2)}초에 정지)`
    }
    if (lastRound.gameId === 'wordChain' && entry.value !== undefined) {
      return ` (${(entry.value / 1000).toFixed(2)}초 만에 정답)`
    }
    if (lastRound.gameId === 'auction' && entry.value !== undefined) {
      return ` (총자산 ${formatWon(entry.value)})`
    }
    if (lastRound.gameId === 'colorMatch' && entry.value !== undefined) {
      return ` (합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'scavengerHunt' && entry.value !== undefined) {
      return ` (3라운드 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'telepathy' && entry.value !== undefined) {
      return ` (${telepathyMeta?.subRounds.length ?? 3}라운드 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'acrostic' && entry.value !== undefined) {
      return ` (받은 표 ${entry.value}표)`
    }
    if (lastRound.gameId === 'liarQuiz' && entry.value !== undefined) {
      return ` (${liarQuizMeta?.turns.length ?? 0}턴 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'minority' && entry.value !== undefined) {
      return ` (${minorityMeta?.subRounds.length ?? 5}라운드 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'simon' && entry.value !== undefined) {
      return ` (${simonMeta?.stages.length ?? SIMON_STAGES}단계 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'fourChars' && entry.value !== undefined) {
      return ` (정답 ${entry.value}개)`
    }
    if (lastRound.gameId === 'catchmind' && entry.value !== undefined) {
      return ` (전체 턴 합산 ${entry.value}점)`
    }
    if (lastRound.gameId === 'telestration' && entry.value !== undefined) {
      return ` (받은 표 ${entry.value}표)`
    }
    return ''
  }

  const scavengerHuntTargetLabel = (target: { mode: string; object?: { label: string }; color?: { label: string } }) => {
    if (target.mode === 'object' && target.object) return `📦 ${target.object.label}`
    if (target.mode === 'color' && target.color) return `🎨 ${target.color.label}`
    return ''
  }

  const roundEntries = [...lastRound.ranking]
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => ({
      id: entry.playerId,
      label: `${entry.rank}위 ${nicknameOf(entry.playerId)}${detailOf(entry)}`,
      points: entry.points,
    }))

  // 팀전이면 같은 팀 사람은 같은 등수·점수라서, 아무 팀원의 기록을 팀의 기록으로 쓴다
  const roundTeams = lastRound.teams ?? []
  const teamName = (teamId: number) => roundTeams.find((team) => team.id === teamId)?.name ?? '팀'
  const teamStandings = roundTeams
    .map((team) => {
      const entry = lastRound.ranking.find((e) => team.memberIds.includes(e.playerId))
      return { team, rank: entry?.rank ?? roundTeams.length, score: entry?.value ?? 0, points: entry?.points ?? 0 }
    })
    .sort((a, b) => a.rank - b.rank || a.team.id - b.team.id)
    // 개인 등수(4명 중 3위 등)가 아니라 팀끼리의 등수로 다시 매긴다 — 같은 점수는 공동 등수
    .map((row, _index, rows) => ({ ...row, rank: rows.findIndex((other) => other.rank === row.rank) + 1 }))

  // 팀전은 팀이 유지되니 누적 점수도 팀 단위로 보여준다
  const showTeamCumulative = roundTeams.length > 0
  const teamCumulativeEntries = teamScoreRows(roundTeams, state.scores).map(({ team, rank, score }) => ({
    id: String(team.id),
    label: `${rank}위 ${teamEmoji(team.id)} ${team.name} (${team.memberIds.map((id) => state.players.find((p) => p.id === id)?.nickname ?? '???').join(', ')})`,
    points: score,
  }))

  const cumulativeEntries = [...state.players]
    .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
    .map((p) => ({ id: p.id, label: nicknameOf(p.id), points: state.scores[p.id] ?? 0 }))

  return (
    <section className="game-page">
      <div>
        <PartyExitToLobbyButton session={session} />  
      </div>
      <div className="party-page-header">
        <h1 className="page-title">{state.currentRoundIndex + 1}라운드 결과</h1>
      </div>

      {wordChainMeta && (
        <div className="party-wordchain-answer">
          <p>
            정답: <strong>{wordChainMeta.word}</strong> ({wordChainMeta.category})
          </p>
          <p className="party-wordchain-answer-definition">{wordChainMeta.definition}</p>
        </div>
      )}

      {wordChainMeta?.guesses && (
        <ul className="party-wordchain-guesses">
          {[...lastRound.ranking]
            .sort((a, b) => a.rank - b.rank)
            .map((entry) => {
              const playerGuesses = wordChainMeta.guesses?.[entry.playerId] ?? []
              return (
                <li key={entry.playerId}>
                  <span className="party-wordchain-guesses-name">{nicknameOf(entry.playerId)}</span>
                  {playerGuesses.length === 0 ? (
                    <span className="party-wordchain-guesses-empty">입력 없음</span>
                  ) : (
                    <ol>
                      {playerGuesses.map((guess, i) => (
                        <li
                          key={i}
                          className={guess === wordChainMeta.word ? 'party-wordchain-guesses-correct' : undefined}
                        >
                          {guess}
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
        </ul>
      )}

      {auctionMeta && auctionFlavors && (
        <div className="party-auction-reveal">
          {auctionMeta.items.map((item) => (
            <div
              className={`party-auction-reveal-item${item.winnerPlayerId === session.playerId ? ' party-auction-reveal-item-won' : ''}`}
              key={item.itemId}
            >
              <img
                className="party-auction-reveal-image"
                src={auctionFlavors[item.itemId].image}
                alt={auctionFlavors[item.itemId].name}
              />
              <div className="party-auction-reveal-body">
                <div className="party-auction-reveal-header">
                  <span>
                    {auctionItemNumber(item.itemId)}. {auctionFlavors[item.itemId].name}
                  </span>
                  <strong className={signClass(item.value)}>{formatWon(item.value)}</strong>
                </div>
                <p className="party-auction-reveal-winner">
                  {item.winnerPlayerId ? `🏆 낙찰: ${nicknameOf(item.winnerPlayerId)}` : '유찰 (아무도 못 가져감)'}
                </p>
                <ul className="party-auction-reveal-bids">
                  {Object.entries(item.bids)
                    .filter(([, amount]) => amount > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([playerId, amount]) => (
                      <li key={playerId}>
                        {nicknameOf(playerId)}: {formatWon(amount)}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {colorMatchMeta && (
        <div className="party-colormatch-reveal">
          <PartySubRoundPager current={subRoundPage} total={colorMatchMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {colorMatchMeta.subRounds.map((subRound) => (
              <div className="party-colormatch-reveal-item" key={subRound.subRoundIndex}>
                <div className="party-colormatch-reveal-header">
                  <span>{subRound.subRoundIndex + 1}번 문제</span>
                  <div className="party-colormatch-reveal-answer" style={{ background: rgbToCss(subRound.answerColor) }} />
                </div>
                <ul className="party-colormatch-reveal-picks">
                  {Object.entries(subRound.picks)
                    .sort(([, a], [, b]) => b.matchPercent - a.matchPercent)
                    .map(([playerId, pick]) => (
                      <li key={playerId}>
                        <div className="party-colormatch-reveal-pick-color" style={{ background: rgbToCss(pick.color) }} />
                        <span>
                          {nicknameOf(playerId)}: {pick.matchPercent}% ({colorMatchGradeOf(pick.matchPercent)})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {pixelCanvasMeta && <PixelCanvasSnapshot meta={pixelCanvasMeta} />}

      {balloonPopMeta && (
        <ul className="party-balloonpop-reveal">
          {[...balloonPopMeta.results]
            .sort((a, b) => b.pumps - a.pumps)
            .map((r) => (
              <li key={r.playerId}>
                <span>{nicknameOf(r.playerId)}</span>
                <span className="party-balloonpop-reveal-detail">
                  {r.status === 'popped' && `💥 ${r.pumps}번에서 터짐`}
                  {r.status === 'stopped' && `🛑 ${r.pumps}번에서 멈춤 (사실 ${r.threshold}번까지 버틸 수 있었어요)`}
                  {r.status === 'alive' && '⏱️ 결정 못 함'}
                </span>
              </li>
            ))}
        </ul>
      )}

      {scavengerHuntMeta && (
        <div className="party-scavengerhunt-reveal">
          <PartySubRoundPager current={subRoundPage} total={scavengerHuntMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {scavengerHuntMeta.subRounds.map((subRound) => (
              <div className="party-scavengerhunt-reveal-item" key={subRound.subRoundIndex}>
                <div className="party-scavengerhunt-reveal-header">
                  <span>{subRound.subRoundIndex + 1}번 문제</span>
                  <span>{scavengerHuntTargetLabel(subRound.target)}</span>
                </div>
                <ul className="party-scavengerhunt-reveal-picks">
                  {Object.entries(subRound.picks)
                    .sort(([, a], [, b]) => b.roundScore - a.roundScore)
                    .map(([playerId, pick]) => (
                      <li key={playerId}>
                        {pick.photo ? (
                          <img src={pick.photo} alt="" className="party-scavengerhunt-reveal-thumb" />
                        ) : (
                          <span className="party-scavengerhunt-reveal-thumb party-scavengerhunt-reveal-thumb-empty">📷</span>
                        )}
                        <span>
                          {nicknameOf(playerId)}: {pick.submitted ? `일치율 ${pick.matchPercent}% · ${pick.roundScore}점` : '미제출 · 0점'}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {telepathyMeta && (
        <div className="party-telepathy-reveal">
          {roundTeams.length > 0 && (
            <p className="party-team-note">점수 기준: 팀원 모두가 같은 카드를 고른 팀만 점수를 받아요. 한 명이라도 다르면 0점이에요.</p>
          )}
          <PartySubRoundPager current={subRoundPage} total={telepathyMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {telepathyMeta.subRounds.map((subRound) => (
              <div className="party-telepathy-reveal-item" key={subRound.subRoundIndex}>
                <div className="party-telepathy-reveal-header">
                  <span>{subRound.subRoundIndex + 1}번 문제</span>
                  <span>{subRound.prompt}</span>
                </div>
                {subRound.teams && (
                  <ul className="party-team-standings">
                    {subRound.teams.map((result) => (
                      <li key={result.teamId} className={`party-team-standing ${teamColorClass(result.teamId)}`}>
                        <div className="party-team-standing-head">
                          <span>
                            {teamEmoji(result.teamId)} {teamName(result.teamId)}
                          </span>
                          <span>{result.unanimous ? `✅ 만장일치 +${result.points}점` : '❌ 의견이 갈렸어요'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="party-telepathy-reveal-picks">
                  {Object.entries(subRound.picks)
                    .sort(([, a], [, b]) => b.score - a.score)
                    .map(([playerId, pick]) => (
                      <li key={playerId}>
                        {nicknameOf(playerId)}:{' '}
                        {pick.cardId === null
                          ? '미제출 · 0점'
                          : `${subRound.cards.find((card) => card.id === pick.cardId)?.label ?? '?'} · ${pick.score}점`}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {acrosticMeta && (
        <div className="party-acrostic-reveal">
          <p className="party-acrostic-reveal-word">
            제시어 <strong>{acrosticMeta.word}</strong>
          </p>
          <ul className="party-acrostic-reveal-poems">
            {acrosticMeta.poems.map((poem) => (
              <li className="party-acrostic-reveal-poem" key={poem.playerId}>
                <div className="party-acrostic-reveal-header">
                  <span>{nicknameOf(poem.playerId)}</span>
                  <span>👍 {poem.votes}표</span>
                </div>
                {poem.lines.map((line, i) => (
                  <span className="party-acrostic-poem-line" key={i}>
                    <strong>{[...line][0]}</strong>
                    {[...line].slice(1).join('')}
                  </span>
                ))}
                {poem.voterIds.length > 0 && (
                  <span className="party-acrostic-reveal-voters">투표: {poem.voterIds.map(nicknameOf).join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {liarQuizMeta && liarQuizMeta.turns.length > 0 && (
        <div className="party-telepathy-reveal">
          <PartySubRoundPager current={subRoundPage} total={liarQuizMeta.turns.length} onChange={setSubRoundPage} unit="턴" />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {liarQuizMeta.turns.map((turn) => (
              <div className="party-telepathy-reveal-item" key={turn.turnIndex}>
                <LiarQuizTurnCard result={turn} nicknameOf={nicknameOf} />
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {minorityMeta && (
        <div className="party-telepathy-reveal">
          <PartySubRoundPager current={subRoundPage} total={minorityMeta.subRounds.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {minorityMeta.subRounds.map((subRound) => (
              <div className="party-telepathy-reveal-item" key={subRound.subRoundIndex}>
                <div className="party-telepathy-reveal-header">
                  <span>{subRound.subRoundIndex + 1}번 문제</span>
                  <span>{subRound.options.map((option) => option.label).join(' vs ')}</span>
                </div>
                <ul className="party-telepathy-reveal-picks">
                  {Object.entries(subRound.picks)
                    .sort(([, a], [, b]) => b.score - a.score)
                    .map(([playerId, pick]) => (
                      <li key={playerId}>
                        {nicknameOf(playerId)}:{' '}
                        {pick.choice === null
                          ? '미제출 · 0점'
                          : `${subRound.options.find((option) => option.id === pick.choice)?.label ?? '?'} · ${pick.score}점`}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {simonMeta && simonMeta.stages.length > 0 && (
        <div className="party-telepathy-reveal">
          <PartySubRoundPager current={subRoundPage} total={simonMeta.stages.length} onChange={setSubRoundPage} unit="단계" />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {simonMeta.stages.map((stage) => (
              <div className="party-telepathy-reveal-item" key={stage.stageIndex}>
                <SimonStageReveal result={stage} nicknameOf={nicknameOf} />
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {fourCharsMeta && fourCharsMeta.turns.length > 0 && (
        <FourCharsRecap meta={fourCharsMeta} teams={roundTeams} nicknameOf={plainNicknameOf} />
      )}

      {catchmindMeta?.teamTurns && (
        <div className="party-catchmind-reveal">
          <p className="party-team-note">
            점수 기준: 먼저 맞힌 팀이 팀 수({roundTeams.length}팀)만큼의 점수를 받고, 다음 팀부터 1점씩 줄어요. 못 맞히면 0점이에요.
          </p>
          <PartySubRoundPager current={subRoundPage} total={catchmindMeta.teamTurns.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {catchmindMeta.teamTurns.map((turn) => (
              <div className="party-catchmind-reveal-item" key={turn.turnIndex}>
                <div className="party-catchmind-reveal-header">
                  <span>{turn.turnIndex + 1}번째 턴</span>
                  <span>
                    정답: <strong>{turn.word}</strong>
                  </span>
                </div>
                {/* 먼저 맞힌 팀(점수가 높은 팀)이 위에 오고, 못 맞힌 팀은 맨 아래 */}
                {[...turn.teams]
                  .sort((a, b) => b.points - a.points || a.teamId - b.teamId)
                  .map((teamTurn) => (
                  <div key={teamTurn.teamId} className={`party-catchmind-team-card ${teamColorClass(teamTurn.teamId)}`}>
                    <div className="party-catchmind-team-head">
                      <span className="party-catchmind-team-name">
                        {teamEmoji(teamTurn.teamId)} {teamName(teamTurn.teamId)}
                      </span>
                      <span className={`party-catchmind-team-points${teamTurn.solved ? '' : ' party-catchmind-team-points-none'}`}>
                        {teamTurn.solved ? `+${teamTurn.points}점` : '못 맞혔어요'}
                      </span>
                    </div>
                    <div className="party-catchmind-team-meta">
                      <span>🎨 {plainNicknameOf(teamTurn.drawerId)}</span>
                      {teamTurn.solved && (
                        <span>
                          ✅ {plainNicknameOf(teamTurn.solverId ?? '')} · {((teamTurn.elapsedMs ?? 0) / 1000).toFixed(1)}초
                        </span>
                      )}
                    </div>
                    <CatchmindSnapshot strokes={teamTurn.strokes} />
                  </div>
                ))}
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {catchmindMeta && !catchmindMeta.teamTurns && (
        <div className="party-catchmind-reveal">
          <PartySubRoundPager current={subRoundPage} total={catchmindMeta.turns.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {catchmindMeta.turns.map((turn) => (
              <div className="party-catchmind-reveal-item" key={turn.turnIndex}>
                <div className="party-catchmind-reveal-header">
                  <span>{nicknameOf(turn.drawerId)}님의 턴</span>
                  <span>
                    정답: <strong>{turn.word}</strong>
                  </span>
                </div>
                <CatchmindSnapshot strokes={turn.strokes} />
                <ul className="party-catchmind-reveal-picks">
                  <li>
                    출제자 {nicknameOf(turn.drawerId)}: {turn.drawerPoints}점
                  </li>
                  {turn.correctGuessers.length === 0 ? (
                    <li>아무도 못 맞혔어요</li>
                  ) : (
                    turn.correctGuessers.map((g, i) => (
                      <li key={g.playerId}>
                        {i + 1}등 {nicknameOf(g.playerId)}: {(g.elapsedMs / 1000).toFixed(2)}초 · {g.points}점
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {telestrationMeta && (
        <div className="party-catchmind-reveal">
          <PartySubRoundPager current={subRoundPage} total={telestrationMeta.chains.length} onChange={setSubRoundPage} />
          <PartySubRoundCarousel current={subRoundPage} onChange={setSubRoundPage}>
            {telestrationMeta.chains.map((chain) => (
              <div className="party-catchmind-reveal-item party-telestration-box" key={chain.initialWord}>
                <div className="party-catchmind-reveal-header">
                  <span>처음 제시어</span>
                  <strong>{chain.initialWord}</strong>
                </div>
                {chain.steps.map((step, s) => (
                  <TelestrationStepCard key={s} record={step} nickname={nicknameOf(step.playerId)} order={s + 1}>
                    {/* 투표는 그림에만 할 수 있으니, 글 단계에는 표 수를 보여주지 않는다 */}
                    {step.kind === 'draw' && <p className="party-round-hint">👍 {step.votes}표</p>}
                  </TelestrationStepCard>
                ))}
              </div>
            ))}
          </PartySubRoundCarousel>
        </div>
      )}

      {/* 팀전은 개인 목록 대신 팀 카드로 이번 라운드 점수를 보여준다 (카드 안에 팀원이 받은 점수도 있다) */}
      {roundTeams.length === 0 ? (
        <>
          <h2 className="party-section-title">이번 라운드 점수</h2>
          <PartyScoreList entries={roundEntries} badgeClass="badge-strike" />
        </>
      ) : (
        <>
          <h2 className="party-section-title">이번 라운드 점수</h2>
          <p className="party-team-note">합산 점수로 팀 순위가 정해지고, 순위에 따라 받는 점수(초록색)가 누적 점수에 더해져요.</p>
          {teamStandings.length > 0 && (
            <ul className="party-team-standings">
              {teamStandings.map(({ team, rank, score, points }) => (
                <li
                  key={team.id}
                  className={`party-team-standing ${teamColorClass(team.id)}${team.memberIds.includes(session.playerId ?? '') ? ' party-team-standing-mine' : ''}`}
                >
                  <div className="party-team-standing-head">
                    <span>
                      {rank}위 {teamEmoji(team.id)} {team.name} · 합산 {score}점
                    </span>
                    <span className="badge badge-strike">{points}점</span>
                  </div>
                  {/* 지금 팀전 게임은 점수가 팀 단위라 팀원별 점수는 보여주지 않는다. 팀원마다 점수가 다른 게임이 생기면
                      여기에 \`닉네임 (N점)\`을 붙이고 합산을 팀원 점수의 합으로 계산한다 */}
                  <div className="party-team-standing-mates">{team.memberIds.map(nicknameOf).join(', ')}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2 className="party-section-title">{showTeamCumulative ? '팀 누적 점수' : '누적 점수'}</h2>
      <PartyScoreList entries={showTeamCumulative ? teamCumulativeEntries : cumulativeEntries} />

      {session.isHost && (
        <button type="button" className="btn btn-primary" onClick={session.nextRound}>
          {isLastRound ? '최종 결과 보기' : '다음 라운드'}
        </button>
      )}
    </section>
  )
}
