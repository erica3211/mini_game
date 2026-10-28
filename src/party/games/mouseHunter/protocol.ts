// 쥐 세 끼: 방 목록 순서는 mouseHunterRooms.ts의 MOUSE_HUNTER_ROOMS와 동일하게 유지 (백엔드 types.ts 미러)
export type MouseHunterRoomId = 'livingRoom' | 'bedRoom' | 'kitchen' | 'bathRoom' | 'studyRoom' | 'dressRoom'
export type MouseHunterSkin = 'default' | 'teatime' | 'hat' | 'eyeglass' | 'bubble' | 'swimming' | 'cheese' | 'sleep' | 'scarf'
export type MouseHunterVariant = 'front' | 'side'
export type MouseHunterFacing = 'left' | 'right'

export interface MouseHunterMouse {
  id: string
  roomId: MouseHunterRoomId
  spotId: string
  skin: MouseHunterSkin
  variant: MouseHunterVariant
  facing: MouseHunterFacing
}

// 쥐 세 끼: 맵 전체에 항상 유지되는 쥐 마리 수 — 한 마리를 잡으면 곧바로 다른 방에 한 마리가 새로 스폰된다
export const MOUSE_HUNTER_TOTAL_MICE = 3
export const MOUSE_HUNTER_ROUND_TIMEOUT_MS = 30_000
