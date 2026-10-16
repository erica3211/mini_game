import type { ReactNode } from 'react'

interface Props {
  categories: string[]
  selected: string[]
  onToggle: (category: string) => void
  onSelectAll: () => void
  onClear: () => void
  /** 보기만 하고 바꾸지 못하게 한다 (예: 방장이 아닌 파티 참가자) */
  disabled?: boolean
  /** 칩 아래에 보여줄 선택 현황·안내 문구 */
  children?: ReactNode
}

/** 카테고리를 칩으로 여러 개 고르는 선택 영역 */
export function CategoryPicker({ categories, selected, onToggle, onSelectAll, onClear, disabled, children }: Props) {
  const selectedSet = new Set(selected)
  return (
    <div className="category-picker">
      <div className="category-picker-head">
        <span className="category-picker-title">카테고리</span>
        {!disabled && (
          <span className="category-picker-actions">
            <button type="button" className="category-picker-link" onClick={onSelectAll}>
              전체 선택
            </button>
            <button type="button" className="category-picker-link" onClick={onClear}>
              전체 해제
            </button>
          </span>
        )}
      </div>
      <div className="category-picker-chips">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-chip${selectedSet.has(category) ? ' category-chip-selected' : ''}`}
            aria-pressed={selectedSet.has(category)}
            disabled={disabled}
            onClick={() => onToggle(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {children && <div className="category-picker-note">{children}</div>}
    </div>
  )
}
