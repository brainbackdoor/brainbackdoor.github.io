import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import type { PostSummary, LegacySourcePage } from './posts';
import {
  adjacentPosts,
  legacyRedirects,
  collectTags,
  groupByKey,
  parseEntryId,
  postsWithTag,
  relatedPosts,
  shouldShowOriginalLink,
  sortByDateDesc,
} from './posts';

// pubDate만 문자열로 받는다. Partial<PostSummary>를 그대로 교차시키면
// pubDate가 Date & string = never가 되므로 Omit으로 빼낸다.
function post(
  over: Omit<Partial<PostSummary>, 'pubDate'> & { slug: string; pubDate: string },
): PostSummary {
  return {
    lang: 'ko',
    title: over.slug,
    description: '',
    category: 'infra',
    tags: [],
    minutes: 1,
    href: `/posts/${over.slug}`,
    ...over,
    pubDate: new Date(over.pubDate),
  };
}

describe('parseEntryId', () => {
  it('언어 디렉터리와 slug를 분리한다', () => {
    expect(parseEntryId('ko/tcp-recovery')).toEqual({ lang: 'ko', slug: 'tcp-recovery' });
    expect(parseEntryId('en/tcp-recovery')).toEqual({ lang: 'en', slug: 'tcp-recovery' });
  });

  it('언어 디렉터리가 없으면 기본 로케일로 본다', () => {
    // 라우트 생성도 이 판단을 그대로 쓴다. 여기서 ko로 보는 글은 목록에도 뜨고
    // 페이지도 생겨야 한다 — 예전에는 라우트만 'ko/' 접두사를 따로 따져 404가 났다.
    expect(parseEntryId('hello')).toEqual({ lang: 'ko', slug: 'hello' });
  });

  it('중첩 디렉터리는 slug에 남긴다', () => {
    expect(parseEntryId('ko/2023/tcp')).toEqual({ lang: 'ko', slug: '2023/tcp' });
  });
});

describe('sortByDateDesc', () => {
  it('최신 글이 앞에 온다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'a', pubDate: '2022-01-01' }),
      post({ slug: 'c', pubDate: '2024-01-01' }),
      post({ slug: 'b', pubDate: '2023-01-01' }),
    ]);
    expect(sorted.map((p) => p.slug)).toEqual(['c', 'b', 'a']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const input = [
      post({ slug: 'a', pubDate: '2022-01-01' }),
      post({ slug: 'b', pubDate: '2024-01-01' }),
    ];
    sortByDateDesc(input);
    expect(input.map((p) => p.slug)).toEqual(['a', 'b']);
  });
});

describe('groupByKey', () => {
  it('키별로 묶고 첫 등장 순서를 유지한다', () => {
    const result = groupByKey(['apple', 'avocado', 'banana', 'apricot'], (s) => s[0]);
    expect(result).toEqual([
      { key: 'a', items: ['apple', 'avocado', 'apricot'] },
      { key: 'b', items: ['banana'] },
    ]);
  });

  it('빈 목록은 빈 배열이 된다', () => {
    expect(groupByKey([], () => 'x')).toEqual([]);
  });
});


