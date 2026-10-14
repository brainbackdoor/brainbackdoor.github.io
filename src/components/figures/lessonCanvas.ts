import { FIGURE_COLORS } from './figurePalette';
import { arrivalTimes, cacheState, flowEvents, flowState, indexState, lockState, queueState, sparkState, type FigureId } from './lesson-models';

export type DrawOp =
 | {type:'rect';x:number;y:number;w:number;h:number;fill:string;stroke:string}
 | {type:'text';x:number;y:number;text:string;color:string;size:number;align:CanvasTextAlign;bold:boolean;mono?:boolean;alpha?:number;weight?:number}
 | {type:'line';x1:number;y1:number;x2:number;y2:number;color:string;dash:boolean}
 | {type:'circle';x:number;y:number;r:number;color:string;stroke?:string;strokeWidth?:number;alpha?:number}
 /** Rounded shapes, curves, arrowheads and icons share one SVG path string in Canvas and SVG. */
 | {type:'path';d:string;fill:string;stroke:string;width:number;dash:number[]|null;alpha:number};
export interface LessonFrame {ops:DrawOp[];height:number;status:string}
export { FIGURE_COLORS };
const F=FIGURE_COLORS;
/** Linear display progress of one span: 0 and 1 at its ends, clamped outside, invalid when the span has no length. */
export function span(t:number,start:number,end:number){if(!(end>start))throw new Error(`invalid span ${start}..${end}`);return Math.max(0,Math.min(1,(t-start)/(end-start)));}
/** CSS-compatible cubic-bezier: find the curve parameter for x first, then read y. */
export function cubicBezier(x1:number,y1:number,x2:number,y2:number){
 if(x1<0||x1>1||x2<0||x2>1)throw new Error('cubic-bezier x control points must be within 0..1');
 const bx=(s:number)=>3*x1*s*(1-s)*(1-s)+3*x2*s*s*(1-s)+s*s*s,by=(s:number)=>3*y1*s*(1-s)*(1-s)+3*y2*s*s*(1-s)+s*s*s;
 return (x:number)=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<26;i++){const m=(lo+hi)/2;if(bx(m)<x)lo=m;else hi=m;}return by((lo+hi)/2);};
}
const r2=(n:number)=>Math.round(n*100)/100;
/** Closed rounded rectangle; the radius never exceeds half of the shorter side. */
export function roundedRectPath(x:number,y:number,w:number,h:number,r:number){
 const k=r2(Math.max(0,Math.min(r,w/2,h/2)));
 if(!k)return `M${r2(x)} ${r2(y)}H${r2(x+w)}V${r2(y+h)}H${r2(x)}Z`;
 return `M${r2(x+k)} ${r2(y)}H${r2(x+w-k)}A${k} ${k} 0 0 1 ${r2(x+w)} ${r2(y+k)}V${r2(y+h-k)}A${k} ${k} 0 0 1 ${r2(x+w-k)} ${r2(y+h)}H${r2(x+k)}A${k} ${k} 0 0 1 ${r2(x)} ${r2(y+h-k)}V${r2(y+k)}A${k} ${k} 0 0 1 ${r2(x+k)} ${r2(y)}Z`;
}


