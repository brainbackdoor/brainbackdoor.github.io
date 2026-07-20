# 3a단계: 흰 배경 중성 테마 · 모바일 반응형 · 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배경이 흰색인 중성 톤으로 바뀌고, 375px 모바일에서 모든 화면이 깨지지 않으며, 푸터가 짧은 페이지에서도 화면 하단에 붙는다.

**Architecture:** 색은 `@theme` 토큰만 바꾸면 전 화면에 전파되도록 이미 되어 있으므로 Task 1은 토큰 파일 하나로 끝난다. 반응형은 레이아웃 셸(Task 2) → 헤더(Task 3) → 개별 화면(Task 4) 순으로 바깥에서 안으로 좁혀 들어간다. 정리 작업(Task 5~7)은 앞의 변경과 독립이다.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, Vitest

## Global Constraints

- 색·간격 값은 `src/styles/global.css`의 `@theme` 블록에만 정의한다. 컴포넌트에 hex/px/oklch 색상값을 직접 박지 않는다.
- **페이지 배경은 순백**(`oklch(1 0 0)`). 카드는 그보다 **살짝 어둡게**, 푸터는 더 어둡게. 2단계까지의 "카드가 페이지보다 밝다"는 관계는 뒤집힌다.
- **톤은 중성**. 잉크·테두리·표면에서 따뜻한 채도를 뺀다(chroma 0). **강조색만 테라코타 `oklch(0.45 0.1 32)`로 남긴다.**
- 다크모드는 구현하지 않는다.
- **375px에서 문서 가로 스크롤이 없어야 한다**(`documentElement.scrollWidth <= clientWidth`). 코드 블록처럼 넓은 콘텐츠는 자기 안에서 스크롤한다.
- 본문으로 읽는 텍스트의 명도 대비는 흰 배경에서 **4.5:1 이상**이어야 한다. 장식적 메타 텍스트는 3:1 이상.
- TypeScript는 **6.x 고정**.
- 각 태스크 끝에서 `pnpm test`, `pnpm check`, `pnpm build`가 통과해야 한다.

## 이 계획이 다루지 않는 것

Pagefind 검색, i18n 라우팅, 태그 페이지는 **3b**로 분리했다. 이 계획은 토큰과 레이아웃을 건드려 모든 화면에 영향이 가므로, 새 라우트 추가와 섞으면 회귀의 출처를 가리기 어렵다.

giscus 댓글은 저장소가 아직 없어 검증이 불가능하므로 4단계로 미뤘다.

---

### Task 1: 토큰 중성화와 흰 배경

**Files:**
- Modify: `src/styles/global.css` (`@theme` 블록)

**Interfaces:**
- Consumes: 없음
- Produces: 전 컴포넌트가 이미 참조 중인 토큰들의 새 값. 이름은 그대로 두므로 컴포넌트 수정은 없다.

- [ ] **Step 1: `@theme` 블록의 색 토큰 교체**

`src/styles/global.css`의 `@theme` 안에서 표면·잉크·강조·코드 항목을 아래로 바꾼다. 주석의 hex는 참고용 근사값이다.

```css
  /* ── 표면 (밝음 → 어두움) ──
   * 페이지가 순백이라 카드는 페이지보다 밝을 수 없다. 2단계까지와 달리
   * 카드가 페이지보다 어둡다. 올라온 면이 아니라 살짝 가라앉은 면으로 읽힌다. */
  --color-canvas: oklch(1 0 0); /* #ffffff 페이지 배경 */
  --color-surface: oklch(0.975 0 0); /* #f7f7f7 카드 */
  --color-sunken: oklch(0.955 0 0); /* #f1f1f1 푸터 */

  /* ── 잉크 (진함 → 옅음) ── */
  --color-ink: oklch(0.25 0 0); /* #2b2b2b 본문·제목 */
  --color-ink-muted: oklch(0.46 0 0); /* #6b6b6b 부제 */
  --color-ink-subtle: oklch(0.58 0 0); /* #8a8a8a 메타 */
  --color-ink-faint: oklch(0.68 0 0); /* #a6a6a6 라벨 */

  /* ── 강조 (유일하게 채도가 남는 곳) ── */
  --color-accent: oklch(0.45 0.1 32); /* 테라코타 */
  --color-accent-hover: oklch(0.52 0.1 32);

  /* ── 코드 블록 (본문에서 유일하게 어두운 면) ── */
  --color-code-surface: oklch(0.21 0 0); /* Shiki 배경 */
  --color-code-ink: oklch(0.99 0 0); /* 어두운 면 위의 글자·테두리 기준색 */
```

