import {
  MIN_PLAYERS_PER_TEAM,
  MIN_TEAM_COUNT,
  TEAM_NAMES,
  type PlayerId,
  type TeamInfo,
} from '../../shared/lib/partyProtocol'

/** 팀을 직접 고른 상태로 시작할 수 있는가 — 사람이 있는 팀이 2개 이상이고 모든 팀이 최소 인원을 채워야 한다 (서버도 같은 기준으로 막는다). 안 되면 이유를 돌려준다 */
export function teamProblem(players: { teamId: number | null }[]): string | null {
  const counts = new Map<number, number>()
  for (const { teamId } of players) if (teamId !== null) counts.set(teamId, (counts.get(teamId) ?? 0) + 1)
  if (counts.size < MIN_TEAM_COUNT) return `팀이 ${MIN_TEAM_COUNT}개 이상 있어야 해요. 팀을 나눠주세요.`
  for (const [teamId, count] of [...counts.entries()].sort(([a], [b]) => a - b)) {
    if (count < MIN_PLAYERS_PER_TEAM) return `${TEAM_NAMES[teamId] ?? `${teamId + 1}팀`}에 최소 ${MIN_PLAYERS_PER_TEAM}명이 필요해요.`
  }
  return null
}

export interface TeamScoreRow {
  team: TeamInfo
  rank: number
  score: number
}

/** 팀별 누적 점수 순위 — 팀원은 매 라운드 팀 점수를 똑같이 받으니 가장 높은 팀원의 누적 점수가 곧 팀의 누적 점수다 (중간에 들어온 사람은 덜 받았을 수 있어서 최댓값을 쓴다). 같은 점수는 공동 등수 */
export function teamScoreRows(teams: TeamInfo[], scores: Record<PlayerId, number>): TeamScoreRow[] {
  const rows = teams
    .map((team) => ({ team, score: Math.max(0, ...team.memberIds.map((id) => scores[id] ?? 0)) }))
    .sort((a, b) => b.score - a.score || a.team.id - b.team.id)
  let previousScore: number | null = null
  let previousRank = 0
  return rows.map((row, index) => {
    const rank = previousScore !== null && row.score === previousScore ? previousRank : index + 1
    previousScore = row.score
    previousRank = rank
    return { ...row, rank }
  })
}
