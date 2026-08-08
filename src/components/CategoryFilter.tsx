import { useMemo, useState } from 'react';
import { CATEGORIES, categoryLabel, type CategorySlug } from '../lib/categories';
import { groupByKey } from '../lib/posts';
import { Button } from '@astryxdesign/core/Button';

/** 서버에서 직렬화되어 넘어오므로 Date가 아니라 문자열로 받는다. */
export interface FilterablePost {
  title: string;
  category: CategorySlug;
  href: string;
  year: string;
  meta: string;
}

interface Props {
  posts: FilterablePost[];
}

export default function CategoryFilter({ posts }: Props) {
  const [filter, setFilter] = useState<CategorySlug | 'all'>('all');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [posts]);

  // posts는 서버에서 최신순으로 정렬돼 넘어오므로 연도 그룹 순서도 그대로 최신순이다.
  const groups = useMemo(() => {
    const visible = filter === 'all' ? posts : posts.filter((p) => p.category === filter);
    return groupByKey(visible, (p) => p.year);
  }, [posts, filter]);

  return (
    <>
      <div className="sticky top-header z-10 border-b border-ink/10 bg-canvas/90 py-4 backdrop-blur-[8px]">
        <div className="flex flex-wrap gap-2.5">
          <Button
            label={`전체 ${posts.length}`}
            size="sm"
            variant={filter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilter('all')}
          />
          {CATEGORIES.map((c) => (
            <Button
              key={c.slug}
              label={`${c.label} ${counts.get(c.slug) ?? 0}`}
              size="sm"
              variant={filter === c.slug ? 'primary' : 'secondary'}
              onClick={() => setFilter(c.slug)}
            />
          ))}
        </div>
      </div>

      <div className="pt-4 pb-18">
        {groups.map(({ key: year, items }) => (
          <div key={year} className="pt-9 pb-2">
            <div className="pb-1.5 font-mono text-[22px] font-semibold tracking-[-0.01em] text-ink-faint">
              {year}
            </div>
            {items.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="flex flex-col gap-1 border-t border-ink/8 py-4 transition-opacity hover:opacity-60 sm:grid sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-5"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-[10.5px] font-semibold tracking-[0.06em] text-accent uppercase sm:min-w-16">
                    {categoryLabel(p.category)}
                  </span>
                  <span className="text-[17px] font-semibold tracking-[-0.01em]">{p.title}</span>
                </div>
                <span className="font-mono text-[12.5px] whitespace-nowrap text-ink-faint">
                  {p.meta}
                </span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
