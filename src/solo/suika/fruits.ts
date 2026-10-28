// 수박게임 과일 데이터 — 같은 과일 둘이 닿으면 다음 단계(배열의 다음 칸)로 합쳐진다

export interface Fruit {
  name: string
  /** 보드(논리 좌표) 위에서의 반지름 */
  radius: number
  color: string
  /** 테두리·무늬에 쓰는 진한 색 */
  dark: string
}

export const FRUITS: readonly Fruit[] = [
  { name: '체리', radius: 14, color: '#e5383b', dark: '#9b1d20' },
  { name: '딸기', radius: 20, color: '#ff6b81', dark: '#c0392b' },
  { name: '포도', radius: 27, color: '#9b5de5', dark: '#5f2e9c' },
  { name: '귤', radius: 34, color: '#ffa62b', dark: '#c46f00' },
  { name: '감', radius: 43, color: '#f77f00', dark: '#a85200' },
  { name: '사과', radius: 52, color: '#ef476f', dark: '#a3223f' },
  { name: '배', radius: 62, color: '#d4e157', dark: '#8c9a1a' },
  { name: '복숭아', radius: 73, color: '#ffb3c1', dark: '#d06a80' },
  { name: '파인애플', radius: 85, color: '#ffd23f', dark: '#b8860b' },
  { name: '멜론', radius: 98, color: '#b7e4a0', dark: '#6aa84f' },
  { name: '수박', radius: 114, color: '#4caf50', dark: '#1b5e20' },
]

export const LAST_LEVEL = FRUITS.length - 1
/** 위에서 떨어뜨릴 수 있는 가장 큰 과일 단계 (체리~감) */
export const MAX_DROP_LEVEL = 4

/** 합쳐서 level단계 과일을 만들었을 때 얻는 점수 — 체리 1점 … 수박 66점 */
export const scoreForLevel = (level: number) => ((level + 1) * (level + 2)) / 2

/** 수박끼리 만나 둘 다 사라질 때의 보너스 */
export const WATERMELON_BONUS = 100
