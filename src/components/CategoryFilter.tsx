import { useMemo, useRef, useState } from 'react';
import { CATEGORIES, categoryLabel, type CategorySlug } from '../lib/categories';
import { groupByKey } from '../lib/posts';

/** Dates are serialized before entering the hydrated archive. */
export interface FilterablePost {
  title: string;
  description: string;
  tags: string[];
  category: CategorySlug;
  href: string;
  year: string;
  date: string;
  dateTime: string;
  minutes: number;
}

export function filterPosts(posts: FilterablePost[], category: CategorySlug | 'all', query: string): FilterablePost[] {
  const words = query.normalize('NFC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (category !== 'all' && post.category !== category) return false;
    const text = [post.title, post.description, ...post.tags, categoryLabel(post.category)]
      .join(' ').normalize('NFC').toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

const englishCategories: Record<CategorySlug, string> = {
  retrospect: 'Retrospectives & culture', infra: 'Infrastructure', guide: 'Guides', life: 'Life',
};

interface Props { posts: FilterablePost[]; lang?: string; }

export default function CategoryFilter({ posts, lang = 'ko' }: Props) {
  const en = lang === 'en';
  const [category, setCategory] = useState<CategorySlug | 'all'>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const counts = useMemo(() => {
    const result = new Map<CategorySlug, number>();
    for (const post of posts) result.set(post.category, (result.get(post.category) ?? 0) + 1);
    return result;
  }, [posts]);
  const visible = useMemo(() => filterPosts(posts, category, query), [posts, category, query]);
  const groups = useMemo(() => groupByKey(visible, (post) => post.year), [visible]);
  const filtered = category !== 'all' || query.trim() !== '';
  const reset = () => { setCategory('all'); setQuery(''); searchRef.current?.focus(); };
  const label = (slug: CategorySlug) => en ? englishCategories[slug] : categoryLabel(slug);

  return (
    <div className="archive-browser">
      <section className="archive-controls" aria-label={en ? 'Find posts' : '글 찾아보기'}>
        <label className="archive-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input ref={searchRef} type="search" aria-label={en ? 'Search posts' : '글 검색'} placeholder={en ? 'Search titles, descriptions, or tags' : '제목이나 키워드로 찾아보세요'} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="archive-filters" role="group" aria-label={en ? 'Post category' : '글 주제 선택'}>
          <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{en ? 'All' : '전체'}<span>{posts.length}</span></button>
          {CATEGORIES.map((item) => <button key={item.slug} type="button" aria-pressed={category === item.slug} onClick={() => setCategory(item.slug)}>{label(item.slug)}<span>{counts.get(item.slug) ?? 0}</span></button>)}
        </div>
      </section>
      <section aria-label={en ? 'Posts' : '글 목록'}>
        <div className="archive-result">
          <span role="status" aria-live="polite" aria-atomic="true">{en ? `${visible.length} ${visible.length === 1 ? 'post' : 'posts'}` : `${visible.length}개의 글`}{query.trim() ? en ? ' · Search results' : ' · 검색 결과' : ''}</span>
          <div className="archive-result-meta">{filtered && <button className="archive-reset" type="button" onClick={reset}>{en ? 'Reset' : '초기화'}</button>}<span>{en ? 'Newest first' : '최근에 쓴 글부터'}</span></div>
        </div>
        {groups.map(({ key: year, items }) => (
          <section className="archive-year" key={year} aria-labelledby={`archive-year-${year}`}>
            <h2 id={`archive-year-${year}`}>{year}</h2>
            <ul>{items.map((post) => (
              <li className="archive-post" key={post.href}>
                <div className="archive-category">{label(post.category)}</div>
                <div className="archive-post-heading"><h3><a href={post.href}>{post.title}</a></h3><time dateTime={post.dateTime}>{post.date}</time></div>
                <p>{post.description}</p>
                <span className="archive-reading-time">{en ? `${post.minutes} min read` : `${post.minutes}분 읽기`}</span>
              </li>
            ))}</ul>
          </section>
        ))}
        {!visible.length && <div className="archive-empty"><h2>{en ? 'No posts found.' : '찾는 글이 없어요.'}</h2>{filtered && <><p>{en ? 'Try another keyword or category.' : '다른 키워드로 검색하거나 주제를 전체로 바꿔보세요.'}</p><button type="button" onClick={reset}>{en ? 'View all posts' : '전체 글 보기'}</button></>}</div>}
      </section>
    </div>
  );
}
