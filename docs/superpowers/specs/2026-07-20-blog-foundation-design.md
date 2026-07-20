# 개인 블로그 — 설계

작성일: 2026-07-20
저장소: `brainbackdoor/brainbackdoor.github.io`

## 목적

GitHub Pages에 배포하는 개인 기술 블로그. 디자인은 Claude Design 프로젝트
"개인 블로그 사이트 설계"(7개 화면)를 따른다.

## 스택

| 항목 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | Astro 7 (static) | 콘텐츠 사이트에 최적. 기본 JS 0KB, 필요한 컴포넌트만 hydration |
| UI island | React 19 | 향후 리치 인터랙션(다이어그램·차트·에디터) 라이브러리 생태계가 넓음 |
| 스타일 | Tailwind CSS 4 | `@theme`로 디자인 토큰을 CSS에 선언 |
| 콘텐츠 | Content Collections + MDX | 저장소 내 파일. git이 곧 히스토리 |
| 검색 | Pagefind (3단계) | 빌드 시 인덱스 생성 → 서버 불필요 |
| 댓글 | giscus (3단계) | GitHub Discussions 백엔드, 서버 불필요 |
| 배포 | GitHub Actions → Pages | `withastro/action@v6` + `actions/deploy-pages@v5` |
| 패키지 매니저 | pnpm 10 | |

### React를 고른 이유

초기 판단은 Svelte였다(번들 최소화). 사용자가 "리치한 인터랙션을 나중에
넣고 싶을 수도 있다"고 밝히면서 전제가 바뀌었다. 판단 기준은 언어 문법이
아니라 생태계다 — React Flow, Recharts, CodeMirror 래퍼 등 성숙한 라이브러리
유무가 실제 구현 시간을 가른다.

Astro islands 구조에서는 이 선택의 비용이 작다. 인터랙티브 컴포넌트가 없는
페이지에는 React 런타임이 실리지 않는다(1단계에서 실측 확인: 인프라 페이지
JS 0 bytes).

## 디자인 토큰

단일 출처는 `src/styles/global.css`의 `@theme` 블록이다.
컴포넌트에 색상 값을 직접 박지 않는다.

색은 oklch로 적는다. 명도(L)만 조절해 hover·다크 대응값을 파생시키므로
파생색이 원본과 수치로 연결된다. 원본 hex는 주석에 남긴다.

```
canvas   oklch(0.95  0.008 85)   ← #f4f2ee  페이지 배경
surface  oklch(0.972 0.007 85)   ← #faf8f4  카드
sunken   oklch(0.935 0.008 85)   ← #efece5  푸터
ink      oklch(0.255 0.008 60)   ← #24211d  본문
accent   oklch(0.45  0.1   32)              테라코타
```

다크모드 토글 UI는 2단계지만, 대응 토큰(`:root[data-theme='dark']`)은
1단계에 미리 정의한다 — 나중에 붙이면 컴포넌트를 전부 다시 만져야 한다.

## 라우팅 · i18n

- `ko`가 기본 로케일, prefix 없음 (`/tech/infra`)
- `en`은 prefix 사용 (`/en/tech/infra`)
- 글은 `src/content/posts/{ko,en}/<slug>.mdx`
- 번역이 없는 글은 해당 언어 목록에 나타나지 않는다. 별도 fallback 처리 없음

## 콘텐츠 스키마

```ts
{
  title, description, pubDate,
  updatedDate?, tags: string[],
  category: 'tech' | 'retro' | 'personal',
  draft: boolean
}
```

## 단계 구분

- **1단계 (완료)** — 스캐폴딩, 디자인 토큰, 레이아웃 primitive(Header/Footer/BaseLayout),
  `인프라` 페이지 포팅, 배포 파이프라인
- **2단계** — 글 상세 페이지, 읽기 편의 기능(다크모드 토글·목차·코드 복사·읽기 진행률), 목록/태그
- **3단계** — Pagefind 검색, giscus 댓글, i18n 전면 적용
- **4단계** — 나머지 화면(홈, 소개, 회고, 블로그목차, 기술포스팅, 실습가이드)

`인프라` 페이지를 1단계 검증 대상으로 삼은 이유: 헤더·푸터·카드·통계 타일·
사이드 네비를 모두 포함해 디자인 시스템 전반을 한 번에 검증할 수 있다.

## 알려진 제약

- **TypeScript는 6.x에 고정.** TS 7(네이티브 컴파일러)은 `astro check`가 쓰는
  programmatic API를 아직 노출하지 않는다.
  ([withastro/roadmap#1321](https://github.com/withastro/roadmap/discussions/1321))
  TS 7로 올리면 타입체크가 깨진다.
- **`dist/_astro/client.*.js`(약 191KB)는 어떤 페이지도 로드하지 않는다.**
  React 통합이 무조건 방출하는 런타임 엔트리다. 전송량에는 영향이 없다.
- 빌드 시 `glob-loader: No files found` 경고가 뜬다. 아직 글이 없어서이며,
  첫 글을 쓰면 사라진다.
- Tailwind는 알파 유틸리티(`bg-ink/5`)를 `color-mix()` + hex fallback 쌍으로
  방출한다. `color-mix()` 경로만 토큰 변수를 참조하므로, 이 경로를 지원하지
  않는 구형 브라우저에서는 다크모드 시 알파 색이 라이트 값으로 고정된다.
  oklch와 지원 범위가 같아(2023+) 실질적 문제는 없다.
