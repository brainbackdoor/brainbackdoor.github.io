import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LessonFigure from './LessonFigure';
import TcpRecoveryFigure from './TcpRecoveryFigure';
import { cacheState, lessonInfo, lockState, queueState, sparkState } from './lesson-models';
import { networkInfo, networkState } from './network-models';
import { systemInfo } from './system-models';
import { systemRenderers } from './systemCanvas';
import { dataInfo } from './data-models';
import { dataRenderers } from './dataCanvas';
import { infraInfo } from './infra-models';
import { infraRenderers } from './infraCanvas';
import { processInfo } from './process-models';
import { processRenderers } from './processCanvas';

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

  it('keeps leading and repeated spaces in SVG text as Canvas does', () => {
    const spaced = { height: 40, status: '', ops: [{ type: 'text', x: 0, y: 12, text: '   1> [로그]  2>&1', color: '#343a40', size: 12, align: 'left', bold: false, mono: true }, { type: 'text', x: 0, y: 30, text: 'plain', color: '#343a40', size: 12, align: 'left', bold: false }] } as LessonFrame;
    const html = renderToString(createElement(LessonSvg, { frame: spaced, width: 100, title: '공백' }));
    expect(html).toMatch(/<text[^>]*xml:space="preserve"[^>]*> {3}1&gt; \[로그\] {2}2&gt;&amp;1<\/text>/);
    expect(html).not.toMatch(/<text[^>]*xml:space[^>]*>plain<\/text>/);
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
    // 이름으로 한 번만 읽히도록 제목 자체는 낭독에서 뺀다
    expect(html).toMatch(new RegExp(`<[a-z]+ id="${labelledBy}" class="sr-only" aria-hidden="true">공유 counter<`));
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

describe('deployed figures v2 (R04)', () => {
  type Text = Extract<LessonFrame['ops'][number], { type: 'text' }>;
  const renderers = { ...lessonRenderers, ...networkRenderers } as Record<string, (w: number, t: number) => LessonFrame>;
  const texts = (f: LessonFrame) => f.ops.filter((o): o is Text => o.type === 'text');
  const has = (f: LessonFrame, s: string) => texts(f).some(o => o.text === s);
  const items = [...lessonInfo, ...networkInfo];
  const loop = (id: string, step = 100) => { const d = items.find(i => i.id === id)!.duration; return Array.from({ length: Math.floor(d / step) + 1 }, (_, i) => i * step); };
  // 실측 지면 폭: 데스크톱 본문 650·목록 625, 390px 본문 346·목록 321, 320px 본문 284·목록 259
  const ARTICLE_WIDTHS = [650, 625, 346, 321, 284, 259];

  it('draws every shape as a path so Canvas and SVG share the same corners', () => {
    for (const item of items) for (const w of ARTICLE_WIDTHS) for (const t of [0, ...item.steps, item.final]) {
      expect(renderers[item.id](w, t).ops.filter(o => o.type === 'rect' || o.type === 'line').length, `${item.id} ${w} ${t}`).toBe(0);
    }
  });

  it('changes the endpoint states of N04 and N10 at the model times', () => {
    for (const t of loop('N04', 50)) { const s = networkState('N04', t), f = renderers.N04(650, t); expect(has(f, s.client) && has(f, s.server), `${t}`).toBe(true); }
    for (const t of loop('N10', 50)) { const s = networkState('N10', t), f = renderers.N10(650, t); expect(has(f, s.active) && has(f, s.passive), `${t}`).toBe(true); }
  });

  it('attaches a held lock to its owner thread in T01', () => {
    for (const t of loop('T01', 50)) { const s = lockState(t), f = renderers.T01(650, t); expect([has(f, 'L1'), has(f, 'L2')], `${t}`).toEqual([!!s.owners.L1, !!s.owners.L2]); }
  });

  it('labels the current cwnd of N05 from the model', () => {
    for (const t of loop('N05', 50)) expect(has(renderers.N05(650, t), `cwnd ${networkState('N05', t).cwnd}`), `${t}`).toBe(networkState('N05', t).points.length > 0);
  });

  it('shows the stored response in the proxy only after the whole body arrives (W03)', () => {
    for (const t of loop('W03', 50)) expect(has(renderers.W03(650, t), '200 · public'), `${t}`).toBe(cacheState(t).stored);
  });

  it('shows doubled partition elements in S03 only after map', () => {
    for (const t of loop('S03', 50)) { const s = sparkState(t), f = renderers.S03(650, t); expect(has(f, '12'), `${t}`).toBe(!!s.mapped); }
  });

  it('marks reuse at 304 and replacement after the v2 body in W04', () => {
    for (const t of loop('W04', 50)) { const s = networkState('W04', t), f = renderers.W04(650, t); expect([has(f, 'v1 재사용'), has(f, 'v2 교체')], `${t}`).toEqual([s.unchanged.code === 304, s.changed.bodyComplete]); }
  });

  it('drops the overflow packets of N01 into the loss tray', () => {
    for (const t of loop('N01', 50)) {
      const s = queueState(t, 2), f = renderers.N01(650, t);
      const lost = f.ops.filter(o => o.type === 'path' && o.stroke === FIGURE_COLORS.red && o.dash !== null).length;
      expect(lost, `${t}`).toBe(s.dropped.length);
    }
  });

  it('keeps the W05 layer label above the stream arrows that cross it', () => {
    const ops = renderers.W05(650, 8000).ops;
    const at = ops.findIndex(o => o.type === 'text' && o.text === 'HTTP/2 분배 (TCP 위 계층)');
    const arrows = ops.map((o, i) => o.type === 'path' && o.stroke === FIGURE_COLORS.green && /^M[\d.]+ [\d.]+L/.test(o.d) ? i : -1).filter(i => i >= 0);
    expect(arrows.length).toBeGreaterThan(0);
    expect(Math.max(...arrows)).toBeLessThan(at);
  });

  it('draws no element of a static step or final scene fully transparent', () => {
    // 단계 시각이 사건 시각과 같으면 그 사건에 나타나는 요소가 투명하게 남는다
    const all = [...items.map(i => [renderers[i.id], i] as const), ...systemInfo.map(i => [systemRenderers[i.id], i] as const), ...dataInfo.map(i => [dataRenderers[i.id], i] as const), ...infraInfo.map(i => [infraRenderers[i.id], i] as const), ...processInfo.map(i => [processRenderers[i.id], i] as const)];
    const issues: string[] = [];
    for (const [r, item] of all) for (const w of [650, 284]) for (const t of [...item.steps, item.final]) for (const o of r(w, t).ops) {
      if (o.type === 'text' && o.text.trim() && (o.alpha ?? 1) < 0.05) issues.push(`${item.id} ${t} text ${o.text}`);
      if (o.type === 'path' && (o.fill !== 'none' || o.stroke !== 'none') && o.alpha < 0.05) issues.push(`${item.id} ${t} path`);
    }
    expect([...new Set(issues)]).toEqual([]);
  });

  it('keeps every shape inside the figure at every article width', () => {
    const box = (d: string) => { let x = 0; const xs: number[] = []; for (const [, cmd, args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) { const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number); if (cmd === 'H') x = n[n.length - 1]; else if (cmd !== 'V' && cmd !== 'Z') x = n[n.length - 2]; if (cmd !== 'Z') xs.push(x); } return [Math.min(...xs), Math.max(...xs)]; };
    const issues = new Set<string>();
    const all = [...items.map(i => [renderers[i.id], i] as const), ...systemInfo.map(i => [systemRenderers[i.id] as (w: number, t: number) => LessonFrame, i] as const), ...dataInfo.map(i => [dataRenderers[i.id], i] as const), ...infraInfo.map(i => [infraRenderers[i.id], i] as const), ...processInfo.map(i => [processRenderers[i.id], i] as const)];
    for (const [r, item] of all) for (const w of ARTICLE_WIDTHS) for (let t = 0; t <= item.duration; t += 100) for (const o of r(w, t).ops) {
      if (o.type !== 'path') continue;
      const [x1, x2] = box(o.d);
      if (x1 < -1 || x2 > w + 1) issues.add(`${item.id} ${w}`);
    }
    expect([...issues]).toEqual([]);
  });

  it('shows a partition count in S03 only from the count event', () => {
    for (const t of loop('S03', 50)) expect(texts(renderers.S03(650, t)).some(o => o.text === '0'), `${t}`).toBe(sparkState(t).result !== null);
  });

  it('keeps the Reno row of N08 free of flow dots and names the BBR values as estimates', () => {
    for (const t of loop('N08', 250)) {
      const f = renderers.N08(650, t), split = texts(f).find(o => o.text === 'BBRv1 · 관측 모델')!.y;
      expect(f.ops.filter(o => o.type === 'circle' && o.r === 2.4 && o.y < split).length, `${t}`).toBe(0);
      expect(has(f, '추정: BtlBw 100 Mbps / RTprop 40 ms')).toBe(true);
    }
  });

  it('does not report gzip compression in W02 before the compression span starts', () => {
    for (const t of loop('W02', 50)) if (t < 1600) expect(texts(renderers.W02(650, t)).some(o => o.text.includes('압축 중')), `${t}`).toBe(false);
  });

  it('keeps visible labels apart and inside the figure at every article width', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const box = (o: Text) => { const w = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x; return { x1: x, x2: x + w, y1: o.y - o.size * 0.8, y2: o.y + o.size * 0.22 }; };
    const issues: string[] = [];
    for (const item of items) for (const w of ARTICLE_WIDTHS) for (const t of loop(item.id)) {
      const bs = texts(renderers[item.id](w, t)).filter(o => o.text.trim() && (o.alpha ?? 1) > 0.5).map(o => ({ o, ...box(o) }));
      for (const b of bs) if (b.x1 < -1 || b.x2 > w + 1) issues.push(`${item.id} ${w} ${t} outside ${b.o.text}`);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        // 같은 글자가 같은 자리에 있는 것은 이동 토큰이 출발점을 떠나는 순간이다
        if (a.o.text === b.o.text && Math.abs(a.o.x - b.o.x) < 3 && Math.abs(a.o.y - b.o.y) < 3) continue;
        if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2) issues.push(`${item.id} ${w} ${t} ${a.o.text} / ${b.o.text}`);
      }
    }
    expect([issues.length, ...new Set(issues.map(i => i.split(' ').slice(0, 2).join(' ')))]).toEqual([0]);
  });
});

