import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryLabel } from './categories';

describe('categories', () => {
  it('디자인에 정의된 4개 카테고리를 순서대로 가진다', () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
      'retrospect',
      'infra',
      'guide',
      'life',
    ]);
  });

  it('slug를 한글 라벨로 옮긴다', () => {
    expect(categoryLabel('retrospect')).toBe('회고·문화');
    expect(categoryLabel('infra')).toBe('인프라');
    expect(categoryLabel('guide')).toBe('실습 가이드');
    expect(categoryLabel('life')).toBe('라이프');
  });

});
