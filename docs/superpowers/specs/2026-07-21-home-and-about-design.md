# 설계 — 홈 화면과 소개 페이지

작성일: 2026-07-21
근거 PRD: `docs/prd/2026-07-21-home-and-about.md`

## 0. 목표

임시 스캐폴드 상태의 홈(`/`)을 실제 랜딩으로 교체하고, 없는 소개 페이지(`/about`)를
새로 만든다. 콘텐츠·구조는 Claude Design 시안을 따르되 색·크롬은 이 저장소의 확립된
규칙(흰 배경 중성 테마, `@theme` 토큰만)을 쓴다. 소개를 만들며 nav의 "소개"를 되살린다.

## 1. 확정된 결정 (브레인스토밍)

1. **Featured 정책** — featured = 최신 글 1편. 이 글은 "최근 글" 목록(상위 5편)에서
   **제외**한다. 같은 글이 화면에 두 번 나오지 않게 한다.
2. **카테고리 카드** — `CATEGORIES` 4종(회고·문화/인프라/실습 가이드/라이프)을 **항상 그
   순서로** 카드로 낸다. 글이 0인 카테고리도 카드를 표시하고 "아직 글이 없습니다" 안내를
   보인다. 카운트·최신 글 제목은 전부 실제 데이터.
3. **소개 폭** — 새 토큰 `--spacing-container-about: 860px`를 `@theme`에 추가하고
   `max-w-container-about`으로 쓴다. 하드코딩 `max-w-[860px]` 금지(토큰 규칙 준수).
4. **홈 사이드바 "지금 하는 일"** — 소개 페이지의 "현재 하는 일"과 같은 데이터이므로
   `src/data/about.ts`를 단일 출처로 삼아 공유한다. 항목 수는 3개로 못박지 않는다(가변).
5. **about 폭 적용 방식** — `BaseLayout`에 prop을 늘리지 않는다. `about.astro`가 슬롯 안에서
   자체 폭 래퍼(`max-w-container-about mx-auto`)를 둔다. `BaseLayout`은 기본 폭 유지.

## 2. 반드시 지킬 컨벤션 (PRD §2 요약)

- 색·간격은 `@theme` 토큰만. hex/px/oklch 직접 삽입 금지. 시안의 따뜻한 색 금지(중성 유지).
- 플레이스홀더 이미지는 중성 회색 2단계 `repeating-linear-gradient` — `MissionCard`/`Header` 선례.
- 기존 컴포넌트/레이아웃 재사용: `BaseLayout`·`Header`·`Footer`, 목록/카드 마크업 톤 통일.
- 순수 로직은 `src/lib`+Vitest. 페이지는 렌더만. 날짜는 `src/lib/date.ts`만.
- TypeScript 6.x 고정. 검증 3종(`pnpm test`/`check`/`build`)을 각 태스크 끝에.
- 모바일 320/375/768px 가로 스크롤 없음. 2열 그리드는 모바일 1열 스택, 제목 축소.
- 대비는 computed style의 실제 RGB로 실측(본문 ≥4.5:1, 장식 메타 ≥3:1). classList 아님.
- 접근성: 아바타·플레이스홀더는 장식이므로 `aria-hidden` 또는 빈 alt.

## 3. 모듈 경계

### 3.1 `src/lib/home.ts` (신규) + `src/lib/home.test.ts`

홈이 필요로 하는 집계를 순수 함수로 분리한다. `PostSummary[]`를 받아 렌더용 뷰모델을
돌려준다. Astro 런타임 무의존 → Vitest로 검증.

```ts
import type { PostSummary } from './posts';
import type { CategorySlug } from './categories';

/** featured = 최신 글 1편, 나머지에서 최근 recentCount편. 입력 순서에 의존하지 않음. */
export function splitFeatured(
  posts: PostSummary[],
  recentCount = 5,
): { featured: PostSummary | null; recent: PostSummary[] };

export interface CategoryCard {
  slug: CategorySlug;
  label: string;
  count: number;
  latest: PostSummary | null;
}

/** CATEGORIES 4종을 항상 그 순서로. 글 0이면 count:0, latest:null. */
export function categoryCards(posts: PostSummary[]): CategoryCard[];
```

- `splitFeatured`: 내부에서 `sortByDateDesc`를 한 번 태워 최신순을 보장한 뒤,
  head 1편을 featured로, 그 다음부터 `recentCount`편을 recent로 자른다. featured가 recent에
  포함되지 않는다. 빈 목록이면 `{ featured: null, recent: [] }`.
- `categoryCards`: `CATEGORIES`를 순회하며 각 slug로 글을 필터링, `count`와 최신 글(`latest`)을
  구한다. `categoryLabel`로 라벨을 채운다. 항상 길이 4, 순서 고정.

