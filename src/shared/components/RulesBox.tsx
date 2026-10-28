import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  summary: ReactNode
  example?: ReactNode
}

/**
 * 게임 화면 하단에 붙는 규칙 박스. 요약은 2줄까지만 보여주고, 넘칠 만큼 길 때만 "규칙 더보기" 버튼을 띄운다.
 * 예시가 있으면 따로 "예시 보기" 버튼으로 펼친다.
 * 페이지(section)에 game-page-fill을 붙이면 콘텐츠가 짧을 때 화면 맨 아래로 밀려 붙는다
 */
export function RulesBox({ summary, example }: Props) {
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [showExample, setShowExample] = useState(false)

  useLayoutEffect(() => {
    const el = summaryRef.current
    if (!el) return
    // 펼친 상태에서는 clamp가 풀려 넘침을 잴 수 없으므로, 접힌 상태일 때만 다시 잰다
    const measure = () => {
      if (!expanded) setIsOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [summary, expanded])

  return (
    <div className="rules-dock">
      <div className="rules">
        <p ref={summaryRef} className={expanded ? undefined : 'rules-clamped'}>
          {summary}
        </p>
        <div className="rules-toggles">
          {(isOverflowing || expanded) && (
            <button type="button" className="rules-toggle" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded}>
              {expanded ? '규칙 접기 ▲' : '규칙 더보기 ▼'}
            </button>
          )}
          {example && (
            <button
              type="button"
              className="rules-toggle"
              onClick={() => setShowExample((prev) => !prev)}
              aria-expanded={showExample}
            >
              {showExample ? '예시 접기 ▲' : '예시 보기 ▼'}
            </button>
          )}
        </div>
        {example && showExample && <div className="rules-example">{example}</div>}
      </div>
    </div>
  )
}
