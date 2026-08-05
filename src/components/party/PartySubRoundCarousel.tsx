import { useCallback, useEffect, useRef, type ReactNode } from 'react'

interface Props {
  current: number
  onChange: (index: number) => void
  children: ReactNode[]
}

/** colorMatch/scavengerHunt 결과 화면에서 PartySubRoundPager와 짝을 이뤄 쓰는 가로 캐러셀 —
 *  네이티브 CSS scroll-snap 위에 얹어서, 버튼 클릭 시 부드럽게 슬라이드되고 손가락/마우스로 옆 페이지를
 *  스와이프할 수도 있다. 손수 만든 pointer-event 드래그 로직은 브라우저의 터치 스크롤 처리와 계속
 *  충돌하기 쉬워서(mouseHunter 방 캐러셀에서 겪었던 문제) 쓰지 않는다 — scroll-snap이 그 자체로
 *  스와이프/모멘텀/방향판정을 다 대신 해주고, 버튼 클릭은 scrollTo({behavior:'smooth'})로 얹기만 하면 된다 */
export function PartySubRoundCarousel({ current, onChange, children }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollEndTimer = useRef<number | undefined>(undefined)

  // current가 바뀌면(=이전/다음 버튼 클릭) 그 페이지로 부드럽게 스크롤한다. 사용자가 스와이프해서
  // 이미 그 위치에 도달해 있는 경우(핸들러가 먼저 onChange를 불러 current가 바뀐 경우)는 건너뛴다
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const target = current * el.clientWidth
    if (Math.abs(el.scrollLeft - target) < 2) return
    el.scrollTo({ left: target, behavior: 'smooth' })
  }, [current])

  // 스크롤이 멎었을 때(짧은 디바운스) 가장 가까운 페이지 인덱스를 계산해서 부모 상태에 반영한다 —
  // 스크롤 도중 매 프레임마다 반영하면 버튼 클릭으로 트리거된 위 effect와 서로 되먹임을 일으킬 수 있다
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    window.clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = window.setTimeout(() => {
      const index = Math.round(el.scrollLeft / el.clientWidth)
      if (index !== current) onChange(index)
    }, 100)
  }, [current, onChange])

  useEffect(() => () => window.clearTimeout(scrollEndTimer.current), [])

  return (
    <div className="party-subround-carousel" ref={scrollerRef} onScroll={handleScroll}>
      {children.map((child, index) => (
        <div className="party-subround-carousel-page" key={index}>
          {child}
        </div>
      ))}
    </div>
  )
}
