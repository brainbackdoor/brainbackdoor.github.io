/**
 * 동적 OG 이미지 생성 (satori → resvg). 빌드 타임에 페이지별 1200×630 PNG를 만든다.
 * 폰트는 src/assets/og-fonts 의 woff(=woff2 아님)를 쓴다. 한글은 IBM Plex Sans KR.
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

// 로고 마크(테라코타+흰 로봇)를 data URI로 — favicon.svg 재사용
const markPng = new Resvg(fs.readFileSync(path.join(process.cwd(), 'public/favicon.svg'), 'utf8'), {
  fitTo: { mode: 'width', value: 96 },
})
  .render()
  .asPng();
const MARK = `data:image/png;base64,${Buffer.from(markPng).toString('base64')}`;

const TERRA = '#9a4b34';
const INK = '#2b2b2b';
const MUTED = '#6b6b6b';
const FAINT = '#a0a0a0';
const CANVAS = '#ffffff';

export interface OgInput {
  title: string;
  subtitle?: string;
  kicker?: string;
}

// satori용 엘리먼트 트리(JSX 없이 객체로)
function node(type: string, style: Record<string, unknown>, children?: unknown) {
  return { type, props: { style, ...(children === undefined ? {} : { children }) } };
}

function tree({ title, subtitle, kicker = '씨유 · brainbackdoor' }: OgInput) {
  const middleChildren: unknown[] = [
    node('div', { fontSize: 72, fontWeight: 800, color: INK, lineHeight: 1.05, letterSpacing: '-0.03em' }, title),
  ];
  if (subtitle) {
    middleChildren.push(
      node('div', { marginTop: 22, fontSize: 30, fontWeight: 500, color: MUTED, lineHeight: 1.3 }, subtitle),
    );
  }
  middleChildren.push(node('div', { marginTop: 30, width: 64, height: 7, backgroundColor: TERRA, borderRadius: 4 }));

  return node(
    'div',
    {
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '68px 76px',
      backgroundColor: CANVAS,
      fontFamily: 'Manrope, PlexKR',
    },
    [
      node('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
        { type: 'img', props: { src: MARK, width: 44, height: 44, style: { borderRadius: 10 } } },
        node('div', { fontSize: 24, fontWeight: 700, color: INK }, kicker),
      ]),
      node('div', { display: 'flex', flexDirection: 'column' }, middleChildren),
      node('div', { fontSize: 22, color: FAINT }, 'brainbackdoor.github.io'),
    ],
  );
}

export async function generateOg(input: OgInput): Promise<Buffer> {
  // satori 타입은 ReactNode를 기대 — 객체 트리를 그대로 넘긴다.
  const svg = await satori(tree(input) as never, { width: 1200, height: 630, fonts: fonts as never });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
