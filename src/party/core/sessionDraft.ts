/**
 * 아직 서버에 제출하지 않은 "입력 중인 내용"(쓰던 글, 그리던 그림 등)을 브라우저 sessionStorage에 임시로 남겨둔다.
 * 서버는 제출 전의 내용을 모르기 때문에, 새로고침하면 화면 상태와 함께 사라지는 입력을 되살릴 방법이 이것뿐이다.
 *
 * 키에는 반드시 roundKey(라운드 번호 + 게임)를 넣어서 다른 라운드의 낡은 초안이 섞여 들어오지 않게 한다.
 * 다만 roundKey는 방 코드를 담지 않아서, 다른 방이나 같은 방의 다음 판에서도 "0-게임" 같은 키가 똑같이 나온다 —
 * 그래서 라운드가 끝나면(대기실·카운트다운·결과 화면) clearAllDrafts로 남은 초안을 비워야 새 라운드에 지난 입력이 튀어나오지 않는다.
 * 저장소가 막혀 있거나 용량이 모자라도(try/catch) 게임 진행에는 영향이 없어야 한다 — 초안은 어디까지나 덤이다.
 */
const DRAFT_PREFIX = 'party_draft_'

/** 저장해 둔 초안을 전부 지운다. 라운드 밖에서만 부른다 (진행 중인 라운드에서 새로고침하면 초안을 되살려야 하니까) */
export function clearAllDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(DRAFT_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // no-op
  }
}

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
