import type { TeamInfo } from '../../../shared/lib/partyProtocol'
import type { SpyCard, SpyWordsRoundMeta } from './protocol'
import { SpyBoard, SpyEnd } from './SpyWordsView'

interface Props {
  meta: SpyWordsRoundMeta
  teams: TeamInfo[]
}

/** 결과 화면: 끝났을 때의 결과 상자와 정답판을 그대로 다시 보여준다 — 열린 칸은 색으로 채워지고, 못 연 칸은 주인이 테두리로 보인다 */
export function SpyWordsRecap({ meta, teams }: Props) {
  const cards: SpyCard[] = meta.words.map((word, index) => ({
    word,
    revealed: meta.revealed[index] ? meta.end.owners[index] : null,
    key: meta.end.owners[index],
  }))
  return (
    <div className="party-spy-recap">
      <SpyEnd end={meta.end} teams={teams} />
      <SpyBoard cards={cards} />
    </div>
  )
}
