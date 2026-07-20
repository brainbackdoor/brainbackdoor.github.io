/**
 * 한국어 기술 글 기준 읽기 시간.
 *
 * 영어권의 "분당 200단어" 공식은 한국어에 쓸 수 없다. 한국어는 공백으로
 * 나뉘는 단위가 영어 단어와 대응하지 않아서, 글자 수로 세는 편이 맞는다.
 * 코드 블록은 훑어 읽는 속도가 산문과 달라 따로 계산한다.
 */
const KO_CHARS_PER_MIN = 500;
const EN_WORDS_PER_MIN = 200;
const CODE_CHARS_PER_MIN = 250;

const FENCED_CODE = /```[\s\S]*?```/g;
// 코드 글자 수는 펜스(```)와 언어 태그(예: js)를 뺀 실제 코드 내용만 센다.
// 이 둘은 읽는 대상이 아니라 마크다운 문법이라 산문에서 기호를 걷어내는 것과 같은 이유다.
const FENCED_CODE_CONTENT = /```[^\n]*\n([\s\S]*?)```/g;
const KOREAN = /[가-힣]/g;
const LATIN_WORD = /[A-Za-z][A-Za-z'-]*/g;

/** 읽는 대상이 아닌 마크다운 문법 기호를 걷어낸다. */
function stripMarkdown(src: string): string {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // 링크 → 텍스트만
    .replace(/`[^`]*`/g, '')                    // 인라인 코드
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')         // 제목 기호
    .replace(/^\s{0,3}>\s?/gm, '')              // 인용
    .replace(/[*_~]/g, '');                     // 강조
}

export function readingTime(markdown: string): number {
  const codeChars = Array.from(markdown.matchAll(FENCED_CODE_CONTENT))
    .map((m) => m[1].replace(/\s/g, '').length)
    .reduce((a, b) => a + b, 0);

  const prose = stripMarkdown(markdown.replace(FENCED_CODE, ''));
  const koreanChars = (prose.match(KOREAN) ?? []).length;
  const latinWords = (prose.match(LATIN_WORD) ?? []).length;

  const minutes =
    koreanChars / KO_CHARS_PER_MIN +
    latinWords / EN_WORDS_PER_MIN +
    codeChars / CODE_CHARS_PER_MIN;

  return Math.max(1, Math.ceil(minutes));
}
