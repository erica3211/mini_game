import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { FourCharsRoundMeta } from './protocol'

interface Props {
  meta: FourCharsRoundMeta
  teams: TeamInfo[]
  nicknameOf: (playerId: string) => string
}

/** 결과 화면: 이번 라운드에 나온 문제와 누가 어떻게 답했는지 한 줄씩 */
export function FourCharsRecap({ meta, teams, nicknameOf }: Props) {
  return (
    <ul className="party-fourchars-recap">
      {meta.turns.map((turn) =>
        turn.answers ? (
          // 개인전: 모두가 같은 문제를 풀었으니 문제마다 사람별 정오를 한꺼번에 보여준다
          <li key={turn.turnIndex} className="party-fourchars-recap-item party-fourchars-recap-everyone">
            <span>
              {turn.turnIndex + 1}번 · {turn.word}
            </span>
            <span>
              {turn.answers.map((answer) => `${answer.correct ? '⭕' : '❌'} ${nicknameOf(answer.playerId)}`).join(' · ')}
            </span>
          </li>
        ) : (
          <li key={turn.turnIndex} className={`party-fourchars-recap-item ${teamColorClass(turn.teamId)}`}>
            <span>
              {turn.correct ? '⭕' : '❌'} {teamEmoji(turn.teamId)} {teams.find((team) => team.id === turn.teamId)?.name ?? '팀'}
            </span>
            <span>
              {turn.word} · {nicknameOf(turn.answererId)}
              {turn.correct ? '' : turn.submitted === null ? ' (시간 초과)' : ` (${turn.submitted})`}
            </span>
          </li>
        ),
      )}
    </ul>
  )
}
