import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOg, type OgInput } from '../../lib/og';
import { loadPosts } from '../../lib/collection';

/**
 * 페이지별 OG 이미지: /og/<slug>.png (빌드 타임 생성).
 * 고정 페이지(home·about) + 글(slug). ko/en 글은 slug가 같으므로 하나로 합친다.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const fixed: Array<{ slug: string } & OgInput> = [
    { slug: 'home', title: '이동규', subtitle: '소프트웨어 엔지니어 — 만들고, 가르칩니다' },
    { slug: 'about', title: '이동규', subtitle: '소프트웨어 엔지니어 · brainbackdoor' },
  ];

  const bySlug = new Map<string, { slug: string } & OgInput>(fixed.map((f) => [f.slug, f]));
  for (const p of [...(await loadPosts('ko')), ...(await loadPosts('en'))]) {
    if (!bySlug.has(p.slug)) {
      bySlug.set(p.slug, { slug: p.slug, title: p.title, subtitle: p.description });
    }
  }

  return [...bySlug.values()].map(({ slug, ...props }) => ({ params: { slug }, props }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await generateOg(props as OgInput);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
