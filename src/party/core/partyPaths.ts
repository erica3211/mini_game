import type { RoomMode } from '../../shared/lib/partyProtocol'

/** 방 모드별 주소의 앞부분 — 개인전은 /party, 팀전은 /teamParty */
export function partyBasePath(mode: RoomMode): string {
  return mode === 'team' ? '/teamParty' : '/party'
}
