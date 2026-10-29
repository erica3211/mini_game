import { useEffect, useState } from 'react'

/**
 * 스크롤해도 흔들리지 않는 화면 높이 — 모바일 브라우저는 스크롤할 때마다 주소창·하단 바가 나타났다 사라지면서 화면 높이(innerHeight, vh, dvh, 어떤 웹뷰는 svh까지)가
 * 계속 바뀌는데, 이 값으로 미로 크기를 정하면 스크롤할 때마다 미로가 커졌다 작아진다. 그래서 지금까지 본 화면 높이 중 가장 작은 값만 쓴다
 * (바가 보일 때의 높이) — 한 번 작아지면 바가 사라져도 다시 커지지 않는다. 화면을 돌릴 때만 새로 잰다.
 */
export function useStableViewportHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight)

  useEffect(() => {
    const shrinkOnly = () => setHeight((previous) => Math.min(previous, window.innerHeight))
    // 가로↔세로 전환은 높이가 크게 바뀌는 것이 정상이라 줄어든 값을 버리고 새로 잰다 (전환이 끝난 뒤의 높이를 읽도록 잠깐 기다린다)
    let reset: number | undefined
    const remeasure = () => {
      window.clearTimeout(reset)
      reset = window.setTimeout(() => setHeight(window.innerHeight), 350)
    }
    window.addEventListener('resize', shrinkOnly)
    window.addEventListener('orientationchange', remeasure)
    return () => {
      window.removeEventListener('resize', shrinkOnly)
      window.removeEventListener('orientationchange', remeasure)
      window.clearTimeout(reset)
    }
  }, [])

  return height
}
