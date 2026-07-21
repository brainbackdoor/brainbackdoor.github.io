# 홈 화면과 소개 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 임시 스캐폴드인 홈(`/`)을 데이터 기반 실제 랜딩으로 교체하고, 없는 소개 페이지(`/about`)를 새로 만들며 nav에 "소개"를 되살린다.

**Architecture:** 홈이 필요로 하는 집계는 `src/lib/home.ts` 순수 함수로 빼서 Vitest로 검증하고(Task 1), 페이지는 렌더만 한다. 소개의 정적 콘텐츠는 `src/data/about.ts`에 두어 소개 페이지와 홈 사이드바가 공유한다(Task 2). 그다음 홈 페이지(Task 3) → nav 복원(Task 4) → 폭 토큰+소개 페이지(Task 5) → 모바일·대비 검증(Task 6) 순으로 바깥 데이터에서 화면으로 좁혀 들어간다.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, Vitest, TypeScript 6.x

## Global Constraints

- 색·간격 값은 `src/styles/global.css`의 `@theme` 블록에만 정의한다. 컴포넌트/페이지에 hex/px/oklch 색상값을 직접 박지 않는다. 컨테이너 폭 같은 레이아웃 상수도 토큰으로 둔다.
- 시안의 따뜻한 색(`#f4f2ee`·`#24211d`·`#6b6459`·`oklch(0.45 0.1 32)` 외 채도색)은 쓰지 않는다. **3a 중성 테마 토큰만** 쓴다: 배경 `canvas`/카드 `surface`/푸터 `sunken`, 본문 `ink`/부제 `ink-muted`/메타 `ink-subtle`/라벨 `ink-faint`, 강조 `accent`.
- 플레이스홀더 이미지는 중성 회색 2단계 `repeating-linear-gradient(45deg, oklch(0.93 0 0), oklch(0.93 0 0) 11px, oklch(0.9 0 0) 11px, oklch(0.9 0 0) 22px)` — `MissionCard.astro`·`Header.astro` 선례. 장식이므로 `aria-hidden="true"`.
- 순수 로직은 `src/lib`에 두고 Vitest로 검증한다. 날짜는 `src/lib/date.ts`(`formatDate`/`formatShortDate`/`getYear`)만 쓴다 — 로컬 게터 금지(타임존 밀림).
- 하드코딩된 글 수·최신 글 금지. featured·최근 글·카테고리 카운트는 전부 `loadPosts('ko')`에서 파생한다.
- TypeScript는 **6.x 고정**. 올리지 않는다(TS 7은 `astro check`를 깨뜨린다).
- 모바일 320·375·768px에서 문서 가로 스크롤이 없어야 한다(`documentElement.scrollWidth <= clientWidth`). 2열 그리드는 모바일 1열로 쌓고(`grid-cols-1 sm:grid-cols-2`), 큰 제목은 모바일에서 줄인다.
- 대비는 흰 배경에서 본문 텍스트 ≥ 4.5:1, 장식 메타 ≥ 3:1. `getComputedStyle`은 oklch 문자열을 주므로 canvas로 실제 RGB를 뽑아 WCAG로 계산한다. classList가 아니라 computed style로 확인한다.
- 각 태스크 끝에서 `pnpm test`, `pnpm check`, `pnpm build`가 통과해야 한다.

## 확정된 결정 (브레인스토밍)

1. featured = 최신 글 1편. "최근 글" 목록에서 **제외**한다.
2. 카테고리 카드는 `CATEGORIES` 4종을 **항상 그 순서로** 낸다. 글 0인 카테고리도 카드를 표시하고 안내를 보인다.
3. 소개 폭은 새 토큰 `--spacing-container-about: 860px`. 하드코딩 금지.
4. 홈 사이드바 "지금 하는 일"은 `src/data/about.ts`의 `current`를 공유한다(항목 수 가변).
5. 소개 폭은 `BaseLayout` prop이 아니라 `about.astro` 슬롯 안 자체 래퍼로 적용한다.

## 이 계획이 다루지 않는 것 (PRD §6)

