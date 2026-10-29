import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { EmojiPicker } from './EmojiPicker'
import {
  EMOJI_CHARADES_PLAY_MS,
  EMOJI_CHARADES_SELECT_MS,
  type EmojiCharadesViewState,
} from './protocol'
import {
  type ClientToServerEvents,
  type PlayerInfo,
  type ServerToClientEvents,
  type TeamInfo,
} from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji, teamOf } from '../../core/PartyTeamBanner'
import { useMonotonicStartedAt } from '../../core/useMonotonicStartedAt'
import { RemainingTime } from '../../../shared/components/RemainingTime'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  state: EmojiCharadesViewState | null
  playerId: string | null
  players: PlayerInfo[]
  /** 이번 라운드의 팀 배정 */
  teams: TeamInfo[]
}

export function EmojiCharadesGame({ socket, roundKey, state, playerId, players, teams }: Props) {
  const nicknameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '???'
  const select = state?.select ?? null
  const start = state?.start ?? null
  const end = state?.end ?? null

  const selectStartedAt = useMonotonicStartedAt(`${roundKey}-select`, select, start ? 'finished' : 'running')
  const playStartedAt = useMonotonicStartedAt(`${roundKey}-play`, start, end ? 'finished' : 'running')

  // 지원 체크 — 서버가 아는 값(새로고침 복원)으로 시작하고, 누를 때마다 바로 서버에 알린다
  const [want, setWant] = useState(false)
  useEffect(() => {
    if (select) setWant(select.want)
  }, [select])
  const toggleWant = (next: boolean) => {
    setWant(next)
    socket.emit('emojiCharades:volunteer', { want: next })
  }

  const [guess, setGuess] = useState('')
  const chatLogRef = useRef<HTMLUListElement>(null)
  const chat = state?.chat ?? []
  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length])

  if (!state || (!select && !start)) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  // 1) 표현자를 정하는 5초
  if (!start && select) {
    return (
      <div className="party-round-stage">
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="이모티콘 표현자 정하기">
            <div className="modal-header">
              <h2 className="modal-title">이모티콘으로 표현해 볼래요? 😜</h2>
            </div>
            <p className="party-emojichar-select-text">
              체크하면 우리 팀의 표현자 후보가 돼요. 여러 명이 체크하면 그중 한 명이 무작위로 뽑히고, 아무도 체크하지 않으면 팀원 중 한 명이
              무작위로 정해져요.
            </p>
            <label className={`party-emojichar-volunteer${want ? ' party-emojichar-volunteer-on' : ''}`}>
              <input type="checkbox" checked={want} onChange={(event) => toggleWant(event.target.checked)} />
              <span>제가 이모티콘으로 표현할래요!</span>
            </label>
            <div className="party-emojichar-select-timer">
              {selectStartedAt !== null && <RemainingTime startedAt={selectStartedAt} timeoutMs={EMOJI_CHARADES_SELECT_MS} />}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!start) return null

  const myTeam = teamOf(teams, playerId)
  const isExpresser = playerId !== null && Object.values(start.expresserIds).includes(playerId)
  const myTeamExpresserId = myTeam ? start.expresserIds[myTeam.id] : undefined
  const emojis = state.emojis
  const full = emojis.length >= start.maxEmojis
  const playing = end === null

  const submitGuess = (event: FormEvent) => {
    event.preventDefault()
    const text = guess.trim()
    if (!text || !playing || isExpresser) return
    socket.emit('emojiCharades:guess', { text })
    setGuess('')
  }

  const slots = Array.from({ length: start.maxEmojis }, (_, index) => emojis[index] ?? null)

  return (
    <div className="party-round-stage party-emojichar-stage">
      <ul className="party-emojichar-teams">
        {teams.map((team) => {
          const expresserId = start.expresserIds[team.id]
          return (
            <li key={team.id} className={`party-emojichar-team ${teamColorClass(team.id)}${team.id === myTeam?.id ? ' party-emojichar-team-mine' : ''}`}>
              <span>
                {teamEmoji(team.id)} {team.name}
              </span>
              <span className="party-emojichar-team-expresser">🎨 {expresserId ? nicknameOf(expresserId) : '?'}</span>
            </li>
          )
        })}
      </ul>

      <div className="party-emojichar-hints">
        <span className="party-emojichar-chip">분류 · {start.category}</span>
        {start.lengthHint !== null && <span className="party-emojichar-chip">{start.lengthHint}글자</span>}
        {start.chosungHint !== null && <span className="party-emojichar-chip">{start.chosungHint}</span>}
      </div>

      {playing && playStartedAt !== null && <RemainingTime startedAt={playStartedAt} timeoutMs={EMOJI_CHARADES_PLAY_MS} />}

      {isExpresser && start.word !== null && (
        <div className="party-emojichar-word">
          <p className="party-round-hint">제시어를 이모티콘만으로 표현하세요! (글자는 쓸 수 없어요)</p>
          <strong>{start.word}</strong>
        </div>
      )}
      {!isExpresser && playing && (
        <p className="party-round-hint">
          {myTeamExpresserId
            ? `${nicknameOf(myTeamExpresserId)}님의 이모티콘을 보고 정답을 채팅으로 맞혀 보세요!`
            : '이모티콘을 보고 정답을 채팅으로 맞혀 보세요!'}
        </p>
      )}

      <div className="party-emojichar-line" aria-live="polite" aria-label="우리 팀 이모티콘">
        {slots.map((emoji, index) => (
          <span key={index} className={`party-emojichar-slot${emoji ? '' : ' party-emojichar-slot-empty'}`}>
            {emoji}
          </span>
        ))}
      </div>
      <p className="party-emojichar-count">
        {emojis.length} / {start.maxEmojis}
      </p>

      {isExpresser && playing && (
        <>
          <div className="party-emojichar-tools">
            <button type="button" className="btn btn-secondary" onClick={() => socket.emit('emojiCharades:undo')} disabled={emojis.length === 0}>
              ⌫ 지우기
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => socket.emit('emojiCharades:clear')} disabled={emojis.length === 0}>
              🗑 모두 지우기
            </button>
          </div>
          <EmojiPicker onPick={(emoji) => socket.emit('emojiCharades:add', { emoji })} disabled={full} />
          {full && <p className="party-round-hint">이모티콘을 12개 모두 썼어요. 지우고 다시 골라 보세요.</p>}
        </>
      )}

      {end && (
        <div className={`party-emojichar-end ${end.winnerTeamId !== null ? 'party-emojichar-end-solved' : ''}`}>
          <p className="party-emojichar-end-title">
            {end.winnerTeamId !== null
              ? `🎉 ${teams.find((team) => team.id === end.winnerTeamId)?.name ?? '팀'}이 맞혔어요!`
              : '⏰ 아무도 못 맞혔어요'}
          </p>
          <p>
            정답은 <strong>{end.answer}</strong>
            {end.solverId && ` · 맞힌 사람 ${nicknameOf(end.solverId)}`}
          </p>
          <ul className="party-emojichar-end-teams">
            {end.teams.map((item) => (
              <li key={item.teamId} className={`party-emojichar-end-team ${teamColorClass(item.teamId)}`}>
                <span>
                  {teamEmoji(item.teamId)} {teams.find((team) => team.id === item.teamId)?.name} · {nicknameOf(item.expresserId)}
                </span>
                <span className="party-emojichar-end-emojis">{item.emojis.join('') || '(비어 있음)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="party-catchmind-chat">
        <ul ref={chatLogRef} className="party-catchmind-chat-log">
          <li className="party-catchmind-chat-line party-catchmind-chat-system">
            채팅은 모든 팀이 함께 봐요.
            <br />
            이모티콘을 보고 정답 같으면 입력해 보세요!
          </li>
          {chat.map((entry) => (
            <li key={entry.id} className="party-catchmind-chat-line">
              <strong>
                {teamEmoji(teamOf(teams, entry.playerId)?.id ?? 0)} {nicknameOf(entry.playerId)}
              </strong>
              : {entry.text}
            </li>
          ))}
        </ul>
        {!isExpresser && playing && (
          <form className="party-wordchain-form" onSubmit={submitGuess}>
            <input
              type="text"
              className="party-wordchain-input"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="정답을 채팅으로 입력하세요"
              maxLength={40}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={guess.trim().length === 0}>
              전송
            </button>
          </form>
        )}
        {isExpresser && playing && <p className="party-round-hint">표현자는 채팅을 칠 수 없어요. 이모티콘으로만 알려 주세요!</p>}
      </div>
    </div>
  )
}
