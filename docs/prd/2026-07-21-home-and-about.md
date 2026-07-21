# PRD — 홈 화면과 소개 페이지

작성일: 2026-07-21
대상: 이 저장소에서 새 세션으로 진행할 작업

## 0. 한 줄 요약

임시 스캐폴드 상태인 **홈(`/`)** 을 실제 랜딩 페이지로 만들고, 현재 없는 **소개 페이지(`/about`)** 를 새로 만든다. 둘 다 Claude Design 시안을 따르되, 크롬·색은 이 저장소의 확립된 규칙(흰 배경 중성 테마)을 쓴다.

---

## 1. 지금 이 저장소의 상태 (꼭 먼저 파악)

Astro 7 + React 19 + Tailwind CSS 4 기반 개인 블로그. 1~3c단계가 `main`에 머지돼 있다.

- **1단계** — 스캐폴딩, 디자인 토큰, 인프라 대시보드(`/tech/infra`)
- **2단계** — 글 상세·아카이브·읽기 편의 기능
- **3a** — 흰 배경 **중성 테마**(따뜻한 베이지 → 순백+회색), 모바일 반응형, 푸터 하단 고정
- **3b** — 태그 페이지, i18n 라우팅(한/영), 언어 전환
- **3c** — Pagefind 검색

**시작 전에 반드시 읽을 것:**

- `docs/superpowers/specs/2026-07-20-blog-foundation-design.md` — 설계 원칙
- `docs/superpowers/plans/` — 지난 단계 계획들(컨벤션의 근거)
- `.superpowers/sdd/deferred-findings.md` — 미뤄둔 지적(소개 페이지 관련 항목 포함)
- `src/styles/global.css` — 디자인 토큰의 단일 출처
- `src/components/` — 재사용할 컴포넌트들
- 전역 `~/.claude/CLAUDE.md` — 응답 한국어, 기존 파일 편집 우선

---

## 2. 반드시 지킬 컨벤션 (앞 단계에서 값비싸게 배운 것들)

이 규칙들은 앞 단계에서 리뷰가 실제 결함을 잡으며 확립됐다. 어기면 같은 함정에 빠진다.

1. **색·간격은 `@theme` 토큰만.** 컴포넌트에 hex/px/oklch 색상값을 직접 박지 않는다. 시안의 하드코딩된 따뜻한 색(`#f4f2ee`, `#24211d`, `#6b6459` 등)은 **그대로 쓰지 말 것** — 3a에서 흰 배경 중성으로 바뀌었다. 아래 토큰으로 매핑한다:
   - 배경 `--color-canvas`(흰색) / 카드 `--color-surface` / 푸터 `--color-sunken`
   - 본문 `--color-ink` / 부제 `--color-ink-muted` / 메타 `--color-ink-subtle` / 라벨 `--color-ink-faint`
   - 강조 `--color-accent`(테라코타, 유일하게 채도 있는 색). 시안의 `oklch(0.45 0.1 32)`는 이 토큰과 같다.
   - 시안의 `repeating-linear-gradient` 플레이스홀더 이미지는 중성 회색 두 단계(`oklch(0.93 0 0)` / `oklch(0.9 0 0)`)로 바꾼다 — `MissionCard.astro`·`Header.astro`에 선례가 있다.

2. **기존 컴포넌트를 재사용한다.** 새 페이지는 `BaseLayout`(title·description·active·narrow·altLocale prop), `Header`, `Footer`로 감싼다. 목록 행·카드·메타 표기는 아카이브(`ArchiveView`)·`PostMeta`·`RelatedPosts`의 마크업 패턴을 따른다. 새로 만들기 전에 있는 걸 먼저 본다.

3. **순수 로직은 `src/lib`에 두고 Vitest로 검증.** 페이지는 렌더링만. 최근 글 선별·정렬 같은 로직이 필요하면 `src/lib`의 기존 함수(`loadPosts`, `sortByDateDesc`, `collectTags`)를 쓰거나 새 순수 함수로 뺀다. 페이지 프런트매터에 로직을 늘어놓지 않는다.

4. **날짜는 `src/lib/date.ts`** (`formatDate`/`formatShortDate`/`getYear`)만 쓴다. `getFullYear` 같은 로컬 게터를 새로 쓰지 않는다(타임존 밀림).

5. **TypeScript는 6.x 고정.** 올리지 말 것 — TS 7은 `astro check`를 깨뜨린다.

