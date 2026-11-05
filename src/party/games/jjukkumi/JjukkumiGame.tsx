import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, PlayerInfo, ServerToClientEvents } from '../../../shared/lib/partyProtocol'
import { BridgeStage } from './BridgeStage'
import { DalgonaStage } from './DalgonaStage'
import { JjukkumiEnd } from './JjukkumiView'
import type { BridgeStateSignal, DalgonaStateSignal, DalgonaTrace, JjukkumiEndSignal, JjukkumiPositionsSignal, JjukkumiStageSignal, JjukkumiStateSignal, MarblesStateSignal, TugStagePowerSignal, TugStageStateSignal } from './protocol'
import { MarblesStage } from './MarblesStage'
import { RedLightStage } from './RedLightStage'
import { TugStage } from './TugStage'

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  roundKey: string
  /** 지금 하는 스테이지 — 어떤 스테이지 화면을 띄울지 정한다 */
  stage: JjukkumiStageSignal | null
  /** 스테이지 1(무궁화 꽃이 피었습니다)의 신호 */
  redLight: { state: JjukkumiStateSignal | null; positions: JjukkumiPositionsSignal | null }
  /** 스테이지 2(달고나)의 신호 */
  dalgona: { state: DalgonaStateSignal | null; traces: Record<string, DalgonaTrace> }
  /** 스테이지 3(줄다리기)의 신호 — power는 가장 최근에 받은 팀별 힘(없으면 state의 힘) */
  tug: { state: TugStageStateSignal | null; power: TugStagePowerSignal['power'] | null }
  /** 스테이지 4(구슬치기)의 신호 */
  marbles: MarblesStateSignal | null
  /** 스테이지 5(징검다리)의 신호 */
  bridge: BridgeStateSignal | null
  /** 게임이 모두 끝났을 때의 최종 순위 */
  end: JjukkumiEndSignal | null
  playerId: string | null
  players: PlayerInfo[]
}

/**
 * 쭈꾸미 게임 — 지금 하는 스테이지(stage.id)에 맞는 화면을 띄운다. 스테이지가 끝나면 서버가 다음 스테이지를 알려 주고 화면이 바뀐다.
 * 새 스테이지를 만들면 여기에 그 화면을 하나 더하면 된다. 최종 순위(end)는 어느 스테이지 화면이든 맨 아래에 같이 보여 준다.
 */
export function JjukkumiGame({ socket, roundKey, stage, redLight, dalgona, tug, marbles, bridge, end, playerId, players }: Props) {
  const endBox = end ? <JjukkumiEnd end={end} players={players} myId={playerId} /> : null

  if (stage?.id === 'dalgona') {
    return (
      <DalgonaStage socket={socket} roundKey={roundKey} state={dalgona.state} traces={dalgona.traces} end={end} playerId={playerId} players={players}>
        {endBox}
      </DalgonaStage>
    )
  }
  if (stage?.id === 'bridge') {
    return (
      <BridgeStage socket={socket} roundKey={roundKey} state={bridge} end={end} playerId={playerId} players={players}>
        {endBox}
      </BridgeStage>
    )
  }
  if (stage?.id === 'marbles') {
    return (
      <MarblesStage socket={socket} roundKey={roundKey} state={marbles} end={end} playerId={playerId} players={players}>
        {endBox}
      </MarblesStage>
    )
  }
  if (stage?.id === 'tugOfWar') {
    return (
      <TugStage socket={socket} roundKey={roundKey} state={tug.state} power={tug.power} end={end} playerId={playerId} players={players}>
        {endBox}
      </TugStage>
    )
  }
  if (stage?.id === 'redLight') {
    return (
      <RedLightStage socket={socket} roundKey={roundKey} state={redLight.state} positions={redLight.positions} end={end} playerId={playerId} players={players}>
        {endBox}
      </RedLightStage>
    )
  }
  return (
    <div className="party-round-stage">
      <p className="party-round-hint">곧 시작합니다...</p>
    </div>
  )
}
