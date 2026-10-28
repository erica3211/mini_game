import type { ReactNode } from 'react'

interface Props {
  /** 안내 문구 — 강조할 부분은 <strong>으로 감싸면 포인트 색으로 보인다 */
  children: ReactNode
  onStart: () => void
  /** 안내 문구와 시작 버튼 사이에 넣을 설정 영역 (예: 카테고리 선택) */
  options?: ReactNode
  startDisabled?: boolean
}

/** 혼자 하는 게임들의 공용 시작 화면: 목표·최고기록 안내 + 시작하기 버튼 */
export function SoloIntro({ children, onStart, options, startDisabled }: Props) {
  return (
    <div className="solo-intro">
      <p className="solo-intro-message">{children}</p>
      {options}
      <button type="button" className="btn btn-primary" onClick={onStart} disabled={startDisabled} autoFocus>
        시작하기
      </button>
    </div>
  )
}
