import { useEffect } from 'react'

/**
 * 모바일에서 키보드가 올라오면 브라우저는 페이지(레이아웃 뷰포트)는 그대로 두고, 실제로 보이는 영역(비주얼 뷰포트)만
 * 줄인 뒤 입력창이 보이도록 아래로 옮긴다. position: fixed는 레이아웃 뷰포트 기준이라 상단 토스트가 보이는 영역
 * 위로 밀려나 안 보이게 된다 — 보이는 영역의 위쪽 오프셋을 CSS 변수(--visual-viewport-top)로 내려줘서
 * 토스트가 항상 "지금 보이는 화면"의 상단에 붙게 한다
 */
export function useVisualViewportTop() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => root.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`)
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--visual-viewport-top')
    }
  }, [])
}
