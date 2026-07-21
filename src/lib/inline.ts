/**
 * 아주 작은 인라인 마크업 → 안전한 HTML.
 * 지원: **볼드**, [텍스트](url). 그 외 문자는 이스케이프한다.
 * 본인 작성 콘텐츠(about 데이터)에만 쓴다 — set:html 대상.
 */
const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

export function renderInline(md: string): string {
  let s = escapeHtml(md);
  // [텍스트](url) — 볼드 마커(**)는 텍스트 안에 남겨두고 이후 단계에서 처리
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    const external = /^https?:\/\//.test(url);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${url}"${attrs} class="text-accent underline underline-offset-2 hover:text-accent-hover">${text}</a>`;
  });
  // **볼드**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
  return s;
}