- [ ] **Step 2: `@layer base`의 selection 색도 중성으로**

같은 파일에서 아래를 찾아

```css
  ::selection {
    background: oklch(0.89 0.02 78);
  }
```

이렇게 바꾼다.

```css
  ::selection {
    background: oklch(0.89 0 0);
  }
```

- [ ] **Step 3: 하드코딩된 따뜻한 색이 남아 있지 않은지 확인**

Run: `grep -rn 'oklch(' src/ --include=*.astro --include=*.tsx`
Expected: 결과 없음. 하나라도 나오면 그 값을 `@theme` 토큰으로 옮기고 컴포넌트는 토큰을 참조하게 고친다.

Run: `grep -rn 'repeating-linear-gradient' src/`
Expected: `Header.astro`(브랜드 원형)와 `MissionCard.astro`(카드 상단 패턴) 두 곳. 둘 다 따뜻한 베이지 계열이 인라인으로 박혀 있다. 각각 `--color-surface`와 `--color-sunken` 사이의 중성 회색 두 단계로 바꾼다:

```
oklch(0.93 0 0) / oklch(0.90 0 0)
```

- [ ] **Step 4: 빌드하고 대비를 실측**

Run: `pnpm build && pnpm check`
Expected: `Complete!`, `0 errors`

그다음 `pnpm dev`로 띄우고 브라우저에서 아래를 실행해 대비를 잰다. **눈으로 보고 판단하지 말 것** — 색은 보는 환경에 따라 다르게 읽힌다.

```js
const lum = (c) => {
  const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
};
const bg = getComputedStyle(document.body).backgroundColor;
const pick = (sel) => getComputedStyle(document.querySelector(sel)).color;
JSON.stringify({
  본문: ratio(pick('.prose p'), bg),
  부제: ratio(pick('.prose blockquote'), bg),
  메타: ratio(pick('[class*="text-ink-faint"]'), bg),
  강조: ratio(pick('.text-accent'), bg),
});
```

Expected: `본문`과 `강조`는 4.5 이상, `메타`는 3.0 이상. 미달하면 해당 토큰의 명도(L)를 0.02씩 낮춰 다시 잰다. 통과할 때까지 반복하고, 최종 수치를 커밋 메시지에 남긴다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "배경을 흰색으로, 톤을 중성으로 바꿈"
```

---

### Task 2: 푸터를 화면 하단에 고정

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (레이아웃 셸 변경)

짧은 페이지에서 푸터가 콘텐츠 바로 밑에 붙고 그 아래가 빈 채로 남는다. 뷰포트보다 짧으면 하단에 붙고, 길면 콘텐츠를 따라 내려가야 한다.

- [ ] **Step 1: body를 세로 flex로, main이 남는 공간을 차지하게**

`src/layouts/BaseLayout.astro`에서 아래를 찾아

```astro
  <body class="min-h-screen">
```

이렇게 바꾼다.

```astro
  <body class="flex min-h-screen flex-col">
```

그리고 `<main>`의 class에 `flex-1`과 `w-full`을 더한다. 기존:

```astro
    <main class:list={['mx-auto px-8', narrow ? 'max-w-container-narrow' : 'max-w-container']}>