**테스트 (`home.test.ts`):**
- 빈 목록: featured null, recent [], 카테고리 4개 전부 count 0·latest null.
- 1편만: featured = 그 글, recent [].
- 6편: featured = 최신, recent = 그다음 5편, featured가 recent에 없음.
- 입력이 뒤섞여 들어와도 최신순으로 정렬해 판정.
- `categoryCards`: 항상 4개·CATEGORIES 순서, 글 있는 카테고리 count/latest 정확, 빈 카테고리 null.

### 3.2 `src/data/about.ts` (신규)

`src/data/infra.ts` 패턴대로 소개의 정적 콘텐츠와 타입을 둔다. 페이지는 렌더만.

- `career: { org: string; role: string }[]` (최신순, PRD §4.2)
- `education: string[]`, `contact: string`
- `sns: { label: string; href: string }[]` (GitHub·LinkedIn·Facebook·Instagram·Rallit)
- `values: { name: string; tagline: string; body: string }[]` (개발문화 3카드, §4.3)
- `current: { title: string; subtitle: string }[]` (현재 하는 일, §4.4 — 홈 사이드바와 공유)
- `past: { caption: string }[]` (이전 활동 9개, §4.5)

홈 사이드바 "지금 하는 일"은 `current`를 그대로 읽어 각 항목을 `/about`으로 링크한다.
(항목 수 가변 — 홈은 `current` 전체 또는 앞 N개를 보여준다. 구현 시 확정.)

### 3.3 `src/pages/index.astro` (교체)

`<BaseLayout title description active="home">` (기본 1120px). 데이터: `loadPosts('ko')` →
`splitFeatured`/`categoryCards`, 정적 사이드바는 `about.ts`의 `current`.

섹션 (PRD §3):
1. 히어로 — eyebrow / h1(모바일 축소, `text-balance`) / 소개 문단.
2. 이달의 글 + 사이드바 (2열 `1fr/280px`, 모바일 1열). featured 큰 카드 + "지금 하는 일".
   featured가 null이면(글 없음) 카드 대신 담백한 안내.
3. 카테고리 카드 4개 (`grid-cols-1 sm:grid-cols-2`). 빈 카테고리는 안내 문구.
4. 최근 글 목록 — 헤더 "최근 글" + "전체 N편 →"(N = 실제 글 수, `/posts`). recent 상위 5편,
   각 행 작은 플레이스홀더 + 카테고리 라벨 + 제목 + 날짜·시간, 모바일 세로 스택.

### 3.4 `src/pages/about.astro` (신규)

`<BaseLayout title description active="about">`. 슬롯 안 자체 폭 래퍼
`max-w-container-about mx-auto`. 데이터는 `about.ts`. 섹션 (PRD §4.1~4.5):
프로필 헤더 / Career·Education·Contact 2열 / 개발문화 3카드 세로 / 현재 하는 일 4카드 2열 /
이전 활동 9카드 3열(모바일 축소) + 하단 "그 외 다수…". 플레이스홀더·아바타는 중성 회색·장식.

### 3.5 `src/lib/nav.ts` (수정)

`NAV_ITEMS`에 `{ key: 'about', label: '소개', href: '/about' }` 추가(글 뒤). `NavKey`는 자동
유도되어 `about` 포함. 상단 주석의 "소개 페이지는 3b에서 만들며…" 문구를 현실에 맞게 수정.

### 3.6 `src/styles/global.css` (수정)

`@theme`에 `--spacing-container-about: 860px;` 추가(기존 `--spacing-container-*` 옆).

## 4. 컴포넌트 재사용/신규 판단

- 플레이스홀더 이미지·태그 알약·카드 셸은 인라인 마크업으로 충분(선례 존재). 홈/소개에서
  반복되는 카드가 3종 이상 생기면 작은 컴포넌트로 뺀다 — 구현 중 반복이 확인될 때 결정.
- 소개의 반복 카드(values·current·past)는 `about.ts` 데이터를 `.map` 하는 인라인 렌더로 시작.

## 5. 검증 (각 태스크 끝)

`pnpm test && pnpm check && pnpm build`. 모바일 320/375/768px에서
`documentElement.scrollWidth <= clientWidth`. 대비는 canvas로 실제 RGB를 뽑아 WCAG 계산
(본문 ≥4.5:1, 메타 ≥3:1). 완료 후 `--no-ff`로 `main` 머지.

## 6. 범위 밖 (PRD §6)

giscus 댓글, `/en/` 홈·소개, 배포, 시안의 따뜻한 색 복원.
