import { describe, expect, it } from 'vitest';
import type { PostSummary } from './posts';
import {
  adjacentPosts,
  collectTags,
  groupByKey,
  parseEntryId,
  postsWithTag,
  relatedPosts,
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
