/**
 * 아직 서버에 제출하지 않은 "입력 중인 내용"(쓰던 글, 그리던 그림 등)을 브라우저 sessionStorage에 임시로 남겨둔다.
 * 서버는 제출 전의 내용을 모르기 때문에, 새로고침하면 화면 상태와 함께 사라지는 입력을 되살릴 방법이 이것뿐이다.
 *
 * 키에는 반드시 roundKey(라운드 번호 + 게임)를 넣어서 다른 라운드의 낡은 초안이 섞여 들어오지 않게 한다.
 * 저장소가 막혀 있거나 용량이 모자라도(try/catch) 게임 진행에는 영향이 없어야 한다 — 초안은 어디까지나 덤이다.
 */
const DRAFT_PREFIX = 'party_draft_'

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value))
  } catch {
    // no-op
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + key)
  } catch {
    // no-op
  }
}
