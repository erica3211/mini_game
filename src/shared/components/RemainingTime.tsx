import { useEffect, useState } from 'react'

interface Props {
  startedAt: number
  timeoutMs: number
}

/** 제한시간 중 남은 시간을 1초 단위로 보여준다 */
export function RemainingTime({ startedAt, timeoutMs }: Props) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, timeoutMs - (performance.now() - startedAt)))

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(Math.max(0, timeoutMs - (performance.now() - startedAt)))
    }, 250)
    return () => window.clearInterval(interval)
  }, [startedAt, timeoutMs])

  return <span className="party-round-remaining">⏳ {Math.ceil(remainingMs / 1000)}초</span>
}
