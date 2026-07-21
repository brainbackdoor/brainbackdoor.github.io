# 홈 화면 구현 계획 (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 임시 스캐폴드인 홈(`/`)을 데이터 기반 v2 랜딩으로 교체하고, 한글이 mono에서 세리프로 폴백되던 전역 폰트 버그를 고친다.

**Architecture:** 홈 집계는 `src/lib/home.ts` 순수 함수(Vitest)로 빼고 페이지는 렌더만. 사이드바 "지금 하는 일"은 `src/data/about.ts`의 `current`를 공유. 디자인은 선·박스를 걷어낸 여백 우선(v2). `/about` 풀 이력서·nav 소개 복원·`--spacing-container-about` 토큰은 **Phase B(별도 계획)**로 분리한다.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, Vitest, TypeScript 6.x

## Global Constraints

- 색·간격·컨테이너 폭은 `src/styles/global.css`의 `@theme` 토큰만. 컴포넌트/페이지에 hex/px/oklch 직접 삽입 금지.
- 중성 테마 토큰만: 배경 `canvas`/카드 `surface`/가라앉은 면 `sunken`, 잉크 `ink`/`ink-muted`/`ink-subtle`/`ink-faint`, 강조 `accent`. 시안의 따뜻한 색 금지.
- **한글 텍스트에 `font-mono`를 직접 얹지 않는다.** mono가 필요한 자리(순수 숫자·라틴)만 mono로 두고, 한글이 섞이면 sans. (전역 폴백은 Task 2에서 보강.)
- 플레이스홀더는 소프트 단색(`bg-sunken`) + inset ring. 대각선 스트라이프를 새로 쓰지 않는다.
- 하드코딩된 글 수·최신 글 금지 — 전부 `loadPosts('ko')`에서 파생.
- 날짜는 `src/lib/date.ts`만. TypeScript 6.x 고정.
- 모바일 320·375·768px에서 `documentElement.scrollWidth <= clientWidth`. 2열 그리드는 모바일 1열. 히어로 제목은 모바일에서 축소.
- 대비: 본문 ≥ 4.5:1, 장식 메타 ≥ 3:1 — computed style RGB로 실측(classList 아님).
- 각 태스크 끝 `pnpm test`, `pnpm check`, `pnpm build` 통과.

## 이 계획이 다루지 않는 것 (Phase B)

풀 이력서 `/about`(중첩 Activity 모델·더보기·이미지 슬롯), nav "소개" 복원, `--spacing-container-about` 토큰. 별도 스펙/계획에서 진행한다. 따라서 이 계획에서 홈 사이드바 항목은 `/about`으로 링크하되(앵커 href), 그 페이지는 Phase B에서 생긴다.

---

### Task 1: 홈 집계 순수 함수 (`src/lib/home.ts`)

**Files:**
- Create: `src/lib/home.ts`
- Test: `src/lib/home.test.ts`

**Interfaces:**
- Consumes: `PostSummary`·`sortByDateDesc`(`src/lib/posts.ts`), `CATEGORIES`·`CategorySlug`(`src/lib/categories.ts`)
- Produces:
  - `splitFeatured(posts: PostSummary[], recentCount = 5): { featured: PostSummary | null; recent: PostSummary[] }`
  - `interface CategoryCard { slug: CategorySlug; label: string; count: number; latest: PostSummary | null }`
  - `categoryCards(posts: PostSummary[]): CategoryCard[]` (항상 길이 4, `CATEGORIES` 순서)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/home.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import type { CategorySlug } from './categories';
import { categoryCards, splitFeatured } from './home';

function post(slug: string, date: string, category: CategorySlug = 'infra'): PostSummary {
  return {
    slug, lang: 'ko', title: slug, description: '',
    pubDate: new Date(date), category, tags: [], minutes: 1, href: `/posts/${slug}`,
  };
}

