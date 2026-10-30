import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  doneLabel?: string
  /** 닫기 버튼 앞에 같은 줄로 놓을 버튼들 (예: 입장하기). 있으면 닫기는 보조 버튼 모양이 된다 */
  actions?: ReactNode
  /** 모바일(터치)에서는 팝업을 화면 위쪽에 붙인다 — 입력창이 있는 팝업이 올라오는 키보드에 가려지지 않게 한다. 웹에서는 가운데 그대로 */
  topOnTouch?: boolean
  children: ReactNode
}

/** 설정 같은 내용을 담는 팝업. 배경 클릭/Esc/닫기 버튼으로 닫는다 (확인용 ConfirmModal과 달리 안에 아무 내용이나 넣을 수 있다) */
export function Modal({ open, title, onClose, doneLabel = '완료', actions, topOnTouch = false, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={`modal-backdrop${topOnTouch ? ' modal-backdrop-top-on-touch' : ''}`} onClick={onClose}>
      <div className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
        <div className={`modal-footer${actions ? ' modal-footer-split' : ''}`}>
          {actions}
          <button type="button" className={`btn ${actions || doneLabel === '닫기' ? 'btn-secondary' : 'btn-primary'}`} onClick={onClose}>
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
