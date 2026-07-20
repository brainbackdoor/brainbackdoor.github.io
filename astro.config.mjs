// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// 사용자 사이트(brainbackdoor.github.io)라 base path가 없다.
// 프로젝트 사이트로 옮기게 되면 base: '/blog' 를 추가해야 한다.
export default defineConfig({
  site: 'https://brainbackdoor.github.io',
  integrations: [react(), mdx(), sitemap()],
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      // 한국어는 prefix 없이 / 로, 영어는 /en/ 으로
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: false,
      transformers: [
        {
          // Shiki가 pre에 박는 인라인 배경색을 걷어낸다.
          // 인라인 스타일은 CSS로 덮을 수 없어 !important가 필요해지는데,
          // 그러면 이후 어떤 규칙도 코드블록 배경을 조정할 수 없게 된다.
          pre(node) {
            const style = String(node.properties.style ?? '');
            node.properties.style = style.replace(/background-color:[^;]*;?/g, '');
          },
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