giscus 댓글, `/en/` 홈·소개, 배포(remote·Pages), 시안의 따뜻한 색 복원.

---

### Task 1: 홈 집계 순수 함수 (`src/lib/home.ts`)

**Files:**
- Create: `src/lib/home.ts`
- Test: `src/lib/home.test.ts`

**Interfaces:**
- Consumes: `PostSummary`(`src/lib/posts.ts`), `sortByDateDesc`(`src/lib/posts.ts`), `CATEGORIES`·`CategorySlug`(`src/lib/categories.ts`)
- Produces:
  - `splitFeatured(posts: PostSummary[], recentCount = 5): { featured: PostSummary | null; recent: PostSummary[] }`
  - `interface CategoryCard { slug: CategorySlug; label: string; count: number; latest: PostSummary | null }`
  - `categoryCards(posts: PostSummary[]): CategoryCard[]` — 항상 길이 4, `CATEGORIES` 순서

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/home.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import type { CategorySlug } from './categories';
import { categoryCards, splitFeatured } from './home';

function post(
  slug: string,
  date: string,
  category: CategorySlug = 'infra',
): PostSummary {
  return {
    slug,
    lang: 'ko',
    title: slug,
    description: '',
    pubDate: new Date(date),
    category,
    tags: [],
    minutes: 1,
    href: `/posts/${slug}`,
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
    const posts = [
      post('a', '2024-01-01'),
      post('b', '2024-06-01'),
      post('c', '2024-03-01'),
    ];
    const { featured, recent } = splitFeatured(posts);
    expect(featured?.slug).toBe('b');
    expect(recent.map((p) => p.slug)).toEqual(['c', 'a']);
    expect(recent).not.toContain(featured);
  });

  it('recent는 recentCount편으로 제한된다', () => {
    const posts = Array.from({ length: 8 }, (_, i) =>
      post(`p${i}`, `2024-01-0${i + 1}`),
    );
    const { recent } = splitFeatured(posts, 5);
    expect(recent).toHaveLength(5);
  });
});