```

교체:

```astro
    <main
      class:list={[
        'w-full flex-1 px-8',
        narrow ? 'max-w-container-narrow' : 'max-w-container',
        'mx-auto',
      ]}
    >
```

`w-full`이 필요한 이유: `flex-col` 컨테이너에서 자식은 교차축(가로)으로 늘어나지만, `max-w-*`와 `mx-auto`가 함께 걸리면 브라우저에 따라 내용 폭으로 줄어들 수 있다. 명시해 두는 편이 안전하다.

- [ ] **Step 2: 짧은 페이지에서 확인**

`pnpm dev`로 띄우고 `http://localhost:4321/` (홈은 콘텐츠가 짧다)에서:

```js
const f = document.querySelector('footer').getBoundingClientRect();
JSON.stringify({
  footerBottom: Math.round(f.bottom),
  viewportHeight: window.innerHeight,
  pinned: Math.abs(f.bottom - window.innerHeight) < 2,
  pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
});
```

Expected: `pinned: true`, `pageScrolls: false`

그다음 `http://localhost:4321/posts/tcp-error-recovery` (긴 페이지)에서 같은 코드 실행.
Expected: `pageScrolls: true` — 긴 페이지에서는 푸터가 화면에 고정되지 않고 아래로 밀려나야 한다.

- [ ] **Step 3: 커밋**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "짧은 페이지에서 푸터가 화면 하단에 붙도록"
```

---

### Task 3: 헤더 모바일 대응

**Files:**
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

375px에서 nav 높이가 70px로 헤더(56px)를 넘고, 브랜드 "씨유"가 두 줄로 쪼개진다. flex 자식이 내용 폭 아래로 줄어들면서 글자 단위로 줄바꿈되기 때문이다.

모바일에서는 nav를 토글로 감춘다. 상태를 DOM에만 두고 공유하지 않으므로 React island가 아니라 인라인 스크립트로 처리한다(2단계에서 정한 기준과 같다).

- [ ] **Step 1: 줄바꿈부터 막는다**

`src/components/Header.astro`에서 브랜드 링크에 `shrink-0`을, 브랜드 텍스트에 `whitespace-nowrap`을 더한다. 기존:

```astro
    <a href="/" class="flex items-center gap-[11px]">
```

교체:

```astro
    <a href="/" class="flex shrink-0 items-center gap-[11px]">
```

그 안의 span도 기존:

```astro
      <span class="text-[15px] font-bold tracking-[-0.01em]">씨유</span>
```

교체:

```astro
      <span class="text-[15px] font-bold tracking-[-0.01em] whitespace-nowrap">씨유</span>
```

- [ ] **Step 2: nav를 모바일에서 감추고 토글 버튼을 넣는다**

`<nav>` 여는 태그를 찾아 class를 바꾸고 `id`를 준다. 기존:

```astro
    <nav class="flex items-center gap-[26px] text-[13.5px] font-medium">
```

교체:

```astro
    <button
      type="button"
      id="nav-toggle"
      class="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:text-ink md:hidden"
      aria-label="메뉴 열기"
      aria-expanded="false"
      aria-controls="site-nav"
    >
      <span aria-hidden="true" class="text-lg leading-none">☰</span>
    </button>

    <nav
      id="site-nav"
      class="hidden items-center gap-[26px] text-[13.5px] font-medium md:flex"
    >
```

`</nav>` 뒤(닫는 `</div>` 앞)에 모바일 펼침 패널을 넣는다. 데스크톱에서는 `md:hidden`으로 사라진다.

```astro
  </div>

  <div
    id="mobile-nav"
    class="hidden border-t border-ink/8 bg-canvas px-8 pt-2 pb-4 md:hidden"
  >
    <nav class="flex flex-col text-[15px] font-medium">
      {
        nav.map((item) => (
          <a
            href={item.href}
            class:list={[
              'py-2.5 transition-colors hover:text-ink',
              active === item.key ? 'text-ink' : 'text-ink-subtle',
            ]}
          >
            {item.label}
          </a>
        ))
      }
      <a href="/posts" class="py-2.5 text-ink-subtle transition-colors hover:text-ink">
        글 검색
      </a>
    </nav>
  </div>
