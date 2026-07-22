import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../lib/partyProtocol'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: PartySocket | null = null

function getSocket(): PartySocket {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL as string
    socket = io(url, { autoConnect: true })
  }
  return socket
}

/** 파티게임 소켓 연결을 공유하는 훅. 여러 컴포넌트에서 호출해도 같은 연결 하나를 쓴다 */
export function useSocket() {
  const [connected, setConnected] = useState(() => getSocket().connected)

  useEffect(() => {
    const s = getSocket()
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket: getSocket(), connected }
}
