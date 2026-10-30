import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import { teamColorClass, teamEmoji } from '../../core/PartyTeamBanner'
import type { OrderCardsRoundMeta } from './protocol'

interface Props {
  meta: OrderCardsRoundMeta
  teams: TeamInfo[]
}

/** 결과 화면: 팀별로 몇 라운드를 깼는지, 라운드마다 실수나 시간 초과가 있었는지, 걸린 시간 */
export function OrderCardsRecap({ meta, teams }: Props) {
  const ordered = [...meta.teams].sort((a, b) => b.clearedRounds - a.clearedRounds || b.lives - a.lives || a.finishedMs - b.finishedMs)
  return (
    <ul className="party-order-recap">
      {ordered.map((record) => (
        <li key={record.teamId} className={`party-order-recap-item ${teamColorClass(record.teamId)}`}>
          <span className="party-order-recap-head">
            {teamEmoji(record.teamId)} {teams.find((team) => team.id === record.teamId)?.name ?? '팀'} ·{' '}
            {record.phase === 'out' ? '💥 목숨이 다 떨어졌어요' : `🏁 ${(record.finishedMs / 1000).toFixed(1)}초 만에 끝`}
          </span>
          <span className="party-order-recap-rounds">
            {record.rounds
              .map((round) => `${round.round + 1}라운드 ${round.cleared ? '✅' : round.timedOut ? '⏰' : '❌'}${round.mistakes > 0 ? ` 실수 ${round.mistakes}번` : ''}`)
              .join(' · ')}
          </span>
          <span className="party-order-recap-rounds">
            깬 라운드 {record.clearedRounds}개 · 남은 목숨 {record.lives}개
          </span>
        </li>
      ))}
    </ul>
  )
}
