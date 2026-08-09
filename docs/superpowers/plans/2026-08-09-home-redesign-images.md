# 홈 재설계 — 이미지·이모지 fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈(`src/pages/index.astro`)의 배열을 유지한 채, featured·최근 글·"지금 하는 일"에 커버/썸네일을 붙이되 이미지가 없으면 이모지 타일로 대체한다.

**Architecture:** 이미지↔이모지 대체를 담당하는 단일 컴포넌트 `MediaTile.astro`를 만들어 세 곳(featured 큰 커버, 최근 글 52px 썸네일, 사이드바 38px 썸네일)에서 크기 클래스만 달리해 재사용한다. 이모지 fallback 기본값은 카테고리별로 정하는 순수 함수 `categoryEmoji`가 제공한다. 렌더링 컴포넌트는 `pnpm build` + dev 서버 렌더로 검증하고, 순수 로직만 Vitest로 검증한다(기존 관례).

**Tech Stack:** Astro 7, React 19(기존), Tailwind CSS 4(`@theme` 토큰), Vitest 4.

## Global Constraints

- 색·간격은 `src/styles/global.css`의 `@theme` 토큰만. 컴포넌트에 hex/px 색상 직접 금지.
- TypeScript 6.x 고정(올리지 말 것 — TS 7은 `astro check`를 깬다).
- 날짜는 `src/lib/date.ts`(`formatDate`)만 사용.
- 각 태스크 끝에 검증: `pnpm test`(순수 함수) · `pnpm check`(0 errors) · `pnpm build`(통과).
- 모바일 320·375·768px에서 문서 가로 스크롤 없음(`documentElement.scrollWidth <= clientWidth`).
- astryx 라이트 전용·파인 그린은 컨트롤 전용, 본문 강조는 테라코타(`text-accent`). 기존 규칙 유지.
- 이미지엔 `loading="lazy"`, `object-cover`, 고정 비율/크기.
- 기존 파일 편집 우선, 새 파일 최소.

**범위:** 이 계획은 트랙 A(홈 렌더링)만 다룬다. Notion 글 28편 본문의 MDX 이전(트랙 B)은 별도 계획(`2026-08-xx-notion-content-migration.md`)으로 분리한다. 이 계획은 샘플 글 + SpringCamp 1편으로 완성·검증된다.

---

### Task 1: 카테고리별 이모지 fallback 순수 함수

**Files:**
- Modify: `src/lib/categories.ts`
- Test: `src/lib/categories.test.ts`

**Interfaces:**
- Produces: `categoryEmoji(slug: CategorySlug): string` — 글에 `icon`이 없을 때 쓰는 카테고리 기본 이모지.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/categories.test.ts`에 append

```ts
import { categoryEmoji } from './categories';

