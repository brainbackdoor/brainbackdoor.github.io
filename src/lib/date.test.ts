import { describe, expect, it } from 'vitest';
import { formatDate, formatShortDate, getYear } from './date';

describe('date', () => {
  it('연.월.일을 두 자리로 채워 낸다', () => {
    expect(formatDate(new Date('2023-11-09'))).toBe('2023.11.09');
    expect(formatDate(new Date('2024-01-05'))).toBe('2024.01.05');
  });

  it('짧은 형식은 월.일만 낸다', () => {
    expect(formatShortDate(new Date('2023-04-03'))).toBe('04.03');
  });

  it('연도를 문자열로 낸다', () => {
    expect(getYear(new Date('2024-12-29'))).toBe('2024');
  });

  /*
   * 프런트매터의 2024-01-01은 UTC 자정 Date가 된다. 기준 타임존을 고정하지 않고
   * 로컬 게터를 쓰면 UTC보다 뒤진 곳에서 빌드할 때 하루가 밀리고, 1월 1일 글은
   * 연도까지 밀려 아카이브의 연도 묶음이 달라진다.
   */
  it('UTC 자정 경계에서 로컬 타임존에 흔들리지 않는다', () => {
    const newYear = new Date('2024-01-01T00:00:00Z');
    expect(getYear(newYear)).toBe('2024');
    expect(formatDate(newYear)).toBe('2024.01.01');
  });
});
