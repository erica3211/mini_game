import type { SimonInputTypeId } from './protocol'

// 기억력 시퀀스의 입력 방식(유형)별 화면 정의 — 순수 데이터라서 JSX가 없다. 서버의 party/games/simon/inputTypes.ts와 짝이다.
// 심볼은 와이어에서 문자열 키로 오가며 (예: 'red', 'up', '5', '🍎', 'p4'), 키를 어떻게 그릴지는 여기서만 정한다.
// 새 유형을 추가하려면 SimonInputTypeId에 한 줄 + 이 Record에 한 블록 (빠뜨리면 컴파일 에러)
export interface SimonSymbolView {
  /** 버튼판 위에 보이는 글자 (색/칸처럼 모양으로 구분하는 유형은 빈 문자열) */
  glyph: string
  /** 답 슬롯·결과 칩에 보이는 글자. 없으면 glyph를 쓴다 */
  chip?: string
  className?: string
  /** 스크린리더용 이름 */
  label: string
}

export interface SimonClientInputType {
  title: string
  icon: string
  columns: (alphabet: string[]) => number
  /** 버튼판에 놓을 순서 (null은 빈 칸). 기본은 alphabet 순서 그대로 */
  layout?: (alphabet: string[]) => (string | null)[]
  view: (key: string) => SimonSymbolView
  /** 물리 키보드 입력을 심볼 키로 바꾼다 (해당 없으면 null) */
  keyFor?: (event: KeyboardEvent, alphabet: string[]) => string | null
}

const COLOR_LABEL: Record<string, string> = { red: '빨강', blue: '파랑', green: '초록', yellow: '노랑' }
const ARROW_GLYPH: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' }
const ARROW_LABEL: Record<string, string> = { up: '위', down: '아래', left: '왼쪽', right: '오른쪽' }
const ARROW_KEY: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
const gridNumber = (key: string) => Number(key.slice(1)) + 1
// 건반: 흰 건반의 음 이름
const PIANO_NOTES: Record<string, string> = { do: '도', re: '레', mi: '미', fa: '파', sol: '솔', la: '라', si: '시' }

export const SIMON_CLIENT_TYPES: Record<SimonInputTypeId, SimonClientInputType> = {
  color: {
    title: '색깔',
    icon: '🎨',
    columns: () => 2,
    view: (key) => ({ glyph: '', className: `party-simon-sym-${key}`, label: COLOR_LABEL[key] ?? key }),
    keyFor: (event, alphabet) => {
      const index = Number(event.key) - 1
      return Number.isInteger(index) && index >= 0 && index < alphabet.length ? alphabet[index] : null
    },
  },
  arrow: {
    title: '방향',
    icon: '🧭',
    columns: () => 3,
    // 위쪽 화살표가 가운데 위, 나머지가 아래 줄에 오는 십자(역 T) 배치
    layout: () => [null, 'up', null, 'left', 'down', 'right'],
    view: (key) => ({ glyph: ARROW_GLYPH[key] ?? key, label: ARROW_LABEL[key] ?? key }),
    keyFor: (event) => ARROW_KEY[event.key] ?? null,
  },
  emoji: {
    title: '이모지',
    icon: '😀',
    columns: () => 3,
    view: (key) => ({ glyph: key, label: key }),
  },
  piano: {
    title: '건반',
    icon: '🎹',
    columns: (alphabet) => alphabet.length,
    view: (key) => ({ glyph: PIANO_NOTES[key] ?? key, className: 'party-simon-sym-piano', label: PIANO_NOTES[key] ?? key }),
    // 1~7번 키가 왼쪽 건반부터 차례로 대응한다
    keyFor: (event, alphabet) => {
      const index = Number(event.key) - 1
      return Number.isInteger(index) && index >= 0 && index < alphabet.length ? alphabet[index] : null
    },
  },
  grid: {
    title: '칸 위치',
    icon: '🔲',
    columns: () => 3,
    view: (key) => ({ glyph: '', chip: String(gridNumber(key)), className: 'party-simon-sym-grid', label: `${gridNumber(key)}번 칸` }),
    keyFor: (event, alphabet) => {
      const key = `p${Number(event.key) - 1}`
      return alphabet.includes(key) ? key : null
    },
  },
}
