import { describe, expect, it } from 'vitest';
import { translationHref } from './i18n';

const entries = [
  { id: 'ko/tcp-error-recovery' },
  { id: 'en/tcp-error-recovery' },
  { id: 'ko/load-balancer' },
];

describe('translationHref', () => {
  it('번역이 있으면 그 글의 URL을 낸다', () => {
    expect(translationHref('tcp-error-recovery', 'en', entries)).toBe('/en/posts/tcp-error-recovery');
    expect(translationHref('tcp-error-recovery', 'ko', entries)).toBe('/posts/tcp-error-recovery');
  });

  it('번역이 없으면 그 언어의 아카이브로 보낸다', () => {
    // load-balancer는 en 번역이 없다. 404 대신 영어 아카이브로.
    expect(translationHref('load-balancer', 'en', entries)).toBe('/en/posts');
  });

  it('한국어 아카이브 fallback은 prefix가 없다', () => {
    expect(translationHref('nonexistent', 'ko', entries)).toBe('/posts');
  });
});
