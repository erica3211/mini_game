# 프론트엔드 프로젝트 구조

React 19 + Vite + TypeScript 기반 미니게임 모음 사이트입니다. 게임은 **솔로(혼자 하기)** 와 **파티(여러 명이 방에 모여 하는 실시간 게임)** 두 종류이고, 코드도 이 기준으로 나뉘어 있습니다.

## 핵심 원칙

1. **솔로 / 파티 / 공용을 최상위에서 나눕니다.** (`solo/`, `party/`, `shared/`)
2. **한 게임에 필요한 파일은 그 게임 폴더 안에 모읍니다.** 컴포넌트, 훅, 로직(lib), 이미지(assets)를 흩어 두지 않습니다.
3. **2곳 이상에서 쓰는 코드만 위로 올립니다.** 두 게임이 공유하면 `solo/<공용>` 또는 `party/core`, 솔로와 파티가 함께 쓰면 `shared/`에 둡니다.

## 전체 구조

```
mini_game_front/
├── index.html
├── vite.config.ts, tsconfig.json, vercel.json
├── api/
│   └── search.ts            # Vercel 서버리스 함수 (사전 검색 프록시)
├── public/
│   └── models/doodlenet/    # AI 캐치마인드용 온디바이스 모델 파일
└── src/
    ├── main.tsx             # 진입점
    ├── App.tsx              # 헤더 + 라우팅
    ├── index.css            # 스타일 진입점 — 각 styles.css를 @import 하는 순서(=우선순위)만 담음
    ├── pages/
    │   └── Home.tsx         # 홈 (솔로/파티 진입 화면)
    ├── assets/              # 전역 에셋 (배경 패턴)
    ├── shared/              # 솔로·파티 공용
    ├── solo/                # 혼자 하기 게임
    └── party/               # 파티 게임
```

## `src/shared/` — 솔로·파티 공용

| 폴더 | 내용 |
|---|---|
| `components/` | `Modal`, `ConfirmModal`, `RulesBox`, `CategoryPicker`, `RemainingTime`, `ThemeToggle` |
| `hooks/` | `useTheme`(라이트/다크), `useVisualViewportTop`(모바일 키보드 대응) |
| `lib/` | `partyProtocol.ts` — 서버와 주고받는 **공통** 타입·소켓 이벤트 시그니처 (백엔드 `src/types.ts`의 미러). 게임 전용 타입·상수는 `party/games/<게임>/protocol.ts` |
| `drawing/` | 캐치마인드 계열(솔로 AI 캐치마인드, 파티 캐치마인드, 텔레스트레이션)이 함께 쓰는 그리기 도구: `CatchmindToolbar`, `useCanvasPointerDrawing`, `catchmindDraw` |

> `partyProtocol.ts`는 이름은 party지만 솔로 초성퀴즈·AI 캐치마인드도 상수를 가져다 쓰기 때문에 `shared/`에 있습니다.

## `src/solo/` — 혼자 하기

각 폴더가 곧 하나의 게임(또는 공용 묶음)입니다.

```
solo/
├── shared/            # 솔로 공용: SoloIntro(시작 화면), soloScore(기록 저장)
├── baseball/          # 숫자야구·한글야구 공용: useBaseballGame, baseball.ts,
│                      #   GameStatusBanner, GuessHistory
├── numberBaseball/    # /number-baseball  — NumberBaseball.tsx
├── hangulBaseball/    # /hangul-baseball  — HangulBaseball.tsx, jamo.ts, words.ts
├── blackjack/         # /black-jack       — BlackJack.tsx, BlackjackCard, useBlackjackGame,
│                      #   blackjackRules.ts, assets/(딜러 이미지)
├── choseongQuiz/      # /choseong-quiz    — ChoseongQuiz.tsx, useChoseongQuiz
└── aiCatchmind/       # /catchmind        — AiCatchmind.tsx, useAiCatchmind, doodleNet, doodleLabels
```

- 초성퀴즈는 백엔드의 HTTP API(`/solo/word-chain/*`)에서 문제를 받아옵니다.
- AI 캐치마인드는 `public/models/doodlenet`의 모델을 브라우저에서 직접 돌립니다(서버 비용 없음).

## `src/party/` — 파티 게임