describe('splitFeatured', () => {
  it('빈 목록이면 featured는 null, recent는 빈 배열', () => {
    expect(splitFeatured([])).toEqual({ featured: null, recent: [] });
  });

  it('1편이면 그 글이 featured, recent는 빈 배열', () => {
    const p = post('a', '2024-01-01');
    expect(splitFeatured([p])).toEqual({ featured: p, recent: [] });
  });

  it('최신 글이 featured, featured는 recent에 포함되지 않는다', () => {
    const posts = [post('a', '2024-01-01'), post('b', '2024-06-01'), post('c', '2024-03-01')];
    const { featured, recent } = splitFeatured(posts);
    expect(featured?.slug).toBe('b');
    expect(recent.map((p) => p.slug)).toEqual(['c', 'a']);
    expect(recent).not.toContain(featured);
  });

  it('recent는 recentCount편으로 제한된다', () => {
    const posts = Array.from({ length: 8 }, (_, i) => post(`p${i}`, `2024-01-0${i + 1}`));
    expect(splitFeatured(posts, 5).recent).toHaveLength(5);
  });
});

describe('categoryCards', () => {
  it('CATEGORIES 4종을 항상 그 순서로 반환한다', () => {
    expect(categoryCards([]).map((c) => c.slug)).toEqual(['retrospect', 'infra', 'guide', 'life']);
  });

  it('빈 목록이면 모든 카드가 count 0·latest null', () => {
    for (const card of categoryCards([])) {
      expect(card.count).toBe(0);
      expect(card.latest).toBeNull();
    }
  });

  it('카테고리별 글 수와 최신 글을 집계한다', () => {
    const posts = [
      post('r1', '2024-01-01', 'retrospect'),
      post('i1', '2024-02-01', 'infra'),
      post('i2', '2024-05-01', 'infra'),
    ];
    const bySlug = Object.fromEntries(categoryCards(posts).map((c) => [c.slug, c]));
    expect(bySlug.retrospect.count).toBe(1);
    expect(bySlug.infra.count).toBe(2);
    expect(bySlug.infra.latest?.slug).toBe('i2');
    expect(bySlug.guide.count).toBe(0);
    expect(bySlug.guide.latest).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `pnpm test src/lib/home.test.ts` · Expected: FAIL(`Failed to resolve import './home'`)

- [ ] **Step 3: 최소 구현** — `src/lib/home.ts`

```ts
import { CATEGORIES, type CategorySlug } from './categories';
import { sortByDateDesc, type PostSummary } from './posts';

export interface HomeFeed {
  featured: PostSummary | null;
  recent: PostSummary[];
}

/** featured=최신 1편, recent=featured 제외 그다음 recentCount편. 입력 순서 무의존. */
export function splitFeatured(posts: PostSummary[], recentCount = 5): HomeFeed {
  const [featured = null, ...rest] = sortByDateDesc(posts);
  return { featured, recent: rest.slice(0, recentCount) };
}

export interface CategoryCard {
  slug: CategorySlug;
  label: string;
  count: number;
  latest: PostSummary | null;
}

/** CATEGORIES 4종을 그 순서로. 글 0이면 count 0·latest null. */
export function categoryCards(posts: PostSummary[]): CategoryCard[] {
  const sorted = sortByDateDesc(posts);
  return CATEGORIES.map((c) => {
    const inCat = sorted.filter((p) => p.category === c.slug);
    return { slug: c.slug, label: c.label, count: inCat.length, latest: inCat[0] ?? null };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `pnpm test src/lib/home.test.ts` · Expected: PASS(7)
- [ ] **Step 5: 전체 검증** — Run: `pnpm test && pnpm check && pnpm build` · Expected: 통과
- [ ] **Step 6: 커밋**

```bash
git add src/lib/home.ts src/lib/home.test.ts
git commit -m "홈 집계 순수 함수 splitFeatured·categoryCards"
```

---

### Task 2: 한글 mono 폴백 수정 (`src/styles/global.css`)

`--font-mono`(Space Grotesk)에 한글 글리프가 없어, 한글을 mono로 지정하면 시스템 세리프(궁서체)로 폴백된다. 폴백에 `IBM Plex Sans KR`를 끼우면 한글은 산세리프, 숫자·라틴은 모노를 유지한다. `PostMeta`·`RelatedPosts`·`TopicSection`·`CategoryFilter`·`tags/[tag]` 5곳의 같은 문제가 동시에 해결된다.

**Files:**
- Modify: `src/styles/global.css` (`@theme` 타이포)

**Interfaces:** Consumes/Produces 없음(토큰 값 변경, 이름 불변).

- [ ] **Step 1: 폴백에 한글 산세리프 추가**

`src/styles/global.css`의 `@theme` 안 `--font-mono` 한 줄을 바꾼다.

```css
  --font-mono: 'Space Grotesk', 'IBM Plex Sans KR', ui-monospace, monospace;
```

- [ ] **Step 2: 검증** — Run: `pnpm test && pnpm check && pnpm build` · Expected: 통과
- [ ] **Step 3: 렌더 확인** — `pnpm dev` 후 글 상세(`/posts/2024-retrospect`)의 메타 줄 `N분 읽기 · 이동규`가 세리프가 아니라 산세리프로 보이는지 육안 확인. (computed check: 해당 span에 `getComputedStyle(el).fontFamily` 첫 매칭이 한글 글리프에선 IBM Plex Sans KR로 떨어짐 — 시각 확인으로 충분.)
- [ ] **Step 4: 커밋**

```bash
git add src/styles/global.css
git commit -m "한글이 mono에서 세리프로 폴백되던 문제 수정 (IBM Plex Sans KR 폴백)"
```

---

### Task 3: 홈 사이드바 데이터 (`src/data/about.ts`)

Phase A에서는 홈 사이드바가 쓰는 `current`만 둔다. Phase B에서 이력서 모델로 확장한다.

**Files:**
- Create: `src/data/about.ts`

**Interfaces:**
- Produces: `interface CurrentItem { title: string; subtitle: string }` · `current: CurrentItem[]`

- [ ] **Step 1: 파일 작성** — `src/data/about.ts`

```ts
/**
 * 소개·홈이 공유하는 정적 데이터. infra.ts 패턴. 홈 사이드바 "지금 하는 일"이
 * current를 쓴다. 풀 이력서(career·values·activities 등)는 Phase B에서 확장한다.
 */
export interface CurrentItem {
  title: string;
  subtitle: string;
}

export const current: CurrentItem[] = [
  { title: '그란데클립', subtitle: '프로덕트 엔지니어 · AX' },
  { title: 'NEXTSTEP', subtitle: '교육자 · 사업/운영' },
  { title: '인프라공방', subtitle: '강사' },
  { title: '하린이 육아', subtitle: '가장 중요한 프로젝트' },
];
```

- [ ] **Step 2: 검증** — Run: `pnpm check` · Expected: 0 errors
- [ ] **Step 3: 커밋**

```bash
git add src/data/about.ts
git commit -m "홈 사이드바용 about.ts current 데이터"
```

---

### Task 4: 홈 페이지 v2 (`src/pages/index.astro` 교체)

**Files:**
- Modify: `src/pages/index.astro` (전체 교체)

**Interfaces:**
- Consumes: `loadPosts`(`collection.ts`), `splitFeatured`·`categoryCards`(`home.ts`), `current`(`about.ts`), `categoryLabel`(`categories.ts`), `formatDate`(`date.ts`), `BaseLayout`

- [ ] **Step 1: 페이지 전체 교체** — `src/pages/index.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { loadPosts } from '../lib/collection';
import { splitFeatured, categoryCards } from '../lib/home';
import { categoryLabel } from '../lib/categories';
import { formatDate } from '../lib/date';
import { current } from '../data/about';

const posts = await loadPosts('ko');
const { featured, recent } = splitFeatured(posts, 5);
const cards = categoryCards(posts);
const total = posts.length;
---

<BaseLayout title="씨유 · brainbackdoor" description="이동규의 기술 블로그" active="home">
  <!-- 히어로 -->
  <section class="py-20 sm:py-24">
    <div class="flex items-center gap-2.5 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
      <span class="size-1.5 rounded-full bg-accent" aria-hidden="true"></span>
      이동규 · brainbackdoor
    </div>
    <h1 class="mt-6 max-w-[900px] text-[38px] leading-[1.08] font-extrabold tracking-[-0.04em] text-balance sm:text-[60px]">
      오늘도 한 방울의 맑은 물이 되리라.
    </h1>
    <p class="mt-6 max-w-[600px] text-[17px] leading-relaxed text-ink-muted sm:text-lg">
      소프트웨어·교육·삶을 오가며 남기는 기록. 프로덕트 엔지니어이자 교육자로 일하며
      배운 것들을 조용히 정리합니다.
    </p>
  </section>

  <!-- 이달의 글 + 사이드바 -->
  <section class="grid grid-cols-1 gap-12 pb-16 lg:grid-cols-[1fr_260px]">
    <div>
      <div class="mb-4 text-xs font-semibold tracking-[0.16em] text-accent uppercase">이달의 글</div>
      {
        featured ? (
          <a href={featured.href} class="group block">
            <div
              class="relative flex h-[300px] items-end overflow-hidden rounded-[20px] bg-sunken p-7 ring-1 ring-ink/5 ring-inset"
              aria-hidden="true"
            >
              <span class="absolute right-6 -bottom-2 text-[96px] leading-none font-extrabold tracking-[-0.04em] text-ink/[0.06]">
                {categoryLabel(featured.category)}
              </span>
            </div>
            <div class="mt-5 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
              {categoryLabel(featured.category)}
            </div>
            <h2 class="mt-2.5 max-w-[640px] text-[28px] leading-[1.14] font-extrabold tracking-[-0.03em] text-balance group-hover:text-accent sm:text-[36px]">
              {featured.title}
            </h2>
            <p class="mt-3.5 max-w-[560px] text-[16px] leading-relaxed text-ink-muted">
              {featured.description}
            </p>
            <div class="mt-4 text-[13px] text-ink-faint tabular-nums">
              {formatDate(featured.pubDate)} · {featured.minutes}분 읽기
            </div>
          </a>
        ) : (
          <p class="text-[15px] text-ink-subtle">
            아직 발행한 글이 없습니다. 곧 첫 글이 올라옵니다.
          </p>
        )
      }
    </div>

    <aside>
      <div class="mb-2 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">지금 하는 일</div>
      <div>
        {
          current.map((item) => (
            <a
              href="/about"
              class="flex items-baseline justify-between gap-3 border-t border-ink/6 py-3.5 first:border-t-0"
            >
              <span>
                <span class="block text-[14.5px] font-semibold tracking-[-0.01em]">{item.title}</span>
                <span class="mt-0.5 block text-[12px] text-ink-subtle">{item.subtitle}</span>
              </span>
              <span class="text-[13px] text-ink-faint" aria-hidden="true">↗</span>
            </a>
          ))
        }
      </div>
    </aside>
  </section>

  <!-- 카테고리 -->
  <section class="pb-16">
    <div class="mb-2 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">카테고리</div>
    <div class="grid grid-cols-1 gap-x-14 sm:grid-cols-2">
      {
        cards.map((card) => (
          <a href="/posts" class="group block border-t border-ink/10 py-6">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="text-[21px] font-bold tracking-[-0.02em] group-hover:text-accent">{card.label}</h3>
              <span class="text-[13px] text-ink-faint tabular-nums">
                {String(card.count).padStart(2, '0')}
              </span>
            </div>
            <p class:list={['mt-2.5 text-[14.5px]', card.latest ? 'text-ink-subtle' : 'text-ink-faint']}>
              {card.latest ? card.latest.title : '아직 글이 없습니다'}
            </p>
          </a>
        ))
      }
    </div>
  </section>

  <!-- 최근 글 -->
  <section class="pb-12">
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <h2 class="text-[21px] font-bold tracking-[-0.02em]">최근 글</h2>
      <a href="/posts" class="text-[13px] font-medium text-ink-faint transition-colors hover:text-ink-subtle">
        전체 {total}편 →
      </a>
    </div>
    {
      recent.length > 0 ? (
        <ul>
          {recent.map((p) => (
            <li>
              <a
                href={p.href}
                class="group grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-t border-ink/10 py-5 sm:grid-cols-[110px_1fr_auto] sm:gap-5"
              >
                <span class="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
                  {categoryLabel(p.category)}
                </span>
                <span class="text-[17px] font-semibold tracking-[-0.02em] group-hover:text-accent sm:text-[18px]">
                  {p.title}
                </span>
                <span class="col-span-2 text-[12.5px] text-ink-faint tabular-nums sm:col-span-1 sm:text-right">
                  {formatDate(p.pubDate)} · {p.minutes}분
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="text-[15px] text-ink-subtle">아직 최근 글이 없습니다.</p>
      )
    }
  </section>
</BaseLayout>
```

- [ ] **Step 2: 전체 검증** — Run: `pnpm test && pnpm check && pnpm build` · Expected: 통과. (`text-ink/[0.06]`·`ring-ink/5`·`gap-x-14` 등 유틸이 안 먹으면 근사 유틸로 조정.)
- [ ] **Step 3: 렌더 확인** — `pnpm dev` 후 `/`에서 히어로·이달의 글(최신 "2024년 회고")·카테고리 4장(회고 1·인프라 2·가이드 0·라이프 0)·최근 글(featured 제외)이 뜨는지 본다.
- [ ] **Step 4: 커밋**

```bash
git add src/pages/index.astro
git commit -m "홈 페이지를 데이터 기반 v2 랜딩으로 교체"
```

---

### Task 5: 모바일 반응형 · 대비 실측

**Files:** (문제 발견 시에만 해당 페이지/토큰 수정)

- [ ] **Step 1: 프리뷰 기동** — Run: `pnpm build && pnpm preview`
- [ ] **Step 2: 가로 스크롤 실측** — `/`를 320·375·768px에서 콘솔로 `document.documentElement.scrollWidth <= document.documentElement.clientWidth` → 세 폭 모두 `true`. `false`면 넘치는 요소를 `min-w-0`·`break-words`·그리드 1열로 고치고 다시 측정.
- [ ] **Step 3: 대비 실측** — `/`에서 본문·메타 대표 요소 대비를 계산(본문 ≥4.5:1, 메타 ≥3:1).

```js
function rgb(str){const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=str;x.fillRect(0,0,1,1);return[...x.getImageData(0,0,1,1).data.slice(0,3)];}
function lum([r,g,b]){const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
function ratio(fg,bg){const a=lum(rgb(fg))+0.05,b=lum(rgb(bg))+0.05;return(Math.max(a,b)/Math.min(a,b)).toFixed(2);}
const bg=getComputedStyle(document.body).backgroundColor;
const p=document.querySelector('main p');
console.log('본문', ratio(getComputedStyle(p).color, bg));
```

기준 미달이면 3a 토큰 범위 안에서 더 진한 잉크 토큰으로 사용 토큰을 올린다.

- [ ] **Step 4: 최종 검증·커밋** — Run: `pnpm test && pnpm check && pnpm build`. 수정 있었으면 커밋, 없었으면 검증만.

---

## 완료 후

Phase A가 끝나면 `superpowers:finishing-a-development-branch`로 `--no-ff` main 머지. 그다음 **Phase B(풀 이력서 `/about`)**를 별도 브레인스토밍/스펙/계획으로 진행한다.

## Self-Review 노트

- 스펙 §3(Phase A) 전 항목 → Task 1(home.ts)·2(폰트)·3(about.ts)·4(홈)·5(검증)로 매핑.
- 타입 일관성: `splitFeatured`/`categoryCards`/`CategoryCard`(T1)와 T4 소비, `current`/`CurrentItem`(T3)와 T4 소비 이름·시그니처 일치.
- Phase B로 미룬 것: `/about` 페이지, nav 소개 복원, `--spacing-container-about`, career/values/activities 데이터.