/** 도해 공통 도구(R04): B04 v2(systemCanvas)의 그리기 규칙과 시간 비례 시퀀스. */
export type Pt = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Opt = Record<string, any>;
export const C = {
  ink: F.text, muted: F.muted, faint: F.faint, line: F.line, grid: F.grid, bg: F.plot, slab: F.slab, paper: F.bg,
  blue: F.blue, blueText: F.blueText, blueTint: F.blueTint, blueSoft: F.blueSoft,
  green: F.green, greenText: F.greenText, greenTint: F.greenTint,
  orange: F.orange, orangeText: F.orangeText, orangeTint: F.orangeTint,
  red: F.red, redText: F.redText, redTint: F.redTint,
} as const;
export type Tone = 'blue' | 'green' | 'orange' | 'red';
export const TONE: Record<Tone, { line: string; text: string; tint: string }> = {
  blue: { line: C.blue, text: C.blueText, tint: C.blueTint },
  green: { line: C.green, text: C.greenText, tint: C.greenTint },
  orange: { line: C.orange, text: C.orangeText, tint: C.orangeTint },
  red: { line: C.red, text: C.redText, tint: C.redTint },
};
export const f2 = (n: number) => Math.round(n * 100) / 100;
export function draw() {
  const ops: DrawOp[] = [];
  return {
    ops,
    rect(x: number, y: number, w: number, h: number, o: Opt = {}) { if (w <= 0 || h <= 0) return; ops.push({ type: 'path', d: roundedRectPath(x, y, w, h, o.r ?? 6), fill: o.fill ?? 'none', stroke: o.stroke ?? 'none', width: o.lw ?? 1, dash: o.dash || null, alpha: o.alpha ?? 1 }); },
    line(x1: number, y1: number, x2: number, y2: number, o: Opt = {}) { ops.push({ type: 'path', d: `M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`, fill: 'none', stroke: o.stroke ?? C.line, width: o.lw ?? 1.5, dash: o.dash || null, alpha: o.alpha ?? 1 }); },
    path(d: string, o: Opt = {}) { ops.push({ type: 'path', d, fill: o.fill ?? 'none', stroke: o.stroke ?? 'none', width: o.lw ?? 1.5, dash: o.dash || null, alpha: o.alpha ?? 1 }); },
    circle(x: number, y: number, r: number, o: Opt = {}) { ops.push({ type: 'circle', x, y, r, color: o.fill ?? C.ink, stroke: o.stroke ?? 'none', strokeWidth: o.lw ?? 1, alpha: o.alpha ?? 1 }); },
    text(x: number, y: number, s: string | number, o: Opt = {}) { const weight = o.weight ?? 400; ops.push({ type: 'text', x, y, text: String(s), color: o.color ?? C.ink, size: o.size ?? 12, align: o.align ?? 'left', bold: weight >= 600, weight, mono: !!o.mono, alpha: o.alpha ?? 1 }); },
  };
}
export type G = ReturnType<typeof draw>;
export const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
export const ease = { out: cubicBezier(0.2, 0.7, 0.3, 1), inOut: cubicBezier(0.45, 0, 0.25, 1) };
export const lerp = (a: number, b: number, q: number) => a + (b - a) * q;
export const lerpPt = (p: Pt, q: Pt, u: number): Pt => ({ x: lerp(p.x, q.x, u), y: lerp(p.y, q.y, u) });
export const angle = (p: Pt, q: Pt) => Math.atan2(q.y - p.y, q.x - p.x);
// 다른 칩 위를 넘어가는 이동: 가운데에서 h만큼 위로 뜬다
export const hop = (p: Pt, q: Pt, u: number, h = 18): Pt => {
  // 이동 방향의 수직으로 뜬다: 오른쪽 이동이면 위로, 아래쪽 이동이면 오른쪽으로
  const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, lift = Math.sin(Math.PI * u) * h;
  return { x: lerp(p.x, q.x, u) + dy / len * lift, y: lerp(p.y, q.y, u) - dx / len * lift };
};
// 사건 시각에 0에서 시작하는 나타남(표현 전용)
export const appear = (t: number, at: number, d = 300) => t < at ? 0 : ease.out(span(t, at, at + d));
// 정적 생성과 Canvas가 같은 줄바꿈을 얻도록 실제 측정 대신 고정 폭 규칙을 사용한다.
export function textW(s: string | number, size: number, mono?: boolean) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x1100) n += mono ? 1 : 0.94;
    else if (mono) n += 0.6;
    else if (' .,:;·|!il\'"()[]'.includes(ch)) n += 0.3;
    else if (/[A-Z0-9mwMW+=→]/.test(ch)) n += 0.64;
    else n += 0.52;
  }
  return n * size;
}
export function wrap(s: string, maxW: number, size: number, mono?: boolean) {
  const out: string[] = [];
  let line = '';
  for (const word of String(s).split(' ')) {
    const cand = line ? line + ' ' + word : word;
    if (!line || textW(cand, size, mono) <= maxW) line = cand;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
export function para(g: G, x: number, y: number, s: string, maxW: number, o: Opt = {}) {
  const size = o.size ?? 12, lh = o.lh ?? Math.round(size * 1.6);
  const rows = wrap(s, maxW, size, o.mono);
  const ax = o.align === 'center' ? x + maxW / 2 : o.align === 'right' ? x + maxW : x;
  rows.forEach((r, i) => g.text(ax, y + i * lh, r, { ...o, size }));
  return y + (rows.length - 1) * lh;
}
export function arrowHead(g: G, p: Pt, ang: number, color: string, alpha = 1, size = 7) {
  const a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45;
  g.path(`M${f2(p.x + size * Math.cos(a1))} ${f2(p.y + size * Math.sin(a1))}L${f2(p.x)} ${f2(p.y)}L${f2(p.x + size * Math.cos(a2))} ${f2(p.y + size * Math.sin(a2))}Z`, { fill: color, stroke: color, lw: 1, alpha });
}
export function arrow(g: G, p: Pt, q: Pt, o: Opt = {}) {
  const color = o.stroke ?? C.ink, a = o.alpha ?? 1, ang = angle(p, q), back = { x: q.x - Math.cos(ang) * 3, y: q.y - Math.sin(ang) * 3 };
  g.line(p.x, p.y, back.x, back.y, { stroke: color, lw: o.lw ?? 1.5, dash: o.dash, alpha: a });
  arrowHead(g, q, ang, color, a, o.size ?? 7);
}
export function polyline(g: G, pts: Pt[], o: Opt) { g.path('M' + pts.map(p => `${f2(p.x)} ${f2(p.y)}`).join('L'), { fill: 'none', ...o }); }
// 글자 뒤에 바탕을 깔아 선 위에서도 읽히게 한다
export function label(g: G, x: number, y: number, s: string, o: Opt = {}) {
  const size = o.size ?? 12, w = textW(s, size, o.mono) + 10, align = o.align ?? 'center';
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w + 5 : x - 5;
  g.rect(left, y - size * 0.95, w, size * 1.35, { r: 4, fill: o.bg ?? C.paper, alpha: o.alpha ?? 1 });
  g.text(x, y, s, { ...o, size, align });
  return w;
}
export function pill(g: G, cx: number, cy: number, text: string, o: Opt = {}) {
  const size = o.size ?? 12, w = Math.max(o.min ?? 0, textW(text, size, o.mono) + 22), h = o.h ?? 26, a = o.alpha ?? 1;
  g.rect(cx - w / 2, cy - h / 2, w, h, { r: h / 2, fill: o.fill ?? C.bg, stroke: o.stroke ?? C.line, lw: o.lw ?? 1, alpha: a });
  g.text(cx, cy + size * 0.36, text, { size, weight: o.weight ?? 600, mono: o.mono, align: 'center', color: o.color ?? C.ink, alpha: a });
  return w;
}
// 값 칩: 번호·패킷·바이트 묶음
export function token(g: G, cx: number, cy: number, text: string | number, tone: Tone | 'ink' | 'muted', o: Opt = {}) {
  const st = tone === 'ink' ? { line: C.ink, text: C.ink, tint: C.paper } : tone === 'muted' ? { line: C.line, text: C.muted, tint: C.bg } : TONE[tone];
  const s = String(text), r = o.r ?? 11, w = Math.max(r * 2, textW(s, 12, true) + 12), a = o.alpha ?? 1;
  // 채운 칩은 흰 글자가 4.5:1을 넘도록 진한 글자색으로 채운다
  g.rect(cx - w / 2, cy - r, w, r * 2, { r, fill: o.solid ? st.text : st.tint, stroke: o.solid ? st.text : st.line, lw: 1.3, alpha: a, dash: o.dash });
  g.text(cx, cy + 4.3, s, { size: 12, weight: 700, mono: true, align: 'center', color: o.solid ? '#fff' : st.text, alpha: a });
  return w;
}
export function cross(g: G, cx: number, cy: number, color: string = C.red, alpha = 1, s = 5) {
  g.line(cx - s, cy - s, cx + s, cy + s, { stroke: color, lw: 2, alpha });
  g.line(cx - s, cy + s, cx + s, cy - s, { stroke: color, lw: 2, alpha });
}
export function lockGlyph(g: G, x: number, y: number, color: string, o: Opt = {}) {
  const k = o.s ?? 1, a = o.alpha ?? 1;
  g.path(`M${f2(x + 2.5 * k)} ${f2(y + 6 * k)}V${f2(y + 3.5 * k)}A${f2(3 * k)} ${f2(3 * k)} 0 0 1 ${f2(x + 8.5 * k)} ${f2(y + 3.5 * k)}V${f2(y + 6 * k)}`, { stroke: color, lw: 1.4 * Math.sqrt(k), alpha: a });
  g.rect(x, y + 6 * k, 11 * k, 7 * k, { r: 1.5 * k, fill: color, alpha: a });
}
export function fileGlyph(g: G, x: number, y: number, o: Opt = {}) {
  const color = o.color ?? C.ink, alpha = o.alpha ?? 1, k = o.s ?? 1;
  g.path(`M${f2(x)} ${f2(y)}H${f2(x + 9 * k)}L${f2(x + 14 * k)} ${f2(y + 5 * k)}V${f2(y + 18 * k)}H${f2(x)}Z`, { fill: o.fill ?? C.paper, stroke: color, lw: 1.3, alpha });
  g.path(`M${f2(x + 9 * k)} ${f2(y)}V${f2(y + 5 * k)}H${f2(x + 14 * k)}`, { stroke: color, lw: 1.1, alpha });
}
export function serverGlyph(g: G, x: number, y: number, w: number, h: number, o: Opt = {}) {
  const a = o.alpha ?? 1, s = o.stroke ?? C.ink, u = h / 2;
  g.rect(x, y, w, h, { r: 6, fill: o.fill ?? C.paper, stroke: s, lw: 1.3, alpha: a });
  g.line(x + 1, y + u, x + w - 1, y + u, { stroke: s, lw: 1, alpha: a });
  for (let i = 0; i < 2; i++) {
    g.circle(x + 10, y + u * i + u / 2, 2.6, { fill: o.led ?? C.green, alpha: a });
    g.line(x + 20, y + u * i + u / 2, x + w - 10, y + u * i + u / 2, { stroke: C.line, lw: 2, alpha: a });
  }
}
export function cylinder(g: G, cx: number, top: number, w: number, h: number, o: Opt = {}) {
  const rx = w / 2, ry = 6, a = o.alpha ?? 1, s = o.stroke ?? C.ink;
  g.path(`M${f2(cx - rx)} ${f2(top)}V${f2(top + h)}A${f2(rx)} ${ry} 0 0 0 ${f2(cx + rx)} ${f2(top + h)}V${f2(top)}`, { fill: o.fill ?? C.paper, stroke: s, lw: 1.4, alpha: a });
  g.path(`M${f2(cx - rx)} ${f2(top)}A${f2(rx)} ${ry} 0 1 0 ${f2(cx + rx)} ${f2(top)}A${f2(rx)} ${ry} 0 1 0 ${f2(cx - rx)} ${f2(top)}Z`, { fill: o.fill ?? C.paper, stroke: s, lw: 1.4, alpha: a });
}
// 끝점 상자: 송신·수신 같은 양 끝
export function host(g: G, cx: number, y: number, name: string, o: Opt = {}) {
  const w = Math.max(o.min ?? 56, textW(name, 12) + 24);
  g.rect(cx - w / 2, y, w, 26, { r: 7, fill: o.fill ?? C.paper, stroke: o.stroke ?? C.ink, lw: 1.3 });
  g.text(cx, y + 17.5, name, { size: 12, weight: 600, align: 'center', color: o.color ?? C.ink });
  return w;
}

/* ---------- 시간 비례 시퀀스: 보낸 시각과 도착 시각을 그대로 기울기로 그린다 ---------- */
export type Msg = { a: number; b: number; from: 0 | 1; label: string; tone: Tone; loss?: boolean };
export type Hold = { lane: 0 | 1; a: number; b: number; label: string; tone: Tone | 'muted'; restartAt?: number };
export type LaneState = readonly [number, string, Tone | 'muted' | 'ink'];
export interface SeqSpec {
  x: number; y: number; w: number; t0: number; t1: number; k: number;
  lanes: readonly [string, string];
  msgs: readonly Msg[];
  holds?: readonly Hold[];
  states?: readonly [readonly LaneState[], readonly LaneState[]];
  stateWidth?: number;
  // 끝점 바깥 여백: 대기 구간 라벨을 시퀀스 밖에 둔다 [왼쪽, 오른쪽]
  gutters?: readonly [number, number];
}
export interface SeqGeo { ax: number; bx: number; top: number; bottom: number; Y: (tt: number) => number; mid: number }
export function seq(g: G, t: number, sp: SeqSpec): SeqGeo {
  const sw = sp.states ? sp.stateWidth ?? 0 : 0, gl = sp.gutters?.[0] ?? 0, gr = sp.gutters?.[1] ?? 0;
  const ax = sp.x + sw + gl + 10, bx = sp.x + sp.w - sw - gr - 10, top = sp.y + 40;
  const Y = (tt: number) => top + 10 + (tt - sp.t0) * sp.k, bottom = Y(sp.t1) + 10, mid = (ax + bx) / 2;
  host(g, Math.max(sp.x + 28, ax), sp.y, sp.lanes[0]);
  host(g, Math.min(sp.x + sp.w - 28, bx), sp.y, sp.lanes[1]);
  for (const x of [ax, bx]) g.line(x, sp.y + 26, x, bottom, { stroke: C.line, lw: 1.2 });
  // 끝점 상태: 바깥 여백이 있으면 바깥에, 없으면 안쪽에 쓴다
  sp.states?.forEach((list, lane) => list.forEach(([at, name, tone], i) => {
    if (t < at) return;
    const next = list[i + 1]?.[0] ?? sp.t1, y1 = Y(Math.max(at, sp.t0)) - (at < sp.t0 ? 6 : 0), y2 = Y(Math.min(next, Math.max(t, at)));
    const col = tone === 'muted' ? C.line : tone === 'ink' ? C.ink : TONE[tone].line, txt = tone === 'muted' ? C.muted : tone === 'ink' ? C.ink : TONE[tone].text;
    const lx = lane ? bx : ax, a = appear(t, at);
    if (y2 > y1) g.rect(lx - 2.5, y1, 5, y2 - y1, { r: 2.5, fill: col, alpha: 0.85 * a });
    // 안쪽에 쓸 때는 대기 막대(끝점 ±12)를 비켜 쓰고 바탕을 깐다
    const outside = sw > 0, tx = outside ? (lane ? bx + 10 : ax - 10) : (lane ? bx - 22 : ax + 22);
    label(g, tx, y1 + 13, name, { size: 11, mono: true, weight: 600, align: outside === !!lane ? 'left' : 'right', color: txt, alpha: a });
  }));
  sp.holds?.forEach(h => {
    if (t < h.a) return;
    const lx = h.lane ? bx - 12 : ax + 12, y1 = Y(h.a), y2 = Y(Math.min(h.b, t)), col = h.tone === 'muted' ? C.faint : TONE[h.tone].line;
    const txt = h.tone === 'muted' ? C.muted : TONE[h.tone].text;
    g.rect(lx - 3, y1, 6, Math.max(2, y2 - y1), { r: 3, fill: h.tone === 'muted' ? C.slab : TONE[h.tone].tint, stroke: col, lw: 1, dash: t < h.b ? [3, 3] : null });
    const gut = h.lane ? gr : gl;
    if (gut > 0) {
      // 바깥 여백에 줄을 나눠 쓴다
      const rows = wrap(h.label, gut - 6, 11), ox = h.lane ? bx + 10 : ax - 10;
      rows.forEach((r, i) => g.text(ox, y1 + 12 + i * 14, r, { size: 11, align: h.lane ? 'left' : 'right', color: txt }));
    } else {
      // 안쪽: 끝점 상태 라벨과 겹치지 않게 구간 시작에서 30px 아래부터
      const yl = Math.max((y1 + y2) / 2 + 4, y1 + 32);
      label(g, h.lane ? lx - 9 : lx + 9, yl, h.label, { size: 11, align: h.lane ? 'right' : 'left', color: txt });
    }
  });
  for (const m of sp.msgs) {
    if (t < m.a) continue;
    const p0 = { x: m.from ? bx : ax, y: Y(m.a) }, p1full = { x: m.from ? ax : bx, y: Y(m.b) };
    const tone = TONE[m.tone], reach = m.loss ? 0.55 : 1, q = Math.min(1, (t - m.a) / (m.b - m.a));
    const head = lerpPt(p0, p1full, q * reach), done = t >= m.b;
    if (m.loss) {
      g.line(p0.x, p0.y, head.x, head.y, { stroke: tone.line, lw: 1.6, dash: [5, 4] });
      if (done) { cross(g, head.x, head.y, C.red); label(g, head.x + (m.from ? -10 : 10), head.y + 18, '× 유실', { size: 11, color: C.redText, align: m.from ? 'right' : 'left' }); }
      else g.circle(head.x, head.y, 4.5, { fill: tone.line });
    } else if (done) arrow(g, p0, p1full, { stroke: tone.line, lw: 1.6 });
    else { g.line(p0.x, p0.y, head.x, head.y, { stroke: tone.line, lw: 1.6 }); g.circle(head.x, head.y, 4.5, { fill: tone.line }); }
    // 라벨은 선의 가운데에 바탕을 깔아 둔다(보낸 시각부터)
    const mx = (p0.x + p1full.x) / 2, my = (p0.y + p1full.y) / 2 - 3, maxW = bx - ax - 28;
    const rows = wrap(m.label, maxW, 11, true);
    rows.forEach((r, i) => label(g, mx, my + (i - (rows.length - 1) / 2) * 15 + 4, r, { size: 11, mono: true, weight: 600, color: tone.text, alpha: appear(t, m.a, 200) }));
  }
  return { ax, bx, top, bottom, Y, mid };
}
// 시간 커서: 지금 시각을 시퀀스 위에 가로로 표시
export function cursor(g: G, geo: SeqGeo, t: number, t0: number, t1: number) {
  if (t <= t0 || t >= t1) return;
  const y = geo.Y(t);
  g.line(geo.ax - 6, y, geo.bx + 6, y, { stroke: C.blue, lw: 1, alpha: 0.35, dash: [2, 3] });
}
export function frame(g: G, height: number, status: string): LessonFrame { return { ops: g.ops, height: Math.ceil(height), status }; }

export const twoUp = (w: number) => w >= 560 ? { cols: 2, pw: (w - 28) / 2 } : { cols: 1, pw: w };

/* 운영 lesson 6종(R04 v2, 2026-10-14 승인): 사건 의미는 lesson-models에서 읽고 여기서는 형태·위치·전개만 계산한다. */
// 경로 위의 이동 토큰: [a, b] 동안 움직여 b에 도착하고, 도착 뒤에는 화살표로 남는다
function route(g: G, t: number, p: Pt, q: Pt, a: number, b: number, tone: Tone, text: string, o: { keep?: boolean; dim?: boolean } = {}) {
  if (t < a) { g.line(p.x, p.y, q.x, q.y, { stroke: C.grid, lw: 1.2, dash: [3, 4] }); return; }
  const col = o.dim ? C.grid : TONE[tone].line;
  if (t >= b) { if (o.keep !== false) arrow(g, p, q, { stroke: col, lw: 1.6, size: 6 }); return; }
  const u = ease.inOut(span(t, a, b)), h = lerpPt(p, q, u);
  g.line(p.x, p.y, h.x, h.y, { stroke: col, lw: 1.6 });
  token(g, h.x, h.y, text, tone, { solid: true });
}

/* ---------- N03 수신 윈도: rwnd 0 구간과 앱의 읽기를 같은 시각에 잇는다 ---------- */
function flowV2(w: number, t: number): LessonFrame {
  const g = draw(), s = flowState(t), wide = w >= 560;
  const msgs: Msg[] = flowEvents.map(e => ({ a: e.start, b: e.end, from: e.from === 'sender' ? 0 : 1, label: e.label, tone: e.tone }));
  const geo = seq(g, t, {
    x: 0, y: 0, w, t0: 800, t1: 9700, k: 0.05, lanes: ['송신', '수신'], msgs,
    holds: [{ lane: 0, a: 4700, b: 8200, label: wide ? 'rwnd 0 · 일반 전송 정지' : 'rwnd 0', tone: 'red' }, { lane: 1, a: 4100, b: 7000, label: wide ? '버퍼 가득 참' : '가득 참', tone: 'orange' }],
  });
  // 앱의 읽기: 수신 측에서 버퍼를 비운 시각 → 이후 Window Update
  if (t >= 7000) {
    const y = geo.Y(7000), a = appear(t, 7000);
    g.circle(geo.bx, y, 5, { fill: C.green, alpha: a });
    label(g, geo.bx - 12, y + 4, '앱이 8,760 B 읽음', { size: 11, align: 'right', color: C.greenText, alpha: a });
  }
  cursor(g, geo, t, 800, 9700);
  // 수신 버퍼: 2,920 B 칸 세 개
  const by = geo.bottom + 34, cw = (w - 12) / 3;
  g.text(0, by - 12, `수신 버퍼 ${s.buffer.toLocaleString()} / 8,760 B`, { size: 12, weight: 600 });
  for (let i = 0; i < 3; i++) {
    const on = s.buffer >= (i + 1) * 2920, full = s.buffer >= 8760;
    g.rect(i * (cw + 6), by, cw, 26, { r: 6, fill: on ? (full ? C.orangeTint : C.blueTint) : C.paper, stroke: on ? (full ? C.orange : C.blue) : C.line, lw: 1.2 });
    if (on) g.text(i * (cw + 6) + cw / 2, by + 17.5, '2,920 B', { size: 11, mono: true, align: 'center', color: full ? C.orangeText : C.blueText });
  }
  g.text(0, by + 52, `송신 측이 받은 rwnd ${s.advertised.toLocaleString()} B`, { size: 12, weight: 600, color: s.advertised === 0 ? C.redText : C.greenText });
  return frame(g, by + 62, s.phase);
}

/* ---------- N01 버퍼: 같은 6개 패킷이 용량이 다른 FIFO 큐에서 대기하거나 손실된다 ---------- */
function queuePanel(g: G, x: number, y: number, pw: number, t: number, cap: number) {
  const s = queueState(t, cap), slot = 26, gap = 5, tubeW = cap * (slot + gap) + gap, tx = x + (pw - tubeW) / 2, ty = y + 50, th = slot + 10;
  g.text(x, y + 14, cap === 2 ? '작은 버퍼 · 2개' : '큰 버퍼 · 6개', { size: 13, weight: 600 });
  // 송신 → FIFO 관 → 수신. 출구는 오른쪽이고 머리 패킷이 오른쪽 끝에 선다.
  const cy = ty + th / 2, inX = x, outX = x + pw;
  g.text(inX, ty - 10, '송신', { size: 11, weight: 600, color: C.muted });
  g.text(outX, ty - 10, '수신', { size: 11, weight: 600, align: 'right', color: C.muted });
  arrow(g, { x: inX, y: cy }, { x: tx - 3, y: cy }, { stroke: C.line, lw: 1.3, size: 6 });
  arrow(g, { x: tx + tubeW + 3, y: cy }, { x: outX, y: cy }, { stroke: C.line, lw: 1.3, size: 6 });
  g.rect(tx, ty, tubeW, th, { r: 9, fill: C.bg, stroke: C.ink, lw: 1.4 });
  g.text(tx + tubeW / 2, ty + th + 16, 'FIFO 큐', { size: 11, align: 'center', color: C.muted });
  const slotX = (j: number) => tx + gap + j * (slot + gap) + slot / 2;
  for (let j = 0; j < cap; j++) g.rect(slotX(j) - slot / 2, ty + 5, slot, slot, { r: 6, fill: C.paper, stroke: C.grid, lw: 1 });
  // 앞 패킷이 나가면 뒤 패킷이 한 칸씩 당겨진다(처리 사건 뒤 300ms 이동)
  const lastOut = s.processed.length ? 3600 + (s.processed.length - 1) * 1200 : -1;
  const shift = lastOut >= 0 ? 1 - ease.out(span(t, lastOut, lastOut + 300)) : 0;
  // 출력 중인 머리 패킷은 관 밖으로 이동 중이므로 칸에는 그리지 않는다
  s.queued.forEach((id, k) => { if (t >= arrivalTimes[id - 1] && !(k === 0 && s.output > 0)) token(g, slotX(cap - 1 - k) - (slot + gap) * shift, cy, id, id === 6 ? 'orange' : 'blue', { r: 10 }); });
  // 도착 중인 패킷: [도착-400, 도착] 동안 왼쪽에서 관 입구(받으면 빈 칸)로
  arrivalTimes.forEach((at, i) => {
    if (t < at - 400 || t >= at) return;
    const q = ease.inOut(span(t, at - 400, at)), tx2 = i < cap ? slotX(cap - 1 - i) : tx + 6;
    token(g, lerp(inX + 8, tx2, q), cy, i + 1, i === 5 ? 'orange' : 'blue', { r: 10 });
  });
  // 아래 왼쪽: 손실 칸(가득 찬 입구에서 떨어진다), 아래 오른쪽: 수신 칸(처리된 순서)
  const ly = ty + th + 34;
  g.text(x, ly - 14, '손실', { size: 11, weight: 600, color: s.dropped.length ? C.redText : C.muted });
  g.text(outX, ly - 14, '수신 순서', { size: 11, weight: 600, align: 'right', color: s.processed.length ? C.greenText : C.muted });
  s.dropped.forEach((id, i) => {
    const at = arrivalTimes[id - 1], q = ease.out(span(t, at, at + 300));
    token(g, lerp(tx + 6, x + 12 + i * 24, q), lerp(cy, ly + 4, q), id, 'red', { r: 10, dash: [3, 2] });
  });
  s.processed.forEach((id, i) => {
    const out = 3600 + i * 1200, q = ease.out(span(t, out, out + 300)), px = outX - 12 - (s.processed.length - 1 - i) * 24;
    token(g, lerp(outX - 12, px, q), lerp(cy, ly + 4, q), id, id === 6 ? 'orange' : 'green', { r: 10 });
  });
  // 나가는 패킷: 출력 진행률만큼 관 출구에서 수신 쪽으로
  if (s.output > 0 && s.output < 1 && s.queued.length) {
    const head = s.queued[0];
    token(g, lerp(slotX(cap - 1), outX - 12, ease.inOut(s.output)), cy, head, head === 6 ? 'orange' : 'blue', { r: 10 });
  }
  // 6번 앞의 대기 패킷 수
  const pos = s.queued.indexOf(6);
  if (pos > 0) {
    const x1 = slotX(cap - pos) - slot / 2, x2 = slotX(cap - 1) + slot / 2;
    g.path(`M${x1} ${ty - 5}V${ty - 10}H${x2}V${ty - 5}`, { stroke: C.orange, lw: 1.3 });
    label(g, (x1 + x2) / 2, ty - 14, `6번 앞 ${pos}개`, { size: 11, weight: 600, color: C.orangeText });
  }
  const by = ly + 44;
  g.text(x, by, `유입 ${s.arrived} · 대기 ${s.queued.length}`, { size: 12 });
  g.text(x, by + 22, `처리 ${s.processed.length} · 손실 ${s.dropped.length}`, { size: 12, weight: 600, color: s.dropped.length ? C.redText : C.greenText });
  if (s.dropped.length) g.text(x + pw, by + 22, `× ${s.dropped.join(', ')}`, { size: 12, mono: true, align: 'right', color: C.redText });
  return by + 30 - y;
}
function queueV2(w: number, t: number): LessonFrame {
  const g = draw(), { cols, pw } = twoUp(w);
  const h1 = queuePanel(g, 0, 0, pw, t, 2);
  const h2 = queuePanel(g, cols === 2 ? pw + 28 : 0, cols === 2 ? 0 : h1 + 34, pw, t, 6);
  if (cols === 1) g.line(0, h1 + 14, w, h1 + 14, { stroke: C.grid, lw: 1 });
  const s = queueState(t, 6);
  const status = t < 3200 ? '같은 패킷이 같은 시점에 두 큐로 들어갑니다.' : t < 9600 ? `큰 큐의 6번 요청: ${s.processed.includes(6) ? '처리 완료' : '앞선 패킷이 나가기를 기다리는 중'}. 작은 큐에서는 이미 손실됐습니다.` : '작은 큐는 4개를 잃고, 큰 큐는 6번 요청까지 순서대로 전달합니다.';
  return frame(g, (cols === 2 ? Math.max(h1, h2) : h1 + 34 + h2) + 6, status);
}

/* ---------- T01 교착: 락은 점유자에게 붙고, 대기는 점선으로 남는다 ---------- */
function lockV2(w: number, t: number): LessonFrame {
  const g = draw(), s = lockState(t), bw = Math.min(132, (w - 40) / 2), L = 0, R = w - bw, ty = 8, ly = 250;
  const thread = (x: number, name: 'exec-5' | 'exec-6') => {
    const waiting = s.waits[name], own = (Object.keys(s.owners) as ('L1' | 'L2')[]).find(k => s.owners[k] === name);
    const stroke = waiting ? (s.deadlock ? C.red : C.orange) : C.ink;
    g.rect(x, ty, bw, 66, { r: 14, fill: waiting ? (s.deadlock ? C.redTint : C.orangeTint) : C.paper, stroke, lw: 1.5 });
    g.circle(x + 16, ty + 22, 4.5, { fill: waiting ? C.faint : C.green });
    g.text(x + 28, ty + 27, name, { size: 13, weight: 700, mono: true });
    g.text(x + 14, ty + 52, waiting ? 'BLOCKED' : own ? `${own} 점유` : 'RUNNABLE', { size: 12, weight: 600, color: waiting ? (s.deadlock ? C.redText : C.orangeText) : own ? C.blueText : C.muted });
    // 보유한 락: 획득 시각부터 스레드 오른쪽 위에 붙는다(대기 중에도 놓지 않는다)
    if (own) { const a = appear(t, own === 'L1' ? 1200 : 2600); lockGlyph(g, x + bw - 34, ty + 15, C.blue, { alpha: a }); g.text(x + bw - 20, ty + 27, own, { size: 12, weight: 700, mono: true, color: C.blueText, alpha: a }); }
    return own;
  };
  const lock = (x: number, name: 'L1' | 'L2', addr: string) => {
    const owner = s.owners[name];
    g.rect(x, ly, bw, 66, { r: 8, fill: owner ? C.blueTint : C.paper, stroke: owner ? C.blue : C.line, lw: 1.4 });
    lockGlyph(g, x + 12, ly + 13, owner ? C.blue : C.faint, { s: 1.2 });
    g.text(x + 30, ly + 27, `${name} · ${addr}`, { size: 12, weight: 700, mono: true });
    g.text(x + 12, ly + 52, owner ?? '비어 있음', { size: 12, color: owner ? C.blueText : C.muted });
  };
  thread(L, 'exec-5'); thread(R, 'exec-6');
  lock(L, 'L1', '…b1e8'); lock(R, 'L2', '…b1f8');
  const cyc = s.deadlock;
  // 점유: 락 → 점유자(실선). 획득 시각에 0에서 나타난다
  if (s.owners.L1) arrow(g, { x: L + bw * 0.3, y: ly - 2 }, { x: L + bw * 0.3, y: ty + 70 }, { stroke: cyc ? C.red : C.blue, lw: 2, alpha: appear(t, 1200) });
  if (s.owners.L2) arrow(g, { x: R + bw * 0.7, y: ly - 2 }, { x: R + bw * 0.7, y: ty + 70 }, { stroke: cyc ? C.red : C.blue, lw: 2, alpha: appear(t, 2600) });
  // 대기: 스레드 → 기다리는 락(점선). 움직이는 점을 두지 않아 락 반환처럼 보이지 않게 한다
  if (s.waits['exec-5']) arrow(g, { x: L + bw * 0.75, y: ty + 70 }, { x: R + bw * 0.25, y: ly - 4 }, { stroke: cyc ? C.red : C.orange, lw: 1.8, dash: [6, 4], alpha: appear(t, 3600) });
  if (s.waits['exec-6']) arrow(g, { x: R + bw * 0.25, y: ty + 70 }, { x: L + bw * 0.75, y: ly - 4 }, { stroke: C.red, lw: 1.8, dash: [6, 4], alpha: appear(t, 4600) });
  const my = (ty + 66 + ly) / 2;
  g.rect(w / 2 - 44, my - 15, 88, 30, { r: 15, fill: C.paper, stroke: cyc ? C.red : C.line, lw: cyc ? 1.8 : 1.2 });
  g.text(w / 2, my + 4.5, cyc ? '순환 대기' : '락 요청', { size: 12, weight: 700, align: 'center', color: cyc ? C.redText : C.muted });
  g.line(0, ly + 88, 26, ly + 88, { stroke: C.blue, lw: 2 });
  g.text(34, ly + 92, '실선: 락 → 점유자', { size: 12, color: C.blueText });
  g.line(0, ly + 114, 26, ly + 114, { stroke: C.orange, lw: 1.8, dash: [6, 4] });
  g.text(34, ly + 118, '점선: 스레드 → 기다리는 락', { size: 12, color: C.orangeText });
  return frame(g, ly + 126, s.phase);
}

/* ---------- D03 복합 인덱스: 읽기 커서가 표 위를 지나가며 연속 범위와 전체 확인을 구분 ---------- */
function indexPanel(g: G, x: number, y: number, pw: number, t: number, order: 'employee' | 'time') {
  const s = indexState(t, order), emp = order === 'employee', rh = 34, top = y + 52, cx = x + 22;
  g.text(x, y + 14, emp ? '(employee_id, time)' : '(time, employee_id)', { size: 13, weight: 600, mono: true });
  g.text(cx + 10, y + 42, emp ? 'employee_id' : 'time', { size: 11, color: C.muted });
  g.text(x + pw - 12, y + 42, emp ? 'time' : 'id', { size: 11, align: 'right', color: C.muted });
  g.rect(cx, top, pw - 22, rh * 5, { r: 8, fill: C.paper, stroke: C.line, lw: 1.2 });
  s.rows.forEach((row, i) => {
    const yy = top + i * rh, visited = s.visited.includes(i), match = visited && row[0] === 2;
    if (i) g.line(cx + 1, yy, x + pw - 1, yy, { stroke: C.grid, lw: 1 });
    if (visited) g.rect(cx + 2, yy + 2, pw - 26, rh - 4, { r: 6, fill: match ? C.greenTint : C.slab });
    g.text(cx + 10, yy + 22, emp ? row[0] : row[1], { size: 12, mono: true, weight: emp && row[0] === 2 ? 700 : 400, color: match ? C.greenText : C.ink });
    g.text(x + pw - 12, yy + 22, emp ? row[1] : row[0], { size: 12, mono: true, weight: !emp && row[0] === 2 ? 700 : 400, align: 'right', color: match ? C.greenText : C.ink });
  });
  // 연속 범위: 선두 열이 employee_id이면 값 2가 붙어 있다
  if (emp) { const a = top + rh + 3, b = top + rh * 3 - 3; g.path(`M${x + pw + 4} ${a}H${x + pw + 9}V${b}H${x + pw + 4}`, { stroke: C.green, lw: 1.5 }); }
  if (emp) label(g, cx + (pw - 22) / 2, top + rh * 2 + 4, '값 2 연속 범위', { size: 11, weight: 600, color: C.greenText, bg: C.paper });
  // 읽기 커서: k번째 행 읽기는 1400 + k·1100에 끝난다. 커서는 그 직전 300ms 동안 이동해 도착한다
  const scan = emp ? [1, 2] : [0, 1, 2, 3, 4];
  if (s.read > 0 || t >= 1100) {
    const k = Math.min(s.read, scan.length - 1), at = 1400 + k * 1100, prev = k ? scan[k - 1] : scan[0], next = scan[k];
    const done = s.read >= scan.length, row = done ? scan[scan.length - 1] : lerp(prev, next, ease.inOut(span(t, at - 300, at)));
    const yy = top + row * rh + rh / 2;
    g.path(`M${x + 2} ${yy - 6}L${x + 12} ${yy}L${x + 2} ${yy + 6}Z`, { fill: done ? C.green : C.orange });
  }
  g.text(x, top + rh * 5 + 28, `읽은 행 ${s.read} · 결과 ${s.matches.length}`, { size: 13, weight: 600 });
  g.text(x, top + rh * 5 + 50, s.phase, { size: 12, color: C.muted });
  const fin = s.read === scan.length;
  g.text(x, top + rh * 5 + 72, fin ? '결과: 01-13 · 10-04' : '조건: employee_id = 2', { size: 12, weight: fin ? 600 : 400, color: fin ? C.greenText : C.muted });
  return top + rh * 5 + 80 - y;
}
function indexV2(w: number, t: number): LessonFrame {
  const g = draw(), { cols, pw } = twoUp(w), inner = cols === 2 ? pw - 12 : pw - 12;
  const h = indexPanel(g, 0, 0, inner, t, 'employee');
  indexPanel(g, cols === 2 ? pw + 28 : 0, cols === 2 ? 0 : h + 28, inner, t, 'time');
  if (cols === 1) g.line(0, h + 12, w, h + 12, { stroke: C.grid, lw: 1 });
  return frame(g, (cols === 2 ? h : h * 2 + 28) + 4, t < 3500 ? '선두 열의 값 2는 연속된 범위에 모여 있습니다.' : '찾는 행은 같습니다. 열 순서에 따라 확인하는 범위가 달라집니다.');
}

/* ---------- W03 Proxy cache: 저장소가 있는 proxy, 저장되는 응답과 재사용 경로 ---------- */
function cacheV2(w: number, t: number): LessonFrame {
  const g = draw(), s = cacheState(t), vertical = w < 480;
  const nodeW = vertical ? Math.min(w, 220) : 108, proxyW = vertical ? Math.min(w, 260) : Math.min(210, w - 2 * nodeW - 120);
  const cx = vertical ? [w / 2, w / 2, w / 2] : [nodeW / 2, w / 2, w - nodeW / 2], cy = vertical ? [26, 170, 330] : [70, 70, 70];
  const hh = [52, vertical ? 96 : 104, 52];
  const box = (i: number) => ({ x: cx[i] - (i === 1 ? proxyW : nodeW) / 2, y: cy[i] - hh[i] / 2, w: i === 1 ? proxyW : nodeW, h: hh[i] });
  // 클라이언트: 브라우저 창
  const c0 = box(0);
  g.rect(c0.x, c0.y, c0.w, c0.h, { r: 8, fill: C.paper, stroke: C.ink, lw: 1.3 });
  g.line(c0.x + 1, c0.y + 14, c0.x + c0.w - 1, c0.y + 14, { stroke: C.ink, lw: 1 });
  for (let i = 0; i < 3; i++) g.circle(c0.x + 9 + i * 7, c0.y + 7.5, 2, { fill: C.faint });
  g.text(cx[0], c0.y + 38, 'Client', { size: 12, weight: 600, align: 'center' });
  // origin: 서버
  const c2 = box(2), oDim = t >= 5600;
  serverGlyph(g, c2.x, c2.y, c2.w, c2.h, { alpha: oDim ? 0.55 : 1 });
  g.text(cx[2], c2.y + c2.h + 18, 'Origin', { size: 12, weight: 600, align: 'center', color: oDim ? C.muted : C.ink });
  // proxy: 안에 저장 칸이 있다
  const c1 = box(1);
  g.rect(c1.x, c1.y, c1.w, c1.h, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.4 });
  g.text(c1.x + 12, c1.y + 20, 'Proxy cache', { size: 12, weight: 700 });
  const sx = c1.x + 12, sy = c1.y + 32, sw = c1.w - 24, sh = c1.h - 44;
  const stored = s.stored, a = appear(t, 3800);
  g.rect(sx, sy, sw, sh, { r: 7, fill: stored ? C.greenTint : C.paper, stroke: stored ? C.green : C.line, lw: 1.2, dash: stored ? null : [3, 3] });
  if (stored) {
    fileGlyph(g, sx + 8, sy + (sh - 18) / 2, { color: C.green, alpha: a });
    g.text(sx + 30, sy + sh / 2 - 2, '200 · public', { size: 12, weight: 700, mono: true, color: C.greenText, alpha: a });
    g.text(sx + 30, sy + sh / 2 + 15, 'max-age=600', { size: 11, mono: true, color: C.muted, alpha: a });
  } else g.text(sx + sw / 2, sy + sh / 2 + 4, '저장 응답 없음', { size: 11, align: 'center', color: C.muted });
  // 조회 결과 표시: 첫 조회 MISS(1800), 두 번째 HIT(6400)
  const badge = t >= 6400 ? ['HIT', 'green'] as const : t >= 1800 ? ['MISS', 'orange'] as const : null;
  if (badge) pill(g, c1.x + c1.w - 30, c1.y, badge[0], { size: 11, h: 20, fill: TONE[badge[1]].tint, stroke: TONE[badge[1]].line, color: TONE[badge[1]].text, alpha: appear(t, badge[0] === 'HIT' ? 6400 : 1800) });
  // 경로: 요청은 바깥 줄, 응답은 안쪽 줄
  const edge = (from: number, to: number, off: number): [Pt, Pt] => {
    const A = box(from), B = box(to);
    if (vertical) { const down = to > from; return [{ x: cx[from] + off, y: down ? A.y + A.h + 2 : A.y - 2 }, { x: cx[to] + off, y: down ? B.y - 4 : B.y + B.h + 4 }]; }
    const right = to > from; return [{ x: right ? A.x + A.w + 2 : A.x - 2, y: cy[from] + off }, { x: right ? B.x - 4 : B.x + B.w + 4, y: cy[to] + off }];
  };
  const req = vertical ? -26 : -16, res = vertical ? 26 : 16;
  route(g, t, ...edge(0, 1, req), 1100, 1800, 'blue', 'GET');
  route(g, t, ...edge(1, 2, req), 1800, 2500, 'blue', 'GET', { dim: oDim });
  route(g, t, ...edge(2, 1, res), 3000, 3800, 'green', '200', { dim: oDim });
  route(g, t, ...edge(1, 0, res), 3800, 4600, 'green', '200', { keep: t < 5600 });
  if (t >= 5600) {
    route(g, t, ...edge(0, 1, req), 5600, 6400, 'orange', 'GET');
    // 두 번째 응답은 저장 칸에서 나온다
    const [p, q] = edge(1, 0, res);
    route(g, t, p, q, 6400, 7200, 'green', '200');
  }
  // 첫 응답 본문이 다 도착해야 저장한다: 헤더만으로는 HIT가 되지 않는다
  const bottom = vertical ? cy[2] + 26 + 50 : cy[0] + 52 + 34;
  g.text(w / 2, bottom, t < 5600 ? '① 첫 요청 · MISS' : t < 6400 ? '② 같은 키 · 조회' : '② 같은 키 · HIT', { size: 13, weight: 600, align: 'center' });
  let y = bottom + 34;
  g.text(0, y, 'GET /app.css', { size: 12, weight: 700, mono: true });
  g.text(0, y + 24, `저장 응답 ${s.stored ? '200 · public' : '없음'}`, { size: 12, color: s.stored ? C.greenText : C.muted });
  g.text(0, y + 48, `X-Proxy-Cache: ${s.hit ? 'HIT' : t >= 1800 ? 'MISS' : '—'}`, { size: 12, weight: 700, mono: true, color: s.hit ? C.greenText : C.orangeText });
  y = para(g, 0, y + 72, `클라이언트 요청 ${s.clientRequests} · 원본 요청 ${s.originRequests}`, w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- S03 Spark: lineage는 먼저 등록되고, action 뒤에 partition 원소가 단계별로 계산된다 ---------- */
function sparkV2(w: number, t: number): LessonFrame {
  const g = draw(), s = sparkState(t), wide = w >= 560, names = ['Parent RDD', 'map(x × 2)', 'filter(x ≥ 8)', 'count()'], reg = [0, 1200, 2600, 4200];
  // lineage: 논리 연산 체인
  g.text(0, 14, '논리 연산 · lineage', { size: 12, weight: 600, color: C.muted });
  const nw = wide ? (w - 3 * 22) / 4 : (w - 3 * 10) / 4, ny = 26;
  names.forEach((n, i) => {
    if (t < reg[i]) { g.rect(i * (nw + (wide ? 22 : 10)), ny, nw, 34, { r: 8, stroke: C.grid, lw: 1, dash: [3, 3] }); return; }
    const a = appear(t, reg[i]), x = i * (nw + (wide ? 22 : 10)), done = (i === 1 && s.mapped) || (i === 2 && s.filtered) || (i === 3 && s.result !== null);
    g.rect(x, ny, nw, 34, { r: 8, fill: done ? C.greenTint : C.paper, stroke: i === 3 ? C.green : C.blue, lw: 1.3, alpha: a });
    const rows = wide ? [n] : wrap(n, nw - 6, 11, true);
    rows.forEach((r, j) => g.text(x + nw / 2, ny + 21 + (j - (rows.length - 1) / 2) * 13, r, { size: wide ? 12 : 11, mono: true, weight: 600, align: 'center', alpha: a }));
    if (i) arrow(g, { x: x - (wide ? 20 : 9), y: ny + 17 }, { x: x - 2, y: ny + 17 }, { stroke: C.blue, lw: 1.3, dash: [3, 3], alpha: a, size: 5 });
  });
  const banner = s.executed ? 'action 호출 · 계산 시작' : 'lineage 등록 · 처리 대기';
  g.text(0, ny + 62, banner, { size: 13, weight: 700, color: s.executed ? C.greenText : C.muted });
  // partition 격자: 열 = 입력·map·filter·count (넓은 폭) / 행 = 단계 (좁은 폭)
  const top = ny + 84, stages = ['입력', 'map', 'filter', 'count'], at = [0, 5600, 7000, 8400];
  const cellW = wide ? nw : w - 70, cellH = 40, partH = wide ? 52 : 4 * (cellH + 6) + 26;
  const cell = (p: number, st: number) => wide ? { x: st * (nw + 22), y: top + 22 + p * partH } : { x: 64, y: top + 26 + p * partH + st * (cellH + 6) };
  for (let p = 0; p < 2; p++) {
    const base = cell(p, 0);
    g.text(wide ? 0 : 0, wide ? base.y - 6 : base.y - 10, `Partition ${p + 1}`, { size: 12, weight: 700, color: C.muted });
    for (let st = 0; st < 4; st++) {
      const c = cell(p, st);
      if (!wide) g.text(0, c.y + 25, stages[st], { size: 11, mono: true, color: C.muted });
      g.rect(c.x, c.y, cellW, cellH, { r: 8, fill: st && t >= at[st] ? C.paper : C.bg, stroke: C.line, lw: 1 });
      if (st && t < at[st] - 400) g.text(c.x + cellW / 2, c.y + 24, s.executed ? '대기' : '계산 전', { size: 11, align: 'center', color: C.muted });
    }
    // 원소 칩: 입력 → map(도착 5600에 두 배) → filter(7000에 조건 밖 원소 제외) → count(8400)
    const input = s.input[p], slot = (st: number, k: number) => { const c = cell(p, st); return { x: c.x + 20 + k * 30, y: c.y + cellH / 2 }; };
    input.forEach((v, k) => {
      token(g, slot(0, k).x, slot(0, k).y, v, 'ink');
      if (t >= 5200) {
        const q = ease.inOut(span(t, 5200, 5600)), arrived = t >= 5600, P = hop(slot(0, k), slot(1, k), q, 26);
        token(g, P.x, P.y, arrived ? v * 2 : v, arrived ? 'blue' : 'muted');
      }
      if (t >= 6600) {
        const keep = v * 2 >= 8, q = ease.inOut(span(t, 6600, 7000)), P = hop(slot(1, k), slot(2, keep ? input.filter(x => x * 2 >= 8).indexOf(v) : k), q, 26);
        if (keep || t < 7000) token(g, P.x, P.y, v * 2, keep && t >= 7000 ? 'green' : 'blue', { alpha: !keep && t >= 7000 ? 0 : 1 });
        else { const fade = 1 - appear(t, 7000, 400); if (fade > 0) { token(g, P.x, P.y, v * 2, 'muted', { alpha: fade }); cross(g, P.x, P.y, C.red, fade, 4); } }
      }
    });
    if (s.filtered && s.filtered[p].length === 0) { const c = cell(p, 2); g.text(c.x + cellW / 2, c.y + 24, '[]', { size: 12, mono: true, weight: 700, align: 'center', color: C.muted, alpha: appear(t, 7000) }); }
    if (t >= 8000) {
      const n = s.filtered ? s.filtered[p].length : 0, q = ease.inOut(span(t, 8000, 8400)), c = cell(p, 3);
      const c2 = cell(p, 2), P = hop({ x: c2.x + cellW - 12, y: c2.y + cellH / 2 }, { x: c.x + cellW / 2, y: c.y + cellH / 2 }, q, 26);
      if (t < 8400) token(g, P.x, P.y, n, 'green', { solid: false });
      else token(g, c.x + cellW / 2, c.y + cellH / 2, n, 'green', { solid: true });
    }
  }
  const end = top + 22 + (wide ? 2 * partH : 2 * partH) + 14;
  const sum = s.result === null ? '—' : `0 + 3 = ${s.result}`;
  g.text(0, end + 10, `Driver 결과 ${s.result === null ? '—' : s.result}`, { size: 15, weight: 700, color: s.result === null ? C.muted : C.greenText });
  if (s.result !== null) g.text(textW(`Driver 결과 ${s.result}`, 15) + 14, end + 10, sum, { size: 12, mono: true, color: C.muted, alpha: appear(t, 8400) });
  return frame(g, end + 22, s.phase);
}

export const lessonRenderers: Record<FigureId,(width:number,elapsed:number)=>LessonFrame>={N01:queueV2,N03:flowV2,W03:cacheV2,T01:lockV2,D03:indexV2,S03:sparkV2};
export function paintLesson(ctx:CanvasRenderingContext2D,frame:LessonFrame,w:number,dpr:number,font:string,monoFont:string=font){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,frame.height);for(const o of frame.ops){
 // Commands with opacity, caps or a second font are isolated so the four original commands paint exactly as before.
 if(o.type==='path'){ctx.save();ctx.globalAlpha=o.alpha;const p=new Path2D(o.d);if(o.fill!=='none'){ctx.fillStyle=o.fill;ctx.fill(p);}if(o.stroke!=='none'){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(o.dash??[]);ctx.stroke(p);}ctx.restore();continue;}
 if(o.type==='text'&&(o.mono||o.alpha!==undefined||o.weight!==undefined)){ctx.save();ctx.globalAlpha=o.alpha??1;ctx.fillStyle=o.color;ctx.font=`${o.weight??(o.bold?600:400)} ${o.size}px ${o.mono?monoFont:font}`;ctx.textAlign=o.align;ctx.fillText(o.text,o.x,o.y);ctx.restore();continue;}
 if(o.type==='circle'&&(o.stroke!==undefined||o.alpha!==undefined)){ctx.save();ctx.globalAlpha=o.alpha??1;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);if(o.color!=='none'){ctx.fillStyle=o.color;ctx.fill();}if(o.stroke&&o.stroke!=='none'){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth??1;ctx.stroke();}ctx.restore();continue;}
 if(o.type==='rect'){ctx.fillStyle=o.fill;ctx.fillRect(o.x,o.y,o.w,o.h);if(o.stroke!=='none'){ctx.strokeStyle=o.stroke;ctx.lineWidth=1;ctx.strokeRect(o.x+.5,o.y+.5,o.w-1,o.h-1);}}else if(o.type==='circle'){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle=o.color;ctx.fill();}else if(o.type==='line'){ctx.beginPath();ctx.strokeStyle=o.color;ctx.lineWidth=1.5;ctx.setLineDash(o.dash?[4,4]:[]);ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();ctx.setLineDash([]);}else{ctx.fillStyle=o.color;ctx.font=`${o.bold?600:400} ${o.size}px ${font}`;ctx.textAlign=o.align;ctx.fillText(o.text,o.x,o.y);}}}
