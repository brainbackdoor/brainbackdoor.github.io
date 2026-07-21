# 3c단계: Pagefind 검색 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더의 `글 검색`을 누르면 실제 검색 페이지가 열리고, 글 제목·본문·태그로 글을 찾을 수 있다. 검색 UI는 중성 테마와 어울린다.

**Architecture:** `astro-pagefind` 통합을 쓴다. 이 통합은 `astro build` 중 Pagefind 인덱스를 생성하고(별도 postbuild 스크립트·CI 설정 불필요 — `withastro/action`이 도는 빌드에 자동 포함), dev 서버에서는 Sirv 미들웨어로 빌드된 인덱스를 서빙해 검색이 동작한다. 인덱싱 범위는 글 상세의 `<article>`로 좁혀, 목록·태그·홈 페이지가 검색 인덱스에 노이즈로 섞이지 않게 한다.

**Tech Stack:** Astro 7, astro-pagefind 2, Pagefind 1.5, Tailwind CSS 4

## Global Constraints

- 색·간격 값은 `src/styles/global.css`의 `@theme` 블록에만 정의한다. 검색 UI 테마도 토큰을 참조한다.
- 어떤 링크도 404를 내면 안 된다.
- nav `active`는 `NavKey` 유니온이다(3a). `search` 키가 필요하면 `src/lib/nav.ts`에 먼저 추가한다.
- **Pagefind 인덱스는 빌드 후에만 존재한다.** 검증은 `pnpm build && pnpm preview`로 하고, dev 검증은 "빌드를 한 번 돌린 뒤 dev"로 한다(통합 미들웨어가 dist의 인덱스를 서빙).
- 다크모드는 구현하지 않는다. TypeScript는 **6.x 고정**.
- 각 태스크 끝에서 `pnpm check`·`pnpm build`가 통과해야 한다. (`pnpm test`는 순수 함수 대상이라 이 단계에선 변화 없음.)

## 이 계획이 다루지 않는 것

- **영어 검색(`/en/search`)은 만들지 않는다.** 영어 글이 1편뿐이라, 태그와 같은 이유로 미룬다. 검색 페이지는 한국어 크롬·한국어 인덱스다. Pagefind가 `<html lang>`으로 언어별 인덱스를 이미 분리하므로, 영어 글이 쌓이면 `/en/search`를 얹기만 하면 된다.
- 헤더의 검색을 인라인 드롭다운으로 만들지 않는다. 전용 `/search` 페이지로 간다(구조가 단순하고, 모바일에서 안정적).
- giscus 댓글, 영어 소개 페이지(4단계).

---

### Task 1: astro-pagefind 통합과 인덱싱 범위 설정

**Files:**
- Modify: `package.json` (astro-pagefind 의존성)
- Modify: `astro.config.mjs` (integrations)
- Modify: `src/components/PostArticle.astro` (data-pagefind-body / ignore)

**Interfaces:**
- Consumes: 없음
- Produces: `dist/pagefind/` 인덱스와 UI 번들 — Task 2의 검색 페이지가 로드한다

- [ ] **Step 1: 의존성 설치**

```bash
pnpm add astro-pagefind
```

`astro-pagefind@^2.0.1`이 설치된다(peer: astro ^7, deps: pagefind ^1.5, sirv).

- [ ] **Step 2: 통합 등록**

`astro.config.mjs`에서 import를 더하고 integrations 배열에 넣는다. **`pagefind()`는 다른 통합보다 뒤에 두는 것이 안전하다**(빌드된 출력물을 인덱싱하므로). 기존:

```js
import tailwindcss from '@tailwindcss/vite';
```

뒤에 추가:

```js
import pagefind from 'astro-pagefind';
```

`integrations` 배열의 맨 끝에 `pagefind()`를 더한다. 기존:

```js
  integrations: [react(), mdx(), sitemap()],
```

교체:

```js
  integrations: [react(), mdx(), sitemap(), pagefind()],
```

