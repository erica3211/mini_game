import { useEffect, useState } from 'react'

export interface WordChainCategory {
  category: string
  count: number
}

/** 초성퀴즈 카테고리 목록(가나다순)과 카테고리별 출제 가능 단어 수. 못 받아오면 null */
export function useWordChainCategories(enabled: boolean) {
  const [categories, setCategories] = useState<WordChainCategory[] | null>(null)

  useEffect(() => {
    // 초성퀴즈를 고르지 않은 방에서는 굳이 요청하지 않는다
    if (!enabled || categories !== null) return
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_SOCKET_URL as string}/solo/word-chain/categories`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<WordChainCategory[]>
      })
      .then(setCategories)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error('초성퀴즈 카테고리를 불러오지 못했습니다:', error)
      })
    return () => controller.abort()
  }, [enabled, categories])

  return categories
}
