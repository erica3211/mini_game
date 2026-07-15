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
import { RulesBox } from '../components/RulesBox'



const getLocalDateString = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function HangulBaseball() {
  const today = getLocalDateString();
  const generateHangulAnswer = () =>
    decomposeWord(HANGUL_WORDS[Math.floor(Math.random() * HANGUL_WORDS.length)])

  const [submitCount, setSubmitCount] = useState<number>(() => {
    const savedDate = localStorage.getItem('hangul_game_date');
    const savedCount = localStorage.getItem('hangul_game_count');

    // 날짜가 오늘과 일치할 때만 저장된 카운트를 쓰고, 다르면 오늘의 1번째 시도로 시작
    if (savedDate === today && savedCount) {
      return Number(savedCount);
    }
    return 1;
  });

  const game = useBaseballGame(generateHangulAnswer, submitCount, 'hangul')
  const [slots, setSlots] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const pressJamo = (jamo: string) => {
    setError(null)
    // ㅐ·ㄲ 같은 복합 자/모음은 기본 자/모음 여러 칸으로 풀어서 넣음
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
  } else {
    try {
      const params = new URLSearchParams({ q: word });
      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error('API 요청 실패');
      }

      // 💡 서버에서 이미 정제된 JSON을 받으므로 파싱 부담 Zero!
      const data = await response.json(); // { total: 1, hasNoun: true } 구조

      if (data && data.total > 0) {
        if (data.hasNoun) {
          return true; // 사전에 존재하고 명사임
        } else {
          setError('명사만 입력할 수 있습니다.');
          return false;
        }
      }
      
      setError('사전에 없는 단어입니다.');
      return false;
    } catch (error) {
      console.error("사전 API 조회 중 에러 발생:", error);
      return false;
    }
  }
};

  const handleSubmit = async () => {
    if (slots.length !== HANGUL_LENGTH) {
      setError(`자/모음 ${HANGUL_LENGTH}개를 모두 채워주세요.`)
      return
    }
    if (!await isCheckInDictionary(slots)) {
      return
    }
    game.submitGuess(slots)
    clearInput();
  }

  const handleReset = () => {
    if (submitCount >= 3) {
      setError('오늘 기회를 모두 소진하셨습니다. 내일 다시 도전해주세요.');
      return;
    }

    const nextCount = submitCount + 1;
    localStorage.setItem('hangul_game_date', today);
    localStorage.setItem('hangul_game_count', nextCount.toString());
    setSubmitCount(nextCount);

    game.reset()
    clearInput()
  }

  const jamoStatuses = useMemo(() => {
    const score: Record<'strike' | 'ball' | 'out', number> = { strike: 3, ball: 2, out: 1 };
    const acc: Record<string, 'strike' | 'ball' | 'out'> = {};
    game.history.forEach(({ guess, marks }: { guess: string[]; marks: ('strike' | 'ball' | 'out')[] }) => {
      guess.forEach((jamo: string, index: number) => {
        const currentMark = marks[index]; // 'strike' | 'ball' | 'out'
        if (!currentMark) return;

        // 기존 점수보다 지금 들어온 자/모음의 점수가 더 높을 때만 갱신
        const prevScore = acc[jamo] ? score[acc[jamo]] : 0;
        if (score[currentMark] > prevScore) {
          acc[jamo] = currentMark;
        }
      });
    });
    return acc;
  }, [game.history]);

  useEffect(() => {
    const savedDate = localStorage.getItem('hangul_game_date');

    // 다른날 되면 로컬스토리지 데이터 초기화
    if (savedDate && savedDate !== today) {
      localStorage.removeItem('hangul_game_date');
      localStorage.removeItem('hangul_game_count');
      localStorage.removeItem('hangul_game_status');
      localStorage.removeItem('hangul_game_history');
      localStorage.removeItem('hangul_current_answer');
      localStorage.removeItem('hangul_today_answers');

      setSubmitCount(1);

      setError(null);

      game.reset();
    }
  }, [today]);

  useEffect(() => {
    // 게임 상태가 'won' 또는 'lost'일 때만 실행 (진행 중인 'playing'일 때는 무시)
    if (game.status === 'won' || game.status === 'lost') {

      const savedStatus = localStorage.getItem('hangul_game_status');
      const savedHistory = localStorage.getItem('hangul_game_history');

      if (savedStatus === game.status && savedHistory === JSON.stringify(game.history)) {
        return;
      }

      // 기존에 저장된 오늘 나온 단어 목록(배열) 가져오기
      const savedTodayAnswers = localStorage.getItem('hangul_today_answers');
      const todayAnswersList = savedTodayAnswers ? JSON.parse(savedTodayAnswers) : [];

      // 현재 정답 단어가 목록에 없을 때만 추가
      if (!todayAnswersList.some((a: string[]) => JSON.stringify(a) === JSON.stringify(game.answer))) {
        todayAnswersList.push(game.answer);
      }

      // 시도 번호(submitCount)는 새 판이 시작될 때만 증가하므로 여기서는 그대로 저장
      localStorage.setItem('hangul_game_date', today);
      localStorage.setItem('hangul_game_count', submitCount.toString());
      localStorage.setItem('hangul_game_history', JSON.stringify(game.history));
      localStorage.setItem('hangul_current_answer', JSON.stringify(game.answer));
      localStorage.setItem('hangul_game_status', game.status);
      localStorage.setItem('hangul_today_answers', JSON.stringify(todayAnswersList));
    }
  }, [game.status, game.history, submitCount]);

  useEffect(() => {
    // 물리 키보드 입력 (두벌식). 핸들러가 최신 상태를 참조하도록 매 렌더마다 다시 등록
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
      <RulesBox
        summary={
          <>
            기본 자음·모음 <strong>5개</strong>로 풀리는 <strong>실제 단어</strong>를 맞혀보세요.<br /> &nbsp;&nbsp;예:
            개미 = <strong>ㄱ ㅏ ㅣ ㅁ ㅣ</strong> (<strong>ㅐ</strong>는 <strong>ㅏ</strong>+<strong>ㅣ</strong> 두 칸, <strong>ㄲ</strong>은 <strong>ㄱ</strong>+<strong>ㄱ</strong> 두 칸).<br />  같은 자모가
            여러 번 나올 수 있고, 기회는 5번!<br /> PC에서는 키보드로도 입력할 수 있어요. (한/영 상태 무관,{' '}
            <strong>Enter</strong> 던지기 · <strong>Backspace</strong> 지우기).
          </>
        }
        example={
          <>
            <p className="rules-example-title">
              예시: 정답이 <strong>가족(ㄱ ㅏ ㅈ ㅗ ㄱ)</strong>일 때{' '}
              <strong>고집(ㄱ ㅗ ㅈ ㅣ ㅂ)</strong>을 입력하면?
            </p>
            <table className="rules-example-table">
              <thead>
                <tr>
                  <th>자리</th>
                  <th>정답</th>
                  <th>입력</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>ㄱ</td>
                  <td>ㄱ</td>
                  <td>
                    <span className="badge badge-strike">ㄱ</span> 자/모음과 자리 모두 일치
                  </td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>ㅏ</td>
                  <td>ㅗ</td>
                  <td>
                    <span className="badge badge-ball">ㅗ</span> ㅗ는 정답에 있지만 4번째 자리
                    자/모음이에요
                  </td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>ㅈ</td>
                  <td>ㅈ</td>
                  <td>
                    <span className="badge badge-strike">ㅈ</span> 자/모음과 자리 모두 일치
                  </td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>ㅗ</td>
                  <td>ㅣ</td>
                  <td>
                    <span className="badge badge-out">ㅣ</span> ㅣ는 정답에 없어요
                  </td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>ㄱ</td>
                  <td>ㅂ</td>
                  <td>
                    <span className="badge badge-out">ㅂ</span> ㅂ는 정답에 없어요
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              → 자리마다 <span className="tile tile-strike legend-tile">ㄱ</span>
              <span className="tile tile-ball legend-tile">ㅗ</span>
              <span className="tile tile-strike legend-tile">ㅈ</span>
              <span className="tile tile-out legend-tile">ㅣ</span>
              <span className="tile tile-out legend-tile">ㅂ</span> 처럼 색이 표시돼요.
            </p>
          </>
        }
      />
      <div className="legend">
        <span className="legend-item">
          <span className="tile tile-strike legend-tile">ㄱ</span>자/모음과 자리 모두 맞음
        </span>
        <span className="legend-item">
          <span className="tile tile-ball legend-tile">ㄱ</span>자/모음은 있지만 자리가 다름
        </span>
        <span className="legend-item">
          <span className="tile tile-out legend-tile">ㄱ</span>없는 자/모음
        </span>
      </div>

      <div className="game-status-info" style={{ marginBottom: '15px', textAlign: 'center' }}>
        <p style={{ fontWeight: 'bold' }}>오늘 시도 횟수: {submitCount} / 3</p>
      </div>
      <GameStatusBanner
        status={game.status}
        answer={game.answer}
        answerLabel={`${assembleJamo(game.answer)} (${game.answer.join(' ')})`}
        attemptsLeft={game.attemptsLeft}
        error={error}
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
