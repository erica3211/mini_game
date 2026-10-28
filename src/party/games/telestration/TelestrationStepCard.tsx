import type { ReactNode } from 'react'
import type { TelestrationStepRecord } from './protocol'
import { CatchmindSnapshot } from '../catchmind/CatchmindSnapshot'

interface Props {
  record: TelestrationStepRecord
  nickname: string
  /** 몇 번째 장면인지 (1부터) */
  order: number
  className?: string
  children?: ReactNode
}

/** 이어그리기 체인의 한 장면 — 투표 화면과 결과 화면이 같이 쓴다 */
export function TelestrationStepCard({ record, nickname, order, className, children }: Props) {
  return (
    <div className={`party-telestration-card${className ? ` ${className}` : ''}`}>
      <div className="party-telestration-card-header">
        <span>
          {order}. {nickname}
        </span>
        <span>{record.kind === 'draw' ? '🎨 그림' : '✏️ 글'}</span>
      </div>
      {record.kind === 'draw' ? (
        <CatchmindSnapshot strokes={record.strokes ?? []} />
      ) : (
        <p className="party-telestration-text">“{record.text}”</p>
      )}
      {children}
    </div>
  )
}
