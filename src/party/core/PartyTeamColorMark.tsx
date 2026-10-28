import { TEAM_NAMES } from '../../shared/lib/partyProtocol'
import { teamEmoji } from './PartyTeamBanner'

interface Props {
  teamId: number
  /** 있으면 누를 때마다 다음 팀으로 옮긴다 (내 줄에만 준다). 없으면 그냥 팀 색 표시 */
  onMove?: () => void
  nextTeamId?: number
}

/** 대기실 참가자 목록에서 이름 앞에 붙는 팀 색 동그라미 — 내 줄에서는 누르면 다음 팀으로 옮겨진다 */
export function TeamColorMark({ teamId, onMove, nextTeamId }: Props) {
  if (!onMove) return <span className="party-team-mark">{teamEmoji(teamId)}</span>
  return (
    <button
      type="button"
      className="party-team-mark party-team-mark-button"
      onClick={onMove}
      aria-label={`내 팀: ${TEAM_NAMES[teamId]}. 누르면 ${nextTeamId === undefined ? '다른 팀' : TEAM_NAMES[nextTeamId]}으로 옮겨요`}
      title="눌러서 다른 팀으로 옮기기"
    >
      {teamEmoji(teamId)}
    </button>
  )
}