describe('categoryCards', () => {
  it('CATEGORIES 4종을 항상 그 순서로 반환한다', () => {
    expect(categoryCards([]).map((c) => c.slug)).toEqual([
      'retrospect',
      'infra',
      'guide',
      'life',
    ]);
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
    const bySlug = Object.fromEntries(
      categoryCards(posts).map((c) => [c.slug, c]),
    );
    expect(bySlug.retrospect.count).toBe(1);
    expect(bySlug.infra.count).toBe(2);
    expect(bySlug.infra.latest?.slug).toBe('i2');
    expect(bySlug.guide.count).toBe(0);
    expect(bySlug.guide.latest).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/home.test.ts`
Expected: FAIL — `home.ts`가 없어 import 해석 실패("Failed to resolve import './home'").

- [ ] **Step 3: 최소 구현 작성**

`src/lib/home.ts`:

```ts
import { CATEGORIES, type CategorySlug } from './categories';
import { sortByDateDesc, type PostSummary } from './posts';

/**
 * 홈이 필요로 하는 집계는 여기 순수 함수로 둔다. Astro 런타임에 의존하지 않아
 * Vitest로 검증된다. 페이지는 이 결과를 렌더만 한다.
 */

export interface HomeFeed {
  featured: PostSummary | null;
  recent: PostSummary[];
}

/**
 * featured는 최신 글 1편. recent는 featured를 뺀 그다음 recentCount편.
 * 입력이 정렬돼 있지 않아도 되도록 내부에서 최신순으로 세운다.
 */
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

/**
 * CATEGORIES 4종을 그 순서로. 글이 0이면 count 0·latest null인 카드를 그대로
 * 낸다 — 구조가 먼저 서 있고 글이 쌓이면 채워지도록.
 */
export function categoryCards(posts: PostSummary[]): CategoryCard[] {
  const sorted = sortByDateDesc(posts);
  return CATEGORIES.map((c) => {
    const inCat = sorted.filter((p) => p.category === c.slug);
    return { slug: c.slug, label: c.label, count: inCat.length, latest: inCat[0] ?? null };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/home.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/home.ts src/lib/home.test.ts
git commit -m "홈 집계 순수 함수 splitFeatured·categoryCards"
```

---

### Task 2: 소개 정적 데이터 (`src/data/about.ts`)

PRD §4의 텍스트가 실제 데이터다. `infra.ts` 패턴대로 타입과 함께 여기 두고, 소개 페이지와 홈 사이드바가 공유한다.

**Files:**
- Create: `src/data/about.ts`

**Interfaces:**
- Consumes: 없음
- Produces (소개 페이지·홈이 import):
  - `profile: { name; subtitle; quoteHeading; quoteBody: string }`
  - `interface CareerItem { org: string; role: string }` · `career: CareerItem[]`
  - `education: string[]` · `contact: string`
  - `interface SnsLink { label: string; href: string }` · `sns: SnsLink[]`
  - `interface ValueCard { name: string; tagline: string; body: string }` · `values: ValueCard[]`
  - `interface CurrentItem { title: string; subtitle: string }` · `current: CurrentItem[]`
  - `past: string[]` · `pastMore: string`

- [ ] **Step 1: 데이터 파일 작성**

`src/data/about.ts`:

```ts
/**
 * 소개 페이지의 정적 콘텐츠. infra.ts와 같은 패턴 — 마크업과 분리해 페이지는
 * 렌더만 하게 한다. 홈의 "지금 하는 일" 사이드바도 current를 공유한다(단일 출처).
 */

export interface CareerItem {
  org: string;
  role: string;
}

export interface SnsLink {
  label: string;
  href: string;
}

export interface ValueCard {
  name: string;
  tagline: string;
  body: string;
}

export interface CurrentItem {
  title: string;
  subtitle: string;
}

export const profile = {
  name: '이동규',
  subtitle: '그란데클립 프로덕트 엔지니어 · brainbackdoor',
  quoteHeading: '그대는 전율이어라',
  quoteBody:
    '좋은 울림을 주는 엔지니어를 지향합니다. 좋은 개발문화를 위한 Agile·DevOps 실천 전략에 관심이 많고, Web Architecture를 이루는 구성 요소들에 흥미를 가지고 있어요. 오늘 행한 작은 실천이 주위에 긍정적인 영향을 주길 바라며 개발하고, 가르치고, 기록합니다.',
};

export const career: CareerItem[] = [
  { org: '그란데클립', role: '프로덕트 엔지니어 · AX Partner' },
  { org: '우아한형제들', role: '주문접수채널팀 백엔드 엔지니어' },
  { org: '우아한형제들', role: '배민 셀프서비스팀 백엔드 엔지니어' },
  { org: '우아한형제들', role: '우아한테크코스 코치' },
  { org: '에코마케팅', role: '데이터 엔지니어' },
  { org: '이스트소프트', role: '시스템 엔지니어' },
];

export const education: string[] = ['코드스쿼드', '공군사관학교'];

export const contact = 'brainbackdoor@gmail.com';

export const sns: SnsLink[] = [
  { label: 'GitHub', href: 'https://github.com/brainbackdoor' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/%EB%8F%99%EA%B7%9C-%EC%9D%B4-0606b415a/' },
  { label: 'Facebook', href: 'https://www.facebook.com/brainbackdoor' },
  { label: 'Instagram', href: 'https://www.instagram.com/dongguulee/' },
  { label: 'Rallit', href: 'https://www.rallit.com/hub/resumes/40455/%EC%9D%B4%EB%8F%99%EA%B7%9C' },
];

export const values: ValueCard[] = [
  {
    name: 'Core Value',
    tagline: '핵심가치를 함께 인지하는 문화',
    body: '서비스의 핵심가치를 모두 인지하고 도메인 지식을 서로 공유하며, 그 근간이 되는 기술 개발에 능동적입니다. 고객 창출과 만족을 위한 전략을 세우는 데 필요한 것을 잘 파악합니다.',
  },
  {
    name: 'DevOps',
    tagline: '짧은 주기·장애 내성·고품질',
    body: '스크럼·칸반 등 애자일에 익숙하고 디자이너/PO/PM/프론트엔드와 원팀으로 일해왔습니다. TDD·ATDD·DDD 강의와 리뷰 경험이 많아 코드리뷰·테스트·성능테스트로 견고한 아키텍처를 구성합니다.',
  },
  {
    name: 'Professional',
    tagline: '책임감·자부심·전문성',
    body: '이스트소프트·에코마케팅·우아한형제들에서 사내외 유의미한 제품을 꾸준히 만들어왔습니다. 결과물은 측정 가능한 상태를 지향하며, 수익 외에도 비용 개선·생산성·시장 형성 측면에서 성과를 도출해왔습니다.',
  },
];

export const current: CurrentItem[] = [
  { title: '그란데클립', subtitle: '프로덕트 엔지니어 · AX Partner' },
  { title: 'NEXTSTEP', subtitle: '교육자, 사업 및 운영' },
  { title: '인프라공방', subtitle: '강사' },
  { title: '하린이 육아', subtitle: '가장 중요한 프로젝트' },
];

export const past: string[] = [
  '카카오 신입사원 교육',
  '카카오테크캠퍼스 백엔드 코치',
  '현대차 소프티어 부트캠프 멘토',
  '스테이폴리오 서비스 개발',
  '팀스파르타 항해 플러스 코치',
  '우아한형제들 사장님서비스실',
  '우아한테크코스 코치',
  '우아한테크캠프 Pro',
  'F-lab 플러그인 정기 세미나',
];

export const pastMore = '그 외 다수의 강연·기고·운영 활동';
```

- [ ] **Step 2: 타입 검증**

Run: `pnpm check`
Expected: 0 errors (아직 import하는 곳이 없어도 파일 자체가 타입 통과).

- [ ] **Step 3: 커밋**

```bash
git add src/data/about.ts
git commit -m "소개 정적 데이터 about.ts (홈 사이드바와 공유)"
```

---

### Task 3: 홈 페이지 (`src/pages/index.astro` 교체)

**Files:**
- Modify: `src/pages/index.astro` (전체 교체)

**Interfaces:**
- Consumes: `loadPosts`(`src/lib/collection.ts`), `splitFeatured`·`categoryCards`(`src/lib/home.ts`), `current`(`src/data/about.ts`), `categoryLabel`(`src/lib/categories.ts`), `formatDate`(`src/lib/date.ts`), `BaseLayout`
- Produces: 없음(터미널 화면)

- [ ] **Step 1: 페이지 전체 교체**

`src/pages/index.astro` 전체를 아래로 바꾼다.

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

// 플레이스홀더 이미지 배경(중성 회색 2단계) — MissionCard 선례와 동일
const tile =
  'repeating-linear-gradient(45deg, oklch(0.93 0 0), oklch(0.93 0 0) 11px, oklch(0.9 0 0) 11px, oklch(0.9 0 0) 22px)';
---

<BaseLayout title="씨유 · brainbackdoor" description="이동규의 기술 블로그" active="home">
  <!-- 히어로 -->
  <section class="border-b border-ink/10 py-16 sm:py-24">
    <div class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
      이동규 · brainbackdoor
    </div>
    <h1
      class="mt-4 max-w-[820px] text-[32px] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance sm:text-[52px]"
    >
      오늘도 한 방울의 맑은 물이 되리라.
    </h1>
    <p class="mt-5 max-w-[600px] text-[17px] leading-relaxed text-ink-muted">
      소프트웨어·교육·삶을 오가며 남기는 기록. 프로덕트 엔지니어이자 교육자로 일하며
      배운 것들을 조용히 정리합니다.
    </p>
  </section>

  <!-- 이달의 글 + 사이드바 -->
  <section class="grid grid-cols-1 gap-10 py-14 lg:grid-cols-[1fr_280px]">
    <div>
      <div class="mb-4 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        이달의 글
      </div>
      {
        featured ? (
          <a href={featured.href} class="group block">
            <div
              class="h-[280px] rounded-[16px]"
              style={`background: ${tile}`}
              aria-hidden="true"
            />
            <div class="mt-5 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
              {categoryLabel(featured.category)}
            </div>
            <h2 class="mt-2.5 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance group-hover:text-accent sm:text-[32px]">
              {featured.title}
            </h2>
            <p class="mt-3 max-w-[560px] text-[16px] leading-relaxed text-ink-muted">
              {featured.description}
            </p>
            <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-ink-faint">
              <span>{formatDate(featured.pubDate)}</span><span>·</span>
              <span>{featured.minutes}분 읽기</span>
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
      <div class="mb-4 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        지금 하는 일
      </div>
      <div class="flex flex-col gap-3">
        {
          current.map((item) => (
            <a
              href="/about"
              class="rounded-card border border-ink/10 bg-surface px-4 py-3.5 transition-colors hover:border-ink/20"
            >
              <div class="text-[14px] font-bold tracking-[-0.01em]">{item.title}</div>
              <div class="mt-0.5 text-[12.5px] text-ink-subtle">{item.subtitle}</div>
            </a>
          ))
        }
      </div>
    </aside>
  </section>

  <!-- 카테고리 카드 -->
  <section class="border-t border-ink/10 py-14">
    <div class="mb-6 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
      카테고리
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {
        cards.map((card) => (
          <a
            href="/posts"
            class="rounded-card border border-ink/10 bg-surface px-[22px] py-6 transition-colors hover:border-ink/20"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="text-lg font-bold tracking-[-0.01em]">{card.label}</h3>
              <span class="shrink-0 font-mono text-[13px] text-ink-faint">
                {card.count}편
              </span>
            </div>
            <p class="mt-2 text-[13.5px] leading-normal text-ink-subtle">
              {card.latest ? card.latest.title : '아직 글이 없습니다'}
            </p>
          </a>
        ))
      }
    </div>
  </section>

  <!-- 최근 글 -->
  <section class="border-t border-ink/10 py-14">
    <div class="mb-6 flex items-baseline justify-between gap-3">
      <h2 class="text-xl font-bold tracking-[-0.01em]">최근 글</h2>
      <a href="/posts" class="text-[13px] text-ink-faint transition-colors hover:text-ink-subtle">
        전체 {total}편 →
      </a>
    </div>
    {
      recent.length > 0 ? (
        <ul class="flex flex-col">
          {recent.map((p) => (
            <li class="border-t border-ink/8 first:border-t-0">
              <a
                href={p.href}
                class="group flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div
                  class="h-12 w-12 shrink-0 rounded-[10px]"
                  style={`background: ${tile}`}
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
                    {categoryLabel(p.category)}
                  </div>
                  <div class="mt-1 text-[16px] font-semibold tracking-[-0.01em] group-hover:text-accent">
                    {p.title}
                  </div>
                </div>
                <div class="shrink-0 font-mono text-[12.5px] text-ink-faint sm:text-right">
                  {formatDate(p.pubDate)} · {p.minutes}분
                </div>
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

- [ ] **Step 2: 전체 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과.

- [ ] **Step 3: 개발 서버에서 렌더 육안 확인**

Run: `pnpm dev` 후 `/`를 연다. 히어로·이달의 글(가장 최근 글 = "2024년 회고")·카테고리 4장(회고 1편·인프라 2편·실습 가이드 0편·라이프 0편)·최근 글 목록(featured 제외)이 뜨는지 본다. (모바일·대비 실측은 Task 6에서.)

- [ ] **Step 4: 커밋**

```bash
git add src/pages/index.astro
git commit -m "홈 페이지를 데이터 기반 랜딩으로 교체"
```

---

### Task 4: nav에 소개 복원 (`src/lib/nav.ts`)

소개 페이지가 `active="about"`을 쓰려면 `NavKey`에 `about`이 있어야 하므로 Task 5보다 먼저 한다.

**Files:**
- Modify: `src/lib/nav.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `NAV_ITEMS`에 `about` 항목 추가 → `NavKey` 유니온이 `'about'`을 포함

- [ ] **Step 1: NAV_ITEMS에 소개 추가하고 주석 수정**

`src/lib/nav.ts`에서 상단 주석 문단과 `NAV_ITEMS`를 아래처럼 바꾼다.

주석 마지막 문장을 교체:

```ts
/**
 * 헤더 nav의 단일 출처.
 *
 * key를 유니온 타입으로 묶는다. 예전에는 `active`가 string이라 존재하지 않는
 * 키('archive')를 넘겨도 타입체크를 통과했고, 현재 위치 표시가 조용히 꺼져 있었다.
 *
 * 전용 라우트가 없는 항목은 넣지 않는다 — 넣으면 링크가 404가 된다. 소개(/about)는
 * 4단계에서 페이지를 만들며 되살렸다. 카테고리별 목록은 아직 라우트가 없어 빼둔다.
 */
```

`NAV_ITEMS`에 `about` 행을 추가:

```ts
export const NAV_ITEMS = [
  { key: 'home', label: '홈', href: '/' },
  { key: 'tech', label: '기술', href: '/tech/infra' },
  { key: 'archive', label: '글', href: '/posts' },
  { key: 'about', label: '소개', href: '/about' },
] as const;
```

(`NavKey` 정의 줄 `export type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'search';`는 그대로 둔다 — `about`은 자동 유도된다.)

- [ ] **Step 2: 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과. (nav에 `/about` 링크가 생기지만 페이지는 Task 5에서 만든다 — 내부 앵커라 빌드는 통과한다.)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/nav.ts
git commit -m "nav에 소개(/about) 항목 복원"
```

---

### Task 5: 소개 폭 토큰 + 소개 페이지 (`src/pages/about.astro`)

**Files:**
- Modify: `src/styles/global.css` (`@theme` 블록에 토큰 1줄)
- Create: `src/pages/about.astro`

**Interfaces:**
- Consumes: `BaseLayout`, `profile`·`career`·`education`·`contact`·`sns`·`values`·`current`·`past`·`pastMore`(`src/data/about.ts`)
- Produces: 없음(터미널 화면)

- [ ] **Step 1: 폭 토큰 추가**

`src/styles/global.css`의 `@theme` 블록에서 레이아웃 항목에 한 줄 추가한다.

```css
  /* ── 레이아웃 ── */
  --spacing-container: 1120px;
  --spacing-container-narrow: 900px; /* 아카이브처럼 본문만 있는 페이지 */
  --spacing-container-about: 860px; /* 소개 — 아카이브보다 좁은 본문 폭 */
  --spacing-header: 56px;
```

- [ ] **Step 2: 소개 페이지 작성**

`src/pages/about.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import {
  profile,
  career,
  education,
  contact,
  sns,
  values,
  current,
  past,
  pastMore,
} from '../data/about';

const tile =
  'repeating-linear-gradient(45deg, oklch(0.93 0 0), oklch(0.93 0 0) 11px, oklch(0.9 0 0) 11px, oklch(0.9 0 0) 22px)';
---

<BaseLayout title="소개 · 이동규" description="이동규 — 그란데클립 프로덕트 엔지니어" active="about">
  <div class="mx-auto max-w-container-about">
    <!-- 프로필 헤더 -->
    <section class="flex flex-col gap-6 border-b border-ink/10 py-14 sm:flex-row sm:items-start sm:gap-8">
      <div
        class="size-[108px] shrink-0 rounded-full"
        style={`background: ${tile}`}
        aria-hidden="true"
      >
      </div>
      <div>
        <div class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
          자기소개
        </div>
        <h1 class="mt-2 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[40px]">
          {profile.name}
        </h1>
        <p class="mt-2 text-[15px] text-ink-muted">{profile.subtitle}</p>
        <blockquote class="mt-5 border-l-3 border-accent pl-5">
          <div class="text-[15px] font-bold text-accent">{profile.quoteHeading}</div>
          <p class="mt-2 text-[15px] leading-relaxed text-ink-muted">{profile.quoteBody}</p>
        </blockquote>
      </div>
    </section>

    <!-- Career / Education / Contact -->
    <section class="grid grid-cols-1 gap-10 border-b border-ink/10 py-14 sm:grid-cols-2">
      <div>
        <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Career</h2>
        <ul class="mt-4 flex flex-col gap-3.5">
          {
            career.map((c) => (
              <li>
                <div class="text-[15px] font-semibold tracking-[-0.01em]">{c.org}</div>
                <div class="mt-0.5 text-[13.5px] text-ink-subtle">{c.role}</div>
              </li>
            ))
          }
        </ul>
      </div>
      <div class="flex flex-col gap-8">
        <div>
          <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Education</h2>
          <ul class="mt-4 flex flex-col gap-2">
            {education.map((e) => <li class="text-[15px] text-ink">{e}</li>)}
          </ul>
        </div>
        <div>
          <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Contact</h2>
          <a
            href={`mailto:${contact}`}
            class="mt-4 inline-block text-[15px] text-accent transition-colors hover:text-accent-hover"
          >
            {contact}
          </a>
          <div class="mt-4 flex flex-wrap gap-2">
            {
              sns.map((s) => (
                <a
                  href={s.href}
                  target="_blank"
                  rel="me noopener"
                  class="rounded-pill bg-ink/5 px-[13px] py-[7px] text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-ink/10"
                >
                  {s.label}
                </a>
              ))
            }
          </div>
        </div>
      </div>
    </section>

    <!-- 지향하는 개발 문화 -->
    <section class="border-b border-ink/10 py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        지향하는 개발 문화
      </h2>
      <div class="mt-6 flex flex-col gap-4">
        {
          values.map((v) => (
            <article class="rounded-card border border-ink/10 bg-surface px-[22px] py-6">
              <h3 class="text-[15px] font-bold text-accent">{v.name}</h3>
              <div class="mt-1 text-[13px] text-ink-subtle">{v.tagline}</div>
              <p class="mt-3 text-[14.5px] leading-relaxed text-ink-muted">{v.body}</p>
            </article>
          ))
        }
      </div>
    </section>

    <!-- 현재 하는 일 -->
    <section class="border-b border-ink/10 py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        현재 하는 일
      </h2>
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {
          current.map((item) => (
            <article class="overflow-hidden rounded-card border border-ink/10 bg-surface">
              <div class="h-[132px]" style={`background: ${tile}`} aria-hidden="true" />
              <div class="px-[22px] py-5">
                <h3 class="text-[15px] font-bold tracking-[-0.01em]">{item.title}</h3>
                <p class="mt-1 text-[13px] text-ink-subtle">{item.subtitle}</p>
              </div>
            </article>
          ))
        }
      </div>
    </section>

    <!-- 이전 활동 -->
    <section class="py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        이전 활동
      </h2>
      <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {
          past.map((caption) => (
            <figure class="overflow-hidden rounded-tile border border-ink/10 bg-surface">
              <div class="h-[110px]" style={`background: ${tile}`} aria-hidden="true" />
              <figcaption class="px-4 py-3 text-[12.5px] leading-snug text-ink-muted">
                {caption}
              </figcaption>
            </figure>
          ))
        }
      </div>
      <p class="mt-6 text-center text-[13px] text-ink-faint">{pastMore}</p>
    </section>
  </div>
</BaseLayout>
```

- [ ] **Step 3: 전체 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과. `border-l-3`가 없다는 오류가 나면(Tailwind 기본에 3px border 유틸이 없을 수 있음) `border-l-[3px]`로 바꾼다 — 이는 폭이 아니라 테두리 두께라 토큰 규칙 대상이 아니다.

- [ ] **Step 4: 개발 서버 육안 확인**

Run: `pnpm dev` 후 `/about`을 연다. 프로필·Career 6줄·Education·Contact+SNS 5개 알약·개발문화 3카드·현재 하는 일 4카드·이전 활동 9카드+하단 문구가 뜨는지 본다. 헤더 nav의 "소개"에 현재 위치 표시(진한 색)가 되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/global.css src/pages/about.astro
git commit -m "소개 페이지와 폭 토큰 --spacing-container-about"
```

---

### Task 6: 모바일 반응형 · 대비 실측

홈과 소개 두 페이지를 320·375·768px에서 가로 스크롤 없이, 대비 기준을 넘겨 검증한다.

**Files:**
- (수정은 검증에서 문제가 발견될 때만. 발견 시 해당 페이지/토큰을 고친다.)

**Interfaces:**
- Consumes: 빌드된 `/`·`/about`
- Produces: 없음

- [ ] **Step 1: 프리뷰 서버 기동**

Run: `pnpm build && pnpm preview`
Expected: `http://localhost:4321` 기동(포트는 출력 참고).

- [ ] **Step 2: 가로 스크롤 실측**

브라우저 프리뷰로 `/`와 `/about`을 열고, 320·375·768px 각각에서 아래를 콘솔로 확인한다.

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Expected: 두 페이지·세 폭 모두 `true`. `false`면 넘치는 요소를 찾아(가장 흔한 원인: 고정 px 폭, 2열 그리드가 안 쌓임, 긴 URL·제목) 해당 섹션을 `grid-cols-1 sm:grid-cols-2`·`min-w-0`·`break-words`로 고친 뒤 다시 빌드·측정.

- [ ] **Step 3: 대비 실측 (computed style → 실제 RGB → WCAG)**

`/`와 `/about`에서 본문·메타 대표 요소의 대비를 아래 스니펫으로 계산한다. classList가 아니라 computed color로 확인한다.

```js
function srgbToRgb(str) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = str;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
function lum([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const a = lum(srgbToRgb(fg)) + 0.05;
  const b = lum(srgbToRgb(bg)) + 0.05;
  return (Math.max(a, b) / Math.min(a, b)).toFixed(2);
}
// 예: 본문 문단과 메타
const bg = getComputedStyle(document.body).backgroundColor;
const p = document.querySelector('main p');
console.log('본문', ratio(getComputedStyle(p).color, bg)); // ≥ 4.5
```

Expected: 본문으로 읽는 텍스트(`text-ink`/`text-ink-muted`) ≥ 4.5:1, 장식 메타(`text-ink-faint`) ≥ 3:1. 기준 미달이면 3a에서 정해진 토큰 범위 안에서 더 진한 잉크 토큰으로 바꾼다(예: `ink-faint` 대신 `ink-subtle`). 토큰 값 자체는 3a에서 실측으로 잡았으므로 되도록 토큰을 바꾸지 말고 사용 토큰을 올린다.

- [ ] **Step 4: 최종 검증과 커밋**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과.

수정이 있었다면:

```bash
git add -A
git commit -m "홈·소개 모바일 반응형·대비 실측 보정"
```

수정이 없었다면 이 태스크는 커밋 없이 검증만으로 끝난다.

---

## 완료 후

모든 태스크가 끝나면 `superpowers:finishing-a-development-branch`로 `--no-ff` main 머지를 진행한다(앞 단계와 동일).

## Self-Review 노트

- **PRD §3(홈)**: 히어로(Task 3)·이달의 글+사이드바(Task 3, featured=최신·사이드바=current)·카테고리 4카드(Task 1 함수 + Task 3 렌더)·최근 글(Task 3, featured 제외)·active="home"(Task 3) — 커버.
- **PRD §4(소개)**: 프로필·Career/Education/Contact/SNS·개발문화 3·현재 4·이전 9 (Task 2 데이터 + Task 5 렌더)·폭 토큰(Task 5)·nav 복원(Task 4)·active="about"(Task 5) — 커버.
- **PRD §5 교차**: 헤더/푸터는 BaseLayout(전 페이지)·데이터 의존 하드코딩 금지(Task 1·3)·정적 콘텐츠 데이터 분리(Task 2)·접근성 aria-hidden(Task 3·5) — 커버.
- **타입 일관성**: `splitFeatured`/`categoryCards`/`CategoryCard`(Task 1)와 Task 3 소비, `current`/`CurrentItem` 외(Task 2)와 Task 3·5 소비 이름·시그니처 일치 확인.
