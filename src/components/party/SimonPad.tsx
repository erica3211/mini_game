import type { SimonInputTypeId } from '../../lib/partyProtocol'
import { SIMON_CLIENT_TYPES } from '../../lib/simonInputTypes'

/** 피아노의 검은 건반 — 화면 장식이다. 실제 피아노처럼 도-레, 레-미, 파-솔, 솔-라, 라-시 사이에만 있고(미-파, 시-도 사이에는 없다),
 *  눌러도 아래의 흰 건반이 눌리도록 포인터 입력을 받지 않는다 */
function PianoBlackKeys({ whiteKeyCount }: { whiteKeyCount: number }) {
  const gaps = [0, 1, 3, 4, 5].filter((gap) => gap < whiteKeyCount - 1)
  return (
    <>
      {gaps.map((gap) => (
        <span
          key={gap}
          className="party-simon-piano-black"
          aria-hidden
          style={{ left: `${((gap + 1) / whiteKeyCount) * 100}%`, width: `${(0.6 / whiteKeyCount) * 100}%` }}
        />
      ))}
    </>
  )
}

interface PadProps {
  inputType: SimonInputTypeId
  alphabet: string[]
  /** 지금 켜져 있는 심볼 (점멸 중이 아니면 null) */
  litKey: string | null
  /** 점멸 중이거나 제출한 뒤에는 눌러도 입력되지 않는다 (모양은 그대로 둔다) */
  locked: boolean
  onPress: (key: string) => void
}

/** 입력 방식에 맞는 버튼판. 점멸 재생과 입력에 같이 쓰며, 상태는 갖지 않는다 */
export function SimonPad({ inputType, alphabet, litKey, locked, onPress }: PadProps) {
  const type = SIMON_CLIENT_TYPES[inputType]
  const keys = type.layout ? type.layout(alphabet) : alphabet

  return (
    <div
      className={`party-simon-pad party-simon-pad-${inputType}`}
      style={{ gridTemplateColumns: `repeat(${type.columns(alphabet)}, 1fr)` }}
    >
      {keys.map((key, i) => {
        if (key === null) return <span key={`blank-${i}`} className="party-simon-pad-blank" />
        const view = type.view(key)
        return (
          <button
            key={key}
            type="button"
            className={['party-simon-key', view.className ?? '', key === litKey ? 'party-simon-key-lit' : '', locked ? 'party-simon-key-locked' : ''].join(' ')}
            onClick={() => !locked && onPress(key)}
            aria-label={view.label}
          >
            {view.glyph}
          </button>
        )
      })}
      {inputType === 'piano' && <PianoBlackKeys whiteKeyCount={keys.length} />}
    </div>
  )
}

interface ChipProps {
  inputType: SimonInputTypeId
  symbolKey: string
  wrong?: boolean
}

/** 답 슬롯과 결과 화면에서 심볼 하나를 작게 보여준다 */
export function SimonChip({ inputType, symbolKey, wrong = false }: ChipProps) {
  const view = SIMON_CLIENT_TYPES[inputType].view(symbolKey)
  return (
    <span className={['party-simon-chip', view.className ?? '', wrong ? 'party-simon-chip-wrong' : ''].join(' ')} title={view.label}>
      {view.chip ?? view.glyph}
    </span>
  )
}
