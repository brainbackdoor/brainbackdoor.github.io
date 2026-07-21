import type { APIRoute } from 'astro';
import { generateBrandOg } from '../../lib/og';

/** 기본 OG 이미지 /og/default.png — 홈·소개·이미지 없는 글의 폴백 (빌드 타임 생성). */
export const GET: APIRoute = async () => {
  const png = await generateBrandOg();
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
