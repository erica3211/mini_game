// 이모티콘 고르기 창이 쓰는 이모티콘 목록 — emojibase의 한국어 데이터(이름·검색어 포함)를 이 게임 화면에 들어올 때 처음 불러온다
// (800KB쯤이라 첫 화면 용량에 들어가지 않도록 따로 내려받는다)

export interface PickerEmoji {
  emoji: string
  /** 한국어 이름 (예: 흔드는 손) */
  label: string
  /** 검색에 쓰는 한국어 낱말들 */
  tags: string[]
  /** emojibase의 큰 분류 번호 (GROUPS 참고) */
  group: number
}

/** 고르기 창의 분류 탭 — group은 emojibase 분류 번호 (2번 "피부색·머리 모양 조각"은 이모티콘이 아니라서 뺀다) */
export const EMOJI_GROUPS: { group: number; icon: string; label: string }[] = [
  { group: 0, icon: '😀', label: '표정' },
  { group: 1, icon: '👋', label: '사람' },
  { group: 3, icon: '🐻', label: '자연' },
  { group: 4, icon: '🍔', label: '음식' },
  { group: 5, icon: '✈️', label: '장소' },
  { group: 6, icon: '⚽', label: '활동' },
  { group: 7, icon: '💡', label: '사물' },
  { group: 8, icon: '❤️', label: '기호' },
  { group: 9, icon: '🏁', label: '깃발' },
]

// 오래된 휴대폰에서 네모(□)로 보이지 않도록 이 버전까지의 이모티콘만 쓴다 (Emoji 14.0 — 2021년)
const MAX_EMOJI_VERSION = 14

let cache: Promise<PickerEmoji[]> | null = null

export function loadPickerEmojis(): Promise<PickerEmoji[]> {
  cache ??= import('emojibase-data/ko/data.json').then((module) =>
    module.default
      .filter((item) => item.group !== undefined && item.group !== 2 && item.version <= MAX_EMOJI_VERSION)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item) => ({ emoji: item.emoji, label: item.label, tags: item.tags ?? [], group: item.group! })),
  )
  return cache
}

/** 이름이나 검색어에 입력한 글이 들어 있는 이모티콘 (띄어쓰기·대소문자 무시) */
export function searchEmojis(all: PickerEmoji[], query: string, limit = 150): PickerEmoji[] {
  const needle = query.replace(/\s+/g, '').toLowerCase()
  if (!needle) return []
  const squash = (text: string) => text.replace(/\s+/g, '').toLowerCase()
  const labelHits: PickerEmoji[] = []
  const tagHits: PickerEmoji[] = []
  for (const item of all) {
    if (squash(item.label).includes(needle)) labelHits.push(item)
    else if (item.tags.some((tag) => squash(tag).includes(needle))) tagHits.push(item)
    if (labelHits.length + tagHits.length >= limit * 2) break
  }
  // 이름에 들어 있는 것을 먼저 보여준다
  return [...labelHits, ...tagHits].slice(0, limit)
}

// 최근에 쓴 이모티콘 — 이 기기에서만 기억한다 (없어도 게임은 돌아간다)
const RECENT_KEY = 'party_emoji_recent'
const RECENT_LIMIT = 24

export function readRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function rememberEmoji(emoji: string): string[] {
  const next = [emoji, ...readRecentEmojis().filter((item) => item !== emoji)].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 보인다
  }
  return next
}
