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
