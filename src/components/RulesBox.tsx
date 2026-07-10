import { useState, type ReactNode } from 'react'

interface Props {
  summary: ReactNode
  example: ReactNode
}

/** 규칙 요약을 기본으로 보여주고, 눌렀을 때만 예시를 펼쳐서 보여주는 규칙 박스 */
export function RulesBox({ summary, example }: Props) {
  const [showExample, setShowExample] = useState(false)

  return (
    <div className="rules">
      <p>{summary}</p>
      <button
        type="button"
        className="rules-toggle"
        onClick={() => setShowExample((prev) => !prev)}
        aria-expanded={showExample}
      >
        {showExample ? '예시 접기 ▲' : '예시 보기 ▼'}
      </button>
      {showExample && <div className="rules-example">{example}</div>}
    </div>
  )
}
