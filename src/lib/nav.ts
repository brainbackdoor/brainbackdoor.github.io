/**
 * 헤더 nav의 단일 출처.
 *
 * key를 유니온 타입으로 묶는다. 예전에는 `active`가 string이라 존재하지 않는
 * 키('archive')를 넘겨도 타입체크를 통과했고, 현재 위치 표시가 조용히 꺼져 있었다.
 *
 * 인프라공방은 커리큘럼 목록 아래에 두고 상세 주소 /tech/infra는 유지한다.
 */
export const NAV_ITEMS = [
  { key: 'home', label: '홈', href: '/' },
  { key: 'archive', label: '글', href: '/posts' },
  { key: 'curricula', label: '커리큘럼', href: '/curricula' },
  { key: 'about', label: '소개', href: '/about' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'search';
