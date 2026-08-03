import bathRoom from '../assets/rooms/BathRoom.jpg'
import bedRoom from '../assets/rooms/BedRoom.jpg'
import dressRoom from '../assets/rooms/DressRoom.jpg'
import kitchen from '../assets/rooms/Kitchen.jpg'
import livingRoom from '../assets/rooms/LivingRoom.jpg'
import studyRoom from '../assets/rooms/StudyRoom.jpg'

export interface MouseHunterRoom {
  id: string
  name: string
  image: string
}

// 집 안에서 이어진 순서대로 고정 — 거실이 맨 앞, 드레스룸이 맨 뒤라 각각 왼쪽/오른쪽 끝 방 취급된다
export const MOUSE_HUNTER_ROOMS: MouseHunterRoom[] = [
  { id: 'livingRoom', name: '거실', image: livingRoom },
  { id: 'bedRoom', name: '침실', image: bedRoom },
  { id: 'kitchen', name: '부엌', image: kitchen },
  { id: 'bathRoom', name: '화장실', image: bathRoom },
  { id: 'studyRoom', name: '서재', image: studyRoom },
  { id: 'dressRoom', name: '드레스룸', image: dressRoom },
]
