import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LessonFigure from './LessonFigure';
import TcpRecoveryFigure from './TcpRecoveryFigure';
import { lessonInfo } from './lesson-models';
import { networkInfo } from './network-models';

const deployedIds = [...lessonInfo, ...networkInfo].map(item => item.id);
const svgMarkup = (html: string) => (html.match(/<svg[\s\S]*?<\/svg>/g) ?? []).join('\n').replace(/id="[^"]*"|aria-labelledby="[^"]*"/g, '');
const digest = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

describe('deployed figures keep their drawings while shared support grows', () => {
  it('renders the same static SVG for the 22 deployed figures', () => {
    const hashes = Object.fromEntries(deployedIds.map(figureId => [figureId, digest(svgMarkup(renderToString(createElement(LessonFigure, { figureId }))))]));
    expect(deployedIds).toHaveLength(22);
    expect(hashes).toMatchSnapshot();
  });

  it('draws the same SVG for the 22 deployed scenes at fixed widths', () => {
    const renderers = { ...lessonRenderers, ...networkRenderers } as Record<string, (w: number, t: number) => LessonFrame>;
    const hashes = Object.fromEntries([...lessonInfo, ...networkInfo].map(item => [item.id, digest([560, 227, 200].flatMap(width => [0, ...item.steps, item.final].map(t => svgMarkup(renderToString(createElement(LessonSvg, { frame: renderers[item.id](width, t), width, title: item.title }))))).join('\n'))]));
    expect(hashes).toMatchSnapshot();
  });

  it('renders the same static SVG for the TCP body and home figures', () => {
    const body = digest(svgMarkup(renderToString(createElement(TcpRecoveryFigure))));
    const home = digest(svgMarkup(renderToString(createElement(TcpRecoveryFigure, { variant: 'preview' }))));
    expect({ body, home }).toMatchSnapshot();
  });
});

import { readFileSync } from 'node:fs';
import { FIGURE_COLORS, cubicBezier, paintLesson, roundedRectPath, span, type LessonFrame } from './lessonCanvas';
import { LessonSvg } from './LessonFigure';
import AnimatedFigure from './AnimatedFigure';
import { progress } from './lesson-models';
import { lessonRenderers } from './lessonCanvas';
import { networkRenderers } from './networkCanvas';
import { advanceFigureTime } from './playback';

describe('display progress', () => {
  it('maps a span to 0 and 1 at its ends and clamps outside input', () => {
    expect(span(100, 100, 300)).toBe(0);
    expect(span(300, 100, 300)).toBe(1);
    expect(span(200, 100, 300)).toBe(0.5);
    expect(span(-50, 100, 300)).toBe(0);
    expect(span(900, 100, 300)).toBe(1);
  });
  it('rejects a span whose end is not after its start', () => {
    expect(() => span(0, 300, 300)).toThrow();
    expect(() => span(0, 300, 100)).toThrow();
    expect(() => progress(0, 300, 300)).toThrow();
  });
  it('keeps every deployed renderer valid across its whole loop', () => {
    const renderers = { ...lessonRenderers, ...networkRenderers } as Record<string, (w: number, t: number) => LessonFrame>;
    for (const item of [...lessonInfo, ...networkInfo]) for (const width of [560, 227, 200]) for (let t = 0; t <= item.duration; t += 50) {
      expect(() => renderers[item.id](width, t)).not.toThrow();
    }
  });
});

describe('cubic-bezier easing', () => {
  it('solves x first like CSS cubic-bezier', () => {
    const cssEase = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(cssEase(0)).toBe(0);
    expect(cssEase(1)).toBe(1);
    expect(cssEase(0.5)).toBeCloseTo(0.8024, 3);
  });
  it('stays monotonic within 0..1 for the approved curves', () => {
    for (const curve of [cubicBezier(0.2, 0.7, 0.3, 1), cubicBezier(0.45, 0, 0.25, 1)]) {
      let previous = 0;
      for (let i = 0; i <= 100; i++) { const y = curve(i / 100); expect(y).toBeGreaterThanOrEqual(previous - 1e-9); expect(y).toBeLessThanOrEqual(1); previous = y; }
    }
  });
  it('rejects x control points outside 0..1', () => {
    expect(() => cubicBezier(-0.1, 0, 0.5, 1)).toThrow();
    expect(() => cubicBezier(0.2, 0, 1.2, 1)).toThrow();
  });
});

describe('rounded rectangle path', () => {
  it('closes inside its box and limits the radius to half the short side', () => {
    const d = roundedRectPath(10, 20, 40, 12, 20);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const numbers = [...d.matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0]));
    expect(Math.min(...numbers.filter((_, i) => i % 2 === 0))).toBeGreaterThanOrEqual(0);
    expect(d).toContain('A6 6');
  });
});

describe('palette and CSS tokens', () => {
  const css = readFileSync(new URL('../../styles/global.css', import.meta.url), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--color-figure-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()), m[2].toLowerCase()]));
  it('defines one value for each figure color used by Canvas, SVG and CSS', () => {
    for (const [name, value] of Object.entries(FIGURE_COLORS)) expect([name, tokens[name]]).toEqual([name, value]);
  });
  const luminance = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Semantic text colors sit on white, the plot background or their own tint; the gray layer slab carries text and muted labels only.
  it('keeps small figure text at 4.5:1 on its backgrounds', () => {
    const { text, muted, blueText, greenText, orangeText, redText, bg, plot, slab, blueTint, greenTint, orangeTint, redTint } = FIGURE_COLORS;
    const pairs: [string, string][] = [[text, slab], [muted, slab]];
    for (const fg of [text, muted, blueText, greenText, orangeText, redText]) for (const back of [bg, plot]) pairs.push([fg, back]);
    pairs.push([blueText, blueTint], [greenText, greenTint], [orangeText, orangeTint], [redText, redTint], [text, blueTint], [text, orangeTint]);
    for (const [fg, back] of pairs) expect([fg, back, contrast(fg, back) >= 4.5]).toEqual([fg, back, true]);
  });
});

