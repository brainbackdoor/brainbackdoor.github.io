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
  vite: {
    plugins: [tailwindcss()],
  },
});
