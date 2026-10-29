import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

interface Props {
  /** 방 번호 글자 수 */
  length: number
  /** 칸에 들어 있는 글자를 이어붙인 값 (빈 칸이 있으면 length보다 짧다) */
  onChange: (code: string) => void
}

// 방 번호는 영문 대문자와 숫자만 쓴다 — 그 밖의 글자는 지운다
const normalize = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** 방 번호 입력 — 한글야구처럼 글자 하나씩 들어가는 칸. 입력하면 다음 칸으로 넘어가고, 지우면 앞 칸으로 돌아가며, 붙여넣으면 여러 칸에 나뉘어 들어간다 */
export function RoomCodeInput({ length, onChange }: Props) {
  const [slots, setSlots] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const update = (next: string[]) => {
    setSlots(next)
    onChange(next.join(''))
  }

  const focusSlot = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus()

  /** index번 칸부터 chars를 한 글자씩 채우고, 채운 다음 칸으로 커서를 옮긴다 */
  const fillFrom = (index: number, chars: string) => {
    const next = [...slots]
    chars.split('').forEach((char, offset) => {
      if (index + offset < length) next[index + offset] = char
    })
    update(next)
    focusSlot(index + chars.length)
  }

  const handleChange = (index: number, raw: string) => {
    const chars = normalize(raw)
    if (!chars) {
      // 지웠거나 허용되지 않는 글자만 들어온 경우 — 이 칸만 비운다
      const next = [...slots]
      next[index] = ''
      update(next)
      return
    }
    const old = slots[index]
    // 글자가 있는 칸에 한 글자를 더 쳐서 두 글자가 된 경우 — 새로 친 글자만 쓴다 (칸을 누르면 글자가 선택돼서 보통은 한 글자로 바뀐다)
    if (old && chars.length === 2) {
      fillFrom(index, chars.startsWith(old) ? chars[1] : chars[0])
      return
    }
    // 세 글자 이상이 한 번에 들어오면(붙여넣기·자동완성) 이 칸부터 나눠 채운다
    fillFrom(index, chars)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !slots[index] && index > 0) {
      e.preventDefault()
      const next = [...slots]
      next[index - 1] = ''
      update(next)
      focusSlot(index - 1)
    } else if (e.key === 'ArrowLeft') {
      focusSlot(index - 1)
    } else if (e.key === 'ArrowRight') {
      focusSlot(index + 1)
    }
  }

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const chars = normalize(e.clipboardData.getData('text'))
    if (chars) fillFrom(index, chars)
  }

  return (
    <div className="party-code-slots" role="group" aria-label="방 번호">
      {slots.map((char, index) => (
        <input
          // 칸은 고정된 4개라 순서가 곧 식별자다
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          className={`party-code-slot${char ? ' party-code-slot-filled' : ''}`}
          value={char}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`방 번호 ${index + 1}번째 글자`}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          autoFocus={index === 0}
        />
      ))}
    </div>
  )
}
