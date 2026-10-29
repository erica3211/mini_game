import { useRef, useState } from 'react'

interface Props {
  /** 방 번호 글자 수 */
  length: number
  /** 지금까지 입력한 방 번호 */
  onChange: (code: string) => void
}

// 방 번호는 영문 대문자와 숫자만 쓴다 — 그 밖의 글자는 지운다
const normalize = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * 방 번호 입력 — 한글야구처럼 글자 하나씩 들어가는 칸으로 보이지만, 실제 입력창은 칸 위에 투명하게 겹쳐 놓은 **하나**뿐이다.
 * 칸마다 입력창을 따로 두면 한 글자를 칠 때마다 포커스가 다음 입력창으로 옮겨지는데, 모바일 키보드는 그때마다 자판 모드를
 * 처음 상태(한글)로 되돌려서 숫자를 치려고 숫자 자판으로 바꿔 둬도 매번 초기화된다. 입력창이 하나면 포커스가 그대로라 자판이 유지된다.
 */
export function RoomCodeInput({ length, onChange }: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (raw: string) => {
    const next = normalize(raw).slice(0, length)
    setValue(next)
    onChange(next)
  }

  // 지금 입력 중인 칸 (다 채웠으면 없음)
  const activeIndex = value.length < length ? value.length : -1

  return (
    <div className="party-code-slots" onClick={() => inputRef.current?.focus()}>
      {Array.from({ length }, (_, index) => (
        <span
          // 칸은 고정된 개수라 순서가 곧 식별자다
          key={index}
          className={`party-code-slot${value[index] ? ' party-code-slot-filled' : ''}${focused && index === activeIndex ? ' party-code-slot-active' : ''}`}
          aria-hidden="true"
        >
          {value[index] ?? ''}
        </span>
      ))}
      <input
        ref={inputRef}
        className="party-code-hidden-input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="방 번호"
        inputMode="text"
        lang="en"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
      />
    </div>
  )
}