describe('relatedPosts', () => {
  it('태그가 많이 겹치는 순으로 낸다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP', '네트워크'] });
    const result = relatedPosts(target, [
      post({ slug: 'none', pubDate: '2023-01-01', tags: ['DB'] }),
      post({ slug: 'two', pubDate: '2023-01-01', tags: ['TCP', '네트워크'] }),
      post({ slug: 'one', pubDate: '2023-01-01', tags: ['TCP'] }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['two', 'one']);
  });

  it('자기 자신은 제외한다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP'] });
    expect(relatedPosts(target, [target])).toEqual([]);
  });

  it('같은 slug라도 언어가 다르면 자기 자신이 아니다', () => {
    const target = post({ slug: 'same', pubDate: '2024-01-01', tags: ['TCP'] });
    const translated = post({ slug: 'same', pubDate: '2023-01-01', tags: ['TCP'], lang: 'en' });
    expect(relatedPosts(target, [translated]).map((p) => p.lang)).toEqual(['en']);
  });

  it('겹치는 태그가 없으면 같은 카테고리의 최신 글로 채운다', () => {
    const target = post({
      slug: 'target',
      pubDate: '2024-01-01',
      tags: ['TCP'],
      category: 'infra',
    });
    const result = relatedPosts(target, [
      post({ slug: 'old-infra', pubDate: '2020-01-01', tags: [], category: 'infra' }),
      post({ slug: 'new-infra', pubDate: '2023-01-01', tags: [], category: 'infra' }),
      post({ slug: 'life', pubDate: '2023-06-01', tags: [], category: 'life' }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['new-infra', 'old-infra']);
  });

  it('태그로 채운 뒤 모자란 만큼만 같은 카테고리로 메운다', () => {
    const target = post({
      slug: 'target',
      pubDate: '2024-01-01',
      tags: ['TCP'],
      category: 'infra',
    });
    const result = relatedPosts(target, [
      post({ slug: 'tagged', pubDate: '2021-01-01', tags: ['TCP'], category: 'guide' }),
      post({ slug: 'same-cat', pubDate: '2023-01-01', tags: [], category: 'infra' }),
      post({ slug: 'other-cat', pubDate: '2023-06-01', tags: [], category: 'life' }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['tagged', 'same-cat']);
  });

  it('메우는 글에 이미 태그로 뽑힌 글을 중복해 넣지 않는다', () => {
    const target = post({
      slug: 'target',
      pubDate: '2024-01-01',
      tags: ['TCP'],
      category: 'infra',
    });
    const result = relatedPosts(target, [
      post({ slug: 'tagged-same-cat', pubDate: '2023-01-01', tags: ['TCP'], category: 'infra' }),
      post({ slug: 'plain', pubDate: '2022-01-01', tags: [], category: 'infra' }),
    ]);
    expect(result.map((p) => p.slug)).toEqual(['tagged-same-cat', 'plain']);
  });

  it('기본 2편까지만 낸다', () => {
    const target = post({ slug: 'target', pubDate: '2024-01-01', tags: ['TCP'] });
    const pool = ['a', 'b', 'c'].map((s) =>
      post({ slug: s, pubDate: '2023-01-01', tags: ['TCP'] }),
    );
    expect(relatedPosts(target, pool)).toHaveLength(2);
  });
});

describe('adjacentPosts', () => {
  it('최신순 목록에서 이전 글은 더 과거, 다음 글은 더 최신이다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'newest', pubDate: '2024-01-01' }),
      post({ slug: 'middle', pubDate: '2023-01-01' }),
      post({ slug: 'oldest', pubDate: '2022-01-01' }),
    ]);
    const { prev, next } = adjacentPosts(sorted[1], sorted);
    expect(prev?.slug).toBe('oldest');
    expect(next?.slug).toBe('newest');
  });

  it('양 끝에서는 한쪽이 null이다', () => {
    const sorted = sortByDateDesc([
      post({ slug: 'newest', pubDate: '2024-01-01' }),
      post({ slug: 'oldest', pubDate: '2022-01-01' }),
    ]);
    expect(adjacentPosts(sorted[0], sorted).next).toBeNull();
    expect(adjacentPosts(sorted[1], sorted).prev).toBeNull();
  });

  it('목록에 없는 글은 양쪽 모두 null이다', () => {
    const sorted = [post({ slug: 'a', pubDate: '2024-01-01' })];
    const stranger = post({ slug: 'zzz', pubDate: '2020-01-01' });
    expect(adjacentPosts(stranger, sorted)).toEqual({ prev: null, next: null });
  });
});

describe('collectTags', () => {
  it('태그를 빈도 내림차순으로 세고, 동률이면 사전순으로 낸다', () => {
    const result = collectTags([
      post({ slug: 'a', pubDate: '2024-01-01', tags: ['TCP', '네트워크'] }),
      post({ slug: 'b', pubDate: '2023-01-01', tags: ['TCP'] }),
      post({ slug: 'c', pubDate: '2022-01-01', tags: ['DB'] }),
    ]);
    expect(result).toEqual([
      { tag: 'TCP', count: 2 },
      { tag: 'DB', count: 1 },
      { tag: '네트워크', count: 1 },
    ]);
  });

  it('빈 목록은 빈 배열이 된다', () => {
    expect(collectTags([])).toEqual([]);
  });
});