- [ ] **Step 3: 인덱싱 범위를 글 본문으로 좁힌다**

Pagefind는 사이트에 `data-pagefind-body`가 하나라도 있으면 **그 요소 안만** 인덱싱하고 나머지 페이지는 건너뛴다. 글 상세의 `<article>`에만 붙이면 글 상세 4개(ko 3 + en 1)만 인덱싱되고 목록·태그·홈은 제외된다.

`src/components/PostArticle.astro`의 `<article>` 여는 태그에 속성을 더한다. 기존:

```astro
  <article class="min-w-0 pt-14 pb-10">
```

교체:

```astro
  <article class="min-w-0 pt-14 pb-10" data-pagefind-body>
```

`<article>` 안에는 PostMeta(제목·카테고리·태그·날짜)와 본문이 있다. 제목·태그가 검색되는 건 바람직하다. 다만 PostMeta의 "← 목차로" 백링크는 검색 대상이 아니므로 제외한다.

`src/components/PostMeta.astro`의 "← 목차로" 링크에 `data-pagefind-ignore`를 더한다. 기존:

```astro
<a href="/posts" class="text-[13px] text-ink-faint transition-colors hover:text-ink-subtle">
  ← 목차로
</a>
```

교체:

```astro
<a
  href="/posts"
  data-pagefind-ignore
  class="text-[13px] text-ink-faint transition-colors hover:text-ink-subtle"
>
  ← 목차로
</a>
```

- [ ] **Step 4: 빌드하고 인덱스가 생성되는지 확인**

Run: `pnpm build 2>&1 | tail -6`
Expected: 빌드가 통과하고, Pagefind가 인덱싱 로그를 낸다(예: "Indexed N pages"). 통합이 빌드 중 인덱스를 만든다.

Run: `ls dist/pagefind/`
Expected: `pagefind.js`, `pagefind-ui.js`, `pagefind-ui.css`, `pagefind-entry.json`, `index/`, `fragment/` 등이 있다.

- [ ] **Step 5: 인덱싱 범위가 글 상세만인지 확인**

Pagefind는 언어별로 인덱스를 나눈다. 인덱싱된 페이지 수를 확인한다.

Run: `cat dist/pagefind/pagefind-entry.json`
Expected: `languages`에 `ko`와 `en`(또는 `unknown`) 항목이 있고, 각 언어의 `page_count`가 글 상세 개수와 맞는다(ko 3, en 1). 목록·태그·홈은 포함되지 않아야 한다 — page_count가 4를 크게 넘으면 `data-pagefind-body` 범위가 잘못 잡힌 것이다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "astro-pagefind 통합과 인덱싱 범위 설정

글 상세의 article에만 data-pagefind-body를 붙여, 목록·태그·홈이 검색
인덱스에 노이즈로 섞이지 않게 한다. 통합이 빌드 중 인덱스를 만들고
dev에서는 미들웨어로 서빙하므로 별도 postbuild·CI 설정이 필요 없다."
```

---

### Task 2: 검색 페이지와 헤더 연결, 테마 적용

**Files:**
- Create: `src/pages/search.astro`
- Modify: `src/lib/nav.ts` (검색은 nav 항목이 아니라 알약이므로, active 키만 필요하면 추가)
- Modify: `src/components/Header.astro` (`글 검색` 알약을 `/search`로)
- Modify: `src/styles/global.css` (Pagefind UI 테마 변수)

**Interfaces:**
- Consumes: `dist/pagefind/`(Task 1)
- Produces: 라우트 `/search`

`astro-pagefind`의 `<Search>` 컴포넌트를 쓴다. 이 컴포넌트는 `@pagefind/component-ui`의 검색 박스를 감싸며, CSS 커스텀 속성으로 테마를 받는다. 컴포넌트가 유지보수 모드라는 안내가 있지만, 개인 블로그 검색에는 충분하고 문서화가 완전하다.

- [ ] **Step 1: 검색 페이지 작성**

`src/pages/search.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Search from 'astro-pagefind/components/Search.astro';
---

