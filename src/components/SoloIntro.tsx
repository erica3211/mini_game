import type { ReactNode } from 'react'

interface Props {
  /** 안내 문구 — 강조할 부분은 <strong>으로 감싸면 포인트 색으로 보인다 */
  children: ReactNode
  onStart: () => void
}

/** 혼자 하는 게임들의 공용 시작 화면: 목표·최고기록 안내 + 시작하기 버튼 */
export function SoloIntro({ children, onStart }: Props) {
  return (
    <div className="solo-intro">
      <p className="solo-intro-message">{children}</p>
      <button type="button" className="btn btn-primary" onClick={onStart} autoFocus>
        시작하기
      </button>
    </div>
  )
}
