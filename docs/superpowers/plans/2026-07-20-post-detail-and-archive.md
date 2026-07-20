# 2단계: 글 상세 · 아카이브 · 읽기 편의 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MDX로 쓴 글이 목록·상세 페이지로 렌더링되고, 카테고리 필터·목차·코드 복사 같은 읽기 편의 기능이 동작한다.

**Architecture:** 글은 Content Collection에서 읽는다. 목록 가공(정렬·연도 그룹핑·관련글·읽기시간)은 전부 `src/lib/`의 순수 함수로 분리해 Vitest로 검증하고, `.astro` 페이지는 그 결과를 렌더링만 한다. 인터랙션이 필요한 곳(카테고리 필터 칩)만 React island로 hydration하고 나머지는 정적 HTML + 소형 인라인 스크립트로 처리한다.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, MDX, Shiki, Vitest

## Global Constraints

- TypeScript는 **6.x 고정**. TS 7은 `astro check`가 쓰는 programmatic API를 노출하지 않아 타입체크가 깨진다.
- 색·간격 값은 `src/styles/global.css`의 `@theme` 블록에만 정의한다. 컴포넌트에 hex/px 색상값을 직접 박지 않는다.
- **다크모드는 구현하지 않는다.** 1단계에 선반영한 `:root[data-theme='dark']` 블록은 Task 1에서 제거한다.
- 카테고리는 아래 4종 평면 구조로 고정한다. 3종(`tech`/`retro`/`personal`) 스키마는 폐기한다.

  | slug | label |
  |---|---|
  | `retrospect` | 회고·문화 |
  | `infra` | 인프라 |
  | `guide` | 실습 가이드 |
  | `life` | 라이프 |

- 본문 최대 폭은 상세 페이지 `1120px`(본문 1fr + 목차 220px), 아카이브 페이지 `900px`.
- 강조색은 `--color-accent` (oklch(0.45 0.1 32)) 하나만 쓴다.
- 각 태스크 끝에서 `pnpm check`가 0 errors여야 한다.

---

### Task 1: 카테고리 레지스트리와 스키마 교체

**Files:**
- Create: `src/lib/categories.ts`
- Create: `src/lib/categories.test.ts`
- Create: `vitest.config.ts`
- Modify: `src/content.config.ts`
- Modify: `src/styles/global.css` (다크 토큰 블록 삭제)
- Modify: `package.json` (vitest 추가, test 스크립트)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type CategorySlug = 'retrospect' | 'infra' | 'guide' | 'life'`
  - `CATEGORIES: readonly Category[]` where `Category = { slug: CategorySlug; label: string }`
  - `categoryLabel(slug: CategorySlug): string`
  - `isCategorySlug(v: unknown): v is CategorySlug`

- [ ] **Step 1: Vitest 설치와 설정**

```bash
pnpm add -D vitest
```

`vitest.config.ts` 생성:

```ts
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryLabel, isCategorySlug } from './categories';

