/**
 * 날짜 표기의 단일 출처.
 *
 * 프런트매터의 `2024-01-01`은 UTC 자정 Date가 된다. 로컬 게터로 읽으면 빌드하는
 * 기계의 타임존에 따라 하루가 밀리고, 1월 1일 글은 연도까지 밀려 아카이브의
 * 연도 묶음이 달라진다. UTC를 기준으로 고정해 어디서 빌드하든 같은 값이 나오게 한다.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function getYear(d: Date): string {
  return String(d.getUTCFullYear());
}

export function formatShortDate(d: Date): string {
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

export function formatDate(d: Date): string {
  return `${getYear(d)}.${formatShortDate(d)}`;
}

export type DateSource = 'published' | 'created';

/** Creation-time fallbacks remain visibly distinct from authored publication dates. */
export function postDate(d: Date, source?: DateSource, lang = 'ko', short = false) {
  const formatted = short ? formatShortDate(d) : formatDate(d);
  const created = source === 'created';
  const title = created
    ? (lang === 'en' ? 'Original creation date (publication date unavailable)' : '원문 생성일 (발행일 미기재)')
    : undefined;
  return {
    dateTime: d.toISOString(),
    text: created ? `${lang === 'en' ? 'Created' : '생성일'} ${formatted}` : formatted,
    title,
    ariaLabel: title ? `${title}: ${formatDate(d)}` : undefined,
  };
}
