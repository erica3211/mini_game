import { useEffect, useMemo, useState } from 'react'
import {
  HANGUL_LENGTH,
  KEYBOARD_ROW_1,
  KEYBOARD_ROW_2,
  KEYBOARD_ROW_3,
  KEY_TO_JAMO,
  SHIFT_KEY_TO_JAMO,
  assembleJamo,
  decomposeWord,
  toBasicJamo,
} from '../lib/jamo'
import { HANGUL_WORDS } from '../lib/words'
import { useBaseballGame } from '../hooks/useBaseballGame'
import { GuessHistory } from '../components/GuessHistory'
import { GameStatusBanner } from '../components/GameStatusBanner'
import { xmlToJson } from '../lib/xml'

const API_KEY = import.meta.env.VITE_KOREAN_BASIC_DICTIONARY_API_SECRET_KEY;

const generateHangulAnswer = () =>
  decomposeWord(HANGUL_WORDS[Math.floor(Math.random() * HANGUL_WORDS.length)])

export function HangulBaseball() {
  const game = useBaseballGame(generateHangulAnswer)
  const [slots, setSlots] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const pressJamo = (jamo: string) => {
    setError(null)
    // ㅐ·ㄲ 같은 복합 자모는 기본 자모 여러 칸으로 풀어서 넣는다
    setSlots((prev) => [...prev, ...toBasicJamo(jamo)].slice(0, HANGUL_LENGTH))
  }

  const pressBackspace = () => {
    setError(null)
    setSlots((prev) => prev.slice(0, -1))
  }

  const clearInput = () => {
    setSlots([])
    setError(null)
  }

  const isCheckInDictionary = async (guess: string[]): Promise<boolean> => {
    const word = assembleJamo(guess);

    if (HANGUL_WORDS.includes(word)) {
      return true;
    }
    else {
      try {
        // 한국어기초사전 API 주소와 파라미터 세팅 (자바스크립트의 URLSearchParams 활용)
        const baseUrl = 'https://krdict.korean.go.kr/api/search';
        const params = new URLSearchParams({
          key: API_KEY,
          q: word,
          advanced: 'y',
          method: 'exact',  // 정확히 일치하는 단어만 검색
          target: '1'       // 표제어 검색
        });

        const response = await fetch(`${baseUrl}?${params.toString()}`);

        if (!response.ok) {
          throw new Error('API 요청 실패');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(await response.text(), "text/xml");

        const data = xmlToJson(xmlDoc.documentElement);

        // 데이터가 1개 이상이라도 있을 경우
        if (data && data.total && parseInt(data.total, 10) > 0) {
          const items = Array.isArray(data.item) ? data.item : [data.item];
          const hasNoun = items.some((item: any) => item && item.pos === '명사');
          if (hasNoun) {
            return true; // 사전에 존재하고 명사
          } else {
            setError('명사만 입력할 수 있습니다.'); 
            return false; // 사전에 있지만 명사가 아님
          }
        }
        setError('사전에 없는 단어입니다.')
        return false; // 사전에 없는 단어임
      } catch (error) {
        console.error("사전 API 조회 중 에러 발생:", error);
        return false; 
      }
    }
  }

  const handleSubmit = async () => {
    if (slots.length !== HANGUL_LENGTH) {
      setError(`자모 ${HANGUL_LENGTH}개를 모두 채워주세요.`)
      return
    }
    if (!await isCheckInDictionary(slots)) {
      return
    }
    game.submitGuess(slots)
    clearInput()
  }

  const handleReset = () => {
    game.reset()
    clearInput()
  }

  const jamoStatuses = useMemo(() => {
    const score = { strike: 3, ball: 2, out: 1 };
    const acc: Record<string, 'strike' | 'ball' | 'out'> = {};
    game.history.forEach(({ guess, marks }) => {
      guess.forEach((jamo, index) => {
        const currentMark = marks[index]; // 'strike' | 'ball' | 'out'
        if (!currentMark) return;

        // 기존 점수보다 지금 들어온 자모의 점수가 더 높을 때만 갱신
        const prevScore = acc[jamo] ? score[acc[jamo]] : 0;
        if (score[currentMark] > prevScore) {
          acc[jamo] = currentMark;
        }
      });
    });
    return acc;
  }, [game.history]);

  // 물리 키보드 입력 (두벌식). 핸들러가 최신 상태를 참조하도록 매 렌더마다 다시 등록
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      if (event.key === 'Enter') {
        if (game.status === 'playing') handleSubmit()
        else handleReset()
        return
      }
      if (game.status !== 'playing') return
      if (event.key === 'Backspace') {
        pressBackspace()
        return
      }
      const jamo =
        (event.shiftKey ? SHIFT_KEY_TO_JAMO[event.code] : undefined) ?? KEY_TO_JAMO[event.code]
      if (jamo) pressJamo(jamo)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <section className="game-page">
      <h1 className="page-title">🇰🇷 한글야구</h1>
      <p className="rules">
        기본 자음·모음 <strong>5개</strong>로 풀리는 <strong>실제 단어</strong>를 맞혀보세요. 예:
        개미 = <strong>ㄱ ㅏ ㅣ ㅁ ㅣ</strong> (ㅐ는 ㅏ+ㅣ 두 칸, ㄲ은 ㄱ+ㄱ 두 칸). 같은 자모가
        여러 번 나올 수 있고, 기회는 5번! PC에서는 키보드로도 입력할 수 있어요 (한/영 상태 무관,{' '}
        <strong>Enter</strong> 던지기 · <strong>Backspace</strong> 지우기).
      </p>
      <div className="legend">
        <span className="legend-item">
          <span className="tile tile-strike legend-tile">ㄱ</span>자모·자리 모두 맞음
        </span>
        <span className="legend-item">
          <span className="tile tile-ball legend-tile">ㄱ</span>자모는 있지만 자리가 다름
        </span>
        <span className="legend-item">
          <span className="tile tile-out legend-tile">ㄱ</span>없는 자모
        </span>
      </div>

      <GameStatusBanner
        status={game.status}
        answer={game.answer}
        answerLabel={`${assembleJamo(game.answer)} (${game.answer.join(' ')})`}
        attemptsLeft={game.attemptsLeft}
        onReset={handleReset}
      />

      {game.status === 'playing' && (
        <>
          <div className="preview" aria-live="polite">
            {slots.length > 0 ? assembleJamo(slots) : ' '}
          </div>
          <div className="slots">
            {Array.from({ length: HANGUL_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`slot ${i === slots.length ? 'slot-active' : ''} ${slots[i] ? 'slot-filled' : ''
                  }`}
              >
                {slots[i] ?? ''}
              </span>
            ))}
          </div>
          {error && <p className="error">{error}</p>}

          <div className="keyboard">
            <div className="key-row">
              {KEYBOARD_ROW_1.map((jamo) => {
                const status = jamoStatuses[jamo]; // 'strike', 'ball', 'out' 또는 undefined
                const statusClass = status ? `key-${status}` : ''; // 예: key-strike, key-ball, key-out

                return (
                  <button
                    key={jamo}
                    type="button"
                    className={`key ${statusClass}`}
                    onClick={() => pressJamo(jamo)}
                  >
                    {jamo}
                  </button>
                )
              })}
              <button type="button" className="key key-wide" onClick={pressBackspace}>
                ⌫
              </button>
            </div>
            <div className="key-row">
              {KEYBOARD_ROW_2.map((jamo) => {
                const status = jamoStatuses[jamo]; // 'strike', 'ball', 'out' 또는 undefined
                const statusClass = status ? `key-${status}` : ''; // 예: key-strike, key-ball, key-out

                return (
                  <button
                    key={jamo}
                    type="button"
                    className={`key ${statusClass}`}
                    onClick={() => pressJamo(jamo)}
                  >
                    {jamo}
                  </button>
                )
              })}
            </div>
            <div className="key-row">
              {KEYBOARD_ROW_3.map((jamo) => {
                const status = jamoStatuses[jamo]; // 'strike', 'ball', 'out' 또는 undefined
                const statusClass = status ? `key-${status}` : ''; // 예: key-strike, key-ball, key-out

                return (
                  <button
                    key={jamo}
                    type="button"
                    className={`key ${statusClass}`}
                    onClick={() => pressJamo(jamo)}
                  >
                    {jamo}
                  </button>
                )
              })}
            </div>
            <div className="key-row key-row-actions">
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                던지기!
              </button>
            </div>
          </div>
        </>
      )}

      <GuessHistory history={game.history} display="tiles" formatGuess={assembleJamo} />
    </section>
  )
}
