# 소개 페이지 (풀 이력서) 구현 계획 — Phase B

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 라이브 profile 수준의 완전한 상세 이력서 `/about` 페이지를 만들고 nav "소개"를 되살린다.

**Architecture:** 정적 콘텐츠(프로필·career·values·activities)는 `src/data/about.ts`로 확장(전사 출처: `docs/superpowers/specs/2026-07-21-about-source.md`). 활동 1건 렌더는 `AboutActivity.astro` 컴포넌트로 빼서 현재/이전에 재사용. 페이지는 조립만. 폭은 새 토큰 `--spacing-container-about`.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, TypeScript 6.x

## Global Constraints

- 색·간격·컨테이너 폭은 `src/styles/global.css` `@theme` 토큰만. hex/px/oklch 색상 직접 삽입 금지.
- 중성 테마 토큰만(canvas/surface/sunken, ink/ink-muted/ink-subtle/ink-faint, accent). v2 방향: 선 절제·여백 우선·소프트 폴백(`bg-sunken` + inset ring), 스트라이프 금지.
- **한글 텍스트에 `font-mono` 금지.** 기간 등 숫자는 `tabular-nums`.
- 전사는 `2026-07-21-about-source.md` 원문 그대로 — 임의 축약·의역 금지.
- 순수 데이터는 `about.ts`, 페이지·컴포넌트는 렌더만. 접근성: 아바타·플레이스홀더 aria-hidden.
- TypeScript 6.x 고정. 모바일 320/375/768px 가로 스크롤 없음. 2열은 모바일 1열.
- 대비: 본문 ≥4.5, 메타 ≥3(computed RGB 실측).
- 각 태스크 끝 `pnpm test && pnpm check && pnpm build` 통과.

## 배경

Phase A(홈)는 main에 머지됨. `src/data/about.ts`에 이미 `interface CurrentItem`·`current`(홈 사이드바 4역할)가 있다 — **유지하고 추가만** 한다. `src/lib/nav.ts`는 현재 home/tech/archive만 있고 'about' 없음.

---

### Task 1: about.ts 데이터 확장 (전사)

**Files:**
- Modify: `src/data/about.ts` (기존 `current` 유지, 아래 추가)

**Interfaces (Produces):** `profile`, `CareerItem`·`career`, `education`, `contact`, `SnsLink`·`sns`, `ValueCard`·`values`, `SubProject`·`Activity`·`activities`.

- [ ] **Step 1: 타입과 데이터 추가** — 전사 출처 `docs/superpowers/specs/2026-07-21-about-source.md`를 읽고, 그 내용을 아래 구조로 **그대로** 옮긴다. 기존 `current`/`CurrentItem`은 지우지 말 것.

타입(파일 상단, 기존 export 아래에 추가):

```ts
export const profile = {
  name: '이동규',
  subtitle: '그란데클립 프로덕트 엔지니어 · brainbackdoor',
  quoteHeading: '그대는 전율이어라',
  closingHeading: '나는 오늘도 한 방울의 맑은 물이 되리라',
  closingBody: '오늘 행한 작은 실천이 주위에 긍정적인 영향을 주길 바라며 여러 활동을 하고 있어요.',
};

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
  body: string[];
}

export interface SubProject {
  title: string;
  period?: string;
  bullets: string[];
}

export interface Activity {
  title: string;
  org: string;
  period: string;
  current: boolean;
  bullets: string[];
  subProjects?: SubProject[];
  image?: string;
}
```

그리고 `career`(6줄), `education`, `contact`, `sns`(5개 — 소스의 URL 그대로), `values`(3개, tagline+body 문단), `activities`(소스의 활동 전부, `[current]` 표시가 있으면 `current: true`, 없으면 `false`; 서브프로젝트는 `subProjects`로)를 소스에서 전사한다.

주의:
- `quoteBody`/`closingBody`의 인용 본문 중 "여기" 링크는 데이터에 넣지 않는다 — 그 문단은 페이지(Task 4)에서 인라인 앵커로 렌더한다. `profile`에는 위 필드만.
- `activities` 순서는 소스 순서(최신순) 그대로.

