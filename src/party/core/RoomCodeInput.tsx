import { useRef, useState, type RefObject } from 'react'

interface Props {
  /** 방 번호 글자 수 */
  length: number
  /** 지금까지 입력한 방 번호 */
  onChange: (code: string) => void
  /** 글자를 받는 입력창 — 부모가 사용자가 누른 순간에 바로 포커스를 줄 수 있게 열어 둔다 */
  inputRef?: RefObject<HTMLInputElement | null>
  /** 켜져 있으면(틀린 번호로 입장에 실패한 직후) 입력창이 포커스를 유지한 채로도, 이어서 치는 글자가 기존 번호 뒤에 붙지 않고 처음부터 다시 채워진다.
   *  (버튼으로 제출하면 포커스가 나갔다 들어오면서 번호가 비워지지만, Enter로 제출하면 포커스가 그대로라 이 경로가 필요하다) */
  replaceOnNextInput?: boolean
}

// 방 번호는 영문 대문자와 숫자만 쓴다 — 그 밖의 글자는 지운다
const normalize = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * 방 번호 입력 — 한글야구처럼 글자 하나씩 들어가는 칸으로 보이지만, 실제 입력창은 칸 위에 투명하게 겹쳐 놓은 **하나**뿐이다.
 * 칸마다 입력창을 따로 두면 한 글자를 칠 때마다 포커스가 다음 입력창으로 옮겨지는데, 모바일 키보드는 그때마다 자판 모드를
 * 처음 상태(한글)로 되돌려서 숫자를 치려고 숫자 자판으로 바꿔 둬도 매번 초기화된다. 입력창이 하나면 포커스가 그대로라 자판이 유지된다.
 */
export function RoomCodeInput({ length, onChange, inputRef: externalRef, replaceOnNextInput = false }: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const ownRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? ownRef

  const handleChange = (raw: string) => {
    let chars = normalize(raw)
    // 새 글자를 이어서 친 경우(기존 번호 뒤에 붙은 경우)에만 새로 친 글자부터 다시 채운다 — 지우는 입력은 그대로 지워진다
    if (replaceOnNextInput && value && chars.length > value.length && chars.startsWith(value)) chars = chars.slice(value.length)
    const next = chars.slice(0, length)
    setValue(next)
    onChange(next)
  }

  // 지금 입력 중인 칸 (다 채웠으면 없음)
  const activeIndex = value.length < length ? value.length : -1

  return (
    <div
      className="party-code-slots"
      onClick={() => {
        // 틀린 번호로 입장에 실패한 직후에는 칸을 누르는 순간 번호를 비운다 — Enter로 제출하면 입력창이 포커스를 유지하고 있어서
        // 포커스 이벤트가 오지 않으므로, 누르기(클릭)로도 초기화한다. 정상 입력 중에 칸을 눌러도 지워지지 않는다
        if (replaceOnNextInput && value) {
          setValue('')
          onChange('')
        }
        inputRef.current?.focus()
      }}
    >
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
        onFocus={() => {
          setFocused(true)
          // 포커스가 나갔다가 다시 들어오면 이전에 입력한 번호는 비운다 — 틀린 번호를 지우지 않고 바로 새로 칠 수 있게
          if (value) {
            setValue('')
            onChange('')
          }
        }}
        onBlur={() => setFocused(false)}
        aria-label="방 번호"
        inputMode="text"
        lang="en"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  )
}
