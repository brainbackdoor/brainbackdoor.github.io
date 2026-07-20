import { getCollection, type CollectionEntry } from 'astro:content';
import { parseEntryId, sortByDateDesc, type PostSummary } from './posts';
import { readingTime } from './reading-time';

/**
 * Content Collection과 순수 함수 사이의 어댑터.
 *
 * 이 파일만 astro:content 런타임에 의존한다. 가공 로직은 전부 posts.ts와
 * reading-time.ts에 있고 그쪽이 Vitest로 검증된다. 여기서는 연결만 한다.
 */
export function toSummary(entry: CollectionEntry<'posts'>): PostSummary {
  const { lang, slug } = parseEntryId(entry.id);
  return {
    slug,
    lang,
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    category: entry.data.category,
    tags: entry.data.tags,
    minutes: readingTime(entry.body ?? ''),
    href: lang === 'ko' ? `/posts/${slug}` : `/${lang}/posts/${slug}`,
  };
}

/** draft는 제외하고 최신순으로 반환한다. */
export async function loadPosts(lang = 'ko'): Promise<PostSummary[]> {
  const entries = await getCollection('posts', ({ data }) => !data.draft);
  return sortByDateDesc(entries.map(toSummary).filter((p) => p.lang === lang));
}
