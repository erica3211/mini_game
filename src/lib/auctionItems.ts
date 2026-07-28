import ancientTreasureMap from '../assets/auction/AncientTreasureMap.png'
import diamondNecklace from '../assets/auction/DiamondNecklace.png'
import goldenCrown from '../assets/auction/GoldenCrown.png'
import legendaryDragonEgg from '../assets/auction/LegendaryDragonEgg.png'
import magicRubyRing from '../assets/auction/MagicRubyRing.png'
import medievalSword from '../assets/auction/MedievalSword.png'
import pirateTreasureChest from '../assets/auction/PirateTreasureChest.png'
import secretPotionBottle from '../assets/auction/SecretPotionBottle.png'
import spaceCatStatue from '../assets/auction/SpaceCatStatue.png'
import vintagePocketWatch from '../assets/auction/VintagePocketWatch.png'
import type { AuctionItemId } from './partyProtocol'

export interface AuctionItemFlavor {
  name: string
  image: string
}

const ITEM_POOL: AuctionItemFlavor[] = [
  { name: '황금 왕관', image: goldenCrown },
  { name: '마법의 루비 반지', image: magicRubyRing },
  { name: '고대 보물 지도', image: ancientTreasureMap },
  { name: '다이아몬드 목걸이', image: diamondNecklace },
  { name: '전설의 드래곤 알', image: legendaryDragonEgg },
  { name: '중세 전사의 검', image: medievalSword },
  { name: '비밀의 포션 병', image: secretPotionBottle },
  { name: '해적의 보물 상자', image: pirateTreasureChest },
  { name: '빈티지 포켓 워치', image: vintagePocketWatch },
  { name: '귀여운 우주 고양이 조각상', image: spaceCatStatue },
]

// 문자열을 32비트 정수로 뭉개는 간단한 해시 — 시드로만 쓰이므로 암호학적 안전성은 필요 없다
function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ITEM_IDS: AuctionItemId[] = ['A', 'B', 'C', 'D']

/**
 * roundKey(라운드 인덱스+게임ID)로 시드를 고정해서, 같은 라운드를 보는 모든 참가자가
 * 서버 통신 없이도 물품 4개(전부 다른 종류)와 A~D 배정을 동일하게 계산하도록 한다.
 */
export function pickAuctionFlavors(roundKey: string): Record<AuctionItemId, AuctionItemFlavor> {
  const random = mulberry32(hashSeed(roundKey))
  const shuffled = [...ITEM_POOL]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return Object.fromEntries(ITEM_IDS.map((itemId, index) => [itemId, shuffled[index]])) as Record<AuctionItemId, AuctionItemFlavor>
}

// 서버가 만드는 비교형 힌트("B 물품보다 무조건...")는 물품을 A~D 코드로만 가리킨다.
// 화면에는 물품을 이미지·이름으로 보여주므로, 코드가 그대로 노출되지 않도록 이름으로 바꿔준다.
export function resolveHintText(text: string, flavors: Record<AuctionItemId, AuctionItemFlavor>): string {
  return text.replace(/^([A-D]) 물품보다/, (_match, itemId: AuctionItemId) => `${flavors[itemId].name}보다`)
}
