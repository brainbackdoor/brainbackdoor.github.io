import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CategoryFilter, { filterPosts, type FilterablePost } from './CategoryFilter';

const posts: FilterablePost[] = [
  { title: 'TCP 에러 복구', description: '재전송을 관찰합니다.', tags: ['네트워크', 'RTO'], category: 'infra', href: '/posts/tcp-error-recovery', year: '2024', date: '01.02', dateTime: '2024-01-02', minutes: 3 },
  { title: '일 년의 기록', description: '동료와 함께 만든 서비스 회고.', tags: ['문화'], category: 'retrospect', href: '/posts/retrospect', year: '2023', date: '12.31', dateTime: '2023-12-31', minutes: 2 },
];

describe('archive search', () => {
  it('제목, 설명, 태그를 대소문자 구분 없이 함께 검색한다', () => {
    expect(filterPosts(posts, 'all', '  tcp   rto 재전송 ')).toEqual([posts[0]]);
    expect(filterPosts(posts, 'all', '동료 문화')).toEqual([posts[1]]);
  });
  it('검색과 카테고리를 교집합으로 적용한다', () => {
    expect(filterPosts(posts, 'infra', '문화')).toEqual([]);
    expect(filterPosts(posts, 'retrospect', '')).toEqual([posts[1]]);
  });
  it('한글 정규화 형태가 달라도 태그를 찾는다', () => {
    expect(filterPosts(posts, 'all', '네트워크'.normalize('NFD'))).toEqual([posts[0]]);
  });
  it('공백 검색은 입력 순서를 보존하며 빈 카테고리는 빈 결과를 반환한다', () => {
    expect(filterPosts(posts, 'all', '  ')).toEqual(posts);
    expect(filterPosts(posts, 'life', '')).toEqual([]);
    expect(filterPosts([], 'all', '')).toEqual([]);
  });
  it('JavaScript 실행 전에도 모든 원문 링크와 설명이 HTML에 있다', () => {
    const html = renderToStaticMarkup(createElement(CategoryFilter, { posts }));
    for (const post of posts) {
      expect(html).toContain(`href="${post.href}"`);
      expect(html).toContain(post.description);
    }
    expect(html).toContain('2개의 글');
  });
});
