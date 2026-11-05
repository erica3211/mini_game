import { useEffect, useState } from 'react'

/** CSS 미디어 쿼리 결과를 따라가는 훅 — 화면 크기가 바뀌면(폰 회전, 창 크기 조절) 다시 계산한다 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}
