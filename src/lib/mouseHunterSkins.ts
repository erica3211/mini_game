import bubbleFront from '../assets/mouse/bubble_mouse_front.png'
import bubbleSide from '../assets/mouse/bubble_mouse_side.png'
import cheeseFront from '../assets/mouse/cheese_mouse_front.png'
import cheeseSide from '../assets/mouse/cheese_mouse_side.png'
import defaultFront from '../assets/mouse/mouse_front.png'
import defaultSide from '../assets/mouse/mouse_side.png'
import eyeglassFront from '../assets/mouse/eyeglass_mouse_front.png'
import eyeglassSide from '../assets/mouse/eyeglass_mouse_side.png'
import hatFront from '../assets/mouse/hat_mouse_front.png'
import hatSide from '../assets/mouse/hat_mouse_side.png'
import scarfFront from '../assets/mouse/scarf_mouse_front.png'
import scarfSide from '../assets/mouse/scarf_mouse_side.png'
import sleepFront from '../assets/mouse/sleep_mouse_front.png'
import sleepSide from '../assets/mouse/sleep_mouse_side.png'
import swimmingFront from '../assets/mouse/swimming_mouse_front.png'
import swimmingSide from '../assets/mouse/swimming_mouse_side.png'
import teatimeFront from '../assets/mouse/teatime_mouse_front.png'
import teatimeSide from '../assets/mouse/teatime_mouse_side.png'
import type { MouseHunterSkin, MouseHunterVariant } from './partyProtocol'

// side 원본 이미지는 전부 왼쪽을 바라보고 있다 — facing이 'right'면 컴포넌트에서 CSS로 좌우 반전해서 쓴다
export const MOUSE_HUNTER_SKIN_IMAGES: Record<MouseHunterSkin, Record<MouseHunterVariant, string>> = {
  default: { front: defaultFront, side: defaultSide },
  teatime: { front: teatimeFront, side: teatimeSide },
  hat: { front: hatFront, side: hatSide },
  eyeglass: { front: eyeglassFront, side: eyeglassSide },
  bubble: { front: bubbleFront, side: bubbleSide },
  swimming: { front: swimmingFront, side: swimmingSide },
  cheese: { front: cheeseFront, side: cheeseSide },
  sleep: { front: sleepFront, side: sleepSide },
  scarf: { front: scarfFront, side: scarfSide },
}