function recordingContext() {
  const calls: unknown[][] = [];
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const saved: Record<string, unknown>[] = [];
  const ctx = new Proxy(state, {
    get: (target, key: string) => key in target ? target[key] : (...args: unknown[]) => {
      calls.push([key, ...args.map(a => a instanceof FakePath ? `path:${a.d}` : a)]);
      if (key === 'save') saved.push({ ...target });
      if (key === 'restore') Object.assign(target, saved.pop());
    },
    set: (target, key: string, value) => { target[key] = value; calls.push([`set:${key}`, value]); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state };
}
class FakePath { constructor(public d: string) {} }

describe('shared path, text and circle commands', () => {
  const frame: LessonFrame = { height: 80, status: 'done', ops: [
    { type: 'path', d: 'M10 10H50V30H10Z', fill: '#e7f5ff', stroke: '#228be6', width: 1.5, dash: [4, 3], alpha: 0.5 },
    { type: 'text', x: 12, y: 60, text: 'sharedCounter', color: '#586b80', size: 12, align: 'center', bold: false, mono: true, alpha: 0.75, weight: 700 },
    { type: 'circle', x: 70, y: 20, r: 4, color: '#fd7e14', stroke: '#9c4b00', strokeWidth: 1.2, alpha: 0.6 },
    { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#ced4da', dash: false },
  ] };

  it('paints a path from the same d string with its fill, dashed stroke and opacity', () => {
    (globalThis as unknown as { Path2D: typeof FakePath }).Path2D = FakePath;
    const { ctx, calls, state } = recordingContext();
    paintLesson(ctx, frame, 100, 2, 'Sans', 'Mono');
    expect(calls).toContainEqual(['fill', 'path:M10 10H50V30H10Z']);
    expect(calls).toContainEqual(['stroke', 'path:M10 10H50V30H10Z']);
    expect(calls).toContainEqual(['setLineDash', [4, 3]]);
    expect(calls).toContainEqual(['set:globalAlpha', 0.5]);
    expect(calls).toContainEqual(['set:font', '700 12px Mono']);
    expect(calls).toContainEqual(['fillText', 'sharedCounter', 12, 60]);
    expect(state.globalAlpha).toBe(1);
  });

  it('writes the same geometry, emphasis and font role into the accessible SVG', () => {
    const html = renderToString(createElement(LessonSvg, { frame, width: 100, title: '공유 저장소' }));
    expect(html).toContain('d="M10 10H50V30H10Z"');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('opacity="0.5"');
    expect(html).toMatch(/<text[^>]*font-family:var\(--font-mono\)[^>]*>sharedCounter<\/text>/);
    expect(html).toContain('font-weight="700"');
    expect(html).toMatch(/<circle[^>]*stroke="#9c4b00"/);
    expect(html).toContain('<desc');
  });
});

describe('time independent of frame rate', () => {
  it('reaches the same elapsed time at 60Hz and 120Hz', () => {
    let at60 = 0, at120 = 0;
    for (let i = 0; i < 60; i++) at60 = advanceFigureTime(at60, 1000 / 60, 8000);
    for (let i = 0; i < 120; i++) at120 = advanceFigureTime(at120, 1000 / 120, 8000);
    expect(at60).toBeCloseTo(1000, 6);
    expect(at120).toBeCloseTo(at60, 6);
  });
});

describe('figure frame', () => {
  it('keeps the figure name for assistive technology without a visible heading', () => {
    const html = renderToString(createElement(AnimatedFigure, { containerRef: { current: null }, title: '공유 counter', caption: '설명', running: false, children: null }));
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`<[a-z]+ id="${labelledBy}" class="sr-only">공유 counter<`));
    expect(html).not.toContain('animated-figure__header');
  });
});

describe('review fixes', () => {
  it('keeps the TCP figure and the shared palette free of lesson renderers', () => {
    const valueImports = (file: string) => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)].map(m => m[1]);
    expect(valueImports('./tcpCanvas.ts')).not.toContain('./lessonCanvas');
    expect(valueImports('./TcpRecoveryFigure.tsx')).not.toContain('./lessonCanvas');
    expect(valueImports('./figurePalette.ts')).toEqual([]);
  });

  it('treats none as no paint for circles in Canvas and SVG', () => {
    const frame: LessonFrame = { height: 20, status: '', ops: [{ type: 'circle', x: 5, y: 5, r: 3, color: 'none', stroke: 'none', alpha: 0.5 }] };
    const { ctx, calls } = recordingContext();
    paintLesson(ctx, frame, 20, 1, 'Sans');
    expect(calls.filter(c => c[0] === 'fill' || c[0] === 'stroke')).toEqual([]);
    const html = renderToString(createElement(LessonSvg, { frame, width: 20, title: '빈 원' }));
    expect(html).toMatch(/<circle[^>]*fill="none"/);
    expect(html).not.toContain('stroke-width');
  });
});
