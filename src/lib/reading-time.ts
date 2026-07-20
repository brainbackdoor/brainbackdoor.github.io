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

/**
 * 펜스 코드 블록. 산문에서 지우는 데도, 코드 글자를 세는 데도 이 하나만 쓴다.
 *
 * 정규식을 둘로 나눠 두면 "펜스가 어디서 끝나는가"에 대한 판단이 서로 어긋날 수
 * 있고, 어긋나는 순간 그 블록은 산문에서 지워지기만 하고 코드로도 세어지지 않아
 * 추정치에서 통째로 사라진다. 하나만 두면 지운 범위와 센 범위가 정의상 같아진다.
 *
 * 언어 태그 자리에서 백틱을 빼는 것(`[^\n`]*`)이 핵심이다. 백틱을 허용하면
 * 태그가 그 블록의 닫는 펜스를 삼키고 다음 줄까지 넘어간다.
 * 캡처 그룹은 펜스와 언어 태그를 뺀 실제 코드 내용이다.
 */
const FENCED_CODE = /```(?:[^\n`]*\n)?([\s\S]*?)```/g;
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
  const codeChars = Array.from(markdown.matchAll(FENCED_CODE))
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
