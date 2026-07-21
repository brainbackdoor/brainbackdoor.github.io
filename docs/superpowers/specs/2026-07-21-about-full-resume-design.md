# 설계 — 소개 페이지 (풀 이력서, Phase B)

작성일: 2026-07-21
선행: Phase A(홈) 머지 완료. 이 문서는 `docs/superpowers/specs/2026-07-21-home-and-about-design.md` §4의 방향을 확정 설계로 구체화한다.
콘텐츠 원본: `docs/superpowers/specs/2026-07-21-about-source.md` (전사 단일 출처)

## 0. 목표

라이브 brainbackdoor.com/profile 수준의 완전한 상세 이력서를 `/about`으로 만든다. 색·크롬은
이 저장소의 중성 테마 v2 방향(선 절제·여백 우선·sans·소프트 폴백)을 따른다. nav의 "소개"를
되살린다.

## 1. 확정된 결정 (브레인스토밍)

1. **Career 요약 + 상세 이력 둘 다** — 상단에 스캔용 Career 6줄(org+역할, 날짜 없음),
   아래에 상세 활동 이력.
2. **현재/이전은 한 모델의 토글** — `Activity.current: boolean`. 이전 활동 카드도 예전엔
   현재였던 것. 사용자가 그때그때 플래그를 바꾼다. `/about`의 "현재 하는 일"은
   `current=true` 상세 활동으로 렌더. (홈 사이드바의 4역할 요약 `current: CurrentItem[]`는
   별개로 홈에만 유지 — Phase A에서 이미 존재.)
3. **이전 활동 전부 펼침** — 더보기·클라이언트 JS 없음. 정적으로 전부 렌더.
4. **상세 이력 정렬** — 회사 헤더 없이 시간 역순 평면, 각 항목에 (소속 · 기간) 태그.
5. **서브프로젝트** — 중첩 들여쓰기로 인라인 렌더.
6. **인용문 "여기서 확인"** — 같은 페이지 개발문화 섹션 앵커(`#culture`).
7. **폭** — 새 토큰 `--spacing-container-about: 860px`, 슬롯 내 자체 래퍼(BaseLayout prop 아님).
8. **이미지 슬롯** — `Activity.image?`, 있으면 이미지·없으면 소프트 폴백. 초기엔 폴백.
9. **아바타** — 소프트 폴백 원형 + optional 이미지 슬롯.
10. **포함 범위** — 육아휴직·멘사코리아 포함 전체. 전사는 원본 소스 그대로.

## 2. 데이터 모델 (`src/data/about.ts` 확장)

기존 `current: CurrentItem[]`(홈 사이드바)는 유지하고 아래를 **추가**한다.

```ts
export const profile = {
  name: string; subtitle: string;
  quoteHeading: string; quoteBody: string;   // "여기"는 페이지에서 #culture 링크로 처리
  closingHeading: string; closingBody: string;
};

export interface CareerItem { org: string; role: string }   // 날짜 없음
export const career: CareerItem[];                            // 6줄, 최신순
export const education: string[];
export const contact: string;
export interface SnsLink { label: string; href: string }
export const sns: SnsLink[];                                  // 5개

export interface ValueCard { name: string; tagline: string; body: string[] }
export const values: ValueCard[];                            // 3개, 풀문단

export interface SubProject { title: string; period?: string; bullets: string[] }
export interface Activity {
  title: string; org: string; period: string;
  current: boolean;
  bullets: string[];
  subProjects?: SubProject[];
  image?: string;
}
export const activities: Activity[];                          // 최신순, current/past 혼재
```

내용은 전부 `2026-07-21-about-source.md`에서 전사한다.

## 3. 페이지 (`src/pages/about.astro`, 신규)

`<BaseLayout title description active="about">`. 슬롯 안 `max-w-container-about mx-auto`.
데이터는 `about.ts`. 섹션 순서:

1. **프로필 헤더** — 아바타(폴백/이미지 슬롯, aria-hidden), eyebrow "자기소개" / h1 이동규 /
   부제 / 인용문 blockquote(`quoteHeading` 강조색 + `quoteBody`, "여기"→`#culture`). 하단 hairline.
2. **Career / Education / Contact** — 2열(모바일 1열). Career 6줄(org+역할), Education 목록,
   Contact 메일(mailto) + SNS 알약(`target=_blank rel="me noopener"`).
3. **지향하는 개발 문화** (`id="culture"`) — values 3개, 각 name(강조색)+tagline+body 문단들.
   선 절제(카드 대신 hairline 구분).
4. **현재 하는 일** — `activities.filter(a => a.current)`. 각 활동: 제목 + (소속 · 기간) +
   bullets + subProjects(중첩). 이미지 슬롯 있으면 이미지.
5. **이전 활동** — `activities.filter(a => !a.current)`, 전부. 동일 렌더.
6. **닫는 문구** — `profile.closingHeading` + `closingBody`.

**렌더 규칙**: 한글 라벨·메타 sans(mono 금지). 기간은 `tabular-nums`. 불릿은 `ul/li`,
서브프로젝트는 들여쓴 블록. 접근성: 아바타·플레이스홀더 aria-hidden, 링크 명확.

## 4. 토큰·nav

- `src/styles/global.css` `@theme`: `--spacing-container-about: 860px;` 추가(레이아웃 그룹).
- `src/lib/nav.ts`: `NAV_ITEMS`에 `{ key: 'about', label: '소개', href: '/about' }` 추가(글 뒤).
  `NavKey`는 자동 유도. 상단 주석의 "소개 페이지는 …" 문구를 현실에 맞게 수정.

## 5. 검증

각 태스크 끝 `pnpm test && pnpm check && pnpm build`. 모바일 320/375/768px 가로 스크롤 없음.
대비 본문 ≥4.5·메타 ≥3 실측. **전사 정확성은 렌더된 `/about`을 소스와 대조**해 확인(사용자
최종 검수). nav "소개" active 표시 확인. 완료 후 `--no-ff` main 머지.

## 6. 범위 밖

giscus, `/en/about`, 실제 이미지 자산 제작(슬롯만 준비), 홈 사이드바 `current`를 activities에서
파생시키는 리팩토링(추후).