6. **검증 3종을 각 태스크 끝에 돌린다:** `pnpm test`(순수 함수), `pnpm check`(0 errors), `pnpm build`(통과).

7. **모바일 반응형은 필수.** 320·375·768px에서 문서 가로 스크롤이 없어야 한다(`documentElement.scrollWidth <= clientWidth`). 시안은 데스크톱 폭이므로 2열 그리드는 모바일에서 1열로 쌓는다(`grid-cols-1 sm:grid-cols-2` 식). 제목 크기도 모바일에서 줄인다(3a·3b 선례).

8. **대비는 눈이 아니라 실측으로.** 흰 배경에서 본문 텍스트 대비 ≥ 4.5:1, 장식 메타 ≥ 3:1. `getComputedStyle`은 oklch 문자열을 돌려주므로 canvas로 실제 RGB를 뽑아 WCAG 대비를 계산한다(3a Task 1에 방법 있음). **클래스가 붙었는지가 아니라 computed style로 확인.** (앞 단계에서 classList만 보고 오판한 사고가 있었다.)

9. **dev 서버 캐시 주의.** 브랜치 전환·큰 변경 후 페이지가 비어 보이면 코드 문제로 단정하지 말고 `rm -rf .astro node_modules/.vite` 후 재시작한다. 검색은 빌드 후에만 되므로 `pnpm preview`로 확인.

---

## 3. 산출물 1 — 홈 페이지 (`/`, `src/pages/index.astro` 교체)

**현재:** `src/pages/index.astro`는 "1단계 스캐폴딩 — 홈 화면은 4단계에서 구현합니다" 임시 문구. 이걸 통째로 실제 랜딩으로 교체한다. 컨테이너 폭은 기본 1120px(`max-w-container`, `narrow` 안 씀).

시안(`홈.dc.html`)의 섹션 구조:

### 3.1 히어로 (상단, 하단 보더)
- eyebrow: `이동규 · brainbackdoor` (uppercase, letter-spacing, `text-ink-faint`)
- h1: **오늘도 한 방울의 맑은 물이 되리라.** (52px 데스크톱 / 모바일 축소, extrabold, `text-wrap:balance`, max-width ~820px)
- 소개 문단: "소프트웨어·교육·삶을 오가며 남기는 기록. 프로덕트 엔지니어이자 교육자로 일하며 배운 것들을 조용히 정리합니다." (`text-ink-muted`, max-width ~600px)

### 3.2 이달의 글 + 사이드바 (2열: 1fr / 280px, 모바일 1열)
- **이달의 글**(큰 카드): 시안은 "일의 감각"이라는 예시 글. **실제로는 데이터 기반으로** — `loadPosts('ko')`의 **가장 최근 글**을 featured로 쓴다. eyebrow에 카테고리 라벨(`categoryLabel`), 플레이스홀더 이미지(중성 회색, 280px 높이, radius 16px), 제목(32px), description, 날짜·읽기시간 메타(`formatDate` + `분 읽기`). 링크는 그 글의 `href`.
  - 정책: featured = 최신 글 1편. "최근 글" 목록(3.4)과 겹쳐도 되고 빼도 된다 — 구현자 판단, 겹치면 3.4에서 featured를 제외하는 편이 깔끔.
- **사이드바 "지금 하는 일"**: 정적. 3개 항목, 각 `/about`으로 링크:
  - 그란데클립 — 프로덕트 엔지니어 · AX
  - NEXTSTEP — 교육자 · 사업/운영
  - 인프라공방 — 강사

### 3.3 카테고리 카드 (2열, 모바일 1열)
시안은 라이프/테크 두 묶음이지만, 이 블로그의 실제 카테고리는 4종(`회고·문화`/`인프라`/`실습 가이드`/`라이프`)이다. **두 가지 선택지, 구현자가 정하되 데이터 기반으로:**
- (권장) 4개 카테고리 각각의 카드로 하고, 카드마다 실제 글 수와 최신 글 제목을 보여준다(`collectTags`가 아니라 카테고리별 집계가 필요 — `src/lib`에 순수 함수로 추가하고 테스트).
- 또는 시안대로 2개 묶음을 유지하되 카운트·최신글은 실제 데이터로.
- **하드코딩된 "5편"/"39편"은 쓰지 말 것** — 실제 카운트를 계산한다.

