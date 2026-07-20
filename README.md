# brainbackdoor.github.io

개인 기술 블로그. Astro + React + Tailwind CSS 4, GitHub Pages 배포.

## 개발

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # dist/ 생성
pnpm check    # 타입체크
```

## 구조

```
src/
  styles/global.css     디자인 토큰 (@theme) — 색·타이포 단일 출처
  layouts/              페이지 셸
  components/           재사용 UI
  data/                 페이지별 콘텐츠 데이터
  content/posts/{ko,en} 글 (MDX)
  pages/                라우트
```

색상이나 간격을 바꿀 때는 `src/styles/global.css`의 `@theme` 블록만 수정한다.
컴포넌트에 값을 직접 박지 말 것.

## 배포

`main`에 push하면 GitHub Actions가 빌드 후 Pages에 배포한다.
최초 1회 저장소 설정에서 **Settings → Pages → Source를 "GitHub Actions"로**
바꿔야 한다.

## 설계 문서

[docs/superpowers/specs/](docs/superpowers/specs/)

## 주의

TypeScript는 6.x에 고정되어 있다. TS 7은 `astro check`가 쓰는 API를 아직
노출하지 않아 타입체크가 깨진다.