```

**주의:** 기존 `</div>`(헤더 안쪽 컨테이너를 닫는 것) 하나를 위 블록의 첫 줄이 대체한다. `</header>` 앞에 `</div>`가 중복되지 않게 확인할 것.

- [ ] **Step 3: 토글 스크립트**

파일 맨 끝에 추가한다.

```astro
<script>
  const toggle = document.getElementById('nav-toggle');
  const panel = document.getElementById('mobile-nav');

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });

    // 데스크톱 폭으로 넓어지면 패널을 닫는다. 열어둔 채 회전하면
    // 데스크톱 nav와 패널이 함께 보인다.
    window.matchMedia('(min-width: 48rem)').addEventListener('change', (e) => {
      if (e.matches) {
        panel.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', '메뉴 열기');
      }
    });
  }
</script>
```

- [ ] **Step 4: 375px와 1280px 양쪽에서 확인**

`pnpm dev` 후 브라우저 폭 375px에서:

```js
const inner = document.querySelector('header > div');
const brand = inner.querySelector('a');
const nav = document.getElementById('site-nav');
const toggle = document.getElementById('nav-toggle');
JSON.stringify({
  headerHeight: Math.round(inner.getBoundingClientRect().height),
  brandHeight: Math.round(brand.getBoundingClientRect().height),
  desktopNavVisible: nav.offsetParent !== null,
  toggleVisible: toggle.offsetParent !== null,
});
```

Expected: `headerHeight: 56`, `brandHeight` 24 이하(한 줄), `desktopNavVisible: false`, `toggleVisible: true`

토글을 눌러 패널이 열리는지, `aria-expanded`가 `true`로 바뀌는지 확인한다.

폭을 1280px로 바꾼 뒤 같은 코드 실행.
Expected: `desktopNavVisible: true`, `toggleVisible: false`

- [ ] **Step 5: 커밋**

```bash
git add src/components/Header.astro
git commit -m "모바일에서 헤더 nav를 토글로 감춤"
```

---

### Task 4: 아카이브·글 상세 모바일 레이아웃

**Files:**
- Modify: `src/components/CategoryFilter.tsx`
- Modify: `src/components/PostMeta.astro`
- Modify: `src/pages/tech/infra.astro`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

아카이브 목록 행이 `grid-cols-[1fr_auto]` 고정이라 375px에서 카테고리·제목·날짜가 세 조각으로 흩어진다. 좁은 폭에서는 위아래로 쌓아야 한다.

- [ ] **Step 1: 목록 행을 모바일에서 세로로**

`src/components/CategoryFilter.tsx`의 목록 링크 `className`을 찾아

```
"grid grid-cols-[1fr_auto] items-baseline gap-5 border-t border-ink/8 py-4 transition-opacity hover:opacity-60"
```

이렇게 바꾼다.

```
"flex flex-col gap-1 border-t border-ink/8 py-4 transition-opacity hover:opacity-60 sm:grid sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-5"
```

그리고 날짜 span의 `className`에서 모바일일 때 왼쪽 정렬이 되도록 기존

```
"font-mono text-[12.5px] whitespace-nowrap text-ink-faint"
```

을 유지한다(flex-col에서는 자동으로 왼쪽 정렬된다). 카테고리 span의 `min-w-16`은 세로 배치에서 불필요한 여백을 만드므로 `sm:min-w-16`으로 바꾼다.

- [ ] **Step 2: 글 상세 제목 크기를 모바일에서 줄인다**

`src/components/PostMeta.astro`의 h1에서 기존

```astro
<h1 class="m-0 text-[40px] leading-[1.18] font-extrabold tracking-[-0.03em] text-balance">
```

교체:

```astro
<h1
  class="m-0 text-[28px] leading-[1.22] font-extrabold tracking-[-0.03em] text-balance sm:text-[40px] sm:leading-[1.18]"
