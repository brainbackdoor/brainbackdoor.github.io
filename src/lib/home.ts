import { CATEGORIES, type CategorySlug } from './categories';
import { sortByDateDesc, type PostSummary } from './posts';

export interface HomeFeed {
  featured: PostSummary | null;
  recent: PostSummary[];
}

/** featured=최신 1편, recent=featured 제외 그다음 recentCount편. 입력 순서 무의존. */
export function splitFeatured(posts: PostSummary[], recentCount = 5): HomeFeed {
  const [featured = null, ...rest] = sortByDateDesc(posts);
  return { featured, recent: rest.slice(0, recentCount) };
}

export interface CategoryCard {
  slug: CategorySlug;
  label: string;
  count: number;
  latest: PostSummary | null;
}

/** CATEGORIES 4종을 그 순서로. 글 0이면 count 0·latest null. */
export function categoryCards(posts: PostSummary[]): CategoryCard[] {
  const sorted = sortByDateDesc(posts);
  return CATEGORIES.map((c) => {
    const inCat = sorted.filter((p) => p.category === c.slug);
    return { slug: c.slug, label: c.label, count: inCat.length, latest: inCat[0] ?? null };
  });
}
