import { useMemo } from 'react'
import { teamRgb } from '../../core/PartyTeamBanner'
import { MAZE_OPEN, type MazeData, type MazePoint } from './protocol'

interface Props {
  maze: MazeData
  pos: MazePoint
  /** 우리 팀이 지나온 칸 (칸 번호 = y * width + x) */
  visited: number[]
  teamId: number
}

const CELL = 20
const WALL = 2.4

/** 미로 그림 — 벽은 한 번에 그리고, 지나온 칸은 팀 색으로 옅게 칠하고, 팀 캐릭터는 칸 사이를 부드럽게 움직인다 */
export function MazeBoard({ maze, pos, visited, teamId }: Props) {
  const wallPath = useMemo(() => {
    const segments: string[] = []
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        const open = maze.cells[y * maze.width + x]
        const left = x * CELL
        const top = y * CELL
        // 위·왼쪽 벽은 모든 칸이, 아래·오른쪽 벽은 가장자리 칸만 그려서 같은 벽을 두 번 그리지 않는다
        if (!(open & MAZE_OPEN.up)) segments.push(`M${left} ${top}h${CELL}`)
        if (!(open & MAZE_OPEN.left)) segments.push(`M${left} ${top}v${CELL}`)
        if (y === maze.height - 1 && !(open & MAZE_OPEN.down)) segments.push(`M${left} ${top + CELL}h${CELL}`)
        if (x === maze.width - 1 && !(open & MAZE_OPEN.right)) segments.push(`M${left + CELL} ${top}v${CELL}`)
      }
    }
    return segments.join('')
  }, [maze])

  const rgb = teamRgb(teamId)
  const width = maze.width * CELL
  const height = maze.height * CELL

  return (
    <svg
      className="party-maze-board"
      viewBox={`${-WALL} ${-WALL} ${width + WALL * 2} ${height + WALL * 2}`}
      role="img"
      aria-label="미로"
      preserveAspectRatio="xMidYMid meet"
    >
      {visited.map((index) => (
        <rect
          key={index}
          x={(index % maze.width) * CELL}
          y={Math.floor(index / maze.width) * CELL}
          width={CELL}
          height={CELL}
          fill={`rgba(${rgb}, 0.22)`}
        />
      ))}
      <rect
        x={maze.exit.x * CELL}
        y={maze.exit.y * CELL}
        width={CELL}
        height={CELL}
        className="party-maze-exit"
      />
      <text x={maze.exit.x * CELL + CELL / 2} y={maze.exit.y * CELL + CELL / 2} className="party-maze-flag" textAnchor="middle" dominantBaseline="central">
        🏁
      </text>
      <path d={wallPath} className="party-maze-walls" strokeWidth={WALL} fill="none" strokeLinecap="round" />
      <g className="party-maze-token" style={{ transform: `translate(${pos.x * CELL}px, ${pos.y * CELL}px)` }}>
        <circle cx={CELL / 2} cy={CELL / 2} r={CELL * 0.34} fill={`rgb(${rgb})`} stroke="rgba(0,0,0,0.55)" strokeWidth={1.2} />
        <circle cx={CELL / 2 - 2.2} cy={CELL / 2 - 1.5} r={1.4} fill="#fff" />
        <circle cx={CELL / 2 + 2.2} cy={CELL / 2 - 1.5} r={1.4} fill="#fff" />
      </g>
    </svg>
  )
}
