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
    tvBack: { x: 3, y: 71 }, // tv 뒤
    underDrawer: { x: 5, y: 92 }, // 서랍장 밑
    underSofa: { x: 28, y: 71.5 }, // 소파 밑
    underTable: { x: 32, y: 86.5 }, // 테이블 밑
    rugEdge: { x: 60, y: 78 }, // 카펫 가장자리
    underBigPlant : { x: 24, y: 66 },  // 큰 식물 밑
    BigPlantSide : { x: 24, y: 57 },  // 큰 식물 옆
    sofaCushionSide : { x: 38, y: 57 }, // 소파 쿠션 옆
    onTable : { x: 41, y: 71.5 }, // 테이블 위
    frameFront : { x: 36, y: 27 }, // 프레임 앞
    smallPlantSide : { x: 46, y: 27 }, // 작은 식물 옆
    onLamp : { x: 60.5, y: 33.5 }, // 조명 위
    underLamp : {  x: 62.5, y: 64 }, // 조명 밑
    onBookcase : { x: 82, y: 36 }, // 책장 위
    mediumPlantSide : { x: 95, y: 30.5 }, // 중간 식물 옆
    onFrame : { x: 85, y: 20.5 }, // 프레임 위
    shelf1 : { x: 86, y: 51 }, // 장식장 1단
    shelf2 : { x: 81, y: 63 }, // 장식장 2단
    floor : { x: 90, y: 88 },  // 바닥
  },
  bedRoom: {
    onLamp : { x: 8.7, y: 35.7 },  // 조명 위
    owlSide : { x: 23.5, y: 26 }, // 부엉이 옆
    betweenBooks : { x: 23, y: 35 },  // 책 사이
    underDrawer : { x: 6.5, y: 69 }, // 서랍장 밑
    betweenOrnaments : { x: 24, y: 53 },  // 장식품 사이
    onRug : { x: 21.5, y: 79.5 }, // 러그 위
    betweenBedDrawers1 : { x: 31.5, y: 65 },  // 침대 서랍 사이 1
    betweenBedDrawers2 : { x: 73, y: 65 },  // 침대 서랍 사이 2
    onBlueCushion : { x: 45.2, y: 52.3 }, // 파란 쿠션 위
    onYellowCushion : { x: 65, y: 53.3 }, // 노란 쿠션 위
    underBed : { x: 51, y: 92 },  // 침대 밑
    inBlueSlipper : { x: 81, y: 81.5 }, // 파란 슬리퍼 안
    onMoon : { x: 62.5, y: 18.8 },  // 달 위
    onWindow : { x: 64.5, y: 30 },  // 창문 위
    onPhoto : { x: 83, y: 27 }, // 사진 위
    onPlant : { x: 90, y: 40 }, // 식물 위
    plantSide : { x: 96, y: 58 }, // 식물 옆
    underPlant : { x: 97.5, y: 68 },  // 식물 밑
  },
  kitchen: {
    onFridge : { x: 14, y: 22 },  // 냉장고 위
    onNote : { x: 10.4, y: 46 },  // 메모 위
    onFridgeHandle : { x: 17, y: 58.5 },  // 냉장고 손잡이 위
    fridgeSide : { x: 21.5, y: 74.5 },  // 냉장고 옆
    betweenCondiments1 : { x: 30.5, y: 24 },  // 조미료 사이 1
    betweenCondiments2 : { x: 34.5, y: 35.5 },  // 조미료 사이 2
    onTable1 : { x: 30, y: 51 },  // 테이블 위 1
    onTable2 : { x: 68, y: 51 },  // 테이블 위 2
    inSink : { x: 53, y: 53.5 },  // 싱크대 안
    onWindow : { x: 51, y: 39 },  // 창문 위
    onFryingPan1 : { x: 77.7, y: 34.5 },  // 프라이팬 위 1
    onFryingPan2 : { x: 78, y: 17 },  // 프라이팬 위 2
    onVent : { x: 90, y: 20 },  // 배기장치 위
    onPot1 : { x: 85.5, y: 48 },  // 냄비 위 1
    onPot2 : { x: 93, y: 45.5 },  // 냄비 위 2
    onTrashCan : { x: 94.7, y: 73.5 },  // 쓰레기통 위
    inDrawer : { x: 76, y: 68.5 }, // 서랍 안
  },
  bathRoom: {
    shampooSide : { x: 12, y: 71 }, // 샴푸 옆
    onSoap : { x: 23, y: 72 },  // 비누 위
    underShower : { x: 21, y: 28 }, // 샤워기 밑
    rugEdge : { x: 30, y: 90 }, // 러그 가장자리
    underSink : { x: 48, y: 67.5 }, // 세면대 밑
    onSink : { x: 47, y: 56.5 },  // 세면대 위
    underMirror : { x: 41, y: 51 }, // 거울 밑
    onTowel : { x: 68, y: 26 }, // 수건 위
    inToilet : { x: 70.5, y: 71.6 },  // 변기 안
    toiletSide : { x: 75, y: 80 },  // 변기 옆
    inFrame : { x: 85.6, y: 19 }, // 액자 안
    inBasket : { x: 91, y: 29.5 },  // 바구니 안
    inDrawer1 : { x: 88, y: 52 }, // 서랍 안 1
    inDrawer2 : { x: 84, y: 60 }, // 서랍 안 2
    underDrawer : { x: 93, y: 80 }, // 서랍 밑
    floor : { x: 90, y: 90 }, // 바닥
    onLamp : { x: 45, y: 5 }, // 조명 위

  },
  studyRoom: {
    boxSide : { x: 4.5, y: 15 },  // 상자 옆
    onBook : { x: 19, y: 27 },  // 책 위
    globeSide : { x: 24, y: 34 },   // 지구본 옆
    bookSide : { x: 24, y: 51 },  // 책 옆
    smallPlantSide : { x: 23, y: 74 },  // 작은 식물 옆
    bookcaseFront : { x: 4, y: 80 },  // 책장 앞
    onCurtain : { x: 67, y: 11 },   // 커튼 위
    onMonitor : { x: 67, y: 35 },   // 모니터 위
    onDesk : { x: 46, y: 54 },  // 책상 위
    onChair : { x: 63, y: 55.5 },   // 의자 위
    underDesk : { x: 55, y: 77 },   // 책상 밑
    underChair : { x: 66, y: 87 },  // 의자 밑
    onBigPlant : { x: 89, y: 49 },  // 큰 식물 위
    underBigPlant : { x: 97, y: 78 },   // 큰 식물 밑
    onClock : { x: 86, y: 11 }, // 시계 위
    onRug : { x: 28, y: 93 },  // 러그 위

  },
  dressRoom: {
    onBox : { x: 13, y: 12 }, // 상자 위
    onBag : { x: 35, y: 12 }, // 가방 위
    bagSide : { x: 49, y: 19 }, // 가방 옆
    inBasket : { x: 9, y: 75 }, // 바구니 안
    boxSide : { x: 37, y: 74 }, // 상자 옆
    betweenClothes1 : { x: 33, y: 60 }, // 옷 사이 1
    betweenClothes2 : { x: 45, y: 33 }, // 옷 사이 2
    betweenClothes3 : { x: 17, y: 33 }, // 옷 사이 3
    closetSide : { x: 54.5, y: 74 },  // 옷장 옆
    onRug : { x: 8, y: 20 },  // 러그 위
    underVanity : { x: 32, y: 90 }, // 화장대 밑
    mirrorFront : { x: 85, y: 52 }, // 거울 앞
    onWetWipes : { x: 68, y: 38 },  // 물티슈 위
    floor : { x: 88, y: 90 }, // 바닥
  },
}
