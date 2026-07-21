/**
 * 기본 OG 이미지(화이트 브랜드) 생성 — satori → resvg, 빌드 타임.
 * 홈·소개·이미지 없는 글의 폴백으로 쓰는 /og/default.png 한 장.
 * 글에 frontmatter image가 있으면 그 이미지를 og:image로 쓰므로 여기서 안 만든다.
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

const FONT_DIR = path.join(process.cwd(), 'src/assets/og-fonts');
const read = (f: string) => fs.readFileSync(path.join(FONT_DIR, f));

const fonts = [
  { name: 'Manrope', data: read('manrope-800.woff'), weight: 800, style: 'normal' },
  { name: 'Manrope', data: read('manrope-500.woff'), weight: 500, style: 'normal' },
  { name: 'PlexKR', data: read('plexkr-700.woff'), weight: 700, style: 'normal' },
  { name: 'PlexKR', data: read('plexkr-400.woff'), weight: 400, style: 'normal' },
] as const;

const TERRA = '#9a4b34';
const INK = '#211d1b';
const CANVAS = '#ffffff';
const ROBOT =
  'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5';

const rasterize = (svg: string, width: number) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

// 로봇 마크(테라코타 라운드 배경 + 흰 로봇)를 data URI로
function markDataUri(size: number): string {
  const inner = size * 0.72;
  const off = (size - inner) / 2;
  const sc = inner / 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${TERRA}"/><g transform="translate(${off} ${off}) scale(${sc})" fill="#ffffff"><path d="${ROBOT}"/></g></svg>`;
  return `data:image/png;base64,${Buffer.from(rasterize(svg, size)).toString('base64')}`;
}

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }) },
});

export async function generateBrandOg(): Promise<Buffer> {
  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 30,
      backgroundColor: CANVAS,
      fontFamily: 'Manrope, PlexKR',
    },
    [
      { type: 'img', props: { src: markDataUri(76), width: 76, height: 76, style: { borderRadius: 17 } } },
      el('div', { fontSize: 76, fontWeight: 800, color: INK, letterSpacing: '-0.03em' }, 'brainbackdoor'),
      el('div', { width: 56, height: 6, backgroundColor: TERRA, borderRadius: 4 }),
    ],
  );
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts: fonts as never });
  return rasterize(svg, 1200);
}
