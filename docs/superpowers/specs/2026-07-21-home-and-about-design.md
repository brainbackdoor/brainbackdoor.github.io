# 설계 — 홈 화면과 소개 페이지

작성일: 2026-07-21 (디자인 리뷰 반영 개정)
근거 PRD: `docs/prd/2026-07-21-home-and-about.md`
디자인 목업: 세션 아티팩트(홈·소개 v2, 중성 테마 토큰 기반)

## 0. 목표

임시 스캐폴드 상태의 홈(`/`)을 실제 랜딩으로 교체하고, 없는 소개 페이지(`/about`)를
만든다. 색·크롬은 이 저장소의 확립된 규칙(흰 배경 중성 테마, `@theme` 토큰만)을 쓴다.

## 0.1 범위 분해 (중요)

디자인 리뷰에서 `/about`이 라이브 brainbackdoor.com/profile 수준의 **완전한 상세
이력서**로 확장되기로 결정되어, 원래 한 덩어리였던 작업을 두 사이클로 나눈다.

- **Phase A — 홈 (이 계획으로 지금 구현)**: 홈 페이지, `home.ts` 순수 함수, 홈
  사이드바용 최소 `about.ts`(`current`), 전역 토큰(폰트 폴백 등), 검증.
  홈은 `/about`에 의존하지 않으므로 이력서 전사 작업에 묶이지 않는다.
- **Phase B — 풀 이력서 `/about` (별도 스펙·계획)**: 중첩 프로젝트 이력 데이터
  모델, `/about` 페이지, nav의 "소개" 복원, `--spacing-container-about` 토큰,
  "이전 활동" 더보기. Phase B는 자체 브레인스토밍/스펙에서 다룬다.

이 문서의 **§3은 Phase A**를 확정 설계로 담고, **§4는 Phase B의 방향**만 기록한다.

## 1. 확정된 결정 (브레인스토밍 + 디자인 리뷰)

1. **Featured** = 최신 글 1편. "최근 글" 목록(상위 5편)에서 **제외**한다.
2. **카테고리 카드** = `CATEGORIES` 4종(회고·문화/인프라/실습 가이드/라이프)을 항상
   그 순서로. 글 0인 카테고리도 표시하고 "아직 글이 없습니다" 안내. 카운트·최신 글은
   실제 데이터. (라이브의 라이프/테크 2대 묶음은 채택하지 않음 — 저장소 taxonomy는 4종.)
3. **홈 사이드바 "지금 하는 일"** = `about.ts`의 `current`(고수준 역할 4항목:
   그란데클립·NEXTSTEP·인프라공방·하린이 육아)를 공유. 각 항목 `/about` 링크.
   (이력서의 상세 "현재 활동"과는 다른 리스트다 — 그건 Phase B `activities`.)
4. **디자인 방향(v2)**: 선·박스를 걷어내고 여백 우선(hairline만), 타입 위계 강화
   (히어로 크게·트래킹 조임), 최근 글은 **텍스트-포워드(썸네일 없음)**.
5. **강조색 절제**: 테라코타는 강조 라벨·hover·인용문 등 소수 지점에만.
6. **폰트 규칙(전역 버그 수정)**: `--font-mono`(Space Grotesk)에 한글 글리프가 없어
   한글을 mono로 지정하면 시스템 세리프로 폴백돼 "궁서체"가 된다. **`--font-mono`
   폴백에 `IBM Plex Sans KR`를 끼워** 한글은 깔끔한 산세리프, 숫자·라틴은 모노를
   유지한다. 한 줄 토큰 수정으로 `PostMeta`·`RelatedPosts`·`TopicSection`·
   `CategoryFilter`·`tags/[tag]` 5곳의 같은 문제가 동시에 해결된다.
7. **플레이스홀더**: 대각선 스트라이프 대신 소프트 단색 뉴트럴 + 미세 inset 링.
   이는 **이미지가 없을 때의 공통 폴백**이다(홈·소개·인프라 공통).
8. **이미지 슬롯**(Phase B에서 본격화): 데이터에 optional `image?`를 두고 있으면
   실제 이미지, 없으면 소프트 폴백. Phase A 홈의 featured는 폴백 타일 + 카테고리
   고스팅으로 시작(글 프런트매터에 cover 필드를 추가하지 않는다 — 범위 밖).

## 2. 반드시 지킬 컨벤션 (PRD §2 요약)

- 색·간격·컨테이너 폭은 `@theme` 토큰만. hex/px/oklch 직접 삽입 금지.
- 시안의 따뜻한 색 금지(중성 유지). 강조색만 테라코타.
- 기존 컴포넌트/레이아웃 재사용: `BaseLayout`·`Header`·`Footer`.
- 순수 로직은 `src/lib`+Vitest. 날짜는 `src/lib/date.ts`만.
- 하드코딩된 글 수·최신 글 금지. 전부 `loadPosts('ko')`에서 파생.
- TypeScript 6.x 고정. 모바일 320/375/768px 가로 스크롤 없음. 2열은 모바일 1열.
- 대비 실측(본문 ≥4.5:1, 메타 ≥3:1) — computed style RGB로. 접근성 aria-hidden.

