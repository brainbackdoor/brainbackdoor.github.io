import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import type { CategorySlug } from './categories';
import { categoryCards, splitFeatured } from './home';

function post(slug: string, date: string, category: CategorySlug = 'infra'): PostSummary {
  return {
    slug, lang: 'ko', title: slug, description: '',
    pubDate: new Date(date), category, tags: [], minutes: 1, href: `/posts/${slug}`,
  };
}

describe('splitFeatured', () => {
  it('빈 목록이면 featured는 null, recent는 빈 배열', () => {
    expect(splitFeatured([])).toEqual({ featured: null, recent: [] });
  });

  it('1편이면 그 글이 featured, recent는 빈 배열', () => {
    const p = post('a', '2024-01-01');
    expect(splitFeatured([p])).toEqual({ featured: p, recent: [] });
  });

  it('최신 글이 featured, featured는 recent에 포함되지 않는다', () => {
    const posts = [post('a', '2024-01-01'), post('b', '2024-06-01'), post('c', '2024-03-01')];
    const { featured, recent } = splitFeatured(posts);
    expect(featured?.slug).toBe('b');
    expect(recent.map((p) => p.slug)).toEqual(['c', 'a']);
    expect(recent).not.toContain(featured);
  });

  it('recent는 recentCount편으로 제한된다', () => {
    const posts = Array.from({ length: 8 }, (_, i) => post(`p${i}`, `2024-01-0${i + 1}`));
    expect(splitFeatured(posts, 5).recent).toHaveLength(5);
  });
});

describe('categoryCards', () => {
  it('CATEGORIES 4종을 항상 그 순서로 반환한다', () => {
    expect(categoryCards([]).map((c) => c.slug)).toEqual(['retrospect', 'infra', 'guide', 'life']);
  });

  it('빈 목록이면 모든 카드가 count 0·latest null', () => {
    for (const card of categoryCards([])) {
      expect(card.count).toBe(0);
      expect(card.latest).toBeNull();
    }
  });

  it('카테고리별 글 수와 최신 글을 집계한다', () => {
    const posts = [
      post('r1', '2024-01-01', 'retrospect'),
      post('i1', '2024-02-01', 'infra'),
      post('i2', '2024-05-01', 'infra'),
    ];
    const bySlug = Object.fromEntries(categoryCards(posts).map((c) => [c.slug, c]));
    expect(bySlug.retrospect.count).toBe(1);
    expect(bySlug.infra.count).toBe(2);
    expect(bySlug.infra.latest?.slug).toBe('i2');
    expect(bySlug.guide.count).toBe(0);
    expect(bySlug.guide.latest).toBeNull();
  });
});