### 3.4 최근 글 (목록)
- 헤더: "최근 글" + 우측 "전체 N편 →"(N = 실제 글 수, `/posts`로 링크).
- `loadPosts('ko')` 최신순 상위 5편. 각 행: 작은 플레이스홀더 이미지(48px, 중성) + 카테고리 라벨 + 제목 + 날짜·시간 메타. 아카이브 목록 행 마크업과 톤을 맞추고 모바일에서 세로로 쌓는다.

### 3.5 active 상태
`<BaseLayout active="home">` (이미 `NavKey`에 있음).

---

## 4. 산출물 2 — 소개 페이지 (`/about`, `src/pages/about.astro` 신규)

**현재:** `/about` 라우트가 없어 3b에서 nav의 "소개" 항목을 뺐다(404 방지). 이 페이지를 만들면서 **nav에 소개를 되살린다.**

컨테이너 폭은 시안 기준 **860px**(아카이브 900px보다 좁음). `max-w-[860px]`를 쓰거나 `--spacing-container-narrow`처럼 토큰을 추가한다. 내용은 아래 **실제 데이터**를 그대로 쓴다(시안 renderVals에서 추출).

### 4.1 프로필 헤더 (하단 보더)
- 좌: 원형 아바타 플레이스홀더(108px, 중성 회색). 실제 사진이 있으면 `public/`에 넣고 교체 가능하게.
- 우: eyebrow "자기소개" / h1 **이동규** / 부제 "그란데클립 프로덕트 엔지니어 · brainbackdoor"
- 가치 인용문(blockquote): 강조색 소제목 **"그대는 전율이어라"** + 본문:
  > 좋은 울림을 주는 엔지니어를 지향합니다. 좋은 개발문화를 위한 Agile·DevOps 실천 전략에 관심이 많고, Web Architecture를 이루는 구성 요소들에 흥미를 가지고 있어요. 오늘 행한 작은 실천이 주위에 긍정적인 영향을 주길 바라며 개발하고, 가르치고, 기록합니다.

### 4.2 Career / Education / Contact (2열, 모바일 1열)
**Career** (최신순):
- 그란데클립 — 프로덕트 엔지니어 · AX Partner
- 우아한형제들 — 주문접수채널팀 백엔드 엔지니어
- 우아한형제들 — 배민 셀프서비스팀 백엔드 엔지니어
- 우아한형제들 — 우아한테크코스 코치
- 에코마케팅 — 데이터 엔지니어
- 이스트소프트 — 시스템 엔지니어

**Education**: 코드스쿼드 · 공군사관학교

**Contact**: brainbackdoor@gmail.com