describe('categoryEmoji', () => {
  it('4개 카테고리 각각 기본 이모지를 준다', () => {
    expect(categoryEmoji('retrospect')).toBe('📝');
    expect(categoryEmoji('infra')).toBe('⚙️');
    expect(categoryEmoji('guide')).toBe('🧪');
    expect(categoryEmoji('life')).toBe('🌱');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- categories`
Expected: FAIL — `categoryEmoji is not a function`

- [ ] **Step 3: 최소 구현** — `src/lib/categories.ts`에 append

```ts
const EMOJI_BY_SLUG: Record<CategorySlug, string> = {
  retrospect: '📝',
  infra: '⚙️',
  guide: '🧪',
  life: '🌱',
};

/** 글에 icon이 없을 때 쓰는 카테고리 기본 이모지(MediaTile fallback). */
export function categoryEmoji(slug: CategorySlug): string {
  return EMOJI_BY_SLUG[slug] ?? '📝';
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test -- categories`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: 카테고리별 이모지 fallback categoryEmoji 추가"
```

---

### Task 2: 스키마·데이터 모델 — 글 icon, 지금 하는 일 image/icon

**Files:**
- Modify: `src/content.config.ts:20-22` (image 필드 아래에 icon 추가)
- Modify: `src/data/about.ts:8-18` (`CurrentItem`에 image/icon 추가 + 값 채움)
- Modify: `src/lib/posts.ts` (`PostSummary`에 image/icon)
- Modify: `src/lib/collection.ts:13-23` (`toSummary` 매핑에 image/icon)

**Interfaces:**
- Produces: 글 frontmatter의 `icon?: string`(이모지). `CurrentItem { title; subtitle; image?; icon?; href? }`. `PostSummary`에 `image?: string; icon?: string`.

- [ ] **Step 1: 글 스키마에 icon 추가** — `src/content.config.ts`의 `image` 정의 바로 아래

```ts
    /** 글 대표 이미지(public 기준 경로 또는 절대 URL). OG 이미지로 쓰인다. */
    image: z.string().optional(),
    /** 커버가 없을 때 홈에서 쓰는 이모지 fallback. 없으면 카테고리 기본값. */
    icon: z.string().optional(),
```

- [ ] **Step 2: CurrentItem 확장** — `src/data/about.ts`의 인터페이스와 배열 교체

```ts
export interface CurrentItem {
  title: string;
  subtitle: string;
  /** 로고 이미지(public 기준 경로). 없으면 icon 사용. */
  image?: string;
  /** image가 없을 때 쓰는 이모지 또는 이니셜(2글자). */
  icon?: string;
  href?: string;
}

export const current: CurrentItem[] = [
  { title: '그란데클립', subtitle: '프로덕트 엔지니어 · AX', icon: 'GC' },
  { title: 'NEXTSTEP', subtitle: '교육자 · 사업/운영', image: '/activities/nextstep.webp' },
  { title: '인프라공방', subtitle: '강사', image: '/activities/inflabang.webp' },
  { title: '하린이 육아', subtitle: '가장 중요한 프로젝트', icon: '👶' },
];
```

- [ ] **Step 3: PostSummary에 image/icon 추가** — `src/lib/posts.ts`의 `PostSummary` 인터페이스에 `href` 아래로

```ts
  href: string;
  image?: string;
  icon?: string;
```

- [ ] **Step 4: toSummary 매핑에 연결** — `src/lib/collection.ts`의 `return { … }` 안, `href` 줄 뒤에

```ts
    href: lang === 'ko' ? `/posts/${slug}` : `/${lang}/posts/${slug}`,
    image: entry.data.image,
    icon: entry.data.icon,
```

- [ ] **Step 5: 타입·빌드 확인**

Run: `pnpm check && pnpm build`
Expected: 0 errors, build 통과

- [ ] **Step 6: 커밋**

```bash
git add src/content.config.ts src/data/about.ts src/lib/posts.ts src/lib/collection.ts
git commit -m "feat: 글 icon·CurrentItem·PostSummary image/icon 필드 추가"
```

---

### Task 3: MediaTile 컴포넌트 (이미지↔이모지/이니셜 대체)

**Files:**
- Create: `src/components/MediaTile.astro`

**Interfaces:**
- Consumes: 없음(프레젠테이션 전용).
- Produces: `MediaTile` — props `{ image?: string; icon?: string; alt?: string; class?: string; emojiClass?: string }`. `image`가 있으면 `<img>`, 없으면 이모지/이니셜 타일. 크기·모서리는 호출부의 `class`로 지정.

- [ ] **Step 1: 컴포넌트 작성**

```astro
---
/**
 * 홈 공통 미디어 타일. 이미지가 있으면 커버로, 없으면 이모지(또는 2글자 이니셜)
 * 타일로 대체한다. 크기·모서리는 호출부가 class로 넘긴다.
 * 이니셜은 2글자 이하 텍스트일 때만 크게 렌더(예: 'GC'), 그 외는 이모지로 본다.
 */
interface Props {
  image?: string;
  icon?: string;
  alt?: string;
  class?: string;
  emojiClass?: string;
}
const { image, icon = '📝', alt = '', class: klass = '', emojiClass = 'text-2xl' } = Astro.props;
const isInitials = icon.length <= 2 && /[A-Za-z0-9]/.test(icon);
---
{
  image ? (
    <img src={image} alt={alt} loading="lazy" class:list={['object-cover bg-sunken', klass]} />
  ) : isInitials ? (
    <div
      class:list={['flex items-center justify-center bg-ink font-bold tracking-tight text-canvas', klass]}
      aria-hidden="true"
    >
      <span class="text-[0.8em]">{icon}</span>
    </div>
  ) : (
    <div class:list={['flex items-center justify-center bg-sunken', klass]} aria-hidden="true">
      <span class:list={[emojiClass]}>{icon}</span>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm check && pnpm build`
Expected: 0 errors, build 통과(아직 미사용이라 시각 변화 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/components/MediaTile.astro
git commit -m "feat: 이미지↔이모지 대체 MediaTile 컴포넌트"
```

---

### Task 4: featured 카드 — 빈 박스를 MediaTile 커버로 교체

**Files:**
- Modify: `src/pages/index.astro:1-13` (import), `src/pages/index.astro:35-65` (featured 블록)

**Interfaces:**
- Consumes: `MediaTile`(Task 3), `categoryEmoji`(Task 1).

- [ ] **Step 1: import 추가** — 프런트매터 상단 import 블록에

```astro
import MediaTile from '../components/MediaTile.astro';
import { categoryLabel, categoryEmoji } from '../lib/categories';
```
(기존 `import { categoryLabel } from '../lib/categories';` 줄을 위 한 줄로 교체.)

- [ ] **Step 2: featured 이미지 존을 교체** — 현재 `<div class="relative flex h-[300px] ...">…</div>`(워터마크 span 포함) 전체를 아래로 교체

```astro
            <MediaTile
              image={featured.image}
              icon={featured.icon ?? categoryEmoji(featured.category)}
              alt={featured.title}
              class="h-[260px] w-full rounded-[20px] ring-1 ring-ink/5 ring-inset"
              emojiClass="text-[64px] leading-none"
            />
```

- [ ] **Step 3: dev 서버에서 렌더 확인**

Run: dev 서버(포트 4321)에서 `/` 로드 → featured 박스가 이모지 타일(회고·문화=📝)로 채워지고 거대 워터마크가 사라졌는지 확인. `image`가 있는 글이면 사진이 뜬다.
Expected: 빈 회색 박스·워터마크 제거, 타일이 제목 위에 정상 표시.

- [ ] **Step 4: 빌드·타입 확인**

Run: `pnpm check && pnpm build`
Expected: 0 errors, 통과

- [ ] **Step 5: 커밋**

```bash
git add src/pages/index.astro
git commit -m "feat: featured 카드를 MediaTile 커버로 교체(워터마크 제거)"
```

---

### Task 5: 최근 글 — B1 배열(썸네일 + 카테고리 제목 위)

**Files:**
- Modify: `src/pages/index.astro` (최근 글 `<ul>` 내부 `<li><a>` 마크업)

**Interfaces:**
- Consumes: `MediaTile`(Task 3), `categoryEmoji`(Task 1).

- [ ] **Step 1: 최근 글 행 마크업 교체** — 현재 `recent.map((p) => ( <li> <a class="group grid grid-cols-[auto_1fr] ...">…</a> </li> ))` 내부의 `<a>` 를 아래로 교체

```astro
              <a
                href={p.href}
                class="group grid grid-cols-[52px_1fr_auto] items-center gap-4 border-t border-ink/10 py-4"
              >
                <MediaTile
                  image={p.image}
                  icon={p.icon ?? categoryEmoji(p.category)}
                  alt={p.title}
                  class="size-[52px] rounded-[10px]"
                  emojiClass="text-[22px]"
                />
                <span class="min-w-0">
                  <span class="block text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
                    {categoryLabel(p.category)}
                  </span>
                  <span class="mt-0.5 block truncate text-[17px] font-semibold tracking-[-0.02em] group-hover:text-accent sm:text-[18px]">
                    {p.title}
                  </span>
                </span>
                <span class="text-[12.5px] text-ink-faint tabular-nums">
                  {formatDate(p.pubDate)} · {p.minutes}분
                </span>
              </a>
```

- [ ] **Step 2: dev 렌더 확인** — (`PostSummary`의 image/icon은 Task 2에서 이미 연결됨)

Run: `/` 로드 → 최근 글이 `[52px 썸네일][카테고리↕제목][날짜]`로, 시작점이 썸네일 하나로 통일됐는지 확인. 이미지 없는 글은 이모지 타일.
Expected: B1 배열 정상, 모바일 375px에서 가로 스크롤 없음.

- [ ] **Step 3: 검증·커밋**

```bash
pnpm test && pnpm check && pnpm build
git add src/pages/index.astro
git commit -m "feat: 최근 글 B1 배열(썸네일+카테고리 상단)"
```

---

### Task 6: 지금 하는 일 사이드바 — 썸네일 + ↗제거 + 더 보기 + 라벨 점

**Files:**
- Modify: `src/pages/index.astro` (사이드바 `<aside>` 블록)

**Interfaces:**
- Consumes: `MediaTile`(Task 3), `current`(Task 2).

- [ ] **Step 1: 사이드바 마크업 교체** — 현재 `<aside>…</aside>` 전체를 아래로 교체

```astro
    <aside>
      <div class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        <span class="size-1.5 rounded-full bg-[--color-accent] control-accent" aria-hidden="true"></span>
        지금 하는 일
      </div>
      <div>
        {
          current.map((item) => (
            <a
              href={item.href ?? '/about'}
              class="group flex items-center gap-3 border-t border-ink/6 py-3 first:border-t-0"
            >
              <MediaTile
                image={item.image}
                icon={item.icon}
                alt={item.title}
                class="size-[38px] shrink-0 rounded-[9px]"
                emojiClass="text-[17px]"
              />
              <span class="min-w-0">
                <span class="block truncate text-[14px] font-semibold tracking-[-0.01em]">{item.title}</span>
                <span class="block truncate text-[11.5px] text-ink-subtle">{item.subtitle}</span>
              </span>
            </a>
          ))
        }
      </div>
      <a href="/about" class="mt-3 inline-block text-[12.5px] font-medium text-accent hover:text-accent-hover">
        소개에서 더 보기 →
      </a>
    </aside>
```

- [ ] **Step 2: 라벨 점을 파인 그린으로** — 파인 그린은 astryx button 스코프 토큰이라, 여기선 인라인 스타일로 명시한다. 위 마크업의 점 span을 아래로 교체(토큰 직접 참조는 `@theme`에 없으므로 astryx.css의 값과 동일한 파인 그린을 쓰되, 재사용 위해 global.css에 유틸을 추가).

`src/styles/global.css`의 `@theme` 블록에 강조 아래로 한 줄 추가:
```css
  --color-current: oklch(0.46 0.055 165); /* 파인 그린 — "지금 하는 일" 표식 */
```
그리고 점 span을 아래로:
```astro
        <span class="size-1.5 rounded-full bg-current-dot" aria-hidden="true"></span>
```
`@layer components`에 유틸 추가:
```css
  .bg-current-dot { background: var(--color-current); }
```

- [ ] **Step 3: dev 렌더 확인**

Run: `/` 로드 → 사이드바 각 행에 38px 썸네일(NEXTSTEP·인프라공방=로고, 그란데클립=GC 배지, 하린이=👶), ↗ 사라짐, 하단 "소개에서 더 보기 →", 라벨 앞 파인 그린 점 확인.
Expected: 목업과 일치, 모바일에서 featured 아래로 자연 스택.

- [ ] **Step 4: 검증·커밋**

```bash
pnpm test && pnpm check && pnpm build
git add src/pages/index.astro src/styles/global.css
git commit -m "feat: 지금 하는 일 사이드바 썸네일·더보기·파인그린 점"
```

---

### Task 7: 실데이터 시드 — SpringCamp 글 + 커버, 샘플 글 icon

**Files:**
- Create: `src/content/posts/ko/springcamp-2026.mdx`
- Create: `public/covers/springcamp-2026.<ext>` (다운로드)
- Modify: 샘플 3편 frontmatter(선택) — icon 없이도 categoryEmoji로 뜨므로 필수 아님

**Interfaces:**
- Consumes: Task 2 스키마(image/icon).

- [ ] **Step 1: SpringCamp 첫 인라인 이미지 URL 확보** — 브라우저로 글을 열어 본문 첫 이미지의 oopy URL을 얻는다.

Run(브라우저): `https://www.brainbackdoor.com/38190d37-083f-8033-a7e8-f3996e11cf55` 로드 후 본문 첫 이미지 src 추출.
Expected: `https://oopy.lazyrockets.com/api/v2/notion/image?...` 형태 URL.

- [ ] **Step 2: 커버 다운로드(베스트에포트)**

```bash
mkdir -p public/covers
curl -sL -A "Mozilla/5.0" "<위 URL>" -o public/covers/springcamp-2026.jpeg
file public/covers/springcamp-2026.jpeg   # JPEG/PNG 확인
```
Expected: 실제 사진(수십~수백 KB). **403/HTML이면**(attachment URL 만료) 브라우저에서 이미지 열어 저장하거나, 사용자에게 커버 1장 요청. 실패해도 다음 스텝은 icon fallback으로 진행 가능.

- [ ] **Step 3: SpringCamp 글 생성**

```mdx
---
title: SpringCamp 2026 후기
description: 가상 스레드, 멀티테넌시, Temporal까지 — 스프링캠프에서 눈에 밟힌 것들을 정리합니다.
pubDate: 2026-06-16
category: retrospect
tags: ['회고', '컨퍼런스', 'Spring']
image: /covers/springcamp-2026.jpeg
---

올해 스프링캠프는 스프링 기술을 돌아보고 동료들과 다시 만나기 위해 다녀왔습니다.

## 가상 스레드

캐리어 스레드 관리로 동시성을 효율적으로 다루는 흐름을 정리합니다.

## 정리

우연한 복잡성을 런타임으로 옮긴다는 관점이 인상 깊었습니다.
```
(커버 다운로드가 실패했다면 `image:` 줄을 빼고 `icon: 📝` 로 대체.)

- [ ] **Step 4: featured가 SpringCamp로 바뀌는지 확인**

Run: `/` 로드 → SpringCamp가 최신글이므로 이달의 글로 뜨고, 커버(또는 📝 타일)가 박스를 채우는지 확인.
Expected: featured = SpringCamp, 최근 글 4편이 그 아래 목록.

- [ ] **Step 5: 검증·커밋**

```bash
pnpm test && pnpm check && pnpm build
git add public/covers src/content/posts/ko/springcamp-2026.mdx
git commit -m "feat: SpringCamp 2026 글·커버 시드"
```

---

### Task 8: 반응형·최종 검증

**Files:** 없음(검증 전용, 필요 시 index.astro 미세 수정)

- [ ] **Step 1: 3종 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과.

- [ ] **Step 2: 반응형 가로 스크롤 점검** — dev 서버에서 320/375/768px

Run(브라우저 콘솔): `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
Expected: 각 폭에서 `true`. featured+사이드바 2열이 모바일에서 1열로 스택, 최근 글 행이 안 넘침.

- [ ] **Step 3: 대비 실측** — 카테고리 라벨(테라코타)·메타(ink-faint)가 흰 배경에서 각각 ≥3:1

Run(브라우저): 라벨/메타 텍스트의 computed color로 WCAG 대비 계산.
Expected: 라벨 ≥ 4.5:1(본문급) 또는 ≥ 3:1(장식급) 충족.

- [ ] **Step 4: 최종 커밋(있으면)**

```bash
git add -A
git commit -m "chore: 홈 재설계 반응형·대비 검증"
```

---

## 트랙 B 예고 (별도 계획)

Notion 글 28편의 본문(코드·콜아웃·이미지 포함)을 MDX로 옮기고, 각 글의 첫 인라인 이미지를 `public/covers/`로 내려 `image`에 연결하는 작업은 규모가 커서 별도 계획으로 분리한다: `docs/superpowers/plans/2026-08-xx-notion-content-migration.md`. 이 계획(트랙 A)이 렌더 골격과 fallback을 이미 갖추므로, 트랙 B는 데이터만 채우면 된다.