>
```

메타 줄도 좁은 폭에서 넘치므로 기존

```astro
<div class="mt-5.5 flex items-center gap-3.5 font-mono text-[13px] text-ink-faint">
```

교체:

```astro
<div class="mt-5.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[13px] text-ink-faint">
```

- [ ] **Step 3: 인프라 대시보드 제목도 같은 방식으로**

`src/pages/tech/infra.astro`의 h1에서 기존

```astro
        <h1 class="m-0 text-[44px] leading-[1.1] font-extrabold tracking-[-0.03em]">
```

교체:

```astro
        <h1
          class="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.1]"
        >
```

`src/pages/posts/index.astro`의 h1도 같은 값으로 바꾼다. 기존:

```astro
    <h1 class="m-0 text-[44px] leading-[1.12] font-extrabold tracking-[-0.03em]">
```

교체:

```astro
    <h1
      class="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.12]"
    >
```

- [ ] **Step 4: 세 화면 × 세 폭에서 가로 스크롤이 없는지 확인**

`pnpm build && pnpm preview`로 띄운다. 320px, 375px, 768px 각 폭에서 `/`, `/posts`, `/posts/tcp-error-recovery`, `/tech/infra` 네 경로를 열고 아래를 실행한다.

```js
const de = document.documentElement;
const over = [...document.querySelectorAll('body *')]
  .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
  .filter((e) => e.scrollWidth <= e.clientWidth) // 자기 안에서 스크롤하는 건 정상
  .slice(0, 5)
  .map((e) => e.tagName + '.' + e.className.toString().slice(0, 40));
JSON.stringify({
  width: window.innerWidth,
  horizontalScroll: de.scrollWidth > de.clientWidth,
  offenders: over,
});
```

Expected: 12개 조합 모두 `horizontalScroll: false`, `offenders: []`

코드 블록(`.prose pre`)은 `scrollWidth > clientWidth`라 위 필터에서 제외된다 — 자기 안에서 스크롤하는 것이 의도한 동작이다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "아카이브 목록과 제목 크기를 모바일에 맞춤"
```

---

### Task 5: 날짜 포맷 함수 통합

**Files:**
- Create: `src/lib/date.ts`
- Create: `src/lib/date.test.ts`
- Modify: `src/components/PostMeta.astro`
- Modify: `src/components/RelatedPosts.astro`
- Modify: `src/pages/posts/index.astro`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `formatDate(d: Date): string` — `2023.11.09`
  - `formatShortDate(d: Date): string` — `11.09`
  - `getYear(d: Date): string` — `2023`

`pad`와 포맷 문자열이 세 파일에 복제돼 있고, 셋 다 `getFullYear`/`getMonth`/`getDate`(로컬 타임존)를 쓴다. `pubDate: 2023-11-09`는 UTC 자정 Date가 되므로, UTC보다 뒤진 타임존에서 빌드하면 하루 밀리고 1월 1일 글은 연도까지 밀린다. 기준 타임존을 명시해 고정한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDate, formatShortDate, getYear } from './date';