describe('postsWithTag', () => {
  it('해당 태그를 가진 글만 최신순으로 낸다', () => {
    const result = postsWithTag(
      [
        post({ slug: 'old', pubDate: '2022-01-01', tags: ['TCP'] }),
        post({ slug: 'new', pubDate: '2024-01-01', tags: ['TCP'] }),
        post({ slug: 'other', pubDate: '2023-01-01', tags: ['DB'] }),
      ],
      'TCP',
    );
    expect(result.map((p) => p.slug)).toEqual(['new', 'old']);
  });

  it('태그가 없으면 빈 배열이 된다', () => {
    expect(postsWithTag([post({ slug: 'a', pubDate: '2024-01-01', tags: ['TCP'] })], 'DB')).toEqual(
      [],
    );
  });
});

describe('shouldShowOriginalLink', () => {
  const original = 'https://www.brainbackdoor.com/old-post';

  it('keeps original links on GitHub Pages and local previews', () => {
    expect(shouldShowOriginalLink(original, new URL('https://brainbackdoor.github.io'))).toBe(true);
    expect(shouldShowOriginalLink(original, new URL('http://localhost:4321'))).toBe(true);
  });

  it('hides original links after either original hostname becomes the site domain', () => {
    expect(shouldShowOriginalLink(original, new URL('https://www.brainbackdoor.com'))).toBe(false);
    expect(shouldShowOriginalLink(original, new URL('https://brainbackdoor.com'))).toBe(false);
    expect(shouldShowOriginalLink('https://brainbackdoor.com/old-post', new URL('https://www.brainbackdoor.com'))).toBe(false);
    expect(shouldShowOriginalLink('https://brainbackdoor.notion.site/project', new URL('https://brainbackdoor.com'))).toBe(true);
  });

  it('omits absent or invalid sources', () => {
    for (const source of [undefined, '', '/old-post', 'javascript:alert(1)']) {
      expect(shouldShowOriginalLink(source, undefined)).toBe(false);
    }
    expect(shouldShowOriginalLink(original, undefined)).toBe(true);
  });
});

