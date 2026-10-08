// 혼자 하기 미니게임 공용 점수 규칙 — 문제마다 빨리 해낼수록 높은 점수, 최고기록은 브라우저에 저장한다

const MAX_SCORE_PER_QUESTION = 100
// 성공한 문제의 최소 점수 — 제한시간 직전에 성공해도 0점이 되지 않게 한다
const MIN_SUCCESS_SCORE = 10

/** 바로 성공하면 100점, 제한시간 직전이면 10점 */
export const scoreForElapsed = (elapsedMs: number, timeoutMs: number) =>
  Math.max(MIN_SUCCESS_SCORE, Math.round(MAX_SCORE_PER_QUESTION * (1 - elapsedMs / timeoutMs)))

// 시크릿 창 등에서 localStorage 접근이 막혀도 게임은 그대로 돌아가야 한다
export function readBestScore(storageKey: string): number {
  try {
    return Number(localStorage.getItem(storageKey)) || 0
  } catch {
    return 0
  }
}

export function writeBestScore(storageKey: string, score: number) {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // 저장 실패는 무시한다 — 이번 판 기록은 화면에 그대로 보인다
  }
}
