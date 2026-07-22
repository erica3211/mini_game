interface ScoreEntry {
  id: string
  label: string
  points: number
}

interface Props {
  entries: ScoreEntry[]
  badgeClass?: string
}

export function PartyScoreList({ entries, badgeClass = 'badge-out' }: Props) {
  return (
    <ul className="party-player-list">
      {entries.map((entry) => (
        <li key={entry.id} className="party-player-row">
          <span>{entry.label}</span>
          <span className={`badge ${badgeClass}`}>{entry.points}점</span>
        </li>
      ))}
    </ul>
  )
}