<BaseLayout title="검색 · 씨유" description="글을 검색합니다." active="search" narrow>
  <section class="pt-16 pb-8">
    <div class="mb-4.5 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
      검색
    </div>
    <h1 class="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.12]">
      글 검색
    </h1>
  </section>

  <div class="pb-18">
    <Search
      instance="site-search"
      className="pagefind-neutral"
      searchboxOptions={{ placeholder: '무엇을 찾으세요?' }}
      configOptions={{ lang: 'ko' }}
    />
  </div>
</BaseLayout>
```

props는 astro-pagefind 문서 기준이다: `instance`(고유 id), `className`(테마 훅), `searchboxOptions`(placeholder 등 검색 박스 옵션), `configOptions`(lang·preload 등). `configOptions.lang: 'ko'`로 한국어 인덱스에 붙는다.

**주의:** prop 이름은 설치된 버전이 최종 기준이다. Step 3에서 빌드가 prop 관련 에러를 내면 `node_modules/astro-pagefind/components/Search.astro`를 열어 실제 prop 시그니처를 보고 맞춘다. 문서가 아니라 설치된 코드가 기준이다.

- [ ] **Step 2: 헤더 알약을 검색 페이지로 연결**

`src/lib/nav.ts`에 `search`를 `NavKey`에 추가한다. 다만 검색은 nav 목록 항목이 아니라 별도 알약이므로 `NAV_ITEMS`에는 넣지 않고, active 키만 유효하게 만든다. 파일 끝의 타입 정의를 이용한다 — `NAV_ITEMS`에서 유도되는 유니온이라 `search`가 없다. 그래서 `NavKey`를 명시 유니온으로 넓힌다:

```ts
export type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'search';
```

`src/components/Header.astro`에서 `글 검색` 알약의 href를 바꾼다(데스크톱·모바일 양쪽). 데스크톱 기존:

```astro
      <a
        href="/posts"
        class="flex items-center gap-[7px] rounded-pill bg-ink/5 px-[13px] py-[7px] text-[12.5px] text-ink-faint transition-colors hover:bg-ink/9"
      >
        <span class="text-[13px]">⌕</span><span>글 검색</span>
      </a>
