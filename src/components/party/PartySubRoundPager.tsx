interface Props {
  current: number
  total: number
  onChange: (index: number) => void
}

/** colorMatch/scavengerHunt처럼 한 게임 슬롯 안에 서브라운드 여러 개가 있는 결과 화면에서,
 *  전원 결과를 한꺼번에 다 쌓아 보여주는 대신 한 번에 서브라운드 하나씩만 보여주고 이전/다음으로 넘기게 한다 */
export function PartySubRoundPager({ current, total, onChange }: Props) {
  return (
    <div className="party-subround-pager">
      <button
        type="button"
        className="party-subround-pager-arrow"
        onClick={() => onChange(current - 1)}
        disabled={current <= 0}
        aria-label="이전 라운드"
      >
        ‹
      </button>
      <span className="party-subround-pager-label">
        {current + 1} / {total} 라운드
      </span>
      <button
        type="button"
        className="party-subround-pager-arrow"
        onClick={() => onChange(current + 1)}
        disabled={current >= total - 1}
        aria-label="다음 라운드"
      >
        ›
      </button>
    </div>
  )
}
