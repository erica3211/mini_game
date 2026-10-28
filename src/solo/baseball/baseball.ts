// 숫자야구/한글야구가 공유하는 판정·생성 로직

export interface JudgeResult {
  strike: number
  ball: number
}

/** 자리별 판정: 자리·값 모두 맞음 / 값만 있음 / 없음 */
export type Mark = 'strike' | 'ball' | 'out'

/**
 * 워들 방식 판정. 값이 중복될 수 있으므로, 볼(자리만 다름)은
 * 스트라이크로 쓰이지 않고 남은 정답 개수만큼만 준다.
 */
export function markGuess(answer: string[], guess: string[]): Mark[] {
  const marks: Mark[] = guess.map(() => 'out')
  const remaining = new Map<string, number>()
  answer.forEach((symbol, i) => {
    if (guess[i] === symbol) marks[i] = 'strike'
    else remaining.set(symbol, (remaining.get(symbol) ?? 0) + 1)
  })
  guess.forEach((symbol, i) => {
    if (marks[i] === 'strike') return
    const count = remaining.get(symbol) ?? 0
    if (count > 0) {
      marks[i] = 'ball'
      remaining.set(symbol, count - 1)
    }
  })
  return marks
}

/** 자리와 값이 모두 같으면 스트라이크, 값만 있으면 볼 */
export function judge(answer: string[], guess: string[]): JudgeResult {
  const marks = markGuess(answer, guess)
  return {
    strike: marks.filter((mark) => mark === 'strike').length,
    ball: marks.filter((mark) => mark === 'ball').length,
  }
}

/** pool에서 서로 다른 원소 count개를 무작위로 뽑는다 */
export function pickDistinct<T>(pool: readonly T[], count: number): T[] {
  const rest = [...pool]
  const picked: T[] = []
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * rest.length)
    picked.push(rest.splice(index, 1)[0])
  }
  return picked
}

/** 첫 자리는 1-9, 나머지는 0-9에서 서로 다른 숫자 3개 */
export function generateNumberAnswer(): string[] {
  const first = pickDistinct(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 1)[0]
  const restPool = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].filter(
    (digit) => digit !== first,
  )
  return [first, ...pickDistinct(restPool, 2)]
}
