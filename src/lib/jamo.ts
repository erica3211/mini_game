// 한글야구: 기본 자모 24개 기반의 분해(단어→자모)·조합(자모→미리보기) 로직
//
// 게임의 한 칸은 기본 자모 1개다. ㅐ·ㄲ 같은 복합 자모는 한 칸이 아니라
// 기본 자모 여러 칸으로 풀어서 다룬다 (개미 → ㄱ ㅏ ㅣ ㅁ ㅣ).

export const BASIC_CONSONANTS = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

export const BASIC_VOWELS = [
  'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ',
] as const

export const HANGUL_LENGTH = 5

// 유니코드 한글 음절(가~힣) 분해·조합용 표준 자모 목록
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]
const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
]
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

/** 복합 자모 → 기본 자모 나열 */
const TO_BASIC: Record<string, string> = {
  'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ',
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ',
  'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
  'ㅐ': 'ㅏㅣ', 'ㅒ': 'ㅑㅣ', 'ㅔ': 'ㅓㅣ', 'ㅖ': 'ㅕㅣ',
  'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅏㅣ', 'ㅚ': 'ㅗㅣ',
  'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅓㅣ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ',
}

/** 복합 자모를 기본 자모 배열로 풀어준다. 기본 자모는 그대로 반환. */
export function toBasicJamo(jamo: string): string[] {
  return (TO_BASIC[jamo] ?? jamo).split('')
}

/** 모음-모음 조합 (한 단계씩): ㅏ+ㅣ→ㅐ, ㅗ+ㅏ→ㅘ, ㅘ+ㅣ→ㅙ ... */
const VOWEL_COMBINE: Record<string, string> = {
  'ㅏㅣ': 'ㅐ', 'ㅑㅣ': 'ㅒ', 'ㅓㅣ': 'ㅔ', 'ㅕㅣ': 'ㅖ',
  'ㅗㅏ': 'ㅘ', 'ㅘㅣ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅝㅣ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
}

/** 자음-자음 조합 (쌍자음): ㄱ+ㄱ→ㄲ ... */
const DOUBLE_CONSONANT: Record<string, string> = {
  'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ',
}

/** 받침끼리의 겹받침 조합: ㄱ+ㅅ→ㄳ ... (쌍자음은 초성 조합을 우선하므로 제외) */
const JONG_COMBINE: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ',
  'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
}

export function isVowel(jamo: string): boolean {
  return JUNGSEONG.includes(jamo)
}

/** 한글 단어를 기본 자모 나열로 분해한다: 개미 → [ㄱ,ㅏ,ㅣ,ㅁ,ㅣ] */
export function decomposeWord(word: string): string[] {
  const jamo: string[] = []
  for (const ch of word) {
    const code = ch.codePointAt(0)! - 0xac00
    if (code < 0 || code >= 11172) {
      jamo.push(...toBasicJamo(ch))
      continue
    }
    const cho = CHOSEONG[Math.floor(code / 588)]
    const jung = JUNGSEONG[Math.floor((code % 588) / 28)]
    const jong = JONGSEONG[code % 28]
    jamo.push(...toBasicJamo(cho), ...toBasicJamo(jung))
    if (jong) jamo.push(...toBasicJamo(jong))
  }
  return jamo
}

interface Syllable {
  cho?: string
  jung?: string
  jong?: string
}

function renderSyllable({ cho, jung, jong }: Syllable): string {
  if (cho && jung) {
    return String.fromCodePoint(
      0xac00 +
        CHOSEONG.indexOf(cho) * 588 +
        JUNGSEONG.indexOf(jung) * 28 +
        JONGSEONG.indexOf(jong ?? ''),
    )
  }
  return (cho ?? '') + (jung ?? '') + (jong ?? '')
}

/**
 * 기본 자모 나열을 읽을 수 있는 한글로 조합한다 (입력 미리보기용).
 * 모음-모음(ㅏ+ㅣ→ㅐ), 자음-자음(ㄱ+ㄱ→ㄲ) 조합을 인식한다:
 * [ㄱ,ㅏ,ㅣ,ㅁ,ㅣ] → 개미, [ㅌ,ㅗ,ㄱ,ㄱ,ㅣ] → 토끼
 */
export function assembleJamo(jamoList: string[]): string {
  let out = ''
  let cur: Syllable = {}
  const flush = () => {
    out += renderSyllable(cur)
    cur = {}
  }

  const putVowel = (vowel: string) => {
    if (cur.jong) {
      // 받침을 다음 글자의 초성으로 넘긴다 (겹받침이면 마지막 요소만: 역+ㅅ+ㅏ → 역사)
      const parts = toBasicJamo(cur.jong)
      const moved = parts.pop()!
      cur.jong = parts.length > 0 ? JONG_COMBINE[parts.join('')] ?? parts[0] : undefined
      flush()
      cur = { cho: moved, jung: vowel }
    } else if (cur.jung) {
      const combined = VOWEL_COMBINE[cur.jung + vowel]
      if (combined) cur.jung = combined
      else {
        flush()
        cur = { jung: vowel }
      }
    } else {
      cur.jung = vowel
    }
  }

  const putConsonant = (consonant: string) => {
    const doubled = cur.cho === consonant ? DOUBLE_CONSONANT[consonant] : undefined
    if (!cur.jung) {
      // 아직 모음이 없는 홀로 자음
      if (!cur.cho) cur.cho = consonant
      else if (doubled && !cur.jong) cur.cho = doubled
      else {
        flush()
        cur = { cho: consonant }
      }
    } else if (!cur.jong) {
      cur.jong = consonant
    } else if (cur.jong === consonant && DOUBLE_CONSONANT[consonant]) {
      // 받침과 같은 자음이 또 오면 쌍자음 초성으로 끌어온다: 오+ㅂ+ㅂ+ㅏ → 오빠
      const double = DOUBLE_CONSONANT[consonant]
      cur.jong = undefined
      flush()
      cur = { cho: double }
    } else if (JONG_COMBINE[cur.jong + consonant]) {
      cur.jong = JONG_COMBINE[cur.jong + consonant]
    } else {
      flush()
      cur = { cho: consonant }
    }
  }

  for (const jamo of jamoList) {
    if (isVowel(jamo)) putVowel(jamo)
    else putConsonant(jamo)
  }
  if (cur.cho || cur.jung) flush()
  return out
}

/** 두벌식 자판: 물리 키(event.code) → 자모. 한/영 상태와 무관하게 동작한다. */
export const KEY_TO_JAMO: Record<string, string> = {
  KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ',
  KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ',
  KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ',
  KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ',
  KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ',
  KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ',
}

/** Shift를 누른 상태의 두벌식 자판 (쌍자음, ㅒㅖ) */
export const SHIFT_KEY_TO_JAMO: Record<string, string> = {
  KeyQ: 'ㅃ', KeyW: 'ㅉ', KeyE: 'ㄸ', KeyR: 'ㄲ', KeyT: 'ㅆ',
  KeyO: 'ㅒ', KeyP: 'ㅖ',
}
