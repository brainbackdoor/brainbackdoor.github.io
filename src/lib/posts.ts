import type { CategorySlug } from './categories';

/**
 * 페이지가 렌더링에만 집중할 수 있도록, 글 목록을 가공하는 로직은 전부
 * 여기 순수 함수로 둔다. Astro 런타임에 의존하지 않아 Vitest로 검증된다.
 */
export interface PostSummary {
  slug: string;
  lang: string;
  title: string;
  description: string;
  pubDate: Date;
  category: CategorySlug;
  tags: string[];
  minutes: number;
  href: string;
}

/**
 * Content Collection의 id는 "ko/tcp-recovery" 형태다.
 *
 * 언어 디렉터리 없이 둔 글은 기본 로케일(ko)로 본다. 목록·라우트·RSS가 모두
 * 이 함수 하나로 언어를 판단하므로, 그렇게 둔 글도 목록에 뜨고 페이지도 생긴다.
 */
export function parseEntryId(id: string): { lang: string; slug: string } {
  const at = id.indexOf('/');
  if (at === -1) return { lang: 'ko', slug: id };
  return { lang: id.slice(0, at), slug: id.slice(at + 1) };
}

export function sortByDateDesc(posts: PostSummary[]): PostSummary[] {
  return [...posts].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

/**
 * 키별로 묶되 첫 등장 순서를 유지한다(Map의 삽입 순서).
 * 입력이 이미 정렬돼 있으면 그룹 순서도 그 정렬을 따른다.
 *
 * 아카이브 페이지의 클라이언트 필터도 이 함수를 쓴다. 그룹핑을 서버와
 * 클라이언트에 각각 두면 언젠가 서로 어긋난다.
 */
export function groupByKey<T>(
  items: T[],
  key: (item: T) => string,
): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = groups.get(k);
    if (bucket) bucket.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.entries()].map(([k, v]) => ({ key: k, items: v }));
}

export function groupByYear(
  posts: PostSummary[],
): { year: string; items: PostSummary[] }[] {
  return groupByKey(sortByDateDesc(posts), (p) =>
    String(p.pubDate.getFullYear()),
  ).map(({ key, items }) => ({ year: key, items }));
}

/** 글은 (slug, lang) 쌍으로 식별한다. 번역본은 slug가 같아도 다른 글이다. */
function isSame(a: PostSummary, b: PostSummary): boolean {
  return a.slug === b.slug && a.lang === b.lang;
}

/**
 * 태그가 겹치는 글을 우선하고, 모자라면 같은 카테고리의 최신 글로 채운다.
 * 겹침 수가 같으면 최신 글이 앞선다.
 */
export function relatedPosts(
  target: PostSummary,
  pool: PostSummary[],
  limit = 2,
): PostSummary[] {
  const others = pool.filter((p) => !isSame(p, target));
  const targetTags = new Set(target.tags);

  const scored = others
    .map((p) => ({ post: p, overlap: p.tags.filter((t) => targetTags.has(t)).length }))
    .filter((s) => s.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || b.post.pubDate.getTime() - a.post.pubDate.getTime(),
    )
    .map((s) => s.post);

  if (scored.length >= limit) return scored.slice(0, limit);

  const filler = sortByDateDesc(
    others.filter(
      (p) => p.category === target.category && !scored.some((q) => isSame(q, p)),
    ),
  );

  return [...scored, ...filler].slice(0, limit);
}

/** sorted는 sortByDateDesc를 거친 최신순 목록이어야 한다. */
export function adjacentPosts(
  target: PostSummary,
  sorted: PostSummary[],
): { prev: PostSummary | null; next: PostSummary | null } {
  const i = sorted.findIndex((p) => isSame(p, target));
  if (i === -1) return { prev: null, next: null };
  return {
    next: i > 0 ? sorted[i - 1] : null,
    prev: i < sorted.length - 1 ? sorted[i + 1] : null,
  };
}