- [ ] **Step 2: 검증** — Run: `pnpm check` (0 errors). `pnpm test && pnpm build`도 통과.
- [ ] **Step 3: 커밋** — `git add src/data/about.ts && git commit -m "about.ts에 프로필·career·values·activities 이력 데이터 추가"`

---

### Task 2: nav "소개" 복원 (`src/lib/nav.ts`)

about.astro가 `active="about"`을 쓰려면 `NavKey`에 'about'이 있어야 하므로 Task 4보다 먼저.

**Files:** Modify: `src/lib/nav.ts`

- [ ] **Step 1: NAV_ITEMS에 소개 추가 + 주석 수정**

`NAV_ITEMS`에 행 추가:

```ts
export const NAV_ITEMS = [
  { key: 'home', label: '홈', href: '/' },
  { key: 'tech', label: '기술', href: '/tech/infra' },
  { key: 'archive', label: '글', href: '/posts' },
  { key: 'about', label: '소개', href: '/about' },
] as const;
```

상단 주석의 마지막 문장("소개 페이지와 카테고리별 목록은 3b에서 만들며, 그때 다시 넣는다.")을 아래로 교체:

```ts
 * 전용 라우트가 없는 항목은 넣지 않는다 — 넣으면 링크가 404가 된다. 소개(/about)는
 * 이제 라우트가 있어 되살렸다. 카테고리별 목록은 아직 라우트가 없어 빼둔다.
```

(`NavKey` 정의 줄은 그대로 — 'about' 자동 유도.)

- [ ] **Step 2: 검증** — `pnpm test && pnpm check && pnpm build` 통과. (about 페이지는 Task 4에서 생기지만 내부 앵커라 빌드 통과.)
- [ ] **Step 3: 커밋** — `git add src/lib/nav.ts && git commit -m "nav에 소개(/about) 항목 복원"`

---

### Task 3: 폭 토큰 + AboutActivity 컴포넌트

**Files:**
- Modify: `src/styles/global.css` (`@theme` 레이아웃에 1줄)
- Create: `src/components/AboutActivity.astro`

**Interfaces:** Consumes `Activity`(`src/data/about.ts`). Produces `AboutActivity` (props `{ activity: Activity }`).

- [ ] **Step 1: 폭 토큰 추가** — `src/styles/global.css` `@theme` 레이아웃 그룹에 추가:

```css
  --spacing-container-about: 860px; /* 소개 — 아카이브보다 좁은 본문 폭 */
```

- [ ] **Step 2: 컴포넌트 작성** — `src/components/AboutActivity.astro`:

```astro
---
import type { Activity } from '../data/about';

interface Props {
  activity: Activity;
}
const { activity } = Astro.props;
---

<article class="border-t border-ink/10 py-7 first:border-t-0">
  <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
    <h3 class="text-[17px] font-bold tracking-[-0.02em]">{activity.title}</h3>
    <div class="shrink-0 text-[12.5px] text-ink-faint tabular-nums">
      {activity.org} · {activity.period}
    </div>
  </div>

  {
    activity.bullets.length > 0 && (
      <ul class="mt-3 flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-faint">
        {activity.bullets.map((b) => (
          <li class="text-[14.5px] leading-relaxed text-ink-muted">{b}</li>
        ))}
      </ul>
    )
  }

  {
    activity.subProjects && activity.subProjects.length > 0 && (
      <div class="mt-4 flex flex-col gap-4 border-l border-ink/8 pl-4">
        {activity.subProjects.map((sp) => (
          <div>
            <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h4 class="text-[14.5px] font-semibold tracking-[-0.01em]">{sp.title}</h4>
              {sp.period && (
                <div class="shrink-0 text-[12px] text-ink-faint tabular-nums">{sp.period}</div>
              )}
            </div>
            <ul class="mt-2 flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-faint">
              {sp.bullets.map((b) => (
                <li class="text-[14px] leading-relaxed text-ink-subtle">{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }
</article>
```

