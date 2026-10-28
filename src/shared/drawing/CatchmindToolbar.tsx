import { CATCHMIND_COLORS } from '../lib/partyProtocol'

export const BRUSH_THIN = 4
export const BRUSH_THICK = 10

interface Props {
  color: string
  width: number
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onUndo: () => void
  onClear: () => void
}

/** 캐치마인드 그리기 도구(팔레트·굵기·되돌리기·전체 지우기). 파티 캐치마인드와 혼자 하는 AI 캐치마인드가 같이 쓴다 */
export function CatchmindToolbar({ color, width, onColorChange, onWidthChange, onUndo, onClear }: Props) {
  return (
    <div className="party-catchmind-toolbar">
      <div className="party-catchmind-palette">
        {CATCHMIND_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`party-catchmind-swatch${color === c ? ' party-catchmind-swatch-active' : ''}`}
            style={{ background: c }}
            title={c === '#ffffff' ? '지우개' : c}
            onClick={() => onColorChange(c)}
          />
        ))}
      </div>
      <div className="party-catchmind-widths">
        <button
          type="button"
          className={`btn btn-secondary${width === BRUSH_THIN ? ' party-catchmind-width-active' : ''}`}
          onClick={() => onWidthChange(BRUSH_THIN)}
        >
          얇게
        </button>
        <button
          type="button"
          className={`btn btn-secondary${width === BRUSH_THICK ? ' party-catchmind-width-active' : ''}`}
          onClick={() => onWidthChange(BRUSH_THICK)}
        >
          굵게
        </button>
        <button type="button" className="btn btn-secondary" onClick={onUndo}>
          되돌리기
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClear}>
          전체 지우기
        </button>
      </div>
    </div>
  )
}
