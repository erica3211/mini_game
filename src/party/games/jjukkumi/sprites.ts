import { useEffect, useState } from 'react'
import { JJUKKUMI_CHARACTER_NAMES } from './protocol'

// 쭈꾸미 게임에 쓰는 캐릭터 그림 — public/jjukkumi/ 아래의 투명 배경 PNG이다 (참가자 4종은 등 뒤에서 본 모습, 영희는 뒤·옆·앞 세 모습, 진행 요원 셋)

const FILES = [
  ...JJUKKUMI_CHARACTER_NAMES.map((name) => `${name}-back`),
  'younghee-back',
  'younghee-side',
  'younghee-front',
  'guard-circle',
  'guard-square',
  'guard-triangle',
]

export type SpriteMap = Record<string, HTMLImageElement>

/** 참가자 캐릭터(번호 0~3)의 이미지 이름 */
export const playerSpriteName = (character: number): string => `${JJUKKUMI_CHARACTER_NAMES[character % JJUKKUMI_CHARACTER_NAMES.length]}-back`

/** 이미지 주소 — 목록의 작은 얼굴 그림에도 쓴다 */
export const spriteUrl = (name: string): string => `/jjukkumi/${name}.png`

let cache: Promise<SpriteMap> | null = null

function loadSprites(): Promise<SpriteMap> {
  if (!cache) {
    cache = Promise.all(
      FILES.map(
        (name) =>
          new Promise<[string, HTMLImageElement]>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve([name, image])
            image.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${name}`))
            image.src = spriteUrl(name)
          }),
      ),
    ).then((entries) => Object.fromEntries(entries))
    // 한 번 실패하면 다음에 다시 시도할 수 있게 비운다
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

/** 캐릭터 그림을 불러온다 — 다 불러오면 돌려주고, 그 전에는 null이다 */
export function useJjukkumiSprites(): SpriteMap | null {
  const [sprites, setSprites] = useState<SpriteMap | null>(null)
  useEffect(() => {
    let alive = true
    loadSprites().then(
      (loaded) => alive && setSprites(loaded),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [])
  return sprites
}
