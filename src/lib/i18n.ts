import { parseEntryId } from './posts';

export interface AltLocale {
  /** 지금 페이지의 언어. 반대 언어로 갈 href와 짝이다. */
  current: 'ko' | 'en';
  href: string;
}

/**
 * 전환 대상 언어에 이 글의 번역이 있으면 그 글의 URL을, 없으면 그 언어의
 * 아카이브 URL을 낸다. 번역이 없다고 없는 페이지로 링크해 404를 내지 않기 위해서다.
 *
 * 한국어는 prefix가 없고(prefixDefaultLocale: false) 영어는 /en/ 을 붙인다.
 */
export function translationHref(
  slug: string,
  targetLang: 'ko' | 'en',
  entries: { id: string }[],
): string {
  const prefix = targetLang === 'ko' ? '' : '/en';
  const hasTranslation = entries.some((e) => {
    const parsed = parseEntryId(e.id);
    return parsed.lang === targetLang && parsed.slug === slug;
  });
  return hasTranslation ? `${prefix}/posts/${slug}` : `${prefix}/posts`;
}
