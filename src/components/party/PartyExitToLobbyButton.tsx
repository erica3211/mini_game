import { useState } from 'react'
import { ConfirmModal } from '../ConfirmModal'
import type { GameSession } from '../../hooks/useGameSession'

interface Props {
  session: GameSession
}

/** 게임 도중(카운트다운/진행/결과 공개) 방장이 눌러서 즉시 중단하고 대기실로 돌아간다.
 *  방장에게만 보인다 — 서버도 방장 요청만 받아들인다 */
export function PartyExitToLobbyButton({ session }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (!session.isHost) return null

  return (
    <>
      <button type="button" className="btn btn-secondary party-exit-to-lobby" onClick={() => setConfirming(true)}>
        ← 로비로 돌아가기
      </button>
      <ConfirmModal
        open={confirming}
        message="게임을 중단하고 대기실로 돌아갈까요? 지금까지의 점수와 진행 상황이 모두 초기화돼요."
        confirmLabel="돌아가기"
        cancelLabel="취소"
        onConfirm={() => {
          setConfirming(false)
          session.returnToLobby()
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