describe('categories', () => {
  it('디자인에 정의된 4개 카테고리를 순서대로 가진다', () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
      'retrospect',
      'infra',
      'guide',
      'life',
    ]);
  });

  it('slug를 한글 라벨로 옮긴다', () => {
    expect(categoryLabel('retrospect')).toBe('회고·문화');
    expect(categoryLabel('infra')).toBe('인프라');
    expect(categoryLabel('guide')).toBe('실습 가이드');
    expect(categoryLabel('life')).toBe('라이프');
  });

  it('알 수 없는 slug를 거른다', () => {
    expect(isCategorySlug('infra')).toBe(true);
    expect(isCategorySlug('tech')).toBe(false);
    expect(isCategorySlug(undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "./categories"`

- [ ] **Step 4: 최소 구현**

`src/lib/categories.ts`:

```ts
/**
 * 카테고리는 이 파일이 단일 출처다.
 * 디자인(블로그목차.dc.html)의 필터 칩 순서를 그대로 따른다.
 */
export const CATEGORIES = [
  { slug: 'retrospect', label: '회고·문화' },
  { slug: 'infra', label: '인프라' },
  { slug: 'guide', label: '실습 가이드' },
  { slug: 'life', label: '라이프' },
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategorySlug = Category['slug'];

const BY_SLUG = new Map<string, string>(CATEGORIES.map((c) => [c.slug, c.label]));

export function categoryLabel(slug: CategorySlug): string {
  return BY_SLUG.get(slug) ?? slug;
}

export function isCategorySlug(v: unknown): v is CategorySlug {
  return typeof v === 'string' && BY_SLUG.has(v);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS — 3 passed

- [ ] **Step 6: 콘텐츠 스키마를 새 카테고리로 교체**

`src/content.config.ts`의 `category` 필드를 수정한다. 기존:

```ts
    category: z.enum(['tech', 'retro', 'personal']),
```

교체:

```ts
    category: z.enum(['retrospect', 'infra', 'guide', 'life']),
```

- [ ] **Step 7: 다크모드 토큰 제거**

`src/styles/global.css`에서 `:root[data-theme='dark'] { ... }` 블록 전체와 그 위의 다크모드 설명 주석(`/* 다크모드 대응값. ... */`)을 삭제한다. `@layer base` 안의 `html`, `body`, `a`, `::selection` 규칙은 그대로 둔다.

- [ ] **Step 8: 타입체크와 빌드 확인**

Run: `pnpm check && pnpm build`
Expected: `0 errors`, `Complete!`

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "카테고리를 디자인의 4종 평면 구조로 교체하고 Vitest 도입

다크모드는 구현하지 않기로 해 선반영했던 토큰 블록을 제거한다."
```

---

### Task 2: 한국어 읽기 시간 계산

**Files:**
- Create: `src/lib/reading-time.ts`
- Create: `src/lib/reading-time.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `readingTime(markdown: string): number` — 분 단위 정수, 최소 1

- [ ] **Step 1: 실패하는 테스트 작성**

영어 단어 수 기반 공식은 한국어에 맞지 않는다. 한국어는 글자 수로 세고, 코드 블록은 본문과 읽는 속도가 달라 분리한다.

`src/lib/reading-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readingTime } from './reading-time';

describe('readingTime', () => {
  it('짧은 글도 최소 1분으로 올린다', () => {
    expect(readingTime('안녕하세요.')).toBe(1);
  });

  it('한글 500자를 1분으로 센다', () => {
    expect(readingTime('가'.repeat(1000))).toBe(2);
  });

  it('영문은 분당 200단어로 센다', () => {
    const words = Array.from({ length: 600 }, () => 'word').join(' ');
    expect(readingTime(words)).toBe(3);
  });

  it('펜스 코드 블록은 분당 250자로 따로 센다', () => {
    const code = '```js\n' + 'x'.repeat(1000) + '\n```';
    expect(readingTime(code)).toBe(4);
  });

  it('마크다운 문법 기호는 글자 수에서 뺀다', () => {
    const plain = '가'.repeat(500);
    const marked = `## 제목\n\n**${plain}**\n\n[링크](https://example.com)`;
    // 제목 2자 + 본문 500자 + 링크 텍스트 2자 = 504자 → 2분이 아니라 2분(올림)
    expect(readingTime(marked)).toBe(2);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/reading-time.test.ts`
Expected: FAIL — `Failed to resolve import "./reading-time"`

- [ ] **Step 3: 최소 구현**

`src/lib/reading-time.ts`:

```ts
/**
 * 한국어 기술 글 기준 읽기 시간.
 *
 * 영어권의 "분당 200단어" 공식은 한국어에 쓸 수 없다. 한국어는 공백으로
 * 나뉘는 단위가 영어 단어와 대응하지 않아서, 글자 수로 세는 편이 맞는다.
 * 코드 블록은 훑어 읽는 속도가 산문과 달라 따로 계산한다.
 */
const KO_CHARS_PER_MIN = 500;
const EN_WORDS_PER_MIN = 200;
const CODE_CHARS_PER_MIN = 250;

const FENCED_CODE = /```[\s\S]*?```/g;
const KOREAN = /[가-힣]/g;
const LATIN_WORD = /[A-Za-z][A-Za-z'-]*/g;

/** 읽는 대상이 아닌 마크다운 문법 기호를 걷어낸다. */
function stripMarkdown(src: string): string {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // 링크 → 텍스트만
    .replace(/`[^`]*`/g, '')                    // 인라인 코드
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')         // 제목 기호
    .replace(/^\s{0,3}>\s?/gm, '')              // 인용
    .replace(/[*_~]/g, '');                     // 강조
}

export function readingTime(markdown: string): number {
  const codeBlocks = markdown.match(FENCED_CODE) ?? [];
  const codeChars = codeBlocks.join('').replace(/\s/g, '').length;

  const prose = stripMarkdown(markdown.replace(FENCED_CODE, ''));
  const koreanChars = (prose.match(KOREAN) ?? []).length;
  const latinWords = (prose.match(LATIN_WORD) ?? []).length;

  const minutes =
    koreanChars / KO_CHARS_PER_MIN +
    latinWords / EN_WORDS_PER_MIN +
    codeChars / CODE_CHARS_PER_MIN;

  return Math.max(1, Math.ceil(minutes));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/reading-time.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/reading-time.ts src/lib/reading-time.test.ts
git commit -m "한국어 기준 읽기 시간 계산 추가

영어권의 분당 단어 수 공식 대신 글자 수로 센다. 코드 블록은
훑어 읽는 속도가 산문과 달라 분리해 계산한다."
```

---

### Task 3: 글 목록 가공 파이프라인

**Files:**
- Create: `src/lib/posts.ts`
- Create: `src/lib/posts.test.ts`

**Interfaces:**
- Consumes: `CategorySlug` from `src/lib/categories.ts`
- Produces:
  - `interface PostSummary { slug: string; lang: string; title: string; description: string; pubDate: Date; category: CategorySlug; tags: string[]; minutes: number; href: string }`
  - `parseEntryId(id: string): { lang: string; slug: string }`
  - `sortByDateDesc(posts: PostSummary[]): PostSummary[]`
  - `groupByKey<T>(items: T[], key: (item: T) => string): { key: string; items: T[] }[]`
  - `groupByYear(posts: PostSummary[]): { year: string; items: PostSummary[] }[]`
  - `relatedPosts(target: PostSummary, pool: PostSummary[], limit?: number): PostSummary[]`
  - `adjacentPosts(target: PostSummary, sorted: PostSummary[]): { prev: PostSummary | null; next: PostSummary | null }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/posts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import {
  adjacentPosts,
  groupByKey,
  groupByYear,
  parseEntryId,
  relatedPosts,
  sortByDateDesc,
} from './posts';

// pubDate만 문자열로 받는다. Partial<PostSummary>를 그대로 교차시키면
// pubDate가 Date & string = never가 되므로 Omit으로 빼낸다.
function post(
  over: Omit<Partial<PostSummary>, 'pubDate'> & { slug: string; pubDate: string },
): PostSummary {
  return {
    lang: 'ko',
    title: over.slug,
    description: '',
    category: 'infra',
    tags: [],
    minutes: 1,
    href: `/posts/${over.slug}`,
    ...over,
    pubDate: new Date(over.pubDate),
  };
}

describe('parseEntryId', () => {
  it('언어 디렉터리와 slug를 분리한다', () => {
    expect(parseEntryId('ko/tcp-recovery')).toEqual({ lang: 'ko', slug: 'tcp-recovery' });
    expect(parseEntryId('en/tcp-recovery')).toEqual({ lang: 'en', slug: 'tcp-recovery' });
  });

  it('중첩 디렉터리는 slug에 남긴다', () => {
    expect(parseEntryId('ko/2023/tcp')).toEqual({ lang: 'ko', slug: '2023/tcp' });
  });
});

describe('sortByDateDesc', () => {
  it('최신 글이 앞에 온다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'a', pubDate: '2022-01-01' }),
      post({ slug: 'c', pubDate: '2024-01-01' }),
      post({ slug: 'b', pubDate: '2023-01-01' }),
    ]);
    expect(sorted.map((p) => p.slug)).toEqual(['c', 'b', 'a']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const input = [post({ slug: 'a', pubDate: '2022-01-01' }), post({ slug: 'b', pubDate: '2024-01-01' })];
    sortByDateDesc(input);
    expect(input.map((p) => p.slug)).toEqual(['a', 'b']);
  });
});

describe('groupByKey', () => {
  it('키별로 묶고 첫 등장 순서를 유지한다', () => {
    const result = groupByKey(['apple', 'avocado', 'banana', 'apricot'], (s) => s[0]);
    expect(result).toEqual([
      { key: 'a', items: ['apple', 'avocado', 'apricot'] },
      { key: 'b', items: ['banana'] },
    ]);
  });

  it('빈 목록은 빈 배열이 된다', () => {
    expect(groupByKey([], () => 'x')).toEqual([]);
  });
});

describe('groupByYear', () => {
  it('연도별로 묶고 최신 연도부터 낸다', () => {
    const groups = groupByYear([
      post({ slug: 'a', pubDate: '2024-12-29' }),
      post({ slug: 'b', pubDate: '2023-11-09' }),
      post({ slug: 'c', pubDate: '2023-04-03' }),
    ]);
    expect(groups.map((g) => g.year)).toEqual(['2024', '2023']);
    expect(groups[1].items.map((p) => p.slug)).toEqual(['b', 'c']);
  });

  it('빈 목록은 빈 배열이 된다', () => {
    expect(groupByYear([])).toEqual([]);
  });
});

describe('relatedPosts', () => {
  it('태그가 많이 겹치는 순으로 낸다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP', '네트워크'] });
    const result = relatedPosts(target, [
      post({ slug: 'none', pubDate: '2023-01-01', tags: ['DB'] }),
      post({ slug: 'two', pubDate: '2023-01-01', tags: ['TCP', '네트워크'] }),
      post({ slug: 'one', pubDate: '2023-01-01', tags: ['TCP'] }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['two', 'one']);
  });

  it('자기 자신은 제외한다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP'] });
    expect(relatedPosts(target, [target])).toEqual([]);
  });

  it('겹치는 태그가 없으면 같은 카테고리의 최신 글로 채운다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP'], category: 'infra' });
    const result = relatedPosts(target, [
      post({ slug: 'old-infra', pubDate: '2020-01-01', tags: [], category: 'infra' }),
      post({ slug: 'new-infra', pubDate: '2023-01-01', tags: [], category: 'infra' }),
      post({ slug: 'life', pubDate: '2023-06-01', tags: [], category: 'life' }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['new-infra', 'old-infra']);
  });

  it('기본 2편까지만 낸다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP'] });
    const pool = ['a', 'b', 'c'].map((s) => post({ slug: s, pubDate: '2023-01-01', tags: ['TCP'] }));
    expect(relatedPosts(target, pool)).toHaveLength(2);
  });
});

describe('adjacentPosts', () => {
  it('최신순 목록에서 이전 글은 더 과거, 다음 글은 더 최신이다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'newest', pubDate: '2024-01-01' }),
      post({ slug: 'middle', pubDate: '2023-01-01' }),
      post({ slug: 'oldest', pubDate: '2022-01-01' }),
    ]);
    const { prev, next } = adjacentPosts(sorted[1], sorted);
    expect(prev?.slug).toBe('oldest');
    expect(next?.slug).toBe('newest');
  });

  it('양 끝에서는 한쪽이 null이다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'newest', pubDate: '2024-01-01' }),
      post({ slug: 'oldest', pubDate: '2022-01-01' }),
    ]);
    expect(adjacentPosts(sorted[0], sorted).next).toBeNull();
    expect(adjacentPosts(sorted[1], sorted).prev).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/posts.test.ts`
Expected: FAIL — `Failed to resolve import "./posts"`

- [ ] **Step 3: 최소 구현**

`src/lib/posts.ts`:

```ts
import type { CategorySlug } from './categories';

export interface PostSummary {
  slug: string;
  lang: string;
  title: string;
  description: string;
  pubDate: Date;
  category: CategorySlug;
  tags: string[];
  minutes: number;
  href: string;
}

/** Content Collection의 id는 "ko/tcp-recovery" 형태다. */
export function parseEntryId(id: string): { lang: string; slug: string } {
  const at = id.indexOf('/');
  if (at === -1) return { lang: 'ko', slug: id };
  return { lang: id.slice(0, at), slug: id.slice(at + 1) };
}

export function sortByDateDesc(posts: PostSummary[]): PostSummary[] {
  return [...posts].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

/**
 * 키별로 묶되 첫 등장 순서를 유지한다(Map의 삽입 순서).
 * 입력이 이미 정렬돼 있으면 그룹 순서도 그 정렬을 따른다.
 * 아카이브 페이지의 클라이언트 필터도 이 함수를 쓴다 — 그룹핑 로직을
 * 서버와 클라이언트에 각각 두지 않기 위해서다.
 */
export function groupByKey<T>(
  items: T[],
  key: (item: T) => string,
): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = groups.get(k);
    if (bucket) bucket.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.entries()].map(([k, v]) => ({ key: k, items: v }));
}

export function groupByYear(
  posts: PostSummary[],
): { year: string; items: PostSummary[] }[] {
  return groupByKey(sortByDateDesc(posts), (p) =>
    String(p.pubDate.getFullYear()),
  ).map(({ key, items }) => ({ year: key, items }));
}

/**
 * 태그가 겹치는 글을 우선하고, 모자라면 같은 카테고리의 최신 글로 채운다.
 * 겹침 수가 같으면 최신 글이 앞선다.
 */
export function relatedPosts(
  target: PostSummary,
  pool: PostSummary[],
  limit = 2,
): PostSummary[] {
  const others = pool.filter(
    (p) => !(p.slug === target.slug && p.lang === target.lang),
  );
  const targetTags = new Set(target.tags);

  const scored = others
    .map((p) => ({ post: p, overlap: p.tags.filter((t) => targetTags.has(t)).length }))
    .filter((s) => s.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || b.post.pubDate.getTime() - a.post.pubDate.getTime(),
    )
    .map((s) => s.post);

  if (scored.length >= limit) return scored.slice(0, limit);

  const picked = new Set(scored.map((p) => p.slug));
  const filler = sortByDateDesc(
    others.filter((p) => p.category === target.category && !picked.has(p.slug)),
  );

  return [...scored, ...filler].slice(0, limit);
}

/** sorted는 sortByDateDesc를 거친 최신순 목록이어야 한다. */
export function adjacentPosts(
  target: PostSummary,
  sorted: PostSummary[],
): { prev: PostSummary | null; next: PostSummary | null } {
  const i = sorted.findIndex((p) => p.slug === target.slug && p.lang === target.lang);
  if (i === -1) return { prev: null, next: null };
  return {
    next: i > 0 ? sorted[i - 1] : null,
    prev: i < sorted.length - 1 ? sorted[i + 1] : null,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS — 3개 파일 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/posts.ts src/lib/posts.test.ts
git commit -m "글 목록 가공 함수 추가 (정렬·연도 그룹핑·관련글·이전다음)

페이지에서 로직을 빼내 순수 함수로 두고 Vitest로 검증한다."
```

---

### Task 4: Collection 어댑터와 시드 글

**Files:**
- Create: `src/lib/collection.ts`
- Create: `src/content/posts/ko/tcp-error-recovery.mdx`
- Create: `src/content/posts/ko/load-balancer.mdx`
- Create: `src/content/posts/ko/2024-retrospect.mdx`

**Interfaces:**
- Consumes: `PostSummary`, `parseEntryId`, `sortByDateDesc` from `src/lib/posts.ts`; `readingTime` from `src/lib/reading-time.ts`
- Produces:
  - `toSummary(entry: CollectionEntry<'posts'>): PostSummary`
  - `loadPosts(lang?: string): Promise<PostSummary[]>` — draft 제외, 최신순 정렬 완료 상태로 반환

- [ ] **Step 1: 어댑터 작성**

이 파일은 Astro 런타임(`astro:content`)에 의존하므로 Vitest 대상이 아니다. 순수 로직은 Task 2·3에서 이미 검증했고, 여기서는 연결만 한다.

`src/lib/collection.ts`:

```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { parseEntryId, sortByDateDesc, type PostSummary } from './posts';
import { readingTime } from './reading-time';

export function toSummary(entry: CollectionEntry<'posts'>): PostSummary {
  const { lang, slug } = parseEntryId(entry.id);
  return {
    slug,
    lang,
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    category: entry.data.category,
    tags: entry.data.tags,
    minutes: readingTime(entry.body ?? ''),
    href: lang === 'ko' ? `/posts/${slug}` : `/${lang}/posts/${slug}`,
  };
}

/** draft는 제외하고 최신순으로 반환한다. */
export async function loadPosts(lang = 'ko'): Promise<PostSummary[]> {
  const entries = await getCollection('posts', ({ data }) => !data.draft);
  return sortByDateDesc(
    entries.map(toSummary).filter((p) => p.lang === lang),
  );
}
```

- [ ] **Step 2: 시드 글 3편 작성**

빌드 경고(`glob-loader: No files found`)를 없애고 이후 태스크의 렌더링 대상을 만든다. 내용은 디자인 시안의 글을 그대로 옮긴다.

`src/content/posts/ko/tcp-error-recovery.mdx`:

````mdx
---
title: TCP 에러 복구 살펴보기
description: 재전송이 어떻게 동작하는지 실제 시나리오로 따라갑니다.
pubDate: 2023-11-09
category: infra
tags: ['TCP', '네트워크', '트러블슈팅']
---

안정적으로 보이는 TCP 연결도 패킷 손실, 지연, 순서 뒤바뀜을 끊임없이 마주합니다. 우리가 신뢰할 수 있는 스트림을 얻는 건 그 아래에서 벌어지는 정교한 복구 메커니즘 덕분이에요.

## 재전송의 두 가지 트리거

TCP는 손실을 두 가지 방식으로 감지합니다. 하나는 타임아웃(RTO), 다른 하나는 중복 ACK를 통한 빠른 재전송(Fast Retransmit)입니다. 전자는 보수적이고 느리며, 후자는 공격적이고 빠릅니다.

> 세 개의 중복 ACK를 받으면, TCP는 타임아웃을 기다리지 않고 즉시 해당 세그먼트를 재전송합니다.

## RTO는 어떻게 계산되나

RTO는 고정값이 아니라 관측된 왕복 시간(RTT)을 기반으로 끊임없이 추정됩니다.

```js
// Jacobson/Karels RTO 추정
SRTT   = (1 - α) * SRTT   + α * R        // α = 1/8
RTTVAR = (1 - β) * RTTVAR + β * abs(SRTT - R)
RTO    = SRTT + 4 * RTTVAR               // 최소 1초로 클램프
```

추정된 `RTO` 안에 ACK가 도착하지 않으면 세그먼트는 손실로 간주되고, RTO는 지수적으로 두 배씩 늘어납니다.

## 실전에서 확인하기

실제 트래픽에서 재전송을 관찰하려면 `tcpdump`로 캡처한 뒤 흐름을 따라가면 됩니다.

```bash
# 특정 호스트의 재전송만 필터링
tcpdump -i eth0 'tcp[tcpflags] & tcp-push != 0' \
  -n host 10.0.1.42
```

재전송 비율이 1%를 넘기 시작하면 대개 네트워크 경로나 수신 측 버퍼에 병목이 있다는 신호입니다.

## 정리

TCP의 신뢰성은 마법이 아니라 관측·추정·재전송의 반복입니다.
````

`src/content/posts/ko/load-balancer.mdx`:

```mdx
---
title: 로드밸런서 뒤에서 벌어지는 일
description: 요청 하나가 로드밸런서를 지날 때 실제로 무슨 일이 일어나는지 따라갑니다.
pubDate: 2023-04-03
category: infra
tags: ['네트워크', '로드밸런싱']
---

로드밸런서는 요청을 나눠주는 장치로만 알려져 있지만, 실제로는 연결 관리·헬스체크·타임아웃까지 떠안고 있습니다.

## 연결은 어디서 끊기는가

클라이언트와 로드밸런서 사이의 연결, 로드밸런서와 서버 사이의 연결은 별개입니다. 이 둘을 하나로 착각하면 타임아웃 설정이 어긋납니다.

## 정리

앞단과 뒷단의 타임아웃을 함께 보는 습관이 장애 시간을 줄여줍니다.
```

`src/content/posts/ko/2024-retrospect.mdx`:

```mdx
---
title: 2024년 회고
description: 한 해 동안 무엇을 배웠고 무엇을 놓쳤는지 정리합니다.
pubDate: 2024-12-29
category: retrospect
tags: ['회고']
---

올해는 가르치는 일과 만드는 일 사이의 균형을 다시 잡은 해였습니다.

## 배운 것

설명할 수 없는 지식은 아직 내 것이 아니라는 걸 다시 확인했습니다.

## 정리

내년에는 만든 것을 더 자주 글로 남기려 합니다.
```

- [ ] **Step 3: 빌드로 스키마 검증**

Run: `pnpm build`
Expected: `Complete!` — `glob-loader: No files found` 경고가 사라진다

- [ ] **Step 4: 커밋**

```bash
git add src/lib/collection.ts src/content/posts
git commit -m "Collection 어댑터와 시드 글 3편 추가"
```

---

### Task 5: 아카이브 페이지와 카테고리 필터

**Files:**
- Create: `src/components/CategoryFilter.tsx`
- Create: `src/pages/posts/index.astro`
- Modify: `src/components/Header.astro` (검색 칩 링크를 `/posts`로)

**Interfaces:**
- Consumes: `loadPosts` from `src/lib/collection.ts`; `groupByYear` from `src/lib/posts.ts`; `CATEGORIES` from `src/lib/categories.ts`
- Produces: 라우트 `/posts`

이 프로젝트의 첫 React island다. Astro가 빌드 시 정적 HTML로 렌더링한 뒤 브라우저에서 hydration하므로, JS가 꺼져 있어도 전체 목록은 보인다.

- [ ] **Step 1: 필터 컴포넌트 작성**

`src/components/CategoryFilter.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { CATEGORIES, type CategorySlug } from '../lib/categories';
import { groupByKey } from '../lib/posts';

/** 서버에서 직렬화되어 넘어오므로 Date가 아니라 문자열로 받는다. */
export interface FilterablePost {
  slug: string;
  title: string;
  category: CategorySlug;
  href: string;
  year: string;
  meta: string;
}

interface Props {
  posts: FilterablePost[];
}

const CHIP_BASE =
  'font-sans text-[13px] font-semibold px-4 py-2 rounded-[20px] cursor-pointer transition-all duration-200 border';
const CHIP_ON = 'bg-ink text-canvas border-ink';
const CHIP_OFF = 'bg-transparent text-ink-subtle border-ink/16 hover:border-ink/32';

export default function CategoryFilter({ posts }: Props) {
  const [filter, setFilter] = useState<CategorySlug | 'all'>('all');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [posts]);

  // posts는 서버에서 최신순으로 정렬돼 넘어오므로 연도 그룹 순서도 그대로 최신순이다.
  const groups = useMemo(() => {
    const visible = filter === 'all' ? posts : posts.filter((p) => p.category === filter);
    return groupByKey(visible, (p) => p.year);
  }, [posts, filter]);

  return (
    <>
      <div className="sticky top-header z-10 border-b border-ink/10 bg-canvas/90 py-4 backdrop-blur-[8px]">
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`${CHIP_BASE} ${filter === 'all' ? CHIP_ON : CHIP_OFF}`}
          >
            전체 {posts.length}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setFilter(c.slug)}
              className={`${CHIP_BASE} ${filter === c.slug ? CHIP_ON : CHIP_OFF}`}
            >
              {c.label} {counts.get(c.slug) ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 pb-18">
        {groups.map(({ key: year, items }) => (
          <div key={year} className="pt-9 pb-2">
            <div className="pb-1.5 font-mono text-[22px] font-semibold tracking-[-0.01em] text-ink-faint">
              {year}
            </div>
            {items.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="grid grid-cols-[1fr_auto] items-baseline gap-5 border-t border-ink/8 py-4 transition-opacity hover:opacity-60"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="min-w-16 text-[10.5px] font-semibold tracking-[0.06em] text-accent uppercase">
                    {CATEGORIES.find((c) => c.slug === p.category)?.label}
                  </span>
                  <span className="text-[17px] font-semibold tracking-[-0.01em]">{p.title}</span>
                </div>
                <span className="font-mono text-[12.5px] whitespace-nowrap text-ink-faint">
                  {p.meta}
                </span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 아카이브 페이지 작성**

`src/pages/posts/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import CategoryFilter, { type FilterablePost } from '../../components/CategoryFilter';
import { loadPosts } from '../../lib/collection';

const posts = await loadPosts('ko');

const items: FilterablePost[] = posts.map((p) => ({
  slug: p.slug,
  title: p.title,
  category: p.category,
  href: p.href,
  year: String(p.pubDate.getFullYear()),
  meta: `${String(p.pubDate.getMonth() + 1).padStart(2, '0')}.${String(
    p.pubDate.getDate(),
  ).padStart(2, '0')} · ${p.minutes}분`,
}));

const firstYear = posts.length ? posts[posts.length - 1].pubDate.getFullYear() : new Date().getFullYear();
---

<BaseLayout
  title="기록의 목차 · 씨유"
  description={`${firstYear}년부터 남긴 ${posts.length}편의 글.`}
  active="archive"
>
  <section class="pt-16 pb-10">
    <div class="mb-4.5 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
      아카이브
    </div>
    <h1 class="m-0 text-[44px] leading-[1.12] font-extrabold tracking-[-0.03em]">
      기록의 목차
    </h1>
    <p class="mt-4 text-[17px] leading-relaxed text-ink-muted">
      {firstYear}년부터 남긴 {posts.length}편의 글. 카테고리로 골라 보거나, 아래에서
      연도별로 훑어보세요.
    </p>
  </section>

  <CategoryFilter posts={items} client:load />
</BaseLayout>
```

아카이브는 디자인상 본문 폭이 900px이다. `BaseLayout`의 `main`은 1120px 고정이므로, `src/layouts/BaseLayout.astro`의 `<main>`에 폭을 넘길 수 있도록 props를 추가한다. 기존:

```astro
    <main class="mx-auto max-w-container px-8">
```

교체:

```astro
    <main class:list={['mx-auto px-8', narrow ? 'max-w-[900px]' : 'max-w-container']}>
```

그리고 `interface Props`에 `narrow?: boolean`을 추가하고 구조분해에 포함한다:

```ts
  /** 아카이브처럼 본문 폭이 900px인 페이지 */
  narrow?: boolean;
```

```ts
const { title, description, active, narrow = false } = Astro.props;
```

`src/pages/posts/index.astro`의 `<BaseLayout>` 여는 태그에 `narrow`를 추가한다.

- [ ] **Step 3: 헤더 검색 칩 링크 수정**

`src/components/Header.astro`에서 `href="/search"`를 `href="/posts"`로 바꾼다. 검색은 3단계에서 붙이므로, 그전까지는 아카이브로 보낸다.

- [ ] **Step 4: 빌드하고 React island가 실제로 실린 것을 확인**

Run: `pnpm build && grep -c '<script' dist/posts/index.html`
Expected: `1` 이상 — 1단계의 인프라 페이지와 달리 이 페이지에는 JS가 실린다

Run: `grep -c '2024' dist/posts/index.html`
Expected: `1` 이상 — hydration 전에도 목록이 HTML에 들어 있다

- [ ] **Step 5: 타입체크**

Run: `pnpm check`
Expected: `0 errors`

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "아카이브 페이지와 카테고리 필터 추가

첫 React island다. 빌드 시 정적 HTML로 렌더링되므로 JS 없이도
목록 전체가 보이고, hydration 후 필터가 동작한다."
```

---

### Task 6: 본문 타이포그래피와 코드 블록 테마

**Files:**
- Modify: `src/styles/global.css` (prose 스타일, JetBrains Mono 토큰)
- Modify: `src/layouts/BaseLayout.astro` (폰트 링크에 JetBrains Mono 추가)
- Modify: `astro.config.mjs` (Shiki 설정)

**Interfaces:**
- Consumes: 없음
- Produces: `.prose` 클래스 — Task 7의 글 본문이 사용

- [ ] **Step 1: 폰트 추가**

`src/layouts/BaseLayout.astro`의 Google Fonts `href`에서 `&display=swap` 앞에 `&family=JetBrains+Mono:wght@400;500;700`을 넣는다. 결과 URL:

```
https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap
```

- [ ] **Step 2: 코드 폰트 토큰 추가**

`src/styles/global.css`의 `@theme` 블록에서 타이포 항목에 한 줄 추가한다:

```css
  --font-code: 'JetBrains Mono', ui-monospace, monospace;
```

- [ ] **Step 3: prose 스타일 작성**

`src/styles/global.css` 파일 맨 끝에 추가한다. Tailwind typography 플러그인을 쓰지 않는 이유는 디자인이 이미 확정된 값을 지정하고 있어, 플러그인 기본값을 덮어쓰는 코드가 직접 쓰는 것보다 길어지기 때문이다.

```css
/*
 * 글 본문 타이포그래피 (기술포스팅.dc.html 기준).
 * Tailwind typography 플러그인 대신 직접 정의한다 — 디자인이 값을 확정하고
 * 있어서, 플러그인 기본값을 덮어쓰는 편이 오히려 코드가 길어진다.
 */
@layer components {
  .prose p {
    font-size: 17px;
    line-height: 1.8;
    color: color-mix(in oklab, var(--color-ink) 88%, var(--color-canvas));
    margin: 0 0 22px;
  }

  .prose h2 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 48px 0 18px;
    scroll-margin-top: 80px;
  }

  .prose h3 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 32px 0 14px;
    scroll-margin-top: 80px;
  }

  .prose blockquote {
    margin: 28px 0;
    padding: 4px 0 4px 22px;
    border-left: 3px solid var(--color-accent);
    color: var(--color-ink-muted);
    font-size: 17px;
    line-height: 1.7;
  }

  .prose ul,
  .prose ol {
    margin: 0 0 22px;
    padding-left: 22px;
    font-size: 17px;
    line-height: 1.8;
    color: color-mix(in oklab, var(--color-ink) 88%, var(--color-canvas));
  }

  .prose li {
    margin-bottom: 6px;
  }

  .prose a {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* 인라인 코드 */
  .prose :not(pre) > code {
    font-family: var(--font-code);
    font-size: 14px;
    background: color-mix(in oklab, var(--color-ink) 6%, transparent);
    padding: 2px 6px;
    border-radius: 5px;
  }

  /* Shiki가 만든 코드 블록 */
  .prose pre {
    border-radius: var(--radius-tile);
    padding: 22px 24px;
    overflow-x: auto;
    margin: 0 0 22px;
    font-family: var(--font-code);
    font-size: 13.5px;
    line-height: 1.7;
  }

  .prose pre code {
    font-family: inherit;
    font-size: inherit;
    background: none;
    padding: 0;
  }
}
```

- [ ] **Step 4: Shiki 테마 설정**

디자인의 코드 블록은 어두운 배경(`#26241f`)에 GitHub Dark 계열 색을 쓴다. `github-dark-default`가 가장 가깝다. 배경만 디자인 값으로 바꾼다.

Shiki는 배경색을 `<pre>`의 **인라인 style 속성**에 넣는다. 인라인 스타일은 어떤 선택자보다 우선하므로 CSS로는 덮을 수 없고, `!important`를 쓰면 이후 어떤 규칙도 이 배경을 못 건드리게 된다. 대신 transformer로 인라인 배경 선언만 걷어내고, 색은 평범한 CSS로 지정한다.

`astro.config.mjs`의 `defineConfig` 객체에 `markdown` 키를 추가한다 (`integrations` 아래, `vite` 위):

```js
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: false,
      transformers: [
        {
          // Shiki가 pre에 박는 인라인 배경색을 걷어낸다.
          // 인라인 스타일은 CSS로 덮을 수 없어 !important가 필요해지는데,
          // 그러면 이후 어떤 규칙도 배경을 조정할 수 없게 된다.
          pre(node) {
            const style = String(node.properties.style ?? '');
            node.properties.style = style.replace(/background-color:[^;]*;?/g, '');
          },
        },
      ],
    },
  },
```

배경색을 `src/styles/global.css`의 `@layer components` 안, `.prose pre` 규칙 바로 뒤에 추가한다:

```css
  /* Shiki가 인라인 배경을 떼고 나가므로 여기서 지정한다 */
  .prose pre.astro-code {
    background-color: oklch(0.21 0.008 75);
  }
```

- [ ] **Step 5: 빌드하고 하이라이팅 확인**

Run: `pnpm build && grep -o 'astro-code' dist/posts/index.html | head -1`

이 시점에는 글 상세 페이지가 없으므로 결과가 비어 있어도 정상이다. 빌드가 통과하는지만 본다.
Expected: 빌드 `Complete!`

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "본문 타이포그래피와 Shiki 코드 블록 테마 추가

Tailwind typography 플러그인 대신 직접 정의한다. 디자인이 값을
확정하고 있어 플러그인 기본값을 덮어쓰는 쪽이 더 길어진다."
```

---

### Task 7: 글 상세 페이지

**Files:**
- Create: `src/components/PostMeta.astro`
- Create: `src/components/TableOfContents.astro`
- Create: `src/components/RelatedPosts.astro`
- Create: `src/components/AdjacentNav.astro`
- Create: `src/pages/posts/[...slug].astro`

**Interfaces:**
- Consumes: `loadPosts`, `toSummary` from `src/lib/collection.ts`; `relatedPosts`, `adjacentPosts`, `type PostSummary` from `src/lib/posts.ts`; `categoryLabel` from `src/lib/categories.ts`
- Produces: 라우트 `/posts/<slug>`

- [ ] **Step 1: 메타 컴포넌트 작성**

`src/components/PostMeta.astro`:

```astro
---
import { categoryLabel } from '../lib/categories';
import type { PostSummary } from '../lib/posts';

interface Props {
  post: PostSummary;
}
const { post } = Astro.props;

const date = `${post.pubDate.getFullYear()}.${String(post.pubDate.getMonth() + 1).padStart(2, '0')}.${String(post.pubDate.getDate()).padStart(2, '0')}`;
---

<a href="/posts" class="text-[13px] text-ink-faint transition-colors hover:text-ink-subtle">
  ← 목차로
</a>

<div class="mt-6.5 mb-3.5 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
  {categoryLabel(post.category)}
</div>

<h1 class="m-0 text-[40px] leading-[1.18] font-extrabold tracking-[-0.03em] text-balance">
  {post.title}
</h1>

<div class="mt-5.5 flex items-center gap-3.5 font-mono text-[13px] text-ink-faint">
  <span>{date}</span><span>·</span><span>{post.minutes}분 읽기</span><span>·</span><span>이동규</span>
</div>

{
  post.tags.length > 0 && (
    <div class="mt-4.5 flex flex-wrap gap-2">
      {post.tags.map((tag) => (
        <span class="rounded-[14px] bg-ink/5 px-3 py-[5px] text-xs text-ink-subtle">
          #{tag}
        </span>
      ))}
    </div>
  )
}

<div class="my-8 h-px bg-ink/10"></div>
```

- [ ] **Step 2: 목차 컴포넌트 작성**

Astro의 `render()`가 돌려주는 `headings`를 그대로 쓴다. h2만 노출한다 — 디자인의 목차가 한 층이다.

`src/components/TableOfContents.astro`:

```astro
---
import type { MarkdownHeading } from 'astro';

interface Props {
  headings: MarkdownHeading[];
}
const { headings } = Astro.props;
const items = headings.filter((h) => h.depth === 2);
---

{
  items.length > 0 && (
    <aside class="hidden lg:sticky lg:top-20 lg:block lg:pt-14 lg:pb-10">
      <div class="mb-4 text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        목차
      </div>
      <nav id="toc" class="flex flex-col gap-0.5 border-l-2 border-ink/10">
        {items.map((h) => (
          <a
            href={`#${h.slug}`}
            data-toc-link={h.slug}
            class="-ml-0.5 border-l-2 border-transparent py-1.5 pl-4 text-[13px] leading-snug text-ink-subtle transition-all hover:border-accent hover:text-ink"
          >
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: 관련글·이전다음 컴포넌트 작성**

`src/components/RelatedPosts.astro`:

```astro
---
import { categoryLabel } from '../lib/categories';
import type { PostSummary } from '../lib/posts';

interface Props {
  posts: PostSummary[];
}
const { posts } = Astro.props;

function meta(p: PostSummary): string {
  const d = p.pubDate;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · ${p.minutes}분`;
}
---

{
  posts.length > 0 && (
    <section class="border-t border-ink/12 py-11">
      <div class="mb-6 text-[11px] font-semibold tracking-[0.16em] text-ink-subtle uppercase">
        함께 읽으면 좋은 글
      </div>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        {posts.map((p) => (
          <a
            href={p.href}
            class="rounded-2xl border border-ink/9 bg-surface px-6 py-5.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/24"
          >
            <div class="mb-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-accent uppercase">
              {categoryLabel(p.category)}
            </div>
            <div class="text-[17px] font-semibold tracking-[-0.01em]">{p.title}</div>
            <div class="mt-2 font-mono text-[12.5px] text-ink-faint">{meta(p)}</div>
          </a>
        ))}
      </div>
    </section>
  )
}
```

`src/components/AdjacentNav.astro`:

```astro
---
import type { PostSummary } from '../lib/posts';

interface Props {
  prev: PostSummary | null;
  next: PostSummary | null;
}
const { prev, next } = Astro.props;
---

{
  (prev || next) && (
    <nav class="grid grid-cols-1 gap-5 border-t border-ink/12 pt-8 pb-18 md:grid-cols-2">
      {prev ? (
        <a href={prev.href} class="text-left transition-opacity hover:opacity-70">
          <div class="mb-2 text-xs text-ink-faint">← 이전 글</div>
          <div class="text-base font-semibold tracking-[-0.01em]">{prev.title}</div>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={next.href} class="text-right transition-opacity hover:opacity-70">
          <div class="mb-2 text-xs text-ink-faint">다음 글 →</div>
          <div class="text-base font-semibold tracking-[-0.01em]">{next.title}</div>
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}
```

- [ ] **Step 4: 상세 페이지 라우트 작성**

`src/pages/posts/[...slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostMeta from '../../components/PostMeta.astro';
import TableOfContents from '../../components/TableOfContents.astro';
import RelatedPosts from '../../components/RelatedPosts.astro';
import AdjacentNav from '../../components/AdjacentNav.astro';
import { loadPosts, toSummary } from '../../lib/collection';
import { adjacentPosts, relatedPosts } from '../../lib/posts';

export async function getStaticPaths() {
  const entries = await getCollection('posts', ({ data }) => !data.draft);
  return entries
    .filter((e) => e.id.startsWith('ko/'))
    .map((entry) => ({
      params: { slug: entry.id.slice('ko/'.length) },
      props: { entry },
    }));
}

const { entry } = Astro.props;
const { Content, headings } = await render(entry);

const post = toSummary(entry);
const pool = await loadPosts('ko'); // draft 제외 + 최신순 정렬 완료

const related = relatedPosts(post, pool);
const { prev, next } = adjacentPosts(post, pool);
---

<BaseLayout title={`${post.title} · 씨유`} description={post.description} active="archive">
  <div class="grid items-start gap-16 lg:grid-cols-[1fr_220px]">
    <article class="min-w-0 pt-14 pb-10">
      <PostMeta post={post} />
      <div class="prose">
        <Content />
      </div>
    </article>
    <TableOfContents headings={headings} />
  </div>

  <RelatedPosts posts={related} />
  <AdjacentNav prev={prev} next={next} />
</BaseLayout>
```

- [ ] **Step 5: 빌드하고 라우트 3개가 생겼는지 확인**

Run: `pnpm build && ls dist/posts/`
Expected: `2024-retrospect  index.html  load-balancer  tcp-error-recovery`

Run: `grep -c 'astro-code' dist/posts/tcp-error-recovery/index.html`
Expected: `2` — 코드 블록 2개가 하이라이팅됐다

Run: `grep -o '12분 읽기\|[0-9]*분 읽기' dist/posts/tcp-error-recovery/index.html | head -1`
Expected: `N분 읽기` 형태의 문자열

- [ ] **Step 6: 타입체크**

Run: `pnpm check`
Expected: `0 errors`

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "글 상세 페이지 추가 (메타·목차·관련글·이전다음)"
```

---

### Task 8: 읽기 편의 기능

**Files:**
- Create: `src/components/ReadingProgress.astro`
- Create: `src/components/CodeCopyButton.astro`
- Modify: `src/components/TableOfContents.astro` (스크롤 하이라이트 스크립트)
- Modify: `src/pages/posts/[...slug].astro` (두 컴포넌트 삽입)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (페이지에 삽입되는 UI 조각)

세 기능 모두 React를 쓰지 않는다. 상태가 DOM에만 있고 서로 공유하지 않아서, 인라인 스크립트가 React island보다 짧고 전송량도 작다. React는 상태 공유가 필요한 곳(Task 5의 필터)에만 쓴다.

- [ ] **Step 1: 읽기 진행률 바 작성**

`src/components/ReadingProgress.astro`:

```astro
<div
  id="reading-progress"
  class="fixed top-header left-0 z-40 h-0.5 w-0 bg-accent transition-[width] duration-75"
  aria-hidden="true"
>
</div>

<script>
  const bar = document.getElementById('reading-progress');
  const article = document.querySelector('article');

  if (bar && article) {
    const update = () => {
      const start = article.offsetTop;
      const total = article.offsetHeight - window.innerHeight;
      if (total <= 0) {
        bar.style.width = '0%';
        return;
      }
      const ratio = (window.scrollY - start) / total;
      bar.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }
</script>
```

- [ ] **Step 2: 코드 복사 버튼 작성**

`src/components/CodeCopyButton.astro`:

```astro
<script>
  for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
    pre.style.position = 'relative';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '복사';
    button.className =
      'absolute top-3 right-3 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/60 opacity-0 transition-opacity hover:bg-white/15 hover:text-white/90 focus-visible:opacity-100';

    pre.addEventListener('mouseenter', () => (button.style.opacity = '1'));
    pre.addEventListener('mouseleave', () => (button.style.opacity = '0'));

    button.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = '복사됨';
      } catch {
        // 클립보드 권한이 없거나 비보안 컨텍스트인 경우
        button.textContent = '복사 실패';
      }
      setTimeout(() => (button.textContent = '복사'), 1600);
    });

    pre.appendChild(button);
  }
</script>
```

- [ ] **Step 3: 목차 스크롤 하이라이트 추가**

`src/components/TableOfContents.astro` 파일 맨 끝(`}` 뒤, 즉 템플릿 바깥)에 추가한다:

```astro
<script>
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]');

  if (links.length > 0) {
    const ACTIVE = ['text-ink', 'border-accent'];

    const setActive = (slug: string) => {
      for (const link of links) {
        const on = link.dataset.tocLink === slug;
        link.classList.toggle(ACTIVE[0], on);
        link.classList.toggle(ACTIVE[1], on);
      }
    };

    // rootMargin 상단을 헤더 높이만큼 밀어, 헤더에 가린 제목은 활성으로 치지 않는다.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    for (const heading of document.querySelectorAll('.prose h2[id]')) {
      observer.observe(heading);
    }
  }
</script>
```

- [ ] **Step 4: 상세 페이지에 삽입**

`src/pages/posts/[...slug].astro`의 import 목록에 추가:

```astro
import ReadingProgress from '../../components/ReadingProgress.astro';
import CodeCopyButton from '../../components/CodeCopyButton.astro';
```

`<BaseLayout ...>` 여는 태그 바로 다음 줄에 `<ReadingProgress />`를, `<AdjacentNav ... />` 다음 줄에 `<CodeCopyButton />`을 넣는다.

- [ ] **Step 5: 빌드 확인**

Run: `pnpm build && pnpm check`
Expected: 빌드 `Complete!`, 타입체크 `0 errors`

- [ ] **Step 6: 브라우저로 동작 확인**

Run: `pnpm dev`

`http://localhost:4321/posts/tcp-error-recovery`를 열고 확인한다:
- 스크롤하면 헤더 아래 진행률 바가 늘어난다
- 코드 블록에 마우스를 올리면 "복사" 버튼이 나타나고, 누르면 "복사됨"으로 바뀐다
- 스크롤하면 우측 목차의 현재 항목에 강조색 세로선이 생긴다

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "읽기 편의 기능 추가 (진행률·코드 복사·목차 하이라이트)

셋 다 상태를 공유하지 않아 인라인 스크립트로 처리한다. React는
상태 공유가 필요한 카테고리 필터에만 쓴다."
```

---

### Task 9: RSS 피드

**Files:**
- Create: `src/pages/rss.xml.ts`

**Interfaces:**
- Consumes: `loadPosts` from `src/lib/collection.ts`
- Produces: 라우트 `/rss.xml`

푸터가 이미 `/rss.xml`을 가리키고 있는데 실제 라우트가 없어 링크가 깨져 있다.

- [ ] **Step 1: 피드 라우트 작성**

`src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadPosts } from '../lib/collection';

export async function GET(context: APIContext) {
  const posts = await loadPosts('ko');

  return rss({
    title: '씨유 · brainbackdoor',
    description: '만들고 부수며 배웁니다.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.title,
      description: p.description,
      pubDate: p.pubDate,
      link: p.href,
      categories: p.tags,
    })),
  });
}
```

- [ ] **Step 2: 빌드하고 피드 확인**

Run: `pnpm build && head -5 dist/rss.xml`
Expected: `<?xml version="1.0" encoding="UTF-8"?>`로 시작하고 `<title>씨유 · brainbackdoor</title>`가 보인다

Run: `grep -c '<item>' dist/rss.xml`
Expected: `3`

- [ ] **Step 3: 전체 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 테스트 전부 통과, 타입체크 `0 errors`, 빌드 `Complete!`

- [ ] **Step 4: 커밋**

```bash
git add src/pages/rss.xml.ts
git commit -m "RSS 피드 추가

푸터가 /rss.xml을 가리키는데 라우트가 없어 링크가 깨져 있었다."
```

---

## 2단계 완료 기준

- `/posts`에서 카테고리 칩으로 필터링이 동작하고, JS를 꺼도 전체 목록이 보인다
- `/posts/<slug>` 3개가 생성되고 코드 블록이 하이라이팅된다
- 목차·진행률·코드 복사가 동작한다
- `/rss.xml`이 3개 항목을 낸다
- `pnpm test` 전부 통과, `pnpm check` 0 errors

## 3단계로 넘기는 것

- Pagefind 검색 (헤더 검색 칩을 실제 검색으로)
- giscus 댓글
- i18n 전면 적용 — 현재 `/posts` 라우트는 `lang === 'ko'`만 다룬다. `/en/posts`와 언어 전환 UI가 3단계 범위다
- 태그별 페이지 (`/tags/<tag>`)
