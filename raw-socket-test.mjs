import { io } from 'socket.io-client'

const URL = 'http://localhost:4000'
const t0 = Date.now()
const log = (label, ...args) => console.log(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${label}`, ...args)

const s1 = io(URL)
const s2 = io(URL)

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve))
}

await once(s1, 'connect')
await once(s2, 'connect')
log('both connected')

const created = await new Promise((resolve) => s1.emit('room:create', 'P1', resolve))
log('room created', created)
const roomCode = created.roomCode

const joined = await new Promise((resolve) => s2.emit('room:join', { roomCode, nickname: 'P2' }, resolve))
log('joined', joined)

for (const [label, s] of [['P1', s1], ['P2', s2]]) {
  for (const ev of ['shoutRace:roundStart', 'shoutRace:countdown', 'shoutRace:go', 'shoutRace:update', 'room:state']) {
    s.on(ev, (data) => {
      if (ev === 'room:state') {
        log(`${label} room:state phase=${data.phase} gameId=${data.currentGameId}`)
      } else {
        log(`${label} ${ev}`, JSON.stringify(data).slice(0, 200))
      }
    })
  }
}

s1.emit('host:updateConfig', { selectedGames: ['shoutRace'], totalRounds: 1 })
s2.emit('player:ready', true)
await new Promise((r) => setTimeout(r, 500))
log('starting game')
s1.emit('host:start')

await new Promise((r) => setTimeout(r, 15000))
log('done, closing')
s1.close()
s2.close()