- [ ] **Step 3: 검증** — `pnpm test && pnpm check && pnpm build` 통과. (컴포넌트가 아직 안 쓰여도 타입·빌드 통과. 안 쓰이면 빌드 경고 없음 — Astro는 미사용 컴포넌트를 문제삼지 않음.)
- [ ] **Step 4: 커밋** — `git add src/styles/global.css src/components/AboutActivity.astro && git commit -m "소개 폭 토큰과 AboutActivity 컴포넌트"`

---

### Task 4: 소개 페이지 (`src/pages/about.astro`)

**Files:** Create: `src/pages/about.astro`

**Interfaces:** Consumes `profile`·`career`·`education`·`contact`·`sns`·`values`·`activities`(`about.ts`), `AboutActivity`, `BaseLayout`.

- [ ] **Step 1: 페이지 작성** — `src/pages/about.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AboutActivity from '../components/AboutActivity.astro';
import {
  profile,
  career,
  education,
  contact,
  sns,
  values,
  activities,
} from '../data/about';

const currentActivities = activities.filter((a) => a.current);
const pastActivities = activities.filter((a) => !a.current);
---

<BaseLayout
  title="소개 · 이동규"
  description="이동규 — 그란데클립 프로덕트 엔지니어 · brainbackdoor"
  active="about"
>
  <div class="mx-auto max-w-container-about">
    <!-- 프로필 헤더 -->
    <section class="flex flex-col gap-7 border-b border-ink/10 py-16 sm:flex-row sm:items-start sm:gap-9">
      <div
        class="size-[104px] shrink-0 rounded-full bg-sunken ring-1 ring-ink/5 ring-inset"
        aria-hidden="true"
      >
      </div>
      <div>
        <div class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">자기소개</div>
        <h1 class="mt-3 text-[36px] leading-[1.05] font-extrabold tracking-[-0.04em] sm:text-[44px]">
          {profile.name}
        </h1>
        <p class="mt-2.5 text-[15px] text-ink-muted">{profile.subtitle}</p>
        <blockquote class="mt-6 border-l-2 border-accent pl-5">
          <div class="text-[15px] font-bold tracking-[-0.01em] text-accent">{profile.quoteHeading}</div>
          <p class="mt-2 text-[15.5px] leading-relaxed text-ink-muted">
            좋은 울림을 주는 엔지니어를 지향하고 있어요. 좋은 개발문화를 위한 Agile, DevOps 등의
            실천 전략에 관심이 많으며, Web Architecture를 이루는 구성 요소들에 흥미를 가지고 있습니다.
            제가 지향하는 좋은 개발문화에 대한 자세한 이야기는 <a
              href="#culture"
              class="text-accent underline underline-offset-2 hover:text-accent-hover">여기</a
            >서 확인할 수 있어요.
          </p>
        </blockquote>
      </div>
    </section>

    <!-- Career / Education / Contact -->
    <section class="grid grid-cols-1 gap-10 border-b border-ink/10 py-14 sm:grid-cols-2">
      <div>
        <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Career</h2>
        <ul class="mt-5 flex flex-col gap-3.5">
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
      <div class="flex flex-col gap-9">
        <div>
          <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Education</h2>
          <ul class="mt-5 flex flex-col gap-2">
            {education.map((e) => <li class="text-[15px]">{e}</li>)}
          </ul>
        </div>
        <div>
          <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Contact</h2>
          <a
            href={`mailto:${contact}`}
            class="mt-5 inline-block text-[15px] text-accent transition-colors hover:text-accent-hover"
          >
            {contact}
          </a>
          <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {
              sns.map((s) => (
                <a
                  href={s.href}
                  target="_blank"
                  rel="me noopener"
                  class="text-[13.5px] font-medium text-ink-muted transition-colors hover:text-accent"
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
    <section id="culture" class="scroll-mt-20 border-b border-ink/10 py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">지향하는 개발 문화</h2>
      <div class="mt-6 flex flex-col">
        {
          values.map((v) => (
            <article class="border-t border-ink/10 py-7 first:border-t-0">
              <h3 class="text-[18px] font-bold tracking-[-0.02em] text-accent">{v.name}</h3>
              <div class="mt-1.5 text-[13.5px] text-ink-subtle">{v.tagline}</div>
              <div class="mt-3.5 flex max-w-[640px] flex-col gap-2.5">
                {v.body.map((p) => (
                  <p class="text-[15px] leading-relaxed text-ink-muted">{p}</p>
                ))}
              </div>
            </article>
          ))
        }
      </div>
    </section>

    <!-- 현재 하는 일 -->
    <section class="border-b border-ink/10 py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">현재 하는 일</h2>
      <div class="mt-6 flex flex-col">
        {currentActivities.map((a) => <AboutActivity activity={a} />)}
      </div>
    </section>

    <!-- 이전 활동 -->
    <section class="py-14">
      <h2 class="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">이전 활동</h2>
      <div class="mt-6 flex flex-col">
        {pastActivities.map((a) => <AboutActivity activity={a} />)}
      </div>

      <div class="mt-12 border-t border-ink/10 pt-10">
        <p class="text-[17px] font-bold tracking-[-0.02em]">{profile.closingHeading}</p>
        <p class="mt-2 text-[15px] leading-relaxed text-ink-muted">{profile.closingBody}</p>
      </div>
    </section>
  </div>
</BaseLayout>
```

