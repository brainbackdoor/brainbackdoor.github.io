import { describe, expect, it } from 'vitest';
import { readingTime } from './reading-time';

describe('readingTime', () => {
  it('빈 글에서도 최소 1분을 보장한다', () => {
    // 글자 수가 0이면 minutes도 0이라 Math.max(1, ...) 바닥 없이는 0분이 나온다.
    // 5글자짜리 입력은 올림 때문에 이미 1이 나와 바닥 로직 유무를 구분하지 못한다.
    expect(readingTime('')).toBe(1);
  });

  it('아주 짧은 한글 글도 1분으로 올린다', () => {
    expect(readingTime('안녕하세요.')).toBe(1);
  });

  it('한글 1000자를 2분으로 센다', () => {
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

  it('한 줄짜리 펜스 코드도 코드 글자 수로 센다', () => {
    // 여는 펜스 뒤 개행이 없는 형태. 언어 태그 부분을 선택적으로 두지 않으면
    // 이 형태를 놓친다.
    const code = '```' + 'x'.repeat(1000) + '```';
    expect(readingTime(code)).toBe(4);
  });

  it('한 줄짜리 펜스가 여러 개여도 코드 글자가 사라지지 않는다', () => {
    // 산문에서 지우는 정규식과 코드를 세는 정규식이 따로 있던 시절, 언어 태그
    // 자리가 앞 블록의 닫는 펜스를 삼켜 두 범위가 어긋났다. 그러면 그 내용은
    // 산문에서 지워지기만 하고 코드로도 세어지지 않아 통째로 사라진다.
    const code = '```' + 'x'.repeat(500) + '``` \n ```' + 'y'.repeat(500) + '```';
    expect(readingTime(code)).toBe(4); // 1000자 / 250 = 4분
  });

  /*
   * 아래 두 케이스는 "걷어내지 않으면 결과가 달라지는" 입력이어야 한다.
   * 제목(#)이나 강조(*) 기호만 섞은 입력으로는 스트립이 통째로 사라져도
   * 결과가 같아서(기호는 한글도 라틴 단어도 아니라 애초에 세지 않는다)
   * 아무것도 검증하지 못한다.
   */
  it('이미지 alt와 인라인 코드는 읽는 대상이 아니라 글자 수에서 뺀다', () => {
    const body = '가'.repeat(500); // 500 / 500 = 정확히 1분
    const alt = '나'.repeat(600);
    const marked = `${body}\n\n![${alt}](/images/a.png)\n\n\`${'code '.repeat(200)}\``;
    // 걷어내지 않으면 alt 600자 + 인라인 코드 200단어가 더해져 4분이 된다.
    expect(readingTime(marked)).toBe(1);
  });

  it('링크는 표시 텍스트만 세고 URL은 뺀다', () => {
    const body = '가'.repeat(495);
    const marked = `${body}\n\n[읽기](/posts/${'나'.repeat(600)})`;
    // 본문 495자 + 링크 텍스트 2자 = 497자 → 1분.
    // URL까지 세면 1097자가 되어 3분으로 부푼다.
    expect(readingTime(marked)).toBe(1);
  });
});