describe('legacyRedirects', () => {
  const source = (over: Partial<LegacySourcePage> = {}): LegacySourcePage => ({
    sourceId: '12345678-1234-1234-1234-123456789abc',
    sourceUrl: 'https://www.brainbackdoor.com/12345678-1234-1234-1234-123456789abc',
    aliases: ['/old-post/'], targetPath: '/posts/original', collectionStatus: 'collected', ...over,
  });
  const available = new Set(['/posts/original', '/tech/infra', '/posts/another']);

  it('maps original UUID and friendly paths to the existing target without duplicate redirects', () => {
    expect(legacyRedirects([source({ aliases: ['/old-post/', '/old-post'] })], available)).toEqual([
      { path: '/12345678-1234-1234-1234-123456789abc', targetPath: '/posts/original' },
      { path: '/old-post', targetPath: '/posts/original' },
    ]);
  });

  it('does not shadow application routes or accept external aliases', () => {
    const redirects = legacyRedirects([source({ aliases: ['/posts', '/posts/sample', '/about/', '/tech/infra', '/rss.xml', '/en/posts', 'https://example.com/outside', '/infra'] })], available);
    expect(redirects.map(item => item.path)).toEqual(['/12345678-1234-1234-1234-123456789abc', '/infra']);
  });

  it('preserves collection-row anchors while checking that the parent page exists', () => {
    const redirects = legacyRedirects([source({ targetPath: '/posts/original#row-uuid' })], available);
    expect(redirects).toHaveLength(2);
    expect(redirects.every(item => item.targetPath === '/posts/original#row-uuid')).toBe(true);
    expect(legacyRedirects([source({ targetPath: '/posts/missing#row-uuid' })], available)).toEqual([]);
  });

  it('omits uncollected pages, drafts and targets with no generated page', () => {
    expect(legacyRedirects([
      source({ collectionStatus: 'not_found' }),
      source({ targetPath: '/posts/draft' }),
      source({ targetPath: null }),
    ], available)).toEqual([]);
  });

  it('maps collected project reference aliases only to the verified public Notion host', () => {
    const referenceUrl = 'https://brainbackdoor.notion.site/Project-12345678123412341234123456789abc';
    const project = source({ targetPath: null, contentRole: 'project-reference', referenceUrl });
    expect(legacyRedirects([project], available)).toEqual([
      { path: '/12345678-1234-1234-1234-123456789abc', targetPath: referenceUrl },
      { path: '/old-post', targetPath: referenceUrl },
    ]);
    expect(legacyRedirects([{ ...project, collectionStatus: 'not_found' }], available)).toEqual([]);
    expect(legacyRedirects([{ ...project, contentRole: 'post' }], available)).toEqual([]);
    for (const invalid of [undefined, 'http://brainbackdoor.notion.site/project', '//brainbackdoor.notion.site/project',
      'https://outside.example/project', 'https://brainbackdoor.notion.site.outside.example/project',
      'https://user@brainbackdoor.notion.site/project', 'https://brainbackdoor.notion.site:8443/project']) {
      expect(legacyRedirects([{ ...project, referenceUrl: invalid }], available)).toEqual([]);
    }
  });

  it('includes both Chaak aliases in the inventory redirect set used by sitemap exclusion', () => {
    const inventory = JSON.parse(readFileSync(new URL('../../docs/migration-inventory.json', import.meta.url), 'utf8'));
    const pages = inventory.pages as LegacySourcePage[];
    const targets = new Set(pages.flatMap(page => page.collectionStatus === 'collected' && page.targetPath
      ? [page.targetPath.split(/[?#]/, 1)[0]] : []));
    const redirects = legacyRedirects(pages, targets);
    const project = pages.find(page => page.sourceId === '1c790d37-083f-80e3-aeed-c41e19904cc8')!;
    for (const path of ['/1c790d37-083f-80e3-aeed-c41e19904cc8', '/1c790d37083f80e3aeedc41e19904cc8']) {
      expect(redirects.find(item => item.path === path)?.targetPath).toBe(project.referenceUrl);
      expect(targets.has(path)).toBe(false);
    }
  });

  it('fails on an ambiguous source alias instead of silently directing readers to a different post', () => {
    expect(() => legacyRedirects([source(), source({ sourceId: 'another-id', targetPath: '/posts/another' })], available)).toThrow('Conflicting legacy path');
  });
});

describe('static legacy redirect script', () => {
  const page = readFileSync(new URL('../pages/[...legacy].astro', import.meta.url), 'utf8');
  const script = page.match(/<script is:inline[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('Legacy redirect inline script is missing');

  function redirect(path: string, hash = '') {
    const destinations: string[] = [];
    runInNewContext(script!, {
      document: { currentScript: { getAttribute: () => path } },
      location: { origin: 'https://blog.example', hash, replace: (to: string) => destinations.push(to) },
      URL,
    });
    return destinations;
  }

  it('preserves an encoded incoming section bookmark', () => {
    expect(redirect('/posts/tcp-error-recovery', '#3-%ED%98%BC%EC%9E%A1%EC%A0%9C%EC%96%B4'))
      .toEqual(['https://blog.example/posts/tcp-error-recovery#3-%ED%98%BC%EC%9E%A1%EC%A0%9C%EC%96%B4']);
  });

  it('keeps a default collection-row anchor unless a child bookmark is supplied', () => {
    expect(redirect('/posts/diary#row-uuid')).toEqual(['https://blog.example/posts/diary#row-uuid']);
    expect(redirect('/posts/diary#row-uuid', '#child-uuid')).toEqual(['https://blog.example/posts/diary#child-uuid']);
  });

  it('never treats a fragment as another origin and rejects external targets', () => {
    expect(redirect('/posts/original', '#https://outside.example'))
      .toEqual(['https://blog.example/posts/original#https://outside.example']);
    for (const path of ['//outside.example', '/\\outside.example', 'https://outside.example',
      'http://brainbackdoor.notion.site/project', '//brainbackdoor.notion.site/project',
      'https://brainbackdoor.notion.site.outside.example/project',
      'https://user@brainbackdoor.notion.site/project', 'https://brainbackdoor.notion.site:8443/project']) {
      expect(redirect(path)).toEqual([]);
    }
  });

  it('preserves section bookmarks for the permitted public project reference', () => {
    const project = 'https://brainbackdoor.notion.site/Project-12345678123412341234123456789abc';
    expect(redirect(project)).toEqual([project]);
    expect(redirect(project, '#section')).toEqual([project + '#section']);
    expect(redirect(project + '#default', '#section')).toEqual([project + '#section']);
  });
});
