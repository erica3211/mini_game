import type { MouseHunterRoomId } from './partyProtocol'

export interface SpotPosition {
  /** 방 이미지(500x500, 정사각형) 기준 백분율 좌표 — 쥐 스프라이트의 중심점이 여기에 온다 */
  x: number
  y: number
}

// 방 이미지를 직접 보면서 가구 배치에 맞춰 잡은 좌표 — 방마다 정확히 MOUSE_HUNTER_SPOT_IDS(백엔드)와
// 같은 10개 spotId를 키로 갖는다.
export const MOUSE_HUNTER_SPOT_POSITIONS: Record<MouseHunterRoomId, Record<string, SpotPosition>> = {
  livingRoom: {
    tvBack: { x: 6, y: 90 },
    underSofa: { x: 38, y: 64 },
    sofaCushionBack: { x: 27, y: 54 },
    underTable: { x: 39, y: 68 },
    plantBack: { x: 24, y: 54 },
    lampBack: { x: 62, y: 32 },
    shelfBottomShelf: { x: 82, y: 58 },
    doorBack: { x: 63, y: 60 },
    rugEdge: { x: 60, y: 78 },
    frameBack: { x: 37, y: 25 },
  },
  bedRoom: {
    underBed: { x: 56, y: 90 },
    underBlanket: { x: 56, y: 68 },
    pillowBack: { x: 56, y: 46 },
    nightstandBack: { x: 10, y: 38 },
    slipperBack: { x: 23, y: 80 },
    underBookshelf: { x: 23, y: 40 },
    plantBack: { x: 90, y: 52 },
    curtainBack: { x: 68, y: 15 },
    closetGap: { x: 23, y: 18 },
    rugEdge: { x: 6, y: 66 },
  },
  kitchen: {
    fridgeBack: { x: 11, y: 20 },
    underFridge: { x: 11, y: 58 },
    underSink: { x: 56, y: 48 },
    trashBack: { x: 91, y: 73 },
    underOven: { x: 84, y: 58 },
    matEdge: { x: 30, y: 85 },
    potBack: { x: 66, y: 20 },
    betweenJars: { x: 30, y: 25 },
    underCounter: { x: 50, y: 52 },
    windowPlantBack: { x: 50, y: 38 },
  },
  bathRoom: {
    toiletBack: { x: 68, y: 68 },
    underSink: { x: 50, y: 58 },
    insideShower: { x: 20, y: 27 },
    shampooBack: { x: 13, y: 65 },
    towelBack: { x: 66, y: 32 },
    underCabinet: { x: 86, y: 55 },
    tissueHolderBack: { x: 84, y: 18 },
    matEdge: { x: 29, y: 87 },
    underMirror: { x: 43, y: 46 },
    nearDrain: { x: 73, y: 78 },
  },
  studyRoom: {
    betweenBooks: { x: 17, y: 34 },
    underBookshelf: { x: 10, y: 68 },
    monitorBack: { x: 68, y: 32 },
    chairBack: { x: 62, y: 78 },
    plantBack: { x: 91, y: 60 },
    underDesk: { x: 63, y: 62 },
    keyboardBack: { x: 50, y: 52 },
    underLamp: { x: 81, y: 48 },
    besideDrawer: { x: 78, y: 68 },
    windowsill: { x: 51, y: 45 },
  },
  dressRoom: {
    betweenClothes: { x: 30, y: 58 },
    underHanger: { x: 15, y: 62 },
    drawerBack: { x: 63, y: 45 },
    mirrorBack: { x: 85, y: 42 },
    insideBasket: { x: 10, y: 73 },
    shoeboxBack: { x: 30, y: 73 },
    onShelf: { x: 16, y: 15 },
    rugEdge: { x: 65, y: 88 },
    bagBack: { x: 65, y: 22 },
    underCloset: { x: 45, y: 68 },
  },
}