describe('every figure keeps lines and filled shapes off its labels', () => {
  // B07에서 만든 두 검사를 74종 전체의 정적 단계·완료 장면에 건다(R04·B04·B05·B06은 이전에 이 검사가 없었다)
  const all = [...[...lessonInfo, ...networkInfo].map(i => [({ ...lessonRenderers, ...networkRenderers } as Record<string, (w: number, t: number) => LessonFrame>)[i.id], i] as const), ...systemInfo.map(i => [systemRenderers[i.id] as (w: number, t: number) => LessonFrame, i] as const), ...dataInfo.map(i => [dataRenderers[i.id], i] as const), ...infraInfo.map(i => [infraRenderers[i.id], i] as const), ...processInfo.map(i => [processRenderers[i.id], i] as const)];
  type Text = Extract<LessonFrame['ops'][number], { type: 'text' }>;
  const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
  const tbox = (o: Text) => { const tw = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - tw / 2 : o.align === 'right' ? o.x - tw : o.x; return { t: o.text, x1: x + 1, x2: x + tw - 1, y1: o.y - o.size * 0.7, y2: o.y + o.size * 0.1 }; };
  const pbox = (d: string) => { let x = 0, y = 0; const xs: number[] = [], ys: number[] = []; for (const [, cmd, args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) { const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number); if (cmd === 'H') x = n[n.length - 1]; else if (cmd === 'V') y = n[n.length - 1]; else if (cmd !== 'Z') { x = n[n.length - 2]; y = n[n.length - 1]; } if (cmd !== 'Z') { xs.push(x); ys.push(y); } } return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) }; };
  const scenes = function* () { for (const [r, item] of all) for (const w of [650, 625, 560, 346, 321, 284, 259]) for (const t of [...item.steps, item.final]) yield [item.id, w, t, r(w, t)] as const; };
  it('never runs a straight line through a visible word', () => {
    const issues = new Set<string>();
    for (const [id, w, t, f] of scenes()) {
      const boxes = f.ops.map((o, i) => o.type === 'text' && !!o.text.trim() && o.text !== '—' && (o.alpha ?? 1) > 0.5 ? { i, ...tbox(o) } : null).filter(Boolean) as (ReturnType<typeof tbox> & { i: number })[];
      // 선보다 나중에 칠한 채운 도형(글자 바탕 등)이 그 점을 덮으면 선은 보이지 않는다
      const fills = f.ops.map((o, i) => o.type === 'path' && o.fill !== 'none' && o.alpha > 0.5 ? { i, ...pbox(o.d) } : o.type === 'rect' && o.fill !== 'none' ? { i, x1: o.x, x2: o.x + o.w, y1: o.y, y2: o.y + o.h } : null).filter(Boolean) as { i: number; x1: number; x2: number; y1: number; y2: number }[];
      f.ops.forEach((o, li) => {
        if (o.type === 'line') { check([[o.x1, o.y1], [o.x2, o.y2]], li); return; }
        // 투명도 0.3 미만의 아주 옅은 안내선은 배경이라 제외한다(시간 커서 0.35는 검사한다)
        if (o.type !== 'path' || o.fill !== 'none' || (o.alpha ?? 1) < 0.3 || !/^M[^A-Z]*L[^A-Z]*(L[^A-Z]*)*$/.test(o.d)) return;
        check([...o.d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]), li);
      });
      // 취소선은 실선이다(점선 커서가 글자 가운데를 지나는 것은 취소선이 아니다)
      function grid(li: number) { const o = f.ops[li]; return o.type === 'path' && o.stroke === FIGURE_COLORS.grid; }
      function solid(li: number) { const o = f.ops[li]; return o.type !== 'path' || !o.dash?.length; }
      function check(pts: number[][], li: number) {
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
          for (let k = 0; k <= n; k++) {
            const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
            if (fills.some(c => c.i > li && x >= c.x1 && x <= c.x2 && y >= c.y1 && y <= c.y2)) continue;
            // 그 글자보다 먼저 깐 아주 옅은 눈금선(C.grid)은 차트 배경이다(글자가 선 위에 놓인다)
            for (const b of boxes) if (x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2 && !(grid(li) && b.i > li) && !(solid(li) && strike(b, x0, y0, x1, y1))) issues.add(`${id} ${w} ${t} ${b.t}`);
          }
        }
      }
      // 취소선(글자 가운데를 지나며 글자 폭 대부분을 덮는 짧은 선, 기울기 무관)은 의도된 표시다
      function strike(b: { x1: number; x2: number; y1: number; y2: number }, x0: number, y0: number, x1: number, y1: number) {
        const mid = (b.y1 + b.y2) / 2, cy = (y0 + y1) / 2, tw = b.x2 - b.x1;
        return Math.abs(cy - mid) < 4 && Math.hypot(x1 - x0, y1 - y0) <= tw + 30 && Math.abs((x0 + x1) / 2 - (b.x1 + b.x2) / 2) <= tw * 0.2 + 3 && Math.min(x0, x1) <= b.x1 + tw * 0.15 && Math.max(x0, x1) >= b.x2 - tw * 0.15;
      }
    }
    expect([...issues]).toEqual([]);
  });

  it('never hides a moving token under a later fill', () => {
    // 움직이는 중에도 확인한다(정적 단계·완료 포함). 자기 라벨 바탕 아래에 중심이 들어간 토큰은 아예 그리지 않는다: 바탕 밖으로 조각만 보이지 않게
    const issues = new Set<string>();
    for (const [r, item] of all) for (const w of [650, 259]) for (const t of [...Array.from({ length: Math.floor(item.final / 200) + 1 }, (_, k) => k * 200), ...item.steps]) {
      const f = r(w, t);
      f.ops.forEach((o, i) => {
        if (o.type !== 'circle' || o.r < 3 || o.color === 'none' || (o.alpha ?? 1) < 0.5) return;
        for (const q of f.ops.slice(i + 1)) {
          const b = q.type === 'path' && q.fill !== 'none' && q.alpha > 0.5 ? pbox(q.d) : q.type === 'rect' && q.fill !== 'none' ? { x1: q.x, x2: q.x + q.w, y1: q.y, y2: q.y + q.h } : null;
          if (b && o.x > b.x1 && o.x < b.x2 && o.y > b.y1 && o.y < b.y2) issues.add(`${item.id} ${w} ${t}`);
        }
      });
    }
    expect([...issues]).toEqual([]);
  });

  it('keeps label backgrounds off the N06 timer bars at every width', () => {
    // 대기 막대(점선 테두리 + 옅은 주황)는 라벨 바탕에 끊기면 대기가 멈춘 것처럼 보인다
    const r = networkRenderers.N06, item = networkInfo.find(i => i.id === 'N06')!, hits: string[] = [];
    for (let w = 259; w <= 650; w += 13) for (const t of [...item.steps, item.final]) {
      const f = r(w, t);
      f.ops.forEach((o, i) => {
        if (o.type !== 'path' || o.fill !== FIGURE_COLORS.orangeTint || !o.dash) return;
        const bar = pbox(o.d);
        for (const q of f.ops.slice(i + 1)) if (q.type === 'path' && q.fill === FIGURE_COLORS.bg) {
          const b = pbox(q.d);
          if (b.x1 < bar.x2 && b.x2 > bar.x1 && b.y1 < bar.y2 && b.y2 > bar.y1) hits.push(`${w} ${t}`);
        }
      });
    }
    expect([...new Set(hits)]).toEqual([]);
  });

  it('keeps each label inside the box drawn right before it', () => {
    // 칸·칩·라벨 바탕처럼 글자 바로 앞에 칠한 도형이 글자의 자리라면, 글자가 그 테두리를 넘지 않는다
    const issues = new Set<string>();
    for (const [id, w, , f] of scenes()) f.ops.forEach((o, i) => {
      const p = f.ops[i - 1];
      if (o.type !== 'text' || !o.text.trim() || !p || p.type !== 'path' || p.fill === 'none' || !p.d.includes('A')) return;
      const b = pbox(p.d), t = tbox(o), cy = (t.y1 + t.y2) / 2;
      if (b.y2 - b.y1 > 40 || cy < b.y1 || cy > b.y2 || Math.min(t.x2, b.x2) - Math.max(t.x1, b.x1) < (t.x2 - t.x1) * 0.5) return;
      if (t.x1 < b.x1 - 1 || t.x2 > b.x2 + 1) issues.add(`${id} ${w} ${o.text}`);
    });
    expect([...issues]).toEqual([]);
  });

  it('keeps the time cursor off the loss label right after a loss', () => {
    // 유실 직후 시간 커서가 '× 유실' 바로 위를 지난다: 커서는 그 라벨 바탕 아래 층이어야 한다
    const issues = new Set<string>();
    for (const [r, item] of all) for (const w of [650, 259]) {
      if (!r(w, item.final).ops.some(o => o.type === 'text' && o.text === '× 유실')) continue;
      for (let t = 0; t <= item.final; t += 10) {
        const f = r(w, t), ti = f.ops.findIndex(o => o.type === 'text' && o.text === '× 유실');
        if (ti < 0) continue;
        const b = tbox(f.ops[ti] as Text);
        f.ops.forEach((o, ci) => {
          if (o.type !== 'path' || o.stroke !== FIGURE_COLORS.blue || o.dash?.join() !== '2,3' || ci < ti) return;
          const p = pbox(o.d);
          if (p.y1 > b.y1 && p.y1 < b.y2 && p.x1 < b.x2 && p.x2 > b.x1) issues.add(`${item.id} ${w} ${t}`);
        });
      }
    }
    expect([...new Set([...issues].map(s => s.split(' ').slice(0, 2).join(' ')))]).toEqual([]);
  });

  it('never leaves a dot over a word in a static scene', () => {
    // 정적 단계·완료 장면은 읽는 장면이다: 글자 뒤에 칠한 점(토큰·표지)이 글자를 가리지 않는다
    const issues = new Set<string>();
    for (const [id, w, t, f] of scenes()) f.ops.forEach((o, i) => {
      if (o.type !== 'circle' || o.r < 3 || (o.alpha ?? 1) < 0.5) return;
      for (const q of f.ops.slice(0, i)) if (q.type === 'text' && q.text.trim() && (q.alpha ?? 1) > 0.5) {
        const b = tbox(q);
        if (o.x + o.r > b.x1 && o.x - o.r < b.x2 && o.y + o.r > b.y1 && o.y - o.r < b.y2) issues.add(`${id} ${w} ${t} ${q.text}`);
      }
    });
    expect([...issues]).toEqual([]);
  });

  it('keeps every × mark clear of later fills', () => {
    // 유실·차단 표시(빨간 × 두 획)는 나중에 칠한 바탕에 가려지지 않는다
    const issues = new Set<string>();
    for (const [id, w, t, f] of scenes()) f.ops.forEach((o, i) => {
      if (o.type !== 'path' || o.stroke !== FIGURE_COLORS.red || o.fill !== 'none' || o.width !== 2 || !/^M[^A-Z]*L[^A-Z]*$/.test(o.d)) return;
      const b = pbox(o.d);
      if (Math.hypot(b.x2 - b.x1, b.y2 - b.y1) > 20) return;
      for (const q of f.ops.slice(i + 1)) {
        const c = q.type === 'path' && q.fill !== 'none' && q.alpha > 0.5 ? pbox(q.d) : q.type === 'rect' && q.fill !== 'none' ? { x1: q.x, x2: q.x + q.w, y1: q.y, y2: q.y + q.h } : null;
        if (c && c.x1 < b.x2 && c.x2 > b.x1 && c.y1 < b.y2 && c.y2 > b.y1) issues.add(`${id} ${w} ${t}`);
      }
    });
    expect([...issues]).toEqual([]);
  });

  it('keeps label backgrounds off every hold bar', () => {
    // 시퀀스의 대기 막대(폭 6의 옅은 색 막대)는 라벨 바탕에 끊기면 대기가 멈춘 것처럼 보인다
    const tints = new Set([FIGURE_COLORS.orangeTint, FIGURE_COLORS.blueTint, FIGURE_COLORS.greenTint, FIGURE_COLORS.redTint, FIGURE_COLORS.slab]);
    const issues = new Set<string>();
    for (const [id, w, t, f] of scenes()) f.ops.forEach((o, i) => {
      if (o.type !== 'path' || !tints.has(o.fill) || o.stroke === 'none') return;
      const bar = pbox(o.d);
      if (Math.abs(bar.x2 - bar.x1 - 6) > 0.5 || bar.y2 - bar.y1 < 10) return;
      for (const q of f.ops.slice(i + 1)) if (q.type === 'path' && q.fill === FIGURE_COLORS.bg) {
        const c = pbox(q.d);
        if (c.x1 < bar.x2 && c.x2 > bar.x1 && c.y1 < bar.y2 && c.y2 > bar.y1) issues.add(`${id} ${w} ${t}`);
      }
    });
    expect([...issues]).toEqual([]);
  });

  it('keeps the C07 state word clear of the CMD pill at every side-by-side width', () => {
    const r = systemRenderers.C07 as (w: number, t: number) => LessonFrame, hits: string[] = [];
    for (let w = 560; w <= 650; w++) for (const t of [4400, 6500, 7600, 9000]) {
      const f = r(w, t), i = f.ops.findIndex(o => o.type === 'text' && o.text.startsWith('CMD') && o.mono && o.size === 12 && o.weight === 600), st = f.ops.find((o): o is Text => o.type === 'text' && !!o.mono && o.size === 13 && o.align === 'right');
      const pill = f.ops[i - 2];
      if (i < 2 || !st || pill.type !== 'path' || Math.abs(st.y - (f.ops[i] as Text).y) > 10) continue;
      if (tbox(st).x1 < pbox(pill.d).x2 + 4) hits.push(`${w} ${t} ${st.text}`);
    }
    expect(hits).toEqual([]);
  });

  it('reads each wrapped sentence in one piece and leaves invisible words out of the SVG description', () => {
    // 스크린리더는 desc를 읽는다: 줄바꿈된 한 문장이 ' · '로 끊기지 않고, 보이지 않는(투명도 0.05 이하) 글자는 읽지 않는다
    const desc = (f: LessonFrame, w: number) => (renderToString(createElement(LessonSvg, { frame: f, width: w, title: 't' })).match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const e05 = processRenderers.E05(284, 9400), n06 = networkRenderers.N06(259, 7500);
    expect(desc(e05, 284)).toContain('일어난 사건을 순서대로 덧붙이는 append-only 기록 = 곧 워크플로우 상태');
    expect(desc(n06, 259)).toContain('후속 DATA 없음 → 중복 ACK 없음');
    const leaks = new Set<string>();
    for (const [id, w, t, f] of scenes()) {
      if (w !== 650 && w !== 259) continue;
      const shown = new Set(f.ops.filter((o): o is Text => o.type === 'text' && (o.alpha ?? 1) > 0.05).map(o => o.text));
      const d = desc(f, w);
      for (const o of f.ops) if (o.type === 'text' && (o.alpha ?? 1) <= 0.05 && o.text.trim().length > 1 && !shown.has(o.text) && d.includes(o.text)) leaks.add(`${id} ${w} ${t} ${o.text}`);
    }
    expect([...leaks]).toEqual([]);
  });

  it('keeps visible words apart while C07 removes the container', () => {
    // 제거 장면: 컨테이너 안 글자가 사라진 뒤 'rm …' 안내가 나타난다(둘이 반투명으로 겹치지 않는다)
    const r = systemRenderers.C07 as (w: number, t: number) => LessonFrame, hits = new Set<string>();
    for (const w of [650, 625, 346, 259]) for (let t = 8700; t <= 9600; t += 10) {
      const b = r(w, t).ops.filter((o): o is Text => o.type === 'text' && !!o.text.trim() && (o.alpha ?? 1) > 0.05).map(tbox);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].x1 < b[j].x2 && b[j].x1 < b[i].x2 && b[i].y1 < b[j].y2 && b[j].y1 < b[i].y2) hits.add(`${w} ${b[i].t} / ${b[j].t}`);
    }
    expect([...hits]).toEqual([]);
  });

  it('never paints a filled shape over a label drawn before it', () => {
    const issues = new Set<string>();
    for (const [id, w, , f] of scenes()) f.ops.forEach((o, i) => {
      if (o.type !== 'text' || !o.text.trim() || (o.alpha ?? 1) < 0.5) return;
      for (const q of f.ops.slice(i + 1)) {
        if (q.type === 'path' && q.fill !== 'none' && q.alpha > 0.5) { const b = pbox(q.d); if (o.x > b.x1 && o.x < b.x2 && o.y - 3 > b.y1 && o.y - 3 < b.y2) issues.add(`${id} ${w} ${o.text}`); }
        if (q.type === 'rect' && q.fill !== 'none' && o.x > q.x && o.x < q.x + q.w && o.y - 3 > q.y && o.y - 3 < q.y + q.h) issues.add(`${id} ${w} ${o.text}`);
      }
    });
    expect([...issues]).toEqual([]);
  });
});