```

`href="/posts"`를 `href="/search"`로 바꾼다. 모바일 패널의 `글 검색` 링크(`href="/posts"`)도 `href="/search"`로 바꾼다.

- [ ] **Step 3: 빌드하고 검색 페이지·prop을 확인**

Run: `pnpm build 2>&1 | tail -4`
Expected: `/search/index.html`이 생성되고 빌드 통과. prop 이름이 틀리면 여기서 에러가 난다 — 에러가 나면 Step 1 주의대로 설치된 컴포넌트의 실제 prop으로 고친다.

Run: `grep -o 'pagefind-ui\|pagefind/pagefind' dist/search/index.html | head -3`
Expected: 검색 UI 스크립트/스타일 참조가 페이지에 있다.

- [ ] **Step 4: 실제 검색을 preview로 확인**

Run: `pnpm preview` (백그라운드로 띄운다)

브라우저에서 `/search`를 열고:
- 검색창에 "TCP"를 입력 → "TCP 에러 복구 살펴보기"(한국어 글)가 결과에 뜬다.
- 결과를 클릭 → `/posts/tcp-error-recovery`로 이동한다.
- "재전송" 같은 본문 단어로도 그 글이 검색된다(본문이 인덱싱됐다는 증거).
- 목록/홈이 결과에 안 뜬다("기록의 목차" 같은 페이지 제목이 결과로 나오면 안 됨 — Task 1의 범위 설정이 맞는지 재확인).

실제 결과와 이동으로 판정한다. computed style이 아니라 검색 동작을 본다.

- [ ] **Step 5: UI를 중성 테마에 맞춘다**

Pagefind UI가 노출하는 CSS 커스텀 속성을 **실제로 확인한 뒤** 매핑한다. 브라우저에서 검색 박스 요소를 골라 `getComputedStyle`로 `--pagefind-ui-*` 또는 `--pf-*` 변수를 덤프하거나, `dist/pagefind/pagefind-ui.css`에서 `--pagefind-ui-` 접두 변수를 grep한다.

Run: `grep -o '\-\-pagefind-ui-[a-z-]*' dist/pagefind/pagefind-ui.css | sort -u`
Expected: `--pagefind-ui-primary`, `--pagefind-ui-background`, `--pagefind-ui-border`, `--pagefind-ui-text`, `--pagefind-ui-font` 등의 목록.

그 변수들을 `src/styles/global.css` 맨 끝에서 우리 토큰으로 덮는다. 실제 grep으로 나온 변수 이름을 쓸 것(아래는 예시이며 이름이 다르면 맞춘다):

```css
/* Pagefind 검색 UI를 중성 테마에 맞춘다. 변수 이름은 pagefind-ui.css에서 확인한 것. */
.pagefind-neutral {
  --pagefind-ui-primary: var(--color-ink);
  --pagefind-ui-text: var(--color-ink);
  --pagefind-ui-background: var(--color-surface);
  --pagefind-ui-border: color-mix(in oklab, var(--color-ink) 12%, transparent);
  --pagefind-ui-tag: var(--color-sunken);
  --pagefind-ui-font: var(--font-sans);
  --pagefind-ui-border-radius: var(--radius-item);
}
```

- [ ] **Step 6: 테마가 실제로 먹었는지 preview로 확인**

`pnpm build && pnpm preview` 후 `/search`에서 검색 박스의 배경·테두리·강조색이 중성 톤인지 확인한다. 검색 박스 요소의 computed `background-color`를 읽어 `--color-surface`(oklch(0.975 0 0))와 맞는지 본다. 따뜻한 파랑 기본색(Pagefind 기본 primary는 파랑 계열)이 남아 있으면 매핑이 안 먹은 것 — 변수 이름을 다시 확인한다.

- [ ] **Step 7: dev 미들웨어 검색도 확인**

통합은 dev에서 dist의 인덱스를 서빙한다. 빌드를 한 번 한 상태에서:

Run: `pnpm dev`
`/search`에서 검색이 되는지 확인한다(빌드 인덱스가 있으므로 미들웨어가 서빙). 되면 이후 콘텐츠 개발 중에도 검색을 확인할 수 있다. 안 되면 통합의 dev 미들웨어가 동작하지 않는 것이므로 보고한다.

- [ ] **Step 8: 타입체크와 커밋**

Run: `pnpm check`
Expected: `0 errors`

```bash
git add -A
git commit -m "검색 페이지 추가하고 헤더 알약을 연결, UI를 중성 테마에 맞춤

글 검색 알약이 2단계부터 /posts를 가리키던 것을 /search로 돌린다.
Pagefind UI의 CSS 변수를 우리 토큰으로 덮어 파랑 기본 테마를 중성으로 바꾼다."
```

---

## 3c단계 완료 기준

- `/search`에서 제목·본문·태그로 글을 찾고, 결과를 누르면 그 글로 이동한다
- 목록·태그·홈 페이지가 검색 결과에 섞이지 않는다(글 상세만 인덱싱)
- 검색 UI가 중성 테마와 어울린다(파랑 기본색 아님)
- 헤더의 `글 검색`이 `/search`로 간다(데스크톱·모바일)
- dev(빌드 후)와 preview 둘 다에서 검색이 동작한다
- `pnpm check`·`pnpm build` 통과

## 4단계로 넘기는 것

- 영어 검색 `/en/search`(영어 콘텐츠가 쌓일 때)
- giscus 댓글(저장소 생성 후)
- 영어 소개 페이지, 나머지 디자인 화면(홈·소개 등)
- 배포: `brainbackdoor.github.io` 저장소 생성, remote 교체, Pages Source를 "GitHub Actions"로
