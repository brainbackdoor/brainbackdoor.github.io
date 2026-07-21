/**
 * 헤더 nav의 단일 출처.
 *
 * key를 유니온 타입으로 묶는다. 예전에는 `active`가 string이라 존재하지 않는
 * 키('archive')를 넘겨도 타입체크를 통과했고, 현재 위치 표시가 조용히 꺼져 있었다.
 *
 * 전용 라우트가 없는 항목은 넣지 않는다 — 넣으면 링크가 404가 된다. 소개(/about)는
 * 이제 라우트가 있어 되살렸다. 카테고리별 목록은 아직 라우트가 없어 빼둔다.
 */
export const NAV_ITEMS = [
  { key: 'home', label: '홈', href: '/' },
  { key: 'tech', label: '기술', href: '/tech/infra' },
  { key: 'archive', label: '글', href: '/posts' },
  { key: 'about', label: '소개', href: '/about' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'search';