```
party/
├── core/              # 방·세션 진행 (게임과 무관한 공통 흐름)
└── games/<gameId>/    # 게임별 폴더 (18개)
```

### `party/core/`

| 파일 | 역할 |
|---|---|
| `PartyGame.tsx` | `/party` — 닉네임 입력, 방 만들기 |
| `PartyRoom.tsx` | `/party/:roomCode` — 입장 후 방 상태(`phase`)에 따라 화면 전환 |
| `PartyLobby.tsx` | 대기실: 게임 선택, 라운드 수, 준비/시작 |
| `PartyRoundCountdown.tsx` | 라운드 시작 전 카운트다운 |
| `PartyRoundActive.tsx` | **게임 디스패처** — `gameId`에 따라 알맞은 `XxxGame`을 렌더 |
| `PartyRoundResults.tsx` | 라운드 결과 (게임별 부가 결과 표시 포함) |
| `PartyFinalResults.tsx`, `PartyConfetti.tsx` | 최종 결과 |
| `PartyScoreList`, `PartySubRoundCarousel`, `PartySubRoundPager`, `PartyExitToLobbyButton`, `PartyLoading` | 공통 UI 조각 |
| `useGameSession.ts` | 방 상태·서버 이벤트를 하나로 묶는 핵심 훅 |
| `useSocket.ts` | Socket.IO 연결 (`VITE_SOCKET_URL`) |
| `useMonotonicStartedAt.ts` | 서버 시작 시각 기반 타이머 보정 (모든 `use*Round`가 사용) |
| `sessionDraft.ts` | 작성 중 입력(초안) 임시 보관 |

### `party/games/<gameId>/`

폴더 이름은 백엔드의 `gameId`와 같습니다. 각 폴더의 기본 구성:

```
party/games/simon/
├── SimonGame.tsx          # 게임 화면 (PartyRoundActive가 렌더)
├── useSimonRound.ts       # 라운드 상태·소켓 이벤트 훅
├── protocol.ts            # 서버와 주고받는 이 게임 전용 타입·상수 (백엔드 types.ts의 미러)
├── styles.css             # 이 게임 스타일
├── useSimonPlayback.ts    # (게임 전용 훅)
├── SimonPad.tsx, SimonStageReveal.tsx   # (게임 전용 컴포넌트)
└── simonRules.ts, simonInputTypes.ts    # (게임 전용 로직)
```

| gameId | 게임 | 참고 |
|---|---|---|
| `humanTimer` | 인간 정밀시계 | |
| `oneToTwentyFive` | 숫자 미로 1 to 25 | |
| `wordChain` | 초성 타자왕 | `useWordChainCategories` 포함 |
| `auction` | 코인 영끌 경매 | `assets/`(경매 아이템 이미지) |
| `colorMatch` | 절대색감? | `colorMath.ts` |
| `pixelCanvas` | 픽셀 영토 전쟁 | `PixelCanvasSnapshot` |
| `balloonPop` | 풍선 담력 테스트 | |
| `mouseHunter` | 소곤소곤 쥐 세 끼 | `assets/mouse`, `assets/rooms`, `MouseHunterSpotsDebug`(`/dev/mouse-spots`) |
| `scavengerHunt` | 찰칵 스캐빈저 | `scavengerHuntVision.ts`(TensorFlow.js, 지연 로딩) |
| `shoutRace` | 샤우팅 질주 | 마이크 사용 |
| `catchmind` | 이심전심 그림 맞히기 | `CatchmindSnapshot`(결과·텔레스트레이션에서도 사용) |
| `typeRace` | 텍스트 레이스 | |
| `telestration` | 이어그려줘 | |
| `telepathy` | 텔레파시 | |
| `minority` | 소수의견 | |
| `acrostic` | 막장 행시 | |
| `liarQuiz` | 거짓말쟁이 퀴즈 | 문제 직접 제작 폼 포함 |
| `simon` | 기억력 시퀀스 | |

## 라우팅 (`App.tsx`)

| 경로 | 화면 |
|---|---|
| `/` | `pages/Home` |
| `/number-baseball`, `/hangul-baseball`, `/black-jack`, `/choseong-quiz`, `/catchmind` | `solo/*` |
| `/party`, `/party/:roomCode` | `party/core/PartyGame`, `PartyRoom` |
| `/dev/mouse-spots` | `party/games/mouseHunter/MouseHunterSpotsDebug` (개발용) |

