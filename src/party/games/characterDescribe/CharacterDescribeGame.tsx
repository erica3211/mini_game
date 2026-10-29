import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import {
  CHARACTER_MAX_LINE_LENGTH,
  CHARACTER_PLAY_MS,
  CHARACTER_SELECT_MS,
  type CharacterRejected,
  type CharacterViewState,
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
  state: CharacterViewState | null
  playerId: string | null
  players: PlayerInfo[]
  /** 이번 라운드의 팀 배정 */
  teams: TeamInfo[]
}

/** 설명이 막힌 이유를 설명자에게 보여줄 문장 */
function rejectedText(notice: CharacterRejected): string {
  if (notice.reason === 'rate') return '너무 빨라요! 1초 뒤에 다시 보내 주세요.'
  if (notice.reason === 'series') return `작품 이름('${notice.piece}')은 말할 수 없어요. 생김새나 성격, 특징으로 설명해 주세요!`
  return `캐릭터 이름의 일부('${notice.piece}')가 들어 있어서 보내지 못했어요. 생김새나 성격, 특징으로 설명해 주세요!`
}

export function CharacterDescribeGame({ socket, roundKey, state, playerId, players, teams }: Props) {
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
    socket.emit('characterDescribe:volunteer', { want: next })
  }

  const [text, setText] = useState('')
  const chatLogRef = useRef<HTMLUListElement>(null)
  const chat = state?.chat ?? []
  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length])

  // 설명이 막혔을 때 안내를 3초 동안 보여준다
  const notice = state?.notice ?? null
  const [shownNoticeSeq, setShownNoticeSeq] = useState(0)
  useEffect(() => {
    if (!notice) return
    setShownNoticeSeq(notice.seq)
    const timer = window.setTimeout(() => setShownNoticeSeq(0), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!state || (!select && !start)) {
    return (
      <div className="party-round-stage">
        <p className="party-round-hint">곧 시작합니다...</p>
      </div>
    )
  }

  // 1) 설명자를 정하는 5초
  if (!start && select) {
    return (
      <div className="party-round-stage">
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="캐릭터 설명자 정하기">
            <div className="modal-header">
              <h2 className="modal-title">캐릭터를 설명해 볼래요? 🧸</h2>
            </div>
            <p className="party-chardesc-select-text">
              체크하면 우리 팀의 설명자 후보가 돼요. 여러 명이 체크하면 그중 한 명이 무작위로 뽑히고, 아무도 체크하지 않으면 팀원 중 한 명이
              무작위로 정해져요.
            </p>
            <label className={`party-chardesc-volunteer${want ? ' party-chardesc-volunteer-on' : ''}`}>
              <input type="checkbox" checked={want} onChange={(event) => toggleWant(event.target.checked)} />
              <span>제가 설명할래요!</span>
            </label>
            <div className="party-chardesc-select-timer">
              {selectStartedAt !== null && <RemainingTime startedAt={selectStartedAt} timeoutMs={CHARACTER_SELECT_MS} />}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!start) return null

  const myTeam = teamOf(teams, playerId)
  const isDescriber = playerId !== null && Object.values(start.describerIds).includes(playerId)
  const myDescriberId = myTeam ? start.describerIds[myTeam.id] : undefined
  const playing = end === null
  const teamNameOf = (teamId: number) => teams.find((team) => team.id === teamId)?.name ?? '팀'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || !playing) return
    socket.emit(isDescriber ? 'characterDescribe:describe' : 'characterDescribe:guess', { text: value })
    setText('')
  }

  return (
    <div className="party-round-stage party-chardesc-stage">
      <ul className="party-chardesc-teams">
        {teams.map((team) => {
          const describerId = start.describerIds[team.id]
          return (
            <li key={team.id} className={`party-chardesc-team ${teamColorClass(team.id)}${team.id === myTeam?.id ? ' party-chardesc-team-mine' : ''}`}>
              <span>
                {teamEmoji(team.id)} {team.name}
              </span>
              <span className="party-chardesc-team-describer">🗣 {describerId ? nicknameOf(describerId) : '?'}</span>
            </li>
          )
        })}
      </ul>

      <div className="party-chardesc-hints">
        <span className="party-chardesc-chip">분류 · {start.category}</span>
        {start.lengthHint !== null && <span className="party-chardesc-chip">{start.lengthHint}글자</span>}
        {start.chosungHint !== null && <span className="party-chardesc-chip">{start.chosungHint}</span>}
      </div>

      {playing && playStartedAt !== null && <RemainingTime startedAt={playStartedAt} timeoutMs={CHARACTER_PLAY_MS} />}

      {isDescriber && start.word !== null && (
        <div className="party-chardesc-word">
          <p className="party-round-hint">이름을 말하지 않고 생김새·성격·특징 등 뭐든 설명하세요! (이름·이름 일부·작품 이름은 쓸 수 없어요)</p>
          <strong>{start.word}</strong>
        </div>
      )}
      {!isDescriber && playing && (
        <p className="party-round-hint">
          {myDescriberId
            ? `${nicknameOf(myDescriberId)}님의 설명을 보고 어떤 캐릭터인지 채팅으로 맞혀 보세요!`
            : '설명을 보고 어떤 캐릭터인지 채팅으로 맞혀 보세요!'}
        </p>
      )}

      {end && (
        <div className={`party-chardesc-result${end.winnerTeamId === null ? ' party-chardesc-result-none' : ''}`}>
          <p className="party-chardesc-result-title">
            {end.winnerTeamId !== null ? `🎉 ${teamNameOf(end.winnerTeamId)}이 맞혔어요!` : '⏰ 아무도 못 맞혔어요'}
          </p>
          <p>
            정답은 <strong>{end.answer}</strong> ({end.category})
            {end.solverId && ` · 맞힌 사람 ${nicknameOf(end.solverId)}`}
          </p>
          <ul className="party-chardesc-result-teams">
            {end.teams.map((item) => (
              <li key={item.teamId} className={`party-chardesc-result-team ${teamColorClass(item.teamId)}`}>
                <strong>
                  {teamEmoji(item.teamId)} {teamNameOf(item.teamId)} · {nicknameOf(item.describerId)}
                </strong>
                {item.descriptions.length === 0 ? <span>(설명 없음)</span> : item.descriptions.map((line, index) => <span key={index}>{line}</span>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="party-catchmind-chat">
        <ul ref={chatLogRef} className="party-catchmind-chat-log party-chardesc-chat-log">
          <li className="party-catchmind-chat-line party-catchmind-chat-system">
            설명은 같은 팀에게만 보이고, 오답 채팅은 모든 팀이 함께 봐요.
          </li>
          {chat.map((entry) =>
            entry.kind === 'desc' ? (
              <li key={entry.id} className="party-catchmind-chat-line party-chardesc-line-desc">
                📣 <strong>{nicknameOf(entry.playerId)}</strong>: {entry.text}
              </li>
            ) : (
              <li key={entry.id} className="party-catchmind-chat-line">
                <strong>
                  {teamEmoji(entry.teamId)} {nicknameOf(entry.playerId)}
                </strong>
                : {entry.text}
              </li>
            ),
          )}
        </ul>

        {playing && (
          <form className="party-wordchain-form" onSubmit={submit}>
            <input
              type="text"
              className="party-wordchain-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={isDescriber ? '생김새나 성격, 특징을 설명하세요 (이름은 쓰면 안 돼요)' : '캐릭터 이름을 입력하세요'}
              maxLength={CHARACTER_MAX_LINE_LENGTH}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={text.trim().length === 0}>
              {isDescriber ? '설명' : '전송'}
            </button>
          </form>
        )}
        {isDescriber && notice && shownNoticeSeq === notice.seq && <p className="party-chardesc-notice">{rejectedText(notice)}</p>}
      </div>
    </div>
  )
}