**SNS** (알약 링크): GitHub(https://github.com/brainbackdoor) · LinkedIn · Facebook(https://www.facebook.com/brainbackdoor) · Instagram(https://www.instagram.com/dongguulee/) · Rallit

### 4.3 지향하는 개발 문화 (카드 3개, 세로 스택)
각 카드: 강조색 이름 + 회색 태그라인 + 본문.
- **Core Value** — 핵심가치를 함께 인지하는 문화 — "서비스의 핵심가치를 모두 인지하고 도메인 지식을 서로 공유하며, 그 근간이 되는 기술 개발에 능동적입니다. 고객 창출과 만족을 위한 전략을 세우는 데 필요한 것을 잘 파악합니다."
- **DevOps** — 짧은 주기·장애 내성·고품질 — "스크럼·칸반 등 애자일에 익숙하고 디자이너/PO/PM/프론트엔드와 원팀으로 일해왔습니다. TDD·ATDD·DDD 강의와 리뷰 경험이 많아 코드리뷰·테스트·성능테스트로 견고한 아키텍처를 구성합니다."
- **Professional** — 책임감·자부심·전문성 — "이스트소프트·에코마케팅·우아한형제들에서 사내외 유의미한 제품을 꾸준히 만들어왔습니다. 결과물은 측정 가능한 상태를 지향하며, 수익 외에도 비용 개선·생산성·시장 형성 측면에서 성과를 도출해왔습니다."

### 4.4 현재 하는 일 (카드 4개, 2열·모바일 1열)
각 카드: 플레이스홀더 이미지(132px) + 제목 + 부제.
- 그란데클립 — 프로덕트 엔지니어 / AX Partner
- NEXTSTEP — 교육자, 사업 및 운영
- 인프라공방 — 강사
- 하린이 육아 — 가장 중요한 프로젝트

### 4.5 이전 활동 (카드 9개, 3열·모바일 축소)
플레이스홀더 이미지 + 캡션:
- 카카오 신입사원 교육 / 카카오테크캠퍼스 백엔드 코치 / 현대차 소프티어 부트캠프 멘토
- 스테이폴리오 서비스 개발 / 팀스파르타 항해 플러스 코치 / 우아한형제들 사장님서비스실
- 우아한테크코스 코치 / 우아한테크캠프 Pro / F-lab 플러그인 정기 세미나
- 하단 중앙: "그 외 다수의 강연·기고·운영 활동" (`text-ink-faint`)

### 4.6 active 상태와 nav 복원
- `src/lib/nav.ts`의 `NAV_ITEMS`에 `{ key: 'about', label: '소개', href: '/about' }`를 추가한다. `NavKey` 유니온은 `NAV_ITEMS`에서 유도되므로 자동으로 `about`을 포함한다(현재 `| 'search'`만 수동 추가돼 있음 — 그건 그대로).
- 파일 상단 주석("소개 페이지는 3b에서 만들며, 그때 다시 넣는다")도 현실에 맞게 수정.
- `<BaseLayout active="about">`.

---

## 5. 교차 요구사항

- **디자인 시안의 헤더/푸터는 무시.** 시안마다 자체 헤더·푸터가 있지만 우리는 `BaseLayout`이 `Header`/`Footer`를 렌더한다. 시안에서는 **본문 섹션만** 가져온다.
- **시안의 `.dc.html` 문법**(`<x-dc>`, `sc-for`, `style-hover`, `{{ }}`)은 Astro가 아니다. 1단계에서 `인프라.dc.html`을 Astro로 번역한 선례(`src/pages/tech/infra.astro` + `src/data/infra.ts` + 컴포넌트들)를 참고해 같은 방식으로 번역한다.
- **홈의 데이터 의존**: featured·최근 글·카테고리 카운트는 전부 `loadPosts`/카테고리 집계에서 나온다. 하드코딩 금지. 시드 글이 3편뿐이라 홈이 성기게 보이는 건 정상 — 글이 쌓이면 채워진다.
- **소개의 정적 콘텐츠**: 위 4장의 텍스트가 실제 데이터다. 반복 항목(career·values·current·past)은 `src/data/about.ts` 같은 파일로 빼서 페이지는 렌더만 하게 하는 걸 권장(인프라 페이지의 `src/data/infra.ts` 패턴).
- **접근성**: 링크·랜드마크·이미지 대체. 아바타·플레이스홀더는 장식이므로 `aria-hidden` 또는 빈 alt.

---

## 6. 범위 밖 (하지 말 것)

- giscus 댓글(저장소 생성 후 별도 작업).
- 영어판 홈·소개(`/en/`) — 영어 콘텐츠가 쌓일 때. UI 문구 번역 안 함 원칙 유지.
- 배포(remote 교체·Pages 설정) — 별도 작업.
- 시안의 따뜻한 색을 되살리는 것 — 3a 중성 테마를 유지한다.

---

## 7. 디자인 시안 원본

Claude Design 프로젝트: `https://claude.ai/design/p/5032555b-a58d-4d5e-ac3d-5f3abc48fef9`
- 홈: `홈.dc.html`
- 소개: `자기소개.dc.html`

이 PRD에 시안의 핵심 콘텐츠·구조를 이미 옮겨 담았으므로 **재인증 없이 진행 가능하다.** 픽셀 단위 대조가 필요하면 design MCP 재인증(`/design-login`) 후 위 파일을 가져와 본다. 단, 색·크롬은 이 저장소 규칙이 우선한다.

---

## 8. 권장 진행 방식

1. `superpowers:brainstorming`으로 이 PRD의 모호한 결정(featured 정책, 카테고리 카드 4개 vs 2개, 소개 컨테이너 폭 토큰화 여부)을 먼저 확정.
2. `superpowers:writing-plans`로 태스크 계획 작성 — 대략: (a) 홈에 필요한 순수 함수(카테고리 집계 등)+테스트, (b) 홈 페이지, (c) 소개 데이터+페이지, (d) nav 복원, (e) 모바일·대비 검증.
3. `superpowers:subagent-driven-development`로 태스크별 구현+리뷰.
4. 각 단계 끝 `pnpm test && pnpm check && pnpm build`. 모바일은 320/375/768px 실측, 대비는 computed style로.
5. 완료 후 `--no-ff`로 `main`에 머지(앞 단계와 동일).
