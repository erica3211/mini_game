import type { PlayerId } from '../../../shared/lib/partyProtocol'

// 줄다리기 (party/games/tugOfWar/team.ts) — 서버 types.ts와 모양이 같아야 한다

/** 팀별 힘 — 팀의 당긴 횟수를 팀 인원으로 나눈 값(1인당 평균) */
export type TugPower = Record<number, number>

export interface TugStartSignal {
  durationMs: number
  elapsedMs: number
  power: TugPower
  myPulls: number
}

export interface TugProgressSignal {
  power: TugPower
}

export interface TugEndSignal {
  teams: { teamId: number; power: number; pulls: number; rank: number }[]
  players: { playerId: PlayerId; pulls: number }[]
}

export interface TugRoundMeta {
  end: TugEndSignal
}