## 의존 방향 규칙

```
solo/*  ─┐
         ├──▶ shared/
party/* ─┘
party/core ──▶ party/games/*   (디스패처·결과 화면이 게임을 가져다 씀)
party/games/A ──▶ party/games/B  (최소화. 예: telestration → catchmind의 CatchmindSnapshot)
```

- `shared/`는 `solo/`·`party/`를 import하지 않습니다.
- `solo/`와 `party/`는 서로 import하지 않습니다.

## 새 파티 게임을 추가하려면

1. `src/party/games/<gameId>/`에 `XxxGame.tsx`, `useXxxRound.ts` 작성 (필요한 로직·에셋도 같은 폴더에)
2. 게임 전용 타입·상수는 `party/games/<gameId>/protocol.ts`에, 공통 이벤트 시그니처는 `shared/lib/partyProtocol.ts`에 추가 (백엔드 `types.ts`들과 동일하게 미러)
3. `party/core/PartyRoundActive.tsx`의 `switch`에 `case` 추가
4. 결과 화면에 게임 전용 표시가 필요하면 `party/core/PartyRoundResults.tsx` 수정
5. 백엔드 쪽 작업은 `mini_game_backend/STRUCTURE.md` 참고

## 새 솔로 게임을 추가하려면

1. `src/solo/<게임>/`에 페이지, 훅, 로직을 함께 작성 (`SoloIntro`, `RulesBox` 재사용)
2. `App.tsx`에 라우트 추가, `pages/Home.tsx`에 진입 카드 추가

## 스타일 (CSS)

스타일도 코드와 같은 기준으로 나뉘어 있고, 게임 폴더 안의 `styles.css`가 그 게임의 스타일입니다. `src/index.css`는 내용 없이 `@import`만 나열한 진입점입니다.

```
shared/styles/tokens.css       # 라이트/다크 테마 색 변수(:root), 배경 패턴
shared/styles/layout.css       # 헤더, 페이지 제목, 홈 게임 카드
shared/styles/components.css   # btn, badge, modal, 규칙 박스, 카테고리 선택, 입력 폼
solo/shared/styles.css         # SoloIntro, 결과 배너 등 솔로 공용
solo/<게임>/styles.css         # baseball(숫자·한글야구), blackjack, choseongQuiz, aiCatchmind
party/core/styles.css          # 로비, 카운트다운, 결과, 점수 목록 등 파티 공통
party/core/racing.css          # 샤우팅 질주·텍스트 레이스가 함께 쓰는 레이싱 화면
party/games/<게임>/styles.css  # 파티 게임별 스타일
```

- **순서가 곧 우선순위입니다.** `index.css`의 `@import` 순서는 공용 → 솔로 → 파티 코어 → 파티 게임입니다. 같은 우선순위(클래스 하나)로 같은 속성을 쓰는 규칙은 나중에 불러온 쪽이 이깁니다. 새 파일을 추가할 때는 이 순서를 고려해서 `@import`를 넣으세요.
- **게임 전용 스타일은 그 게임 클래스 접두사로 시작합니다** (`party-simon-*`, `bj-*`, `cq-*`, `aicm-*`). 접두사가 같으면 같은 파일에 있습니다.
- **알려진 사항:** `party/core/styles.css`의 `.party-exit-to-lobby` 규칙은 `.btn`보다 먼저 로드돼야 하는 기존 순서를 보존하기 위해 `shared/styles/layout.css`에 두었습니다(파일 안에 주석 있음). 현재 이 규칙의 `padding`은 `.btn`에 덮여 적용되지 않습니다.

## 명령어

```bash
npm run dev      # 개발 서버 (VITE_SOCKET_URL로 백엔드 지정)
npm run build    # tsc && vite build
```

## 참고

- 환경변수는 `.env`(git 제외)에 둡니다: `VITE_SOCKET_URL`, `VITE_KOREAN_BASIC_DICTIONARY_API_SECRET_KEY`.
- Windows는 대소문자를 구분하지 않으므로 같은 폴더에 대소문자만 다른 파일(`BlackJack.tsx` / `blackjack.ts`)을 두지 마세요.
