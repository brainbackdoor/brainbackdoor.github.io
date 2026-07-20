import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadPosts } from '../lib/collection';

/**
 * 푸터가 /rss.xml 을 가리키는데 라우트가 없어 링크가 깨져 있었다.
 * site 는 astro.config.mjs 에서 지정하므로 context.site 는 항상 존재한다.
 */
export async function GET(context: APIContext) {
  const posts = await loadPosts('ko');

  return rss({
    title: '씨유 · brainbackdoor',
    description: '만들고 부수며 배웁니다.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.title,
      description: p.description,
      pubDate: p.pubDate,
      link: p.href,
      categories: p.tags,
    })),
  });
}
