import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { FourCharsRoundMeta } from './protocol'

interface Props {
  meta: FourCharsRoundMeta
  teams: TeamInfo[]
  nicknameOf: (playerId: string) => string
}

/** 문제 낱말에서 가려졌던 두 글자를 □□로 바꾼다 (대표 정답이 앞쪽이면 앞 두 글자, 아니면 뒤 두 글자) */
function maskedWordOf(word: string, answer: string): string {
  return word.startsWith(answer) ? `□□${word.slice(2)}` : `${word.slice(0, 2)}□□`
}

/** 결과 화면: 이번 라운드에 나온 문제와 누가 어떻게 답했는지 한 줄씩 */
export function FourCharsRecap({ meta, teams, nicknameOf }: Props) {
  return (
    <ul className="party-fourchars-recap">
      {meta.turns.map((turn) =>
        turn.answers ? (
          // 개인전: 모두가 같은 문제를 풀었으니 문제마다 사람별로 낸 답과 정오를 보여준다.
          // 정답이 여러 개일 수 있는 문제라 대표 정답 낱말은 보여주지 않고, 가려졌던 두 글자 자리만 □□로 표시한다
          <li key={turn.turnIndex} className="party-fourchars-recap-item party-fourchars-recap-everyone">
            <span className="party-fourchars-recap-question">
              {turn.turnIndex + 1}번 · {maskedWordOf(turn.word, turn.answer)}
            </span>
            <ul className="party-fourchars-recap-answers">
              {turn.answers.map((answer) => (
                <li key={answer.playerId}>
                  <span>
                    {answer.correct ? '⭕' : '❌'} {nicknameOf(answer.playerId)}
                  </span>
                  <span>{answer.submitted ?? '미제출'}</span>
                </li>
              ))}
            </ul>
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