describe('date', () => {
  it('연.월.일을 두 자리로 채워 낸다', () => {
    expect(formatDate(new Date('2023-11-09'))).toBe('2023.11.09');
    expect(formatDate(new Date('2024-01-05'))).toBe('2024.01.05');
  });

  it('짧은 형식은 월.일만 낸다', () => {
    expect(formatShortDate(new Date('2023-04-03'))).toBe('04.03');
  });

  it('연도를 문자열로 낸다', () => {
    expect(getYear(new Date('2024-12-29'))).toBe('2024');
  });

  /*
   * 프런트매터의 2024-01-01은 UTC 자정 Date가 된다. 기준 타임존을 고정하지 않고
   * 로컬 게터를 쓰면 UTC보다 뒤진 곳에서 빌드할 때 하루가 밀리고, 1월 1일 글은
   * 연도까지 밀려 아카이브의 연도 묶음이 달라진다.
   */
  it('UTC 자정 경계에서 로컬 타임존에 흔들리지 않는다', () => {
    const newYear = new Date('2024-01-01T00:00:00Z');
    expect(getYear(newYear)).toBe('2024');
    expect(formatDate(newYear)).toBe('2024.01.01');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/date.test.ts`
Expected: FAIL — `Failed to resolve import "./date"`

- [ ] **Step 3: 최소 구현**

`src/lib/date.ts`:

```ts
/**
 * 날짜 표기의 단일 출처.
 *
 * 프런트매터의 `2024-01-01`은 UTC 자정 Date가 된다. 로컬 게터로 읽으면 빌드하는
 * 기계의 타임존에 따라 하루가 밀리고, 1월 1일 글은 연도까지 밀려 아카이브의
 * 연도 묶음이 달라진다. UTC를 기준으로 고정해 어디서 빌드하든 같은 값이 나오게 한다.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function getYear(d: Date): string {
  return String(d.getUTCFullYear());
}

export function formatShortDate(d: Date): string {
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

export function formatDate(d: Date): string {
  return `${getYear(d)}.${formatShortDate(d)}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/date.test.ts`
Expected: PASS — 4 passed

- [ ] **Step 5: 세 곳의 복제를 걷어낸다**

`src/components/PostMeta.astro`의 프런트매터에서 아래 세 줄을 지우고

```ts
const pad = (n: number) => String(n).padStart(2, '0');
const d = post.pubDate;
const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
```

이렇게 바꾼다.

```ts
const date = formatDate(post.pubDate);
```

같은 파일 import에 추가:

```ts
import { formatDate } from '../lib/date';
```

`src/components/RelatedPosts.astro`에서 `pad`와 `meta` 함수를 지우고

```ts
import { formatDate } from '../lib/date';

function meta(p: PostSummary): string {
  return `${formatDate(p.pubDate)} · ${p.minutes}분`;
}
```

`src/pages/posts/index.astro`에서 `pad`를 지우고 `items` 매핑을 바꾼다.

```ts
import { formatShortDate, getYear } from '../../lib/date';
```

```ts
const items: FilterablePost[] = posts.map((p) => ({
  title: p.title,
  category: p.category,
  href: p.href,
  year: getYear(p.pubDate),
  meta: `${formatShortDate(p.pubDate)} · ${p.minutes}분`,
}));
```

같은 파일의 `firstYear`도 UTC 기준으로 맞춘다. 기존:

```ts
const firstYear = posts.length
  ? posts[posts.length - 1].pubDate.getFullYear()
  : new Date().getFullYear();
```

교체:

```ts
const firstYear = posts.length
  ? getYear(posts[posts.length - 1].pubDate)
  : String(new Date().getUTCFullYear());
```

- [ ] **Step 6: 복제가 남아 있지 않은지 확인하고 빌드**

Run: `grep -rn 'padStart' src/ --include=*.astro --include=*.tsx`
Expected: 결과 없음

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과

Run: `grep -o '2023.11.09' dist/posts/tcp-error-recovery/index.html | head -1`
Expected: `2023.11.09`

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "날짜 포맷을 한 곳으로 모으고 기준 타임존을 UTC로 고정"
```

---

### Task 6: nav 키를 유니온 타입으로

**Files:**
- Create: `src/lib/nav.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/posts/index.astro`
- Modify: `src/pages/posts/[...slug].astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/tech/infra.astro`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type NavKey = 'home' | 'tech' | 'archive' | 'about'`
  - `NAV_ITEMS: readonly { key: NavKey; label: string; href: string }[]`

아카이브와 글 상세가 `active="archive"`를 넘기는데 헤더의 키 목록에는 `archive`가 없어 조용히 버려진다. `active`가 `string`이라 타입체크에 안 걸린다.

동시에 헤더의 `회고`와 `개인`이 둘 다 `/posts`를 가리키는 임시 상태를 정리한다. 카테고리별 목록은 3b에서 만들 것이므로, 지금은 실제 라우트가 있는 항목만 남긴다.

- [ ] **Step 1: nav 정의를 파일 하나로 분리**

`src/lib/nav.ts`:

```ts
/**
 * 헤더 nav의 단일 출처.
 *
 * key를 유니온 타입으로 묶는다. 예전에는 `active`가 string이라 존재하지 않는
 * 키('archive')를 넘겨도 타입체크를 통과했고, 현재 위치 표시가 조용히 꺼져 있었다.
 *
 * 회고·개인처럼 아직 전용 라우트가 없는 항목은 넣지 않는다. 카테고리별 목록은
 * 3b에서 만든다.
 */
export const NAV_ITEMS = [
  { key: 'home', label: '홈', href: '/' },
  { key: 'tech', label: '기술', href: '/tech/infra' },
  { key: 'archive', label: '글', href: '/posts' },
  { key: 'about', label: '소개', href: '/about' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];
```

- [ ] **Step 2: Header가 이 정의를 쓰게 한다**

`src/components/Header.astro`의 프런트매터에서 지역 `nav` 배열을 지우고 아래로 바꾼다.

```ts
import { NAV_ITEMS, type NavKey } from '../lib/nav';

interface Props {
  active?: NavKey;
}
const { active } = Astro.props;
```

템플릿에서 `nav.map(...)`을 `NAV_ITEMS.map(...)`으로 바꾼다. 모바일 패널(Task 3에서 추가한 것) 안의 `nav.map(...)`도 같이 바꾼다.

- [ ] **Step 3: BaseLayout의 Props도 좁힌다**

`src/layouts/BaseLayout.astro`의 프런트매터에서 기존

```ts
  /** 헤더에서 현재 위치를 표시할 nav 키 */
  active?: string;
```

교체:

```ts
  /** 헤더에서 현재 위치를 표시할 nav 키 */
  active?: NavKey;
```

import 추가:

```ts
import type { NavKey } from '../lib/nav';
```

- [ ] **Step 4: 타입이 실제로 잘못된 키를 잡는지 확인한다**

먼저 현재 페이지들이 넘기는 값이 전부 유효한지 본다. `index.astro`는 `home`, `tech/infra.astro`는 `tech`, 아카이브와 글 상세는 `archive` — Step 1에서 `archive`를 키에 넣었으므로 넷 다 유효하다.

Run: `pnpm check`
Expected: `0 errors`

여기서 통과한다고 타입이 일하는 건 아니다. **잘못된 키가 실제로 걸리는지 확인한다.** `src/pages/posts/index.astro`의 `active="archive"`를 잠시 `active="nonexistent"`로 바꾸고

Run: `pnpm check`
Expected: 에러 — `Type '"nonexistent"' is not assignable to type 'NavKey'`

에러를 확인했으면 `active="archive"`로 되돌리고 다시 `pnpm check`가 `0 errors`인지 본다. 이 확인을 건너뛰면 예전처럼 타입이 느슨한 채로 통과했는지 알 수 없다.

- [ ] **Step 5: 현재 위치 표시가 실제로 켜지는지 확인**

`pnpm dev` 후 `/posts`에서:

```js
const active = [...document.querySelectorAll('#site-nav a')]
  .filter((a) => getComputedStyle(a).color === getComputedStyle(document.body).color)
  .map((a) => a.textContent.trim());
JSON.stringify({ active });
```

Expected: `["글"]` — 예전에는 `[]`였다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "nav 키를 유니온 타입으로 묶어 잘못된 키가 빌드에서 걸리게"
```

---

### Task 7: 데드코드 정리와 Tailwind 스캔 범위 제한

**Files:**
- Modify: `src/lib/posts.ts`
- Modify: `src/lib/posts.test.ts`
- Modify: `src/lib/categories.ts`
- Modify: `src/lib/categories.test.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: 없음
- Produces: `groupByYear`와 `isCategorySlug`가 사라진다. 3b에서 필요해지면 그때 테스트와 함께 되살린다.

- [ ] **Step 1: 정말 안 쓰이는지 확인**

Run: `grep -rn 'groupByYear\|isCategorySlug' src/ | grep -v '\.test\.'`
Expected: 정의부(`src/lib/posts.ts`, `src/lib/categories.ts`)만 나온다. 호출부가 하나라도 나오면 지우지 말고 보고할 것.

- [ ] **Step 2: 제거**

`src/lib/posts.ts`에서 `groupByYear` 함수 전체를 지운다. `groupByKey`는 `CategoryFilter.tsx`가 쓰므로 남긴다.

`src/lib/posts.test.ts`에서 `describe('groupByYear', ...)` 블록 전체와 import 목록의 `groupByYear`를 지운다.

`src/lib/categories.ts`에서 `isCategorySlug` 함수를 지운다. `BY_SLUG`는 `categoryLabel`이 쓰므로 남긴다.

`src/lib/categories.test.ts`에서 `'알 수 없는 slug를 거른다'` 테스트와 import 목록의 `isCategorySlug`를 지운다.

- [ ] **Step 3: Tailwind 스캔 범위를 src로 좁힌다**

`docs/`의 계획 문서에 적힌 클래스 이름이 빌드 CSS에 살아남는다. 문서 안의 예시 코드가 스타일시트에 영향을 주면 안 된다.

`src/styles/global.css` 맨 위에서 기존

```css
@import 'tailwindcss';
```

교체:

```css
@import 'tailwindcss';

/* 문서(docs/)의 예시 코드에 적힌 클래스가 빌드 CSS에 섞이지 않게 소스만 훑는다. */
@source '../../src';
```

- [ ] **Step 4: 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과 (테스트 수는 4개 줄어든다)

Run: `grep -c '900px' dist/_astro/*.css`
Expected: `0` — 계획 문서에만 있고 소스에는 없는 `max-w-[900px]`가 더 이상 생성되지 않는다

Run: `grep -c 'max-w-container-narrow' dist/_astro/*.css`
Expected: `1` 이상 — 실제로 쓰는 클래스는 그대로 생성된다

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "데드코드를 걷어내고 Tailwind 스캔 범위를 src로 제한"
```

---

## 3a단계 완료 기준

- 페이지 배경이 순백, 카드가 그보다 살짝 어둡고, 강조색만 테라코타로 남는다
- 본문 텍스트 대비 4.5:1 이상 (실측값을 커밋 메시지에 기록)
- 320·375·768px × 4개 경로 = 12개 조합에서 문서 가로 스크롤 없음
- 375px에서 헤더 높이 56px 유지, 브랜드 한 줄, nav는 토글
- 짧은 페이지에서 푸터가 화면 하단에 붙고, 긴 페이지에서는 밀려난다
- `/posts`에서 현재 위치 표시가 켜진다
- `pnpm test`·`pnpm check`·`pnpm build` 통과

## 3b로 넘기는 것

- Pagefind 검색 — 헤더의 `글 검색`을 실제 검색으로
- i18n 라우팅·구조 — `/en/posts` 라우트, 언어 전환 UI. UI 문구 번역은 하지 않는다
- 태그 페이지 (`/tags/<tag>`)
- 카테고리별 목록 — nav에서 뺀 `회고`·`개인`을 되살릴지는 그때 결정
