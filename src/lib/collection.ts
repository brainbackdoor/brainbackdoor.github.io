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

/**
 * draft를 뺀 해당 언어의 엔트리. "이 글이 무슨 언어인가"를 판단하는 곳은
 * 여기 하나뿐이어야 한다.
 *
 * 목록은 parseEntryId로, 라우트는 id.startsWith('ko/')로 각각 판단하던 때,
 * 언어 디렉터리 없이 posts/ 바로 아래 둔 글이 목록과 RSS에는 나오면서 페이지는
 * 만들어지지 않아 링크가 404로 끊겼다. 판단이 둘이면 언젠가 어긋난다.
 */
export async function loadEntries(lang = 'ko'): Promise<CollectionEntry<'posts'>[]> {
  const entries = await getCollection('posts', ({ data }) => !data.draft);
  return entries.filter((entry) => parseEntryId(entry.id).lang === lang);
}

/** draft는 제외하고 최신순으로 반환한다. */
export async function loadPosts(lang = 'ko'): Promise<PostSummary[]> {
  return sortByDateDesc((await loadEntries(lang)).map(toSummary));
}
