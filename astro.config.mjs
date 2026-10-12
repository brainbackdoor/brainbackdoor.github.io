// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import { readFileSync } from 'node:fs';
import { legacyRedirects } from './src/lib/posts.ts';

// Loading errors must stop the build instead of publishing aliases in the sitemap.
/** @type {import('./src/lib/posts').LegacySourcePage[]} */
const migrationPages = JSON.parse(readFileSync(new URL('./docs/migration-inventory.json', import.meta.url), 'utf8')).pages;
const canonicalPaths = new Set(migrationPages.flatMap(page =>
  page.collectionStatus === 'collected' && page.targetPath ? [page.targetPath.split(/[?#]/, 1)[0]] : []));
const legacyPaths = new Set(legacyRedirects(migrationPages, canonicalPaths)
  .map(({ path }) => path)
  .filter(path => !canonicalPaths.has(path)));

// 사용자 사이트(brainbackdoor.github.io)라 base path가 없다.
// 프로젝트 사이트로 옮기게 되면 base: '/blog' 를 추가해야 한다.
export default defineConfig({
  site: 'https://brainbackdoor.github.io',
  integrations: [
    react(),
    // 원문 이전 시 따옴표·대시 등 문장 부호를 자동 치환하지 않는다.
    mdx({ smartypants: false }),
    sitemap({
      filter: page => !legacyPaths.has(decodeURIComponent(new URL(page).pathname).replace(/\/+$/, '') || '/'),
    }),
    pagefind(),
    {
      name: 'separate-vite-caches',
      hooks: {
        'astro:config:setup': ({ command, updateConfig }) => {
          // 빌드의 production React 캐시가 실행 중인 dev 서버를 덮어쓰지 않게 한다.
          updateConfig({ vite: { cacheDir: `node_modules/.vite/${command}` } });
        },
      },
    },
  ],
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
      theme: 'github-light',
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
