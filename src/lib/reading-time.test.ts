import { describe, expect, it } from 'vitest';
import { readingTime } from './reading-time';

describe('readingTime', () => {
  it('짧은 글도 최소 1분으로 올린다', () => {
    expect(readingTime('안녕하세요.')).toBe(1);
  });

  it('한글 500자를 1분으로 센다', () => {
    expect(readingTime('가'.repeat(1000))).toBe(2);
  });

  it('영문은 분당 200단어로 센다', () => {
    const words = Array.from({ length: 600 }, () => 'word').join(' ');
    expect(readingTime(words)).toBe(3);
  });

  it('펜스 코드 블록은 분당 250자로 따로 센다', () => {
    const code = '```js\n' + 'x'.repeat(1000) + '\n```';
    expect(readingTime(code)).toBe(4);
  });

  it('마크다운 문법 기호는 글자 수에서 뺀다', () => {
    const plain = '가'.repeat(500);
    const marked = `## 제목\n\n**${plain}**\n\n[링크](https://example.com)`;
    // 제목 2자 + 본문 500자 + 링크 텍스트 2자 = 504자 → 1분이 아니라 2분(올림)
    expect(readingTime(marked)).toBe(2);
  });
});
