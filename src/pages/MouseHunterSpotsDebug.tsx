import { MOUSE_HUNTER_ROOMS } from '../lib/mouseHunterRooms'
import { MOUSE_HUNTER_SKIN_IMAGES } from '../lib/mouseHunterSkins'
import { MOUSE_HUNTER_SPOT_POSITIONS } from '../lib/mouseHunterSpots'
import type { MouseHunterRoomId } from '../lib/partyProtocol'

const defaultMouse = MOUSE_HUNTER_SKIN_IMAGES.default.front

// 개발 중 좌표를 눈으로 확인/조정하기 위한 전용 페이지 — mouseHunterSpots.ts를 고치고 저장하면
// (Vite HMR 덕분에) 이 화면도 곧바로 갱신된다. 실제 게임 플로우와 무관한 독립 페이지라 party 접두사를 쓰지 않는다
export function MouseHunterSpotsDebug() {
  return (
    <section>
      <h1 className="page-title">🐭 쥐 스팟 확인 (개발용)</h1>
      <p className="page-subtitle">mouseHunterSpots.ts의 좌표를 고치고 저장하면 여기 바로 반영돼요.</p>
      <div className="mh-debug-grid">
        {MOUSE_HUNTER_ROOMS.map((room) => (
          <div className="mh-debug-room" key={room.id}>
            <h2 className="mh-debug-room-title">
              {room.name} <span className="mh-debug-room-id">({room.id})</span>
            </h2>
            <div className="mh-debug-thumb">
              <img src={room.image} alt={room.name} />
              {Object.entries(MOUSE_HUNTER_SPOT_POSITIONS[room.id as MouseHunterRoomId]).map(([spotId, pos]) => (
                <div className="mh-debug-spot" key={spotId} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                  <span className="mh-debug-spot-label">{spotId}</span>
                  <img src={defaultMouse} alt="" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
