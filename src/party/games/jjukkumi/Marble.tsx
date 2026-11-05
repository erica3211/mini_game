import { useId } from 'react'

interface Props {
  /** 구슬 속 무늬를 이만큼(도) 돌린다 — 구슬이 여러 개일 때 똑같이 찍어 낸 것처럼 보이지 않게 한다 */
  twist?: number
  className?: string
}

/**
 * 유리구슬 — 맑은 유리 속에 파랑·초록·주황 리본 같은 무늬가 소용돌이치고, 왼쪽 위에 빛이 맺힌 구슬이다.
 * 이미지 파일 없이 SVG로 직접 그렸다. 크기는 바깥에서 정한다(기본은 className의 width·height).
 */
export function Marble({ twist = 0, className }: Props) {
  // 같은 화면에 구슬이 여러 개라 그라데이션·클립 이름이 겹치지 않게 구슬마다 따로 짓는다
  const uid = useId().replace(/:/g, '')
  const glass = `${uid}-glass`
  const clip = `${uid}-clip`
  const orange = `${uid}-orange`
  const green = `${uid}-green`
  const blue = `${uid}-blue`
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        {/* 유리 — 가운데는 맑고 가장자리로 갈수록 푸르스름하다 */}
        <radialGradient id={glass} cx="45%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#f3fbff" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#c8e8f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8cc6e2" stopOpacity="0.75" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="45" />
        </clipPath>
        <linearGradient id={orange} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6b73c" />
          <stop offset="100%" stopColor="#d98914" />
        </linearGradient>
        <linearGradient id={green} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#52c35e" />
          <stop offset="100%" stopColor="#2c9a46" />
        </linearGradient>
        <linearGradient id={blue} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4aa2ec" />
          <stop offset="100%" stopColor="#2a6fd2" />
        </linearGradient>
      </defs>

      {/* 유리 몸통 */}
      <circle cx="50" cy="50" r="46" fill={`url(#${glass})`} />

      {/* 구슬 속 리본 무늬 — 위에서 아래로 모였다 퍼지는 소용돌이. 뒤에 있는 것부터 그린다 */}
      <g clipPath={`url(#${clip})`}>
        <g transform={`rotate(${twist} 50 50)`} stroke="rgba(10, 45, 95, 0.5)" strokeWidth="0.9" strokeLinejoin="round">
          <path d="M46 14 C30 26 22 46 28 68 C32 80 38 90 44 97 C26 84 16 62 20 42 C24 28 34 18 46 14 Z" fill={`url(#${green})`} />
          <path d="M52 10 C36 20 30 40 34 62 C36 76 40 86 42 95 C28 82 22 60 28 40 C32 26 42 16 52 10 Z" fill={`url(#${blue})`} />
          <path d="M54 9 C44 18 40 32 42 46 C44 58 42 70 42 82 C34 70 32 52 36 36 C40 22 46 14 54 9 Z" fill="#2468c4" fillOpacity="0.9" />
          <path d="M60 10 C88 26 90 60 66 82 C58 89 50 94 44 97 C62 76 72 52 66 32 C64 22 62 14 60 10 Z" fill={`url(#${green})`} />
          <path d="M58 12 C78 30 78 58 58 80 C52 86 48 90 44 95 C56 74 62 52 58 34 C57 24 57 16 58 12 Z" fill={`url(#${blue})`} />
          <path d="M56 8 C68 28 64 46 54 64 C50 76 46 86 42 96 C36 78 36 58 44 42 C50 30 54 18 56 8 Z" fill={`url(#${orange})`} />
        </g>
      </g>

      {/* 빛 — 왼쪽 위의 큰 반사, 작은 반사, 오른쪽의 은은한 빛, 아래쪽 가장자리의 빛 */}
      <path d="M19 38 C22 24 33 15 46 12" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" opacity="0.8" />
      <rect x="22" y="44" width="7" height="4.5" rx="2" transform="rotate(-18 25 46)" fill="#fff" opacity="0.8" />
      <path d="M72 20 C83 28 89 40 89 52" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <path d="M77 77 C69 88 55 92 42 90" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />

      {/* 유리 테두리 */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="#6fb2d4" strokeWidth="2.6" />
      <circle cx="50" cy="50" r="43.4" fill="none" stroke="#fff" strokeWidth="1" opacity="0.35" />
    </svg>
  )
}
