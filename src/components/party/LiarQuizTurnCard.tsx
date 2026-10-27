import type { LiarQuizTurnResult } from '../../lib/partyProtocol'

interface QuestionProps {
  question: string
  /** 빈칸에 채워 보여줄 글자. null이면 빈칸 그대로 둔다 */
  fill: string | null
}

/** 문제 문장의 '___' 자리에 fill을 끼워 보여준다. 문자열 치환이 아니라 React 텍스트 노드로 쪼개 그리므로 입력값이 어떻든 안전하다 */
export function LiarQuizQuestion({ question, fill }: QuestionProps) {
  const [before, ...rest] = question.split('___')
  return (
    <p className="party-liar-question">
      {before}
      {fill !== null ? (
        <mark className="party-liar-fill">{fill}</mark>
      ) : (
        <span className="party-liar-blank" aria-label="빈칸">
          ?
        </span>
      )}
      {rest.join('___')}
    </p>
  )
}

interface Props {
  result: LiarQuizTurnResult
  nicknameOf: (playerId: string) => string
}

/** 한 턴의 공개 — 진짜 정답, 보기별 작성자, 누가 속았는지, 얻은 점수. 라이브 공개와 결과 화면이 같이 쓴다 */
export function LiarQuizTurnCard({ result, nicknameOf }: Props) {
  const picked = result.choices.find((choice) => choice.id === result.pickedId) ?? null
  const guesser = nicknameOf(result.guesserId)

  let summary = '⏰ 시간 안에 고르지 못했어요. \n이번 턴은 아무도 점수를 못 받았어요'
  if (picked?.kind === 'truth') summary = `🎉 ${guesser}님이 진짜 정답을 맞혔어요! \n${guesser}님 +${result.guesserPoints}점`
  else if (picked?.kind === 'lie') {
    const names = picked.authorIds.map(nicknameOf).join(', ')
    summary = `😈 ${guesser}님이 ${names}님의 거짓말에 속았어요!\n${names}님 +${result.authorPoints[picked.authorIds[0]] ?? 0}점`
  } else if (picked) summary = `🎲 ${guesser}님이 가짜 보기를 골랐어요.\n아무도 점수를 못 받았어요`

  return (
    <div className="party-liar-turn-card">
      <p className="party-liar-turn-label">
        {result.turnIndex + 1}번째 · {guesser}님이 맞히는 차례
        {result.questionAuthorId !== null && ` · ${nicknameOf(result.questionAuthorId)}님이 낸 문제`}
      </p>
      <LiarQuizQuestion question={result.question} fill={result.answer} />
      <ul className="party-liar-choices">
        {result.choices.map((choice) => {
          const isPicked = choice.id === result.pickedId
          const classes = [
            'party-liar-choice',
            'party-liar-choice-static',
            choice.kind === 'truth' ? 'party-liar-choice-truth' : '',
            isPicked && choice.kind !== 'truth' ? 'party-liar-choice-fooled' : '',
          ]
          let who = '🎲 가짜 보기'
          if (choice.kind === 'truth') who = '✅ 진짜 정답'
          else if (choice.kind === 'lie') who = `✍️ ${choice.authorIds.map(nicknameOf).join(', ')}`
          return (
            <li key={choice.id}>
              <div className={classes.join(' ')}>
                <span className="party-liar-choice-text">{choice.text}</span>
                <span className="party-liar-author">{who}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="party-liar-result">{summary}</p>
      {result.droppedLies.length > 0 && (
        <p className="party-liar-dropped">
          보기가 모자라 못 나온 거짓말: {result.droppedLies.map((lie) => `${nicknameOf(lie.playerId)}(${lie.text})`).join(', ')}
        </p>
      )}
    </div>
  )
}
