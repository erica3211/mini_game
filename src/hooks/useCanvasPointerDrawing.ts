import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react'

type Point = { x: number; y: number }

interface Handlers {
  /** 획 시작 — 좌표는 캔버스 표시 크기 기준 0~1 정규화 */
  onBegin: (point: Point) => void
  onMove: (point: Point) => void
  onEnd: () => void
}

function lockPageScroll() {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function unlockPageScroll() {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

const toPoint = (e: PointerEvent<HTMLCanvasElement>): Point => {
  const rect = e.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}

/**
 * 캔버스에 마우스/터치/펜으로 획을 긋는 포인터 처리. 파티 캐치마인드와 혼자 하는 AI 캐치마인드가 같이 쓴다.
 * enabled가 false면(예: 출제자가 아님) 아무 입력도 받지 않고 터치 스크롤도 막지 않는다.
 * 반환값의 props를 <canvas>에 그대로 펼쳐 붙이면 된다
 */
export function useCanvasPointerDrawing(canvasRef: RefObject<HTMLCanvasElement | null>, enabled: boolean, handlers: Handlers) {
  const isDraggingRef = useRef(false)
  // 데스크톱(마우스)엔 스크롤바가 있어서 overflow: hidden을 걸었다 풀 때마다 스크롤바가
  // 사라졌다 나타나며 화면 폭이 흔들린다 — 터치/펜(모바일 사파리 주소창 문제)일 때만 잠근다
  const scrollLockedRef = useRef(false)
  // 핸들러가 매 렌더 새로 만들어져도 포인터 콜백은 항상 최신 것을 부르도록 ref로 들고 있는다
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => unlockPageScroll, [])

  // 삼성인터넷 등 일부 안드로이드 브라우저는 Pointer Event 쪽 preventDefault만으로는 터치 스크롤이
  // 안 막히고 실제 touchmove 이벤트를 막아야 한다. React가 JSX onTouchMove는 passive 리스너로 등록해버려서
  // 그 안에서 preventDefault를 불러도 씹히니(경고만 뜸), useEffect에서 캔버스에 직접 non-passive로 붙인다
  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const preventTouchScroll = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchstart', preventTouchScroll, { passive: false })
    canvas.addEventListener('touchmove', preventTouchScroll, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', preventTouchScroll)
      canvas.removeEventListener('touchmove', preventTouchScroll)
    }
  }, [enabled, canvasRef])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!enabled) return
      // 모바일 웹뷰 중에는 touch-action: none만으로 스크롤/확대 제스처가 안 막히는 경우가 있어 직접 막는다
      e.preventDefault()
      isDraggingRef.current = true
      // 아이폰 사파리는 캔버스가 touch-action: none이어도, 문서 자체가 뷰포트보다 길면
      // 드래그 제스처를 감지해서 주소창/뒤로가기 바를 접었다 폈다 한다 — 그림은 안 밀리는데 바만 깜빡이는 이유.
      // 획을 긋는 동안만 문서 스크롤 자체를 잠가서 사파리가 반응할 거리를 없앤다.
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        lockPageScroll()
        scrollLockedRef.current = true
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // no-op — 지원 안 하는 환경도 있음
      }
      handlersRef.current.onBegin(toPoint(e))
    },
    [enabled],
  )

  const onPointerMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    handlersRef.current.onMove(toPoint(e))
  }, [])

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (scrollLockedRef.current) {
      unlockPageScroll()
      scrollLockedRef.current = false
    }
    handlersRef.current.onEnd()
  }, [])

  return {
    style: enabled ? { touchAction: 'none' as const } : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onContextMenu: enabled ? (e: MouseEvent) => e.preventDefault() : undefined,
  }
}