## 3. Phase A 설계 (지금 구현)

### 3.1 `src/lib/home.ts` (신규) + `src/lib/home.test.ts`

```ts
import type { PostSummary } from './posts';
import type { CategorySlug } from './categories';

export function splitFeatured(
  posts: PostSummary[],
  recentCount = 5,
): { featured: PostSummary | null; recent: PostSummary[] };
// featured=최신 1편, recent=featured 제외 그다음 recentCount편. 입력 순서 무의존.

export interface CategoryCard {
  slug: CategorySlug; label: string; count: number; latest: PostSummary | null;
}
export function categoryCards(posts: PostSummary[]): CategoryCard[];
// CATEGORIES 4종 항상 그 순서. 글 0이면 count 0·latest null.
```

테스트: 빈 목록/1편/6편(featured 제외·recentCount 제한)·입력 뒤섞임 정렬,
카테고리 항상 4개·순서·빈 카테고리 null·집계 정확.

### 3.2 `src/data/about.ts` (신규, Phase A 부분)

Phase A에서는 홈 사이드바가 쓰는 최소 데이터만 둔다. Phase B에서 이력서 모델을 확장한다.

```ts
export interface CurrentItem { title: string; subtitle: string }
export const current: CurrentItem[] = [
  { title: '그란데클립', subtitle: '프로덕트 엔지니어 · AX' },
  { title: 'NEXTSTEP', subtitle: '교육자 · 사업/운영' },
  { title: '인프라공방', subtitle: '강사' },
  { title: '하린이 육아', subtitle: '가장 중요한 프로젝트' },
];
```

### 3.3 `src/pages/index.astro` (교체)

`<BaseLayout title description active="home">`(기본 1120px). 데이터:
`loadPosts('ko')` → `splitFeatured`/`categoryCards`, 사이드바는 `about.ts` `current`.

v2 마크업:
- 히어로: eyebrow(강조 점) / h1 크게·트래킹 −0.04em·`text-balance` / 리드 문단.
- 이달의 글(폴백 타일+카테고리 고스팅) + 사이드바 "지금 하는 일"(borderless, hairline).
  featured null이면 담백한 안내.
- 카테고리 4카드: borderless, `grid-cols-1 sm:grid-cols-2`, hairline. 빈 카테고리 안내.
- 최근 글: **썸네일 없음**, 카테고리 라벨(sans)+제목+메타(sans), hairline 행, 모바일 스택.
  헤더 "최근 글" + "전체 N편 →".
- 한글 라벨·메타는 sans. 숫자 카운트만 mono 가능(단, §1.6 폴백으로 한글 안전).

### 3.4 `src/styles/global.css` (수정, Phase A 부분)

`--font-mono` 폴백 수정(§1.6):

```css
--font-mono: 'Space Grotesk', 'IBM Plex Sans KR', ui-monospace, monospace;
```

(`--spacing-container-about` 토큰은 `/about`을 만드는 Phase B에서 추가한다.)

### 3.5 검증

각 태스크 끝 `pnpm test && pnpm check && pnpm build`. 모바일 320/375/768px 가로
스크롤 없음, 대비 실측. 완료 후 `--no-ff` main 머지.

## 4. Phase B 방향 (별도 스펙에서 확정)

- **데이터 모델**(약식):
  ```ts
  interface Activity {
    title: string; org: string; period: string; current: boolean;
    bullets: string[];
    subProjects?: { title: string; period?: string; bullets: string[] }[];
    image?: string;
  }
  ```
  current(현재): NEXTSTEP 교육사업·GVC·EIR. past(이전): 스테이폴리오·CHAAK(→친구비
  프로모션)·Reclispe·주문접수채널(→MQTT 이관·취소구간 등)·셀프서비스(→일반셀러·
  우리가게클릭·개발문화)·우아한테크코스·강의서비스·에코마케팅 2·이스트소프트 2·
  멘사코리아·육아휴직.
- `about.ts` 확장: `profile`(quote 풀버전+"여기서" 링크·motto), `career`(org+역할,
  **날짜 없음** — 라이브 상단 목록과 동일), `education`, `contact`, `sns`(5개 URL 확보),
  `values`(풀 3문단 `body: string[]`), `activities: Activity[]`.
- `/about` 페이지: 슬롯 내 `max-w-container-about`(새 토큰 860px). 프로필→Career/
  Education/Contact→개발문화 3카드(풀)→현재 활동→이전 활동. **이전 활동은 더보기(점진
  노출)**. 이미지 슬롯+폴백.
- nav "소개" 복원(`src/lib/nav.ts` + 상단 주석 수정), `active="about"`.
- 콘텐츠 출처: 사용자가 붙여준 라이브 /profile 전문. 전사 정확성 검증 필요(별도 태스크).

## 5. 범위 밖 (PRD §6)

giscus 댓글, `/en/` 홈·소개, 배포, 시안의 따뜻한 색 복원, 글 프런트매터 cover 필드.