- [ ] **Step 2: 검증** — `pnpm test && pnpm check && pnpm build` 통과. (`max-w-container-about`·`scroll-mt-20`·`gap-x-5` 등이 안 먹으면 근사 토큰 유틸로 조정, 단 색값 직접 삽입 금지.)
- [ ] **Step 3: 렌더 확인** — `pnpm dev` 후 `/about`: 프로필·Career 6·Education·Contact+SNS 5·개발문화 3·현재 활동(NEXTSTEP/GVC/EIR)·이전 활동 전부·닫는 문구가 뜨는지, 헤더 nav "소개"에 active 표시되는지, 인용문 "여기" 클릭 시 개발문화로 스크롤되는지 확인.
- [ ] **Step 4: 커밋** — `git add src/pages/about.astro && git commit -m "소개 페이지 (풀 이력서) 추가"`

---

### Task 5: 모바일·대비·전사 검증

- [ ] **Step 1: 프리뷰** — `pnpm build && pnpm preview`.
- [ ] **Step 2: 가로 스크롤** — `/about`을 320·375·768px에서 `document.documentElement.scrollWidth <= clientWidth` → 모두 `true`. `false`면 넘치는 요소(긴 불릿·URL)를 `break-words`·`min-w-0`로 고침.
- [ ] **Step 3: 대비** — `/about`에서 본문 불릿(ink-muted)·서브 불릿(ink-subtle)·기간 메타(ink-faint) 대비를 canvas RGB로 계산: 본문 ≥4.5, 메타 ≥3. (Phase A와 동일 스니펫.)
- [ ] **Step 4: 전사 대조** — `/about` 렌더 내용을 `2026-07-21-about-source.md`와 대조해 활동·불릿 누락/오타가 없는지 확인(특히 subProjects 중첩, current/past 분류). 누락 시 about.ts 수정 후 재검증.
- [ ] **Step 5: 최종 검증·커밋** — `pnpm test && pnpm check && pnpm build`. 수정 있었으면 커밋.

---

## 완료 후

`superpowers:finishing-a-development-branch`로 `--no-ff` main 머지.

## Self-Review 노트

- 스펙 §2(모델) → Task 1. §3(페이지 섹션) → Task 4 + AboutActivity(Task 3). §4(토큰·nav) → Task 2·3. §5(검증) → Task 5.
- 타입 일관성: `Activity`/`SubProject`(Task 1)와 AboutActivity(Task 3)·about.astro(Task 4) 소비 일치. `active="about"`은 Task 2가 NavKey에 'about' 추가 후 유효.
- 기존 `current`/`CurrentItem`(Phase A) 보존 확인 — Task 1은 추가만.
