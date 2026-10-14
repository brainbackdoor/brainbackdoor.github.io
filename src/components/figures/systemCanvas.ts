import { FIGURE_COLORS as F } from './figurePalette';
import { cubicBezier, roundedRectPath, span, type DrawOp, type LessonFrame } from './lessonCanvas';
import { systemState as state, type SystemFigureId, type SystemModels } from './system-models';

/* B04 도해: 승인된 v2 시안(2026-10-14)의 형태. 의미 값은 system-models의 사건 모델에서 읽고, 여기서는 위치·선의 전개·강조만 계산한다. */
type Pt = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Opt = Record<string, any>;
type Zones = readonly (readonly [number, string])[];
type TrackSeg = { a: number; b: number; label: string; kind: 'run' | 'wait' | 'idle' | 'done' };
type State<K extends SystemFigureId> = ReturnType<SystemModels[K]>;
const C: Record<string, string> = {
  ink: F.text, muted: F.muted, faint: F.faint, line: F.line, grid: F.grid, bg: F.plot, slab: F.slab, paper: F.bg,
  blue: F.blue, blueText: F.blueText, blueTint: F.blueTint, blueSoft: F.blueSoft,
  green: F.green, greenText: F.greenText, greenTint: F.greenTint,
  orange: F.orange, orangeText: F.orangeText, orangeTint: F.orangeTint,
  red: F.red, redText: F.redText, redTint: F.redTint,
};
function draw() {
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
type G = ReturnType<typeof draw>;
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
// CSS cubic-bezier와 같은 해석: 입력 진행률에 해당하는 x의 매개변수를 먼저 찾고 y를 구한다.
// 두 곡선 모두 출력이 0..1 안에 있는 단조 곡선이다.
const ease = { out: cubicBezier(0.2, 0.7, 0.3, 1), inOut: cubicBezier(0.45, 0, 0.25, 1) };
const lerp = (a: number, b: number, q: number) => a + (b - a) * q;
const lerpPt = (p: Pt, q: Pt, u: number): Pt => ({ x: lerp(p.x, q.x, u), y: lerp(p.y, q.y, u) });
const angle = (p: Pt, q: Pt) => Math.atan2(q.y - p.y, q.x - p.x);

/* ---------- 그리기 명령: Canvas와 SVG가 같은 좌표를 읽는다 ---------- */
const f2 = (n: number) => Math.round(n * 100) / 100;
// 정적 생성과 Canvas가 같은 줄바꿈을 얻도록 실제 측정 대신 고정 폭 규칙을 사용한다.
function textW(s: string | number, size: number, mono?: boolean) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if ((c ?? 0) >= 0x1100) n += mono ? 1 : 0.94;
    else if (mono) n += 0.6;
    else if (' .,:;·|!il\'"()[]'.includes(ch)) n += 0.3;
    else if (/[A-Z0-9mwMW+=→]/.test(ch)) n += 0.64;
    else n += 0.52;
  }
  return n * size;
}
function wrap(s: string, maxW: number, size: number, mono?: boolean) {
  const out = [];
  let line = '';
  for (const word of String(s).split(' ')) {
    const cand = line ? line + ' ' + word : word;
    if (!line || textW(cand, size, mono) <= maxW) line = cand;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
function para(g: G, x: number, y: number, s: string, maxW: number, o: Opt = {}) {
  const size = o.size ?? 12, lh = o.lh ?? Math.round(size * 1.6);
  const rows = wrap(s, maxW, size, o.mono);
  rows.forEach((r, i) => g.text(x, y + i * lh, r, { ...o, size }));
  return y + (rows.length - 1) * lh;
}

/* ---------- 공통 형태 ---------- */
function arrowHead(g: G, p: Pt, ang: number, color: string, alpha = 1, size = 7) {
  const a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45;
  g.path(`M${f2(p.x + size * Math.cos(a1))} ${f2(p.y + size * Math.sin(a1))}L${f2(p.x)} ${f2(p.y)}L${f2(p.x + size * Math.cos(a2))} ${f2(p.y + size * Math.sin(a2))}Z`, { fill: color, stroke: color, lw: 1, alpha });
}
// 값 칩: 읽은 값·쓰는 값·저장된 값
const CHIP: Record<string, { fill: string; stroke: string; color: string }> = {
  read: { fill: C.paper, stroke: C.muted, color: C.ink },
  held: { fill: C.paper, stroke: C.blue, color: C.blueText },
  write: { fill: C.blue, stroke: C.blue, color: '#fff' },
  store: { fill: C.paper, stroke: C.line, color: C.ink },
  lost: { fill: C.redTint, stroke: C.red, color: C.redText },
};
function chip(g: G, cx: number, cy: number, text: string | number | null, kind: string, alpha = 1) {
  const st = CHIP[kind], label = text ?? '', w = Math.max(24, textW(label, 13, true) + 14), h = 22;
  g.rect(cx - w / 2, cy - h / 2, w, h, { r: 11, fill: st.fill, stroke: st.stroke, lw: 1.2, alpha });
  g.text(cx, cy + 4.5, label, { size: 13, weight: 600, mono: true, align: 'center', color: st.color, alpha });
  return w;
}
function pill(g: G, cx: number, cy: number, text: string, o: Opt = {}) {
  const w = textW(text, 12) + 22, h = 26;
  g.rect(cx - w / 2, cy - h / 2, w, h, { r: 13, fill: o.fill ?? C.bg, stroke: o.stroke ?? C.line, lw: 1 });
  g.text(cx, cy + 4, text, { size: 12, weight: 600, align: 'center', color: o.color ?? C.ink });
  return w;
}
function lockGlyph(g: G, x: number, y: number, color: string, o: Opt = {}) {
  // x,y: 왼쪽 위. 기본 너비 11, 높이 13(s배). open이면 고리를 들어 올린다.
  const k = o.s ?? 1, lift = o.open ? 3 * k : 0;
  if (o.patch) g.rect(x - 3, y - 3 - lift, 11 * k + 6, 13 * k + 6 + lift, { r: 3, fill: C.paper });
  g.path(`M${f2(x + 2.5 * k)} ${f2(y + 6 * k - lift)}V${f2(y + 3.5 * k - lift)}A${f2(3 * k)} ${f2(3 * k)} 0 0 1 ${f2(x + 8.5 * k)} ${f2(y + 3.5 * k - lift)}V${f2(y + 6 * k - (o.open ? lift + 2 * k : 0))}`, { stroke: color, lw: 1.4 * Math.sqrt(k) });
  g.rect(x, y + 6 * k, 11 * k, 7 * k, { r: 1.5 * k, fill: color });
}
function fileGlyph(g: G, x: number, y: number, name: string | null, o: Opt = {}) {
  const color = o.color ?? C.ink, alpha = o.alpha ?? 1;
  g.path(`M${f2(x)} ${f2(y)}H${f2(x + 9)}L${f2(x + 14)} ${f2(y + 5)}V${f2(y + 18)}H${f2(x)}Z`, { fill: o.fill ?? C.paper, stroke: color, lw: 1.3, alpha });
  g.path(`M${f2(x + 9)} ${f2(y)}V${f2(y + 5)}H${f2(x + 14)}`, { stroke: color, lw: 1.1, alpha });
  if (name) g.text(x + 20, y + 14, name, { size: 12, mono: true, color: o.text ?? C.ink, alpha });
}

/* ---------- T04 공유 counter: 실행 레인·읽은 값·공유 저장소·monitor 경계 ---------- */
// 사건 시각은 system-review.js의 T04 모델과 같다. 화살표는 [사건-260ms, 사건]에 이동해 사건 시각에 도착한다.
const T04: { d: number; t0: number; t1: number; ev: Record<'race' | 'sync', Record<'A' | 'B', readonly [number, number]>> } = {
  d: 260, t0: 1100, t1: 4100,
  ev: { race: { A: [1700, 3100], B: [2400, 3800] }, sync: { A: [1700, 2300], B: [2800, 3500] } },
};
function counterPanel(g: G, ox: number, oy: number, pw: number, kind: 'race' | 'sync', t: number, narrow: boolean, k: number) {
  const mk = kind === 'race' ? 'race' : 'synchronized';
  const m = state('T04', t)[mk], ev = T04.ev[kind], d = T04.d;
  const lane: Record<'A' | 'B', number> = { A: ox + pw * 0.13, B: ox + pw * 0.87 }, xs = ox + pw * 0.5;
  const top = oy + 108, Y = (tt: number) => top + (tt - T04.t0) * k, bottom = Y(T04.t1);
  const bw = narrow ? 16 : 18, tEnd = ev.B[1], done = t >= tEnd;
  const valueAt = (tt: number) => state('T04', tt)[mk];

  g.text(ox, oy + 15, kind === 'race' ? '동기화 없음' : 'monitor로 read·+1·write 직렬화', { size: 13, weight: 600 });

  // 경쟁: 두 요청이 같은 0을 함께 보관하는 구간
  if (kind === 'race' && t >= ev.B[0]) {
    const q = ease.out(span(t, ev.B[0], ev.B[0] + 300));
    g.rect(ox, Y(ev.B[0]), pw, Y(Math.min(t, ev.A[1])) - Y(ev.B[0]), { r: 0, fill: C.redTint, alpha: q });
    g.text(xs + 10, Y(ev.B[0]) + 17, '같은 0', { size: 12, weight: 600, color: C.redText, alpha: q });
  }
  // 현재 시점
  if (t >= T04.t0) {
    const fade = 1 - span(t, T04.t1, T04.t1 + 300);
    const yy = Y(Math.min(t, T04.t1));
    if (fade > 0) g.line(ox, yy, ox + pw, yy, { stroke: C.blueSoft, lw: 1, alpha: fade });
  }
  // 레인 머리와 생명선
  for (const who of ['A', 'B'] as const) {
    pill(g, lane[who], oy + 50, '요청 ' + who);
    g.line(lane[who], oy + 63, lane[who], bottom, { stroke: C.grid, lw: 1, dash: [3, 4] });
  }
  // 하나의 공유 저장소
  const sw = narrow ? 112 : 120, sh = 58, sx = xs - sw / 2, sy = oy + 34;
  const tone = done ? (kind === 'race' ? 'red' : 'green') : null;
  g.line(xs, sy + sh, xs, bottom, { stroke: C.grid, lw: 2 });
  if (t > T04.t0) g.line(xs, sy + sh, xs, Y(Math.min(t, T04.t1)), { stroke: C.line, lw: 2 });
  g.rect(sx, sy, sw, sh, { r: 8, fill: C.paper, stroke: tone ? C[tone] : C.ink, lw: tone ? 2 : 1.5 });
  g.text(xs, sy + 20, 'sharedCounter', { size: 12, mono: true, color: C.muted, align: 'center' });
  g.text(xs, sy + 47, m.value, { size: 22, weight: 700, mono: true, align: 'center', color: tone ? C[tone + 'Text'] : C.ink });
  chip(g, xs, Y(T04.t0) + 2, '0', 'store');

  // monitor 경계: 한 요청의 read·+1·write를 감싼다
  if (kind === 'sync') for (const who of ['A', 'B'] as const) {
    const [r, wr] = ev[who], a = r - d;
    if (t < a) continue;
    const x1 = who === 'A' ? lane.A - bw / 2 - 12 : xs - 18, x2 = who === 'A' ? xs + 18 : lane.B + bw / 2 + 12;
    const y1 = Y(a) - 7, y2 = Y(Math.min(t, wr)) + 7;
    g.rect(x1, y1, x2 - x1, y2 - y1, { r: 7, stroke: C.ink, lw: 1.2, dash: [4, 3], alpha: 0.75 });
    lockGlyph(g, who === 'A' ? x1 - 5 : x2 - 6, y1 - 7, C.ink, { patch: true });
  }
  // 실행 막대
  for (const who of ['A', 'B'] as const) {
    const [r, wr] = ev[who], a = r - d;
    if (t < a) continue;
    const x = lane[who], yb = Y(Math.min(t, wr));
    g.rect(x - bw / 2, Y(a), bw, Math.max(2, yb - Y(a)), { r: 4, fill: C.blueTint, stroke: t >= wr ? C.blueSoft : C.blue, lw: 1.2 });
  }
  // read: 저장소 → 레인, write: 레인 → 저장소
  for (const who of ['A', 'B'] as const) {
    const [r, wr] = ev[who], x = lane[who], side = who === 'A' ? 1 : -1, idx = who === 'A' ? 0 : 1;
    const readVal = valueAt(r).reads[idx], writeVal = valueAt(wr).value;
    const rf = { x: xs - side * 2, y: Y(r - d) }, rt = { x: x + side * (bw / 2 + 2), y: Y(r) };
    if (t >= r - d) {
      const q = span(t, r - d, r), tip = lerpPt(rf, rt, q);
      g.line(rf.x, rf.y, tip.x, tip.y, { stroke: C.faint, lw: 1.5 });
      if (q < 1) chip(g, tip.x, tip.y, readVal, 'read');
      else arrowHead(g, rt, angle(rf, rt), C.faint);
    }
    if (t >= r) chip(g, x, Y(r) + 14, readVal, 'held', ease.out(span(t, r, r + 180)));
    const wf = { x: x + side * (bw / 2 + 2), y: Y(wr - d) }, wt = { x: xs - side * 14, y: Y(wr) };
    if (t >= wr - d) {
      const q = span(t, wr - d, wr), tip = lerpPt(wf, wt, q);
      g.line(wf.x, wf.y, tip.x, tip.y, { stroke: C.blue, lw: 1.5 });
      if (q < 1) chip(g, tip.x, tip.y, writeVal, 'write');
      else arrowHead(g, wt, angle(wf, wt), C.blue);
    }
    if (t >= wr) {
      const lost = kind === 'race' && who === 'A' && t >= ev.B[1];
      const cw = chip(g, xs, Y(wr), writeVal, lost ? 'lost' : 'store', ease.out(span(t, wr, wr + 180)));
      if (lost) {
        const q = ease.out(span(t, ev.B[1], ev.B[1] + 260));
        g.line(xs - cw / 2 - 2, Y(wr) + 6, lerp(xs - cw / 2 - 2, xs + cw / 2 + 2, q), lerp(Y(wr) + 6, Y(wr) - 6, q), { stroke: C.red, lw: 1.6 });
        g.text(xs + cw / 2 + 6, Y(wr) + 4, '덮어씀', { size: 12, weight: 600, color: C.redText, alpha: q });
      }
    }
  }
  if (done) {
    const q = ease.out(span(t, tEnd, tEnd + 300));
    g.text(xs, bottom + 28, kind === 'race' ? `최종 ${m.value} · A의 +1이 사라짐` : `최종 ${m.value}`, { size: 12, weight: 600, align: 'center', color: kind === 'race' ? C.redText : C.greenText, alpha: q });
  }
  return bottom + 36;
}
function localStrip(g: G, ox: number, oy: number, w: number, t: number, s: State<'T04'>, narrow: boolean) {
  const titleEnd = para(g, ox, oy + 15, 'LocalCounterServlet · 요청마다 새 지역 변수', w, { size: 13, weight: 600, lh: 20 });
  // 각 요청의 스택 프레임 안에 localCounter가 따로 있다. 좁은 폭에서는 글자를 줄이지 않고 세로로 쌓는다.
  const fw = narrow ? w : 200, fh = 58, y = titleEnd + 15, flips = [3100, 3800];
  ['A', 'B'].forEach((who, i) => {
    const x = ox + (narrow ? 0 : i * (fw + 12)), yy = y + (narrow ? i * (fh + 10) : 0), v = s.locals[i];
    const flash = t >= flips[i] ? 1 - span(t, flips[i] + 200, flips[i] + 700) : 0;
    g.rect(x, yy, fw, fh, { r: 8, fill: C.bg, stroke: C.line });
    g.text(x + 12, yy + 22, '요청 ' + who + ' 스택', { size: 12, color: C.muted });
    g.text(x + 12, yy + 44, 'localCounter', { size: 12, mono: true, color: C.muted });
    const cw = 34, cx = x + fw - cw - 12;
    g.rect(cx, yy + 16, cw, 26, { r: 6, fill: C.paper, stroke: flash > 0 ? C.blue : C.line, lw: flash > 0 ? 1.6 : 1 });
    g.text(cx + cw / 2, yy + 34, v, { size: 15, weight: 700, mono: true, align: 'center' });
  });
  const note = '서로 다른 변수 · 1과 1을 공유 합계로 더하지 않음';
  if (narrow) return para(g, ox, y + 2 * fh + 10 + 24, note, w, { color: C.muted }) + 8;
  para(g, ox + 2 * (fw + 12) + 6, y + 26, note, w - 2 * (fw + 12) - 6, { color: C.muted });
  return y + fh + 8;
}
function counterV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T04', t), narrow = w < 560;
  const gap = 40, pw = narrow ? w : (w - gap) / 2, k = narrow ? 0.064 : 0.074;
  let y;
  if (narrow) {
    y = counterPanel(g, 0, 0, pw, 'race', t, narrow, k);
    g.line(0, y + 10, w, y + 10, { stroke: C.grid, lw: 1 });
    y = counterPanel(g, 0, y + 28, pw, 'sync', t, narrow, k);
  } else {
    y = counterPanel(g, 0, 0, pw, 'race', t, narrow, k);
    counterPanel(g, pw + gap, 0, pw, 'sync', t, narrow, k);
    g.line(pw + gap / 2, 0, pw + gap / 2, y - 10, { stroke: C.grid, lw: 1 });
  }
  g.line(0, y + 10, w, y + 10, { stroke: C.grid, lw: 1 });
  y = localStrip(g, 0, y + 26, w, t, s, narrow);
  return { ops: g.ops, height: Math.ceil(y + 6), status: s.phase };
}

/* ---------- C04 이미지 레이어: 같은 읽기 전용 층 위의 쓰기 계층, commit으로 생긴 새 층 ---------- */
// 사건 시각은 C04 모델(newfile 2,800 / commit 5,200 / newfile2 6,500)과 같다.
const C04 = { write: 2800, commit: 5200, write2: 6500, drop: 400, arrow: [4500, 4800], copy: 4800 };
function bracket(g: G, x: number, y1: number, y2: number, side: number, color: string, q = 1) {
  if (q <= 0) return;
  const ye = lerp(y1, y2, q);
  g.path(`M${f2(x + side * 6)} ${f2(y1)}H${f2(x)}V${f2(ye)}${q >= 1 ? `H${f2(x + side * 6)}` : ''}`, { stroke: color, lw: 1.5 });
}
const pulse = (t: number, at: number, len = 500) => t >= at && t < at + len ? 1 - span(t, at + 120, at + len) : 0;
function layersV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C04', t), narrow = w < 560;
  const pad = narrow ? 14 : 22, gap = narrow ? 36 : 132, colW = (w - 2 * pad - gap) / 2;
  const lx = pad, rx = w - pad - colW, topY = 40, topH = narrow ? 104 : 92;
  const baseY = topY + topH + 10, slabH = 36, slabGap = 6, baseBottom = baseY + 3 * slabH + 2 * slabGap;
  const slots = narrow ? [{ x: lx + 12, y: topY + 36 }, { x: lx + 12, y: topY + 70 }] : [{ x: lx + 14, y: topY + 44 }, { x: lx + 14 + (colW - 28) / 2, y: topY + 44 }];
  const bslot = narrow ? { x: rx + 12, y: topY + 36 } : { x: rx + 14, y: topY + 44 };
  const qB = s.newImageHasFile ? ease.out(span(t, C04.commit, C04.commit + 400)) : 0;

  g.text(lx, 18, 'container', { size: 13, weight: 600, color: C.blueText });
  if (s.newImageHasFile) g.text(rx + colW, 18, 'Image B', { size: 13, weight: 600, align: 'right', color: C.greenText, alpha: qB });
  bracket(g, pad - 10, topY, baseBottom, 1, C.blue);
  if (s.newImageHasFile) bracket(g, w - pad + 10, topY, baseBottom, -1, C.green, Math.max(qB, 0.001));

  // Image A: 아래 세 층. container와 Image B가 같은 층을 공유한다.
  ['Application', 'Libraries', 'Base OS'].forEach((name, i) => {
    const y = baseY + i * (slabH + slabGap);
    g.rect(lx, y, w - 2 * pad, slabH, { r: 6, fill: C.slab, stroke: C.line });
    g.text(lx + 12, y + 23, name, { size: 13 });
    lockGlyph(g, w - pad - 23, y + 11, C.muted);
  });
  g.path(`M${f2(lx)} ${f2(baseBottom + 4)}V${f2(baseBottom + 10)}H${f2(w - pad)}V${f2(baseBottom + 4)}`, { stroke: C.muted, lw: 1.3 });
  g.text(w / 2, baseBottom + 30, 'Image A · 읽기 전용 층', { size: 12, weight: 600, align: 'center', color: C.muted });
  if (s.newImageHasFile) g.text(w / 2, baseBottom + 48, '변경 없음', { size: 12, align: 'center', color: C.muted, alpha: qB });

  // container 쓰기 계층
  const flash = Math.max(pulse(t, C04.write), pulse(t, C04.write2));
  g.rect(lx, topY, colW, topH, { r: 8, fill: C.paper, stroke: C.blue, lw: 1.5 + flash, dash: flash > 0 ? null : [5, 4] });
  g.text(lx + 12, topY + 21, '쓰기 계층', { size: 12, weight: 600, color: C.blueText });
  ([[C04.write, 'newfile'], [C04.write2, 'newfile2']] as [number, string][]).forEach(([at, name], i) => {
    if (t < at - C04.drop) return;
    const q = ease.inOut(span(t, at - C04.drop, at));
    fileGlyph(g, slots[i].x, lerp(slots[i].y - 12, slots[i].y, q), name, { color: C.blue, alpha: span(t, at - C04.drop, at - C04.drop + 160) });
  });

  // Image B의 새 층: commit 전에는 옅은 가이드만
  if (!s.newImageHasFile) g.rect(rx, topY, colW, topH, { r: 8, stroke: C.line, lw: 1, dash: [3, 4] });
  else {
    g.rect(rx, topY, colW, topH, { r: 8, fill: C.greenTint, stroke: C.green, lw: 1.5, alpha: qB });
    g.text(rx + 12, topY + 21, narrow ? '새 층' : '새 읽기 전용 층', { size: 12, weight: 600, color: C.greenText, alpha: qB });
    lockGlyph(g, rx + colW - 23, topY + 10, C.greenText);
    fileGlyph(g, bslot.x, bslot.y, 'newfile', { color: C.greenText });
  }
  // commit: 쓰기 계층의 newfile을 새 층으로 복사. 원래 파일은 컨테이너에 남는다.
  const ay = topY + topH / 2 + (narrow ? 4 : 2), a0 = { x: lx + colW + 6, y: ay }, a1 = { x: rx - 6, y: ay };
  if (t >= C04.arrow[0]) {
    const q = ease.out(span(t, C04.arrow[0], C04.arrow[1])), tip = lerpPt(a0, a1, q);
    g.line(a0.x, a0.y, tip.x, tip.y, { stroke: s.newImageHasFile ? C.muted : C.ink, lw: 1.5 });
    if (q >= 1) arrowHead(g, a1, 0, s.newImageHasFile ? C.muted : C.ink);
    if (narrow) g.text(w / 2, 18, 'commit', { size: 12, weight: 600, align: 'center', alpha: q });
    else g.text((a0.x + a1.x) / 2, ay - 10, 'docker commit', { size: 12, weight: 600, align: 'center', mono: true, alpha: q });
  }
  if (t >= C04.copy && t < C04.commit) {
    const q = ease.inOut(span(t, C04.copy, C04.commit));
    fileGlyph(g, lerp(slots[0].x, bslot.x, q), lerp(slots[0].y, bslot.y, q), null, { color: C.green });
  }
  return { ops: g.ops, height: baseBottom + 58, status: s.phase };
}

/* ---------- T06 Virtual Thread: carrier 슬롯·VT 토큰·monitor·DB connection의 개별 소유 ---------- */
// 영역 변경 시각은 T06 모델의 carrier/소유자 경계와 같다. 토큰은 [변경-280ms, 변경]에 이동해 경계 시각에 도착한다.
const T06: { move: number; axis: readonly [number, number]; zones: Record<'VT1' | 'VT2', Record<21 | 24, Zones>> } = {
  move: 280, axis: [1000, 8600],
  zones: {
    VT1: { 21: [[0, 'ready'], [1100, 'carrier'], [5400, 'done']], 24: [[0, 'ready'], [1100, 'carrier'], [2600, 'io'], [5100, 'carrier'], [5400, 'done']] },
    VT2: { 21: [[0, 'absent'], [3000, 'ready'], [5400, 'carrier'], [5800, 'io'], [7800, 'carrier'], [8300, 'done']], 24: [[0, 'absent'], [3000, 'carrier'], [3400, 'ready'], [5400, 'carrier'], [5800, 'io'], [7800, 'carrier'], [8300, 'done']] },
  },
};
const zoneAt = (list: Zones, t: number) => list.reduce((z, [at, zone]) => t >= at ? zone : z, list[0][1]);
function tokenPos(list: Zones, t: number, P: Record<string, Pt>, move: number) {
  let i = 0;
  while (i + 1 < list.length && list[i + 1][0] <= t) i++;
  const hidden = (z: string) => z === 'absent' || z === 'done';
  let p = P[list[i][1]], alpha = hidden(list[i][1]) ? 0 : 1;
  const next = list[i + 1];
  if (next && t > next[0] - move) {
    const q = ease.inOut(span(t, next[0] - move, next[0]));
    p = lerpPt(p, P[next[1]], q);
    alpha = lerp(alpha, hidden(next[1]) ? 0 : 1, q);
  }
  return { x: p.x, y: p.y, alpha };
}
// 자원 점유 막대는 모델을 50ms 간격으로 읽어 만든다. 모든 사건 시각이 100ms 배수다.
type Seg = { key: string; a: number; b: number };
const jdk = (s: State<'T06'>, v: 21 | 24) => v === 21 ? s.jdk21 : s.jdk24;
const T06_SEG = (() => {
  const out: Record<number, Record<string, Seg[]>> = {};
  for (const v of [21, 24] as const) {
    const rows: Record<string, Seg[]> = { carrier: [], monitor: [], DB: [], 'VT2 대기': [] };
    const push = (arr: Seg[], tt: number, key: string | null) => { const last = arr[arr.length - 1]; if (last && last.key === key && last.b === tt) last.b = tt + 50; else if (key) arr.push({ key, a: tt, b: tt + 50 }); };
    for (let tt = 0; tt <= 12000; tt += 50) {
      const m = jdk(state('T06', tt), v);
      push(rows.carrier, tt, m.carrier ? m.carrier + (m.pinned ? ' pinned' : '') : null);
      push(rows.monitor, tt, m.monitorOwner);
      push(rows.DB, tt, m.dbOwner);
      // 기존 모델의 상태 문구 중 carrier를 쓰지 않는 구간만 자원 대기로 기록한다(I/O 대기는 제외)
      push(rows['VT2 대기'], tt, m.carrier !== 'VT2' && (m.vt2 === 'carrier 대기' || m.vt2 === 'DB 획득 대기') ? m.vt2.split(' ')[0] : null);
    }
    out[v] = rows;
  }
  return out;
})();
function dbGlyph(g: G, x: number, y: number, color: string) {
  // x,y: 위 타원의 중심
  g.path(`M${f2(x - 12)} ${f2(y)}V${f2(y + 18)}A12 4.5 0 0 0 ${f2(x + 12)} ${f2(y + 18)}V${f2(y)}`, { fill: C.paper, stroke: color, lw: 1.4 });
  g.path(`M${f2(x - 12)} ${f2(y)}A12 4.5 0 1 0 ${f2(x + 12)} ${f2(y)}A12 4.5 0 1 0 ${f2(x - 12)} ${f2(y)}Z`, { fill: C.paper, stroke: color, lw: 1.4 });
}
function vtToken(g: G, p: Pt & { alpha: number }, label: string, kind: 'run' | 'wait' | 'pre' | 'done') {
  if (p.alpha <= 0) return;
  const st = { run: [C.blue, C.blue, '#fff'], wait: [C.orangeTint, C.orange, C.orangeText], pre: [C.paper, C.line, C.muted], done: [C.greenTint, C.green, C.greenText] }[kind];
  g.rect(p.x - 21, p.y - 12, 42, 24, { r: 12, fill: st[0], stroke: st[1], lw: 1.3, alpha: p.alpha });
  g.text(p.x, p.y + 4.5, label, { size: 12, weight: 700, mono: true, align: 'center', color: st[2], alpha: p.alpha });
}
function vtPanel(g: G, ox: number, oy: number, pw: number, v: 21 | 24, t: number, narrow: boolean) {
  const m = jdk(state('T06', t), v);
  const zx: Record<string, number> = { ready: ox + pw * 0.15, carrier: ox + pw * 0.5, io: ox + pw * 0.85 }, zy = oy + 78, zw = narrow ? 70 : 86, zh = 44;
  const P = { ready: { x: zx.ready, y: zy }, absent: { x: zx.ready - 24, y: zy }, carrier: { x: zx.carrier, y: zy }, io: { x: zx.io, y: zy }, done: { x: zx.carrier, y: zy - 26 } };
  g.text(ox, oy + 15, v === 21 ? 'JDK 21' : 'JDK 24 · JEP 491', { size: 13, weight: 600 });

  // 영역: 대기 / carrier 실행 슬롯 / I/O 대기
  for (const [z, label] of [['ready', '대기'], ['io', 'I/O 대기']]) {
    g.rect(zx[z] - zw / 2, zy - zh / 2, zw, zh, { r: 8, stroke: C.line, lw: 1, dash: [3, 4] });
    g.text(zx[z], zy - zh / 2 - 9, label, { size: 12, color: C.muted, align: 'center' });
  }
  g.rect(zx.carrier - zw / 2, zy - zh / 2, zw, zh, { r: 8, fill: m.pinned ? C.orangeTint : C.paper, stroke: m.pinned ? C.orange : C.ink, lw: m.pinned ? 2 : 1.5 });
  g.text(zx.carrier, zy - zh / 2 - 9, m.pinned ? 'carrier · pinned' : 'carrier', { size: 12, weight: 600, align: 'center', color: m.pinned ? C.orangeText : C.ink });
  const p1 = tokenPos(T06.zones.VT1[v], t, P, T06.move), p2 = tokenPos(T06.zones.VT2[v], t, P, T06.move);
  // 빈 슬롯 표시는 들어오거나 나가는 토큰과 겹치지 않게 거리로 옅어진다(표현 전용)
  const near = Math.min(...[p1, p2].filter(p => p.alpha > 0.05).map(p => Math.abs(p.x - zx.carrier) + Math.abs(p.y - zy)), 999);
  if (!m.carrier) g.text(zx.carrier, zy + 4, '비어 있음', { size: 12, align: 'center', color: C.greenText, alpha: clamp01((near - 30) / (zw * 0.45)) });

  // 자원: monitor와 DB connection 1
  const ry = oy + 150, mon = { x: ox + pw * 0.32, y: ry }, db = { x: ox + pw * 0.68, y: ry };
  const monHeld = !!m.monitorOwner;
  const pos: Record<string, Pt & { alpha: number }> = { VT1: p1, VT2: p2 };
  // 소유 연결선: 토큰이 어디로 가든 소유권은 토큰을 따라간다
  if (m.monitorOwner) g.line(pos[m.monitorOwner].x, pos[m.monitorOwner].y + 12, mon.x, mon.y - 10, { stroke: C.ink, lw: 1.5, alpha: 0.75 });
  if (m.dbOwner) g.line(pos[m.dbOwner].x, pos[m.dbOwner].y + 12, db.x, db.y - 6, { stroke: C.ink, lw: 1.5, alpha: 0.75 });
  // 기존 모델의 VT2 상태 문구는 JDK24 3,000~3,400(carrier 실행)에도 'DB 획득 대기'이므로 carrier 점유를 먼저 본다
  const vt2WaitsDb = m.vt2 === 'DB 획득 대기' && m.carrier !== 'VT2';
  if (vt2WaitsDb) g.line(p2.x, p2.y + 12, db.x - 6, db.y - 6, { stroke: C.orange, lw: 1.5, dash: [4, 4] });
  g.rect(mon.x - 13, mon.y - 13, 26, 30, { r: 0, fill: C.paper });
  lockGlyph(g, mon.x - 8.25, mon.y - 7, monHeld ? C.ink : C.faint, { open: !monHeld, s: 1.5 });
  g.text(mon.x, ry + 30, 'monitor', { size: 12, align: 'center', color: monHeld ? C.ink : C.muted });
  dbGlyph(g, db.x, db.y - 6, m.dbOwner ? C.ink : C.faint);
  g.text(db.x, ry + 30, 'DB connection 1', { size: 12, align: 'center', color: m.dbOwner ? C.ink : C.muted });

  // VT 토큰
  const k1 = t < 1100 ? 'pre' : t >= 5400 ? 'done' : m.carrier === 'VT1' && !m.pinned ? 'run' : 'wait';
  const k2 = t < 3000 ? 'pre' : m.vt2 === '완료' ? 'done' : m.carrier === 'VT2' ? 'run' : 'wait';
  vtToken(g, p1, 'VT1', k1);
  vtToken(g, p2, 'VT2', k2);
  if (zoneAt(T06.zones.VT2[v], t) === 'ready' && t >= 3000) g.text(p2.x, zy + zh / 2 + 16, m.vt2, { size: 12, weight: 600, align: 'center', color: C.orangeText });

  // 점유 기록: 같은 시간축의 carrier·monitor·DB
  const sy0 = oy + 206, lw = narrow ? 60 : 68, [ta, tb] = T06.axis, X = (tt: number) => ox + lw + (tt - ta) / (tb - ta) * (pw - lw);
  const ROWS = ['carrier', 'monitor', 'DB', 'VT2 대기'];
  ROWS.forEach((row, i) => {
    const y = sy0 + i * 22 + (i === 3 ? 6 : 0);
    g.text(ox, y + 11, row, { size: 12, color: i === 3 ? C.orangeText : C.muted });
    g.rect(X(ta), y, pw - lw, 14, { r: 3, fill: C.bg });
    for (const seg of T06_SEG[v][row]) {
      if (seg.a >= t || seg.b <= ta) continue;
      const a = Math.max(seg.a, ta), b = Math.min(seg.b, t, tb), x1 = X(a), x2 = X(b);
      if (x2 - x1 <= 0) continue;
      const wait = i === 3, pinned = seg.key.endsWith('pinned'), label = wait ? seg.key : seg.key.split(' ')[0];
      g.rect(x1, y, x2 - x1, 14, { r: 3, fill: pinned || wait ? C.orangeTint : row === 'carrier' ? C.blueTint : C.slab, stroke: pinned || wait ? C.orange : row === 'carrier' ? C.blueSoft : C.line, lw: 1 });
      if (x2 - x1 >= textW(label, 12, !wait) + 8) g.text((x1 + x2) / 2, y + 11, label, { size: 12, mono: !wait, align: 'center', color: pinned || wait ? C.orangeText : C.ink });
    }
  });
  if (t >= ta && t <= tb) g.line(X(t), sy0 - 5, X(t), sy0 + 4 * 22 + 2, { stroke: C.blue, lw: 1, alpha: 0.6 });
  return sy0 + 4 * 22 + 6;
}
function carriersV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T06', t), narrow = w < 560;
  const gap = 40, pw = narrow ? w : (w - gap) / 2;
  let y = para(g, 0, 14, 'NIO 수락·polling → 요청 executor → Filter / Servlet', w, { color: C.muted }) + 18;
  if (narrow) {
    y = vtPanel(g, 0, y, pw, 21, t, narrow);
    g.line(0, y + 14, w, y + 14, { stroke: C.grid, lw: 1 });
    y = vtPanel(g, 0, y + 30, pw, 24, t, narrow);
  } else {
    const top = y;
    y = vtPanel(g, 0, top, pw, 21, t, narrow);
    vtPanel(g, pw + gap, top, pw, 24, t, narrow);
    g.line(pw + gap / 2, top, pw + gap / 2, y, { stroke: C.grid, lw: 1 });
  }
  y = para(g, 0, y + 34, 'JDK 24는 synchronized 관련 pinning을 개선했습니다. native·foreign 호출 경로의 pinning은 남습니다.', w, { color: C.muted });
  y = para(g, 0, y + 22, '원본 그림의 max-connections 8192 · max-threads 200은 원본 설정 예이고, carrier 1 · DB connection 1은 설명용 조건입니다.', w, { color: C.muted });
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- T08 뷰·List 복사·요소 복사: 하나의 A0를 여러 참조가 가리킨다 ---------- */
// 사건 시각은 T08 모델(B 추가 3,600 / A0.name 변경 5,400 / view 변경 예외 6,200 / G1에 C 추가 7,000)과 같다.
const T08 = { addB: 3600, rename: 5400, viewAdd: 6200, addC: 7000, reveal: [300, 700, 1100, 1500], draw: 380, wave: 420 };
function cubicPts(p0: Pt, p3: Pt): Pt[] { const D = Math.max(40, p3.x - p0.x); return [p0, { x: p0.x + D * 0.7, y: p0.y }, { x: p3.x - D * 0.3, y: p3.y }, p3]; }
const mixPt = (a: Pt, b: Pt, u: number): Pt => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
function splitCubic(P: Pt[], u: number): Pt[] { const [p0, p1, p2, p3] = P, q0 = mixPt(p0, p1, u), q1 = mixPt(p1, p2, u), q2 = mixPt(p2, p3, u), r0 = mixPt(q0, q1, u), r1 = mixPt(q1, q2, u); return [p0, q0, r0, mixPt(r0, r1, u)]; }
// 길이 기준 진행률 → 곡선 매개변수
function cubicU(P: Pt[], frac: number) {
  const n = 24, pts = [], acc = [0];
  for (let i = 0; i <= n; i++) { const u = i / n, a = splitCubic(P, u); pts.push(a[3]); if (i) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); }
  const target = frac * acc[n];
  for (let i = 1; i <= n; i++) if (acc[i] >= target) return (i - 1 + (target - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1])) / n;
  return 1;
}
function refArrow(g: G, P: Pt[], q: number, color: string, alpha = 1) {
  if (q <= 0) return;
  const S = q >= 1 ? P : splitCubic(P, cubicU(P, q));
  g.path(`M${f2(S[0].x)} ${f2(S[0].y)}C${f2(S[1].x)} ${f2(S[1].y)} ${f2(S[2].x)} ${f2(S[2].y)} ${f2(S[3].x)} ${f2(S[3].y)}`, { stroke: color, lw: 1.5, alpha });
  arrowHead(g, S[3], angle(S[2], S[3]), color, alpha, 7);
}
function itemCard(g: G, x: number, cy: number, w: number, id: string, name: string, o: Opt = {}) {
  const h = 52, y = cy - h / 2, alpha = o.alpha ?? 1;
  g.rect(x, y, w, h, { r: 8, fill: o.fill ?? C.paper, stroke: o.stroke ?? C.ink, lw: o.lw ?? 1.3, alpha });
  g.text(x + 12, y + 21, id, { size: 13, weight: 700, mono: true, alpha });
  g.text(x + 12 + textW(id, 13, true) + 2, y + 21, '.name', { size: 12, mono: true, color: C.muted, alpha });
  g.text(x + 12, y + 41, `"${name}"`, { size: 13, mono: true, color: o.nameColor ?? C.ink, alpha });
}
function copiesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T08', t), narrow = w < 560;
  const slot = 28, sg = 8, sx0 = 30, itemW = narrow ? 100 : 156, ix = narrow ? w - itemW : Math.min(w - itemW - 48, 430);
  const labelW = ix - 24;
  type Row = { key: 'view' | 'getter' | 'shallow' | 'deep'; tag: string; group?: string; label: string; sy: number; cy: number; ny: number };
  const rows: Row[] = ([
    { key: 'view', tag: 'L0', group: '원문 ImmutableCart', label: '생성자 · items = unmodifiableList(L0), 외부 List L0의 뷰' },
    { key: 'getter', tag: 'G1', label: 'getItems() · new ArrayList(items)로 만든 G1' },
    { key: 'shallow', tag: 'L1', group: '비교안', label: '생성자에서 List를 복사한 L1' },
    { key: 'deep', tag: 'L2', label: 'name 요소까지 새로 만든 L2' },
  ] as const).map(r => ({ ...r, sy: 0, cy: 0, ny: 0 }));
  const noteRows: Record<string, number> = { view: 3, getter: 1 };
  let y = 0;
  const labels: { y: number; lines: string[] }[] = [];
  for (const r of rows) {
    if (r.group) { y += y ? 22 : 0; g.text(0, y + 15, r.group, { size: 13, weight: 600 }); y += 30; }
    const lines = wrap(r.label, labelW, 12);
    labels.push({ y: y + 12, lines });
    y = y + 12 + (lines.length - 1) * 19 + (r.key === 'view' ? 28 : 14);
    r.sy = y; r.cy = y + slot / 2; y += slot;
    r.ny = y + 20; y += (noteRows[r.key] || 0) * 19 + 10;
  }
  const R = Object.fromEntries(rows.map(r => [r.key, r])) as Record<Row['key'], Row>;
  const slotX = (i: number) => sx0 + i * (slot + sg);
  const card: Record<string, number> = { B0: R.view.cy, A0: R.getter.cy, C0: (R.getter.cy + R.shallow.cy) / 2 + 26, A1: R.deep.cy };
  const anchor = (id: string) => ({ x: ix - 2, y: card[id] });

  // 이름 변경 전파: A0를 가리키는 참조를 따라 되돌아가는 표시
  const renamed = s.view.names[0] !== 'A', waveQ = renamed ? span(t, T08.rename + 60, T08.rename + 60 + T08.wave) : 0;
  const refColor = (id: string) => id === 'A0' && waveQ >= 1 ? C.orange : C.ink;

  // 참조 화살표
  const refs: { r: Row; i: number; id: string }[] = [];
  for (const r of rows) s[r.key].itemIds.forEach((id, i) => refs.push({ r, i, id }));
  refs.forEach(({ r, i, id }) => {
    const P = cubicPts({ x: slotX(i) + slot / 2 + 4, y: r.cy }, anchor(id));
    const first = i === 0 ? T08.reveal[rows.indexOf(r)] : r.key === 'view' ? T08.addB + 60 : T08.addC + 60;
    const q = ease.out(span(t, first, first + T08.draw));
    refArrow(g, P, q, refColor(id), id === 'A0' && waveQ >= 1 ? 0.85 : 0.6);
    if (id === 'A0' && waveQ > 0 && waveQ < 1) {
      const p = splitCubic(P, cubicU(P, 1 - ease.inOut(waveQ)))[3];
      g.circle(p.x, p.y, 4, { fill: C.orange });
    }
  });

  // 행 라벨: 곡선 위에 바탕을 깔아 읽히게 한다
  for (const l of labels) l.lines.forEach((line, i) => {
    g.rect(-2, l.y + i * 19 - 13, textW(line, 12) + 6, 18, { r: 3, fill: C.paper });
    g.text(0, l.y + i * 19, line, { color: C.muted });
  });
  // List 슬롯과 뷰
  for (const r of rows) {
    const st = s[r.key], n = st.itemIds.length;
    g.text(0, r.cy + 4, r.tag, { size: 12, weight: 600, mono: true, color: C.muted });
    st.itemIds.forEach((id, i) => {
      const at = r.key === 'view' ? T08.addB : T08.addC, a = i > 0 ? ease.out(span(t, at, at + 200)) : 1;
      g.rect(slotX(i), r.sy, slot, slot, { r: 5, fill: C.paper, stroke: C.ink, lw: 1.2, alpha: a });
      g.circle(slotX(i) + slot / 2, r.cy, 4, { fill: id === 'A0' && waveQ >= 1 ? C.orange : C.ink, alpha: a });
    });
    if (r.key === 'view') {
      const w1 = slot + 16, w2 = 2 * slot + sg + 16, q = n > 1 ? ease.out(span(t, T08.addB, T08.addB + 300)) : 0;
      const err = t >= T08.viewAdd ? 1 - span(t, T08.viewAdd + 300, T08.viewAdd + 900) : 0;
      const fx = sx0 - 8, fy = r.sy - 8, fw = lerp(w1, w2, q), fh = slot + 16;
      g.rect(fx, fy, fw, fh, { r: 8, stroke: err > 0 ? C.red : C.blue, lw: 1.4 + err * 0.6, dash: [4, 3] });
      g.rect(fx + 6, fy - 9, textW('view', 12, true) + 30, 18, { r: 3, fill: C.paper });
      lockGlyph(g, fx + 10, fy - 7, C.blueText);
      g.text(fx + 26, fy + 4, 'view', { size: 12, weight: 600, mono: true, color: C.blueText });
      // view.add(): 막히고 되돌아간다
      if (t >= T08.viewAdd - 260 && t < T08.viewAdd + 320) {
        const down = span(t, T08.viewAdd - 260, T08.viewAdd), up = span(t, T08.viewAdd, T08.viewAdd + 320);
        const px = lerp(Math.min(fx + fw + 92, ix - 34), fx + fw + 30, ease.inOut(down)) + 14 * ease.out(up), py = fy + fh / 2;
        g.rect(px - 26, py - 11, 52, 22, { r: 11, fill: C.redTint, stroke: C.red, lw: 1.2, alpha: 1 - up });
        g.text(px, py + 4, 'add()', { size: 12, mono: true, weight: 600, align: 'center', color: C.redText, alpha: 1 - up });
      }
    }
  }
  // 사건 기록
  const noteW = narrow ? w - sx0 : Math.min(250, ix - sx0);
  // 기록 글자 뒤에 바탕을 깔아 곡선이 글자 아래로 지나가게 한다
  const note = (r: Row, line: number, at: number, text: string, color: string) => {
    if (t < at) return;
    const a = ease.out(span(t, at, at + 300)), x = sx0 - 8, yy = r.ny + line * 19;
    g.rect(x - 3, yy - 14, Math.min(noteW, textW(text, 12, true)) + 6, 19, { r: 3, fill: C.paper });
    para(g, x, yy, text, noteW, { size: 12, mono: true, color, alpha: a });
  };
  note(R.view, 0, T08.addB, 'L0.add(B) → 뷰에도 보임', C.blueText);
  note(R.view, 1, T08.viewAdd, 'view.add() →', C.redText);
  note(R.view, 2, T08.viewAdd, 'UnsupportedOperationException', C.redText);
  note(R.getter, 0, T08.addC, 'G1.add(C) → L0는 그대로', C.blueText);

  // Item 객체
  const renamedRing = renamed ? 1 - span(t, T08.rename + 200, T08.rename + 900) : 0;
  if (renamedRing > 0) g.rect(ix - 5, card.A0 - 31, itemW + 10, 62, { r: 11, stroke: C.orange, lw: 2, alpha: renamedRing });
  itemCard(g, ix, card.A0, itemW, 'A0', s.view.names[0], { stroke: renamed ? C.orange : C.ink, lw: 1.8, nameColor: renamed ? C.orangeText : C.ink });
  itemCard(g, ix, card.A1, itemW, 'A1', s.deep.names[0], { stroke: C.ink });
  if (s.view.itemIds.length > 1) itemCard(g, ix, card.B0, itemW, 'B0', s.view.names[1], { alpha: ease.out(span(t, T08.addB, T08.addB + 200)) });
  if (s.getter.itemIds.length > 1) itemCard(g, ix, card.C0, itemW, 'C0', s.getter.names[1], { alpha: ease.out(span(t, T08.addC, T08.addC + 200)) });
  return { ops: g.ops, height: Math.ceil(Math.max(y, card.A1 + 30) + 8), status: s.phase };
}

/* ---------- 묶음 A·B 공통 형태 ---------- */
function terminal(g: G, x: number, y: number, w: number, h: number, lines: string[], o: Opt = {}) {
  const dim = !!o.dim, a = o.alpha ?? 1, stroke = dim ? C.line : (o.stroke ?? C.ink);
  g.rect(x, y, w, h, { r: 8, fill: dim ? C.slab : C.paper, stroke, lw: 1.3, alpha: a });
  g.line(x + 1, y + 18, x + w - 1, y + 18, { stroke, lw: 1, alpha: a });
  for (let i = 0; i < 3; i++) g.circle(x + 11 + i * 9, y + 9.5, 2.5, { fill: dim ? C.line : C.faint, alpha: a });
  lines.forEach((l, i) => g.text(x + 10, y + 37 + i * 19, l, { size: 12, mono: true, color: dim ? C.muted : C.ink, alpha: a }));
}
// 이미지 = 쌓인 층 세 장
function layerGlyph(g: G, x: number, y: number, w: number, o: Opt = {}) {
  for (let i = 0; i < 3; i++) g.rect(x, y + i * 10, w, 8, { r: 2, fill: o.fill ?? C.slab, stroke: o.stroke ?? C.ink, lw: 1.1, alpha: o.alpha ?? 1 });
}
function serverGlyph(g: G, x: number, y: number, w: number, h: number, o: Opt = {}) {
  const a = o.alpha ?? 1, s = o.stroke ?? C.ink, u = h / 2;
  g.rect(x, y, w, h, { r: 6, fill: o.fill ?? C.paper, stroke: s, lw: 1.3, alpha: a });
  g.line(x + 1, y + u, x + w - 1, y + u, { stroke: s, lw: 1, alpha: a });
  for (let i = 0; i < 2; i++) {
    g.circle(x + 10, y + u * i + u / 2, 2.6, { fill: o.led ?? C.green, alpha: a });
    g.line(x + 20, y + u * i + u / 2, x + w - 10, y + u * i + u / 2, { stroke: C.line, lw: 2, alpha: a });
  }
}
function procBox(g: G, cx: number, cy: number, label: string, o: Opt = {}) {
  const a = o.alpha ?? 1, w = Math.max(64, textW(label, 12, true) + 34), run = o.running ?? true;
  g.rect(cx - w / 2, cy - 14, w, 28, { r: 14, fill: o.fill ?? C.paper, stroke: o.stroke ?? C.ink, lw: 1.4, alpha: a });
  g.circle(cx - w / 2 + 13, cy, 4, { fill: run ? C.green : C.faint, alpha: a });
  g.text(cx - w / 2 + 24, cy + 4.5, label, { size: 12, weight: 600, mono: true, color: o.color ?? C.ink, alpha: a });
  return w;
}
function cylinder(g: G, cx: number, top: number, w: number, h: number, o: Opt = {}) {
  const rx = w / 2, ry = 6, a = o.alpha ?? 1, s = o.stroke ?? C.ink;
  g.path(`M${f2(cx - rx)} ${f2(top)}V${f2(top + h)}A${f2(rx)} ${ry} 0 0 0 ${f2(cx + rx)} ${f2(top + h)}V${f2(top)}`, { fill: o.fill ?? C.paper, stroke: s, lw: 1.4, alpha: a });
  g.path(`M${f2(cx - rx)} ${f2(top)}A${f2(rx)} ${ry} 0 1 0 ${f2(cx + rx)} ${f2(top)}A${f2(rx)} ${ry} 0 1 0 ${f2(cx - rx)} ${f2(top)}Z`, { fill: o.fill ?? C.paper, stroke: s, lw: 1.4, alpha: a });
}
// 경로 위의 한 점: 꺾은선 길이 기준
function along(pts: Pt[], q: number): Pt {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(l); total += l; }
  let d = clamp01(q) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) return lerpPt(pts[i], pts[i + 1], seg[i] ? Math.min(1, d / seg[i]) : 1); d -= seg[i]; }
  return pts[pts.length - 1];
}
function polyline(g: G, pts: Pt[], o: Opt) { g.path('M' + pts.map(p => `${f2(p.x)} ${f2(p.y)}`).join('L'), { fill: 'none', ...o }); }
// 상태 기록 막대: segs=[{a,b,label,kind}], 현재 시각까지만 그린다
function stateTrack(g: G, x: number, y: number, w: number, t: number, axis: readonly number[], segs: TrackSeg[], o: Opt = {}) {
  const [ta, tb] = axis, X = (tt: number) => x + (tt - ta) / (tb - ta) * w;
  g.rect(x, y, w, 16, { r: 3, fill: C.bg });
  const tone = { run: [C.blueTint, C.blueSoft, C.blueText], wait: [C.orangeTint, C.orange, C.orangeText], idle: [C.slab, C.line, C.muted], done: [C.greenTint, C.green, C.greenText] };
  for (const s of segs) {
    if (t <= s.a) continue;
    const x1 = X(Math.max(s.a, ta)), x2 = X(Math.min(s.b, t, tb)), st = tone[s.kind];
    if (x2 - x1 <= 0) continue;
    g.rect(x1, y, x2 - x1, 16, { r: 3, fill: st[0], stroke: st[1], lw: 1 });
    if (x2 - x1 >= textW(s.label, 12) + 8) g.text((x1 + x2) / 2, y + 12.5, s.label, { size: 12, align: 'center', color: st[2] });
  }
  if (o.cursor !== false && t >= ta && t <= tb) g.line(X(t), y - 4, X(t), y + 20, { stroke: C.blue, lw: 1, alpha: 0.6 });
}

/* ---------- C01 VM과 공유 커널: 실행 환경 경계와 커널의 개수 ---------- */
const C01L = [1200, 2400, 3600, 4800, 6000];
function vmPanel(g: G, ox: number, oy: number, pw: number, vm: boolean, t: number) {
  const lv = state('C01', t).level;
  const tone = (i: number) => lv < i ? 'off' : lv === i ? 'now' : 'past';
  const block = (x: number, y: number, w: number, h: number, lines: string[], i: number) => {
    const s = tone(i), fill = s === 'now' ? C.blueTint : s === 'past' ? C.paper : C.paper, stroke = s === 'now' ? C.blue : s === 'past' ? C.ink : C.line, color = s === 'now' ? C.blueText : s === 'past' ? C.ink : C.muted;
    g.rect(x, y, w, h, { r: 6, fill, stroke, lw: s === 'now' ? 1.6 : 1.2 });
    lines.forEach((l, k) => g.text(x + w / 2, y + h / 2 + 4.5 + (k - (lines.length - 1) / 2) * 17, l, { size: 12, weight: k ? 400 : 600, align: 'center', color }));
  };
  const gap = 8, cw = (pw - 2 * gap) / 3, top = oy + 30, appY = top + 10, libY = appY + 36;
  g.text(ox, oy + 15, vm ? 'Virtual machines' : 'Linux containers', { size: 13, weight: 600 });
  const envBottom = vm ? libY + 36 + 44 + 10 : libY + 30 + 10;
  for (let i = 0; i < 3; i++) {
    const x = ox + i * (cw + gap);
    g.rect(x - 0.5, top, cw + 1, envBottom - top, { r: 9, stroke: lv >= 1 ? C.muted : C.line, lw: 1.2, dash: [4, 3] });
    block(x + 6, appY, cw - 12, 30, ['App ' + (i + 1)], 1);
    block(x + 6, libY, cw - 12, 30, ['Bins/Lib'], 1);
    if (vm) block(x + 6, libY + 36, cw - 12, 44, ['Guest OS', 'kernel'], 2);
  }
  let y = envBottom + 8;
  if (vm) { block(ox, y, pw, 44, ['Hypervisor'], 4); y += 50; }
  else {
    block(ox, y, pw, 44, ['Container engine'], 3);
    y += 50;
    // 세 컨테이너가 하나의 host kernel을 함께 쓴다
    if (lv >= 4) { const q = ease.out(span(t, C01L[3], C01L[3] + 400)); for (let i = 0; i < 3; i++) { const cx = ox + i * (cw + gap) + cw / 2; g.line(cx, envBottom, cx, y - 50, { stroke: C.blue, lw: 1.4, dash: [3, 3], alpha: q }); g.line(cx, y - 6, cx, y - 1, { stroke: C.blue, lw: 1.4, alpha: q }); arrowHead(g, { x: cx, y }, Math.PI / 2, C.blue, q, 5); } }
    block(ox, y, pw, 44, ['Linux host kernel'], 4);
    y += 50;
  }
  block(ox, y, pw, 38, ['Infrastructure'], 5);
  // 커널 개수
  const at = vm ? C01L[1] : C01L[3];
  if (t >= at) g.text(ox + pw, oy + 15, vm ? 'kernel 3개' : 'kernel 1개 · 공유', { size: 12, weight: 600, align: 'right', color: C.blueText, alpha: ease.out(span(t, at, at + 400)) });
  return y + 38;
}
function vmV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C01', t), narrow = w < 560, gap = 36, pw = narrow ? w : (w - gap) / 2;
  let y;
  if (narrow) { y = vmPanel(g, 0, 0, pw, true, t); g.line(0, y + 14, w, y + 14, { stroke: C.grid, lw: 1 }); y = vmPanel(g, 0, y + 30, pw, false, t); }
  else { y = vmPanel(g, 0, 0, pw, true, t); vmPanel(g, pw + gap, 0, pw, false, t); }
  return { ops: g.ops, height: Math.ceil(y + 8), status: s.phase };
}

/* ---------- C02 CLI부터 컨테이너 시작까지: 역할별 형태 ---------- */
const C02 = { req: [1600, 2000], core: [2400, 2800], pullReq: [3000, 3500], image: [3700, 4400], create: [4800, 5200], run: 6300 };
function cliV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C02', t), narrow = w < 560;
  const termW = narrow ? 178 : 230, termH = 60, regW = narrow ? 92 : 128, regX = w - regW, regH = 46;
  terminal(g, 0, 0, termW, termH, ['$ docker run nginx']);
  g.path(`M${f2(regX)} 4H${f2(regX + regW)}L${f2(regX + regW - 14)} ${4 + regH}H${f2(regX + 14)}Z`, { fill: C.blueTint, stroke: C.blue, lw: 1.4 });
  g.text(regX + regW / 2, 4 + 28, 'Registry', { size: 12, weight: 600, align: 'center', color: C.blueText });
  // dockerd 경계와 그 가장자리의 Unix socket
  const dY = termH + 46, dH = narrow ? 178 : 168, active = s.daemon;
  g.rect(0, dY, w, dH, { r: 22, fill: C.paper, stroke: active ? C.ink : C.line, lw: active ? 1.6 : 1.2 });
  g.text(22, dY + 32, 'dockerd', { size: 13, weight: 700, mono: true, color: active ? C.ink : C.muted });
  const sockW = textW('/var/run/docker.sock', 12, true) + 20, sockX = 16, sockY = dY - 13;
  g.rect(sockX, sockY, sockW, 26, { r: 6, fill: s.socket ? C.greenTint : C.bg, stroke: s.socket ? C.green : C.line, lw: 1.3 });
  g.text(sockX + 10, sockY + 17, '/var/run/docker.sock', { size: 12, mono: true, color: s.socket ? C.greenText : C.muted });
  // 로컬 이미지 / 컨테이너 자리
  const inY = dY + 46, inH = dH - 62, colW = (w - 54) / 2, contX = 18, storeX = contX + colW + 18;
  g.rect(storeX, inY, colW, inH, { r: 10, fill: C.bg, stroke: C.line, lw: 1 });
  g.text(storeX + 12, inY + 20, '로컬 이미지', { size: 12, color: C.muted });
  g.rect(contX, inY, colW, inH, { r: 10, fill: C.bg, stroke: C.line, lw: 1 });
  g.text(contX + 12, inY + 20, '컨테이너', { size: 12, color: C.muted });
  // 요청: 터미널 → socket → dockerd
  const p0 = { x: 40, y: termH }, p1 = { x: 40, y: sockY }, p2 = { x: sockX + sockW + 30, y: dY + 26 };
  if (t >= C02.req[0]) {
    const q = span(t, C02.req[0], C02.req[1]);
    g.line(p0.x, p0.y, p0.x, lerp(p0.y, p1.y, q), { stroke: C.blue, lw: 1.5 });
    if (q < 1) g.circle(p0.x, lerp(p0.y, p1.y, ease.inOut(q)), 4.5, { fill: C.blue }); else arrowHead(g, p1, Math.PI / 2, C.blue);
  }
  if (t >= C02.core[0] && t < C02.core[1] + 300) {
    const q = ease.inOut(span(t, C02.core[0], C02.core[1]));
    const p = lerpPt({ x: sockX + sockW, y: sockY + 13 }, p2, q);
    if (q < 1) g.circle(p.x, p.y, 4.5, { fill: C.blue });
  }
  // pull 요청과 이미지 수신
  const regB = { x: regX + regW / 2, y: 4 + regH }, storeT = { x: Math.min(regB.x, storeX + colW - 20), y: inY };
  if (t >= C02.pullReq[0]) {
    const q = ease.out(span(t, C02.pullReq[0], C02.pullReq[1])), tip = lerpPt(storeT, regB, q);
    g.line(storeT.x, storeT.y, tip.x, tip.y, { stroke: C.muted, lw: 1.3, dash: [4, 3] });
    if (q >= 1) g.text(regB.x - 8, regB.y + 22, 'pull', { size: 12, mono: true, align: 'right', color: C.muted });
  }
  const imgW = Math.min(colW - 24, 120), imgAt = { x: storeX + 12, y: inY + 34 };
  if (t >= C02.image[0]) {
    const q = ease.inOut(span(t, C02.image[0], C02.image[1])), from = { x: regB.x - imgW / 2, y: regB.y - 10 }, p = lerpPt(from, imgAt, q);
    layerGlyph(g, p.x, p.y, imgW, { fill: s.imageAvailable ? C.slab : C.blueTint, stroke: s.imageAvailable ? C.ink : C.blue });
    if (s.imageAvailable) g.text(imgAt.x, imgAt.y + 48, 'nginx', { size: 12, mono: true });
  }
  // create: 이미지 층 위에 컨테이너, start: 실행
  if (t >= C02.create[0]) {
    const q = ease.inOut(span(t, C02.create[0], C02.create[1]));
    if (q < 1) { const p = lerpPt(imgAt, { x: contX + 12, y: inY + 34 }, q); layerGlyph(g, p.x, p.y, imgW, { alpha: 0.5 }); }
    if (s.containerCreated) {
      const cx = contX + 12, cw = colW - 24;
      g.rect(cx - 4, inY + 26, cw + 8, inH - 34, { r: 8, stroke: s.running ? C.green : C.ink, lw: 1.5, dash: s.running ? null : [4, 3], fill: s.running ? C.greenTint : 'none' });
      layerGlyph(g, cx + 4, inY + 52, Math.min(cw - 8, 120), { fill: C.slab });
      g.text(cx + 4, inY + 44, s.running ? 'nginx 실행 중' : 'created', { size: 12, weight: 600, color: s.running ? C.greenText : C.ink });
    }
  }
  // 원본 명령 관계도: 움직이지 않는 참조
  const REL = ['Registry: login / logout / search / push / pull', 'Image: rmi / images / history / tag / inspect', 'Dockerfile + .dockerignore → build → Image', 'Image → create / run → Container', 'Container → commit → 새 Image', 'Image ↔ save / load ↔ Backup', 'Container → export → Backup → import → Image', 'Container: start / stop / restart / pause / unpause / wait', 'Container: exec / attach / top / logs / inspect / cp / diff / rm / kill', 'Docker: events / version / info'];
  let ry = dY + dH + 40;
  g.text(0, ry, '원본 명령 관계', { size: 12, weight: 600, color: C.muted });
  for (const r of REL) ry = para(g, 0, ry + 20, r, w, { size: 12, color: C.muted, lh: 18 });
  return { ops: g.ops, height: Math.ceil(ry + 10), status: s.phase };
}

/* ---------- C03 같은 프로세스의 두 PID, 별도 예의 chroot root ---------- */
const C03 = { pid: 2500, root: 4200, move: 400 };
function namespacesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C03', t), narrow = w < 560;
  // PID: host namespace 안의 container namespace, 그 안의 한 프로세스
  g.text(0, 15, 'PID namespace · 원본 nginx 실습', { size: 13, weight: 600 });
  const oy = 28, oh = 132, ix = w * (narrow ? 0.4 : 0.46), iy = oy + 34, iw = w - ix - 12, ih = oh - 46;
  g.rect(0, oy, w, oh, { r: 12, fill: C.bg, stroke: C.muted, lw: 1.2 });
  g.text(14, oy + 22, 'host', { size: 12, weight: 600, color: C.muted });
  const qi = s.pidVisible ? ease.out(span(t, C03.pid, C03.pid + 400)) : 0;
  g.rect(ix, iy, iw, ih, { r: 10, fill: C.paper, stroke: qi > 0 ? C.blue : C.line, lw: 1.3, dash: qi > 0 ? null : [3, 4] });
  g.text(ix + 12, iy + 20, '컨테이너', { size: 12, weight: 600, color: qi > 0 ? C.blueText : C.muted });
  const pc = { x: ix + iw / 2, y: iy + ih / 2 + 12 };
  procBox(g, pc.x, pc.y, 'nginx');
  // 같은 프로세스에 붙은 두 이름
  const hostTag = { x: narrow ? 52 : w * 0.2, y: oy + 70 };
  chip(g, hostTag.x, hostTag.y, 'PID 4453', 'held');
  g.line(hostTag.x + 40, hostTag.y + 4, pc.x - 34, pc.y, { stroke: C.blue, lw: 1.2, alpha: 0.7 });
  if (qi > 0) { const tag = { x: ix + iw - 38, y: iy + 20 }; chip(g, tag.x, tag.y, 'PID 1', 'held', qi); g.line(tag.x - 4, tag.y + 11, pc.x + 10, pc.y - 14, { stroke: C.blue, lw: 1.2, alpha: 0.7 * qi }); }
  g.text(14, oy + oh - 14, '프로세스 1개', { size: 12, color: C.muted });
  // chroot: 별도 예. 경로 트리와 root 경계
  const ty = oy + oh + 34;
  g.line(0, ty - 18, w, ty - 18, { stroke: C.grid, lw: 1 });
  g.text(0, ty, '별도 예 · chroot가 바꾸는 root', { size: 13, weight: 600 });
  const rows: [string, number][] = [['/', 0], ['bin', 1], ['usr', 1], ['home', 1], ['joe', 2], ['bin', 3], ['usr', 3], ['bin/cp', 4], ['local/bin/gcc · ape', 4], ['local/lib', 4], ['lib', 4]];
  const rh = 22, rx0 = 16, top = ty + 30, ind = narrow ? 18 : 22;
  rows.forEach(([name, lvl], i) => {
    const y = top + i * rh, x = rx0 + lvl * ind;
    if (lvl) g.path(`M${f2(x - ind + 6)} ${f2(y - rh + 8)}V${f2(y)}H${f2(x - 4)}`, { stroke: C.line, lw: 1 });
    g.text(x, y + 4, name, { size: 12, mono: true, color: i >= 4 ? C.ink : C.muted });
  });
  // root 경계: 4,200에 /home/joe 아래로 옮겨 도착
  const q = ease.inOut(span(t, C03.root - C03.move, C03.root));
  const by = lerp(top - 14, top + 4 * rh - 14, q), bh = lerp(rows.length * rh + 4, (rows.length - 4) * rh + 4, q), bx = lerp(rx0 - 10, rx0 + 2 * ind - 10, q);
  g.rect(bx, by, w - bx - 2, bh, { r: 8, stroke: q > 0 ? C.green : C.muted, lw: 1.4, dash: [4, 3] });
  g.text(w - 10, by + 16, q >= 1 ? '프로세스가 보는 /' : 'root /', { size: 12, weight: 600, align: 'right', color: q > 0 ? C.greenText : C.muted });
  if (s.rootVisible) g.text(rx0 + 2 * ind + textW('joe', 12, true) + 8, top + 4 * rh + 4, '→ /', { size: 12, mono: true, color: C.greenText });
  return { ops: g.ops, height: Math.ceil(top + rows.length * rh + 10), status: s.phase };
}

/* ---------- C05 공개 포트에서 bridge와 veth까지: host 경계 안의 실제 경로 ---------- */
const C05 = { req: [1300, 2400, 3500, 4600, 5700], res: [6300, 8900] };
function prefix(pts: Pt[], q: number): Pt[] {
  const out = [pts[0]];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let d = clamp01(q) * total;
  for (let i = 1; i < pts.length && d > 0; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); out.push(d >= l ? pts[i] : lerpPt(pts[i - 1], pts[i], d / l)); d -= l; }
  return out;
}
function bridgeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C05', t), narrow = w < 560;
  const H = narrow ? 300 : 290, cw = (w - 64) / 2, ch = 64, cy = 22, nx = 20, sx = w - 20 - cw;
  const vY = cy + ch + 56, v1 = { x: nx + 30, y: vY }, v2 = { x: sx + 30, y: vY };
  const bw = 74, bh = 42, bx = w / 2 - bw / 2, by = H - 104, bc = { x: w / 2, y: by + bh / 2 }, ex = w / 2, ey = H, lx = ex, ly = H + 66;
  // 1. host 경계와 고정 연결선
  g.rect(0, 0, w, H, { r: 14, stroke: C.blue, lw: 1.6, dash: [6, 4] });
  g.text(w - 14, H - 14, 'host', { size: 12, weight: 600, align: 'right', color: C.blueText });
  const curve = (v: Pt, side: number) => `M${f2(v.x)} ${f2(v.y + 10)}Q${f2(v.x)} ${f2(bc.y)} ${f2(side)} ${f2(bc.y)}`;
  for (const v of [v1, v2]) g.line(v.x, cy + ch, v.x, v.y - 10, { stroke: C.muted, lw: 1.3 });
  g.path(curve(v1, bx), { stroke: C.muted, lw: 1.3 });
  g.path(curve(v2, bx + bw), { stroke: C.muted, lw: 1.3 });
  g.line(ex, by + bh, ex, ey - 10, { stroke: C.muted, lw: 1.3 });
  // 2. 요청·응답 경로: client → host eth0 → docker0 → veth2 → 컨테이너 eth0
  const q2 = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8, A = { x: v2.x, y: v2.y + 10 }, K = { x: v2.x, y: bc.y }, B = { x: bx + bw, y: bc.y }; q2.push({ x: (1 - u) * (1 - u) * B.x + 2 * (1 - u) * u * K.x + u * u * A.x, y: (1 - u) * (1 - u) * B.y + 2 * (1 - u) * u * K.y + u * u * A.y }); }
  const G = [[{ x: lx, y: ly - 18 }, { x: ex, y: ey }], [{ x: ex, y: ey }, { x: ex, y: by + bh }, bc], [bc, ...q2, v2], [v2, { x: sx + 30, y: cy + ch - 2 }]];
  const T = C05.req;
  const route = (groups: Pt[][], windows: number[][]): { pts: Pt[]; tip: Pt | null } => { const pts: Pt[] = []; let tip: Pt | null = null; groups.forEach((grp, i) => { if (t < windows[i][0]) return; const q = span(t, windows[i][0], windows[i][1]); const part = prefix(grp, q); pts.push(...(pts.length ? part.slice(1) : part)); if (q < 1) tip = part[part.length - 1]; }); return { pts, tip }; };
  const reqWin = G.map((_, i) => [T[i], T[i + 1]]);
  let reqTip: Pt | null = null;
  if (t >= T[0]) {
    const r = route(G, reqWin);
    if (r.pts.length > 1) polyline(g, r.pts, { stroke: s.replyStarted ? C.blueSoft : C.blue, lw: 2 });
    reqTip = r.tip;
  }
  let resTip: Pt | null = null;
  if (s.replyStarted) {
    const R = G.slice().reverse().map(grp => grp.slice().reverse()), d = (C05.res[1] - C05.res[0]) / R.length;
    const r = route(R, R.map((_, i) => [C05.res[0] + i * d, C05.res[0] + (i + 1) * d]));
    if (r.pts.length > 1) polyline(g, r.pts, { stroke: C.green, lw: 2 });
    resTip = r.tip;
  }
  // 3. 컨테이너·인터페이스·bridge·client (경로 위에 그린다)
  const box = (x: number, label: string, sub: string | null, on: boolean) => {
    g.rect(x, cy, cw, ch, { r: 10, fill: on ? C.greenTint : C.paper, stroke: on ? C.green : C.ink, lw: 1.4 });
    g.text(x + cw / 2, cy + 26, label, { size: 12, weight: 600, align: 'center', color: on ? C.greenText : C.ink });
    if (sub) g.text(x + cw / 2, cy + 44, sub, { size: 12, mono: true, align: 'center', color: C.muted });
  };
  const tag = (x: number, y: number, text: string) => { const tw = textW(text, 12, true) + 16; g.rect(x - tw / 2, y - 10, tw, 20, { r: 4, fill: C.blueTint, stroke: C.blueSoft, lw: 1 }); g.text(x, y + 4.5, text, { size: 12, mono: true, align: 'center', color: C.blueText }); };
  box(nx, 'nginx', ':80', false);
  box(sx, 'Spring', ':8080', s.requestReceived && !s.replyStarted);
  tag(nx + 30, cy + ch - 2, 'eth0'); tag(sx + 30, cy + ch - 2, 'eth0');
  tag(v1.x, v1.y, 'veth1'); tag(v2.x, v2.y, 'veth2');
  g.rect(bx, by, bw, bh, { r: 6, fill: C.paper, stroke: C.ink, lw: 1.4 });
  g.path(`M${f2(bx + 16)} ${f2(by + 16)}H${f2(bx + bw - 16)}M${f2(bx + bw - 22)} ${f2(by + 11)}L${f2(bx + bw - 16)} ${f2(by + 16)}L${f2(bx + bw - 22)} ${f2(by + 21)}M${f2(bx + bw - 16)} ${f2(by + 27)}H${f2(bx + 16)}M${f2(bx + 22)} ${f2(by + 22)}L${f2(bx + 16)} ${f2(by + 27)}L${f2(bx + 22)} ${f2(by + 32)}`, { stroke: C.ink, lw: 1.3 });
  g.text(bx + bw + 8, by + bh + 16, 'docker0', { size: 12, weight: 600, mono: true });
  tag(ex, ey, 'eth0');
  g.text(ex + 12, ey + 28, ':9000 → :8080', { size: 12, mono: true, color: C.ink });
  g.rect(lx - 26, ly - 18, 52, 32, { r: 4, fill: C.paper, stroke: C.ink, lw: 1.3 });
  g.line(lx - 34, ly + 18, lx + 34, ly + 18, { stroke: C.ink, lw: 1.6 });
  g.text(lx - 44, ly + 4, 'client', { size: 12, weight: 600, align: 'right' });
  if (s.replyReceived) g.text(lx + 44, ly + 4, '응답 도착', { size: 12, weight: 600, color: C.greenText });
  const noteY = para(g, 0, ly + 52, 'Linux host와 기본 bridge의 개념 경로입니다. Docker Desktop의 host→VM 경로는 별도입니다.', w, { color: C.muted });
  // 4. 이동 중인 요청·응답
  if (reqTip && !s.requestReceived) g.circle(reqTip.x, reqTip.y, 5, { fill: C.blue });
  if (resTip && !s.replyReceived) g.circle(resTip.x, resTip.y, 5, { fill: C.green });
  return { ops: g.ops, height: Math.ceil(noteY + 10), status: s.phase };
}

/* ---------- C06 컨테이너 교체 뒤에도 남는 데이터: 고정된 저장소와 바뀌는 컨테이너 ---------- */
const C06 = { a: 1200, write: 3000, remove: 5000, b: 6500, read: 7500, move: 400 };
function volumesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C06', t), gap = 20, cw = (w - gap) / 2;
  ([['named volume', 'Docker가 관리하는 mydata', s.volumeData], ['bind mount', 'host 경로 /data', s.bindData]] as [string, string, string | null][]).forEach(([title, where, data], i) => {
    const x = i * (cw + gap), cx = x + cw / 2, slotY = 30, slotH = 58, pipeTop = slotY + slotH, stTop = 160, stH = 66;
    g.text(x, 15, title, { size: 13, weight: 600 });
    // 컨테이너 자리
    g.rect(x, slotY, cw, slotH, { r: 10, stroke: C.line, lw: 1, dash: [3, 4] });
    if (s.firstContainer || (t >= C06.remove && t < C06.remove + 500)) {
      const a = s.firstContainer ? ease.out(span(t, C06.a, C06.a + 300)) : 1 - span(t, C06.remove, C06.remove + 500);
      g.rect(x, slotY, cw, slotH, { r: 10, fill: C.blueTint, stroke: C.blue, lw: 1.4, alpha: a });
      g.text(cx, slotY + 34, 'container A', { size: 12, weight: 600, mono: true, align: 'center', color: C.blueText, alpha: a });
    }
    if (s.firstContainerRemoved && t < C06.b - C06.move) g.text(cx, slotY + 34, 'A 제거됨', { size: 12, align: 'center', color: C.muted, alpha: span(t, C06.remove + 200, C06.remove + 500) });
    if (t >= C06.b - C06.move) {
      const q = ease.inOut(span(t, C06.b - C06.move, C06.b));
      g.rect(x, lerp(slotY - 14, slotY, q), cw, slotH, { r: 10, fill: C.greenTint, stroke: C.green, lw: 1.4, alpha: q });
      g.text(cx, lerp(slotY - 14, slotY, q) + 34, 'container B', { size: 12, weight: 600, mono: true, align: 'center', color: C.greenText, alpha: q });
    }
    // mount 연결: 붙어 있는 컨테이너가 있을 때만
    const mounted = s.firstContainer || s.replacement;
    g.line(cx, pipeTop, cx, stTop - 6, { stroke: mounted ? C.ink : C.line, lw: mounted ? 2 : 1.2, dash: mounted ? null : [3, 4] });
    if (cw >= 200) g.text(cx + 8, (pipeTop + stTop) / 2 + 4, 'mount /data', { size: 12, mono: true, color: mounted ? C.ink : C.muted });
    else {
      // 좁은 폭: 기록 칩이 관을 지나는 동안 라벨을 옅게 해 겹치지 않게 한다(표현 전용)
      const transit = (t >= C06.write - C06.move && t < C06.write) || (t >= C06.read - C06.move && t < C06.read), la = transit ? 0.15 : 1;
      g.text(cx + 8, (pipeTop + stTop) / 2 - 4, 'mount', { size: 12, mono: true, color: mounted ? C.ink : C.muted, alpha: la });
      g.text(cx + 8, (pipeTop + stTop) / 2 + 13, '/data', { size: 12, mono: true, color: mounted ? C.ink : C.muted, alpha: la });
    }
    // 저장소
    cylinder(g, cx, stTop, Math.min(cw - 20, 150), stH, { fill: C.paper });
    para(g, x + 4, stTop + stH + 26, where, cw - 8, { color: C.muted, align: 'left' });
    // record A: 쓰기(아래로) → 저장소에 남음 → B가 읽음(위로)
    if (t >= C06.write - C06.move && t < C06.write) { const q = ease.inOut(span(t, C06.write - C06.move, C06.write)); chip(g, cx, lerp(slotY + slotH + 4, stTop + stH / 2 + 4, q), 'record A', 'write'); }
    if (data) chip(g, cx, stTop + stH / 2 + 4, 'record A', 'store');
    if (t >= C06.read - C06.move && t < C06.read) { const q = ease.inOut(span(t, C06.read - C06.move, C06.read)); chip(g, cx, lerp(stTop - 10, slotY + slotH + 4, q), 'record A', 'read'); }
    if (s.replacementRead) g.text(cx, slotY + 52, '읽음: record A', { size: 12, align: 'center', color: C.greenText });
  });
  const ny = para(g, 0, 160 + 66 + 26 + 50, 'mount가 가린 기존 파일은 삭제된 것이 아닙니다. 빈 named volume의 초기 복사와 bind mount의 가림은 구분합니다.', w, { color: C.muted });
  return { ops: g.ops, height: Math.ceil(ny + 10), status: s.phase };
}

/* ---------- C07 빌드와 시작·중지·재시작·제거: 같은 컨테이너의 상태 전환 ---------- */
const C07 = { run: 2000, image: 3200, create: 4000, cmd: 4800, write: 5400, stop: 6200, restart: 7000, rm: 8800, axis: [3600, 9400] };
function lifeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C07', t), narrow = w < 560;
  // Dockerfile
  const dfW = narrow ? w : 168, dfH = 96;
  g.path(`M0 0H${f2(dfW - 16)}L${f2(dfW)} 16V${dfH}H0Z`, { fill: C.paper, stroke: C.ink, lw: 1.3 });
  g.text(12, 22, 'Dockerfile', { size: 12, weight: 600, mono: true });
  g.text(12, 48, 'FROM …', { size: 12, mono: true, color: C.muted });
  g.text(12, 68, 'RUN …', { size: 12, mono: true, color: s.runCalls ? C.blueText : C.ink });
  g.text(12, 88, 'CMD …', { size: 12, mono: true, color: C.ink });
  if (s.runCalls) g.text(dfW - 10, 68, `build 때 ${s.runCalls}회`, { size: 12, align: 'right', color: C.blueText });
  // 이미지
  const imX = narrow ? 0 : dfW + 70, imY = narrow ? dfH + 46 : 28, imW = narrow ? Math.min(160, w) : 150;
  if (t >= C07.run) {
    const q = ease.out(span(t, C07.run, C07.image)), a0 = narrow ? { x: 40, y: dfH + 4 } : { x: dfW + 6, y: 48 }, a1 = narrow ? { x: 40, y: imY - 6 } : { x: imX - 8, y: 48 };
    g.line(a0.x, a0.y, lerp(a0.x, a1.x, q), lerp(a0.y, a1.y, q), { stroke: C.ink, lw: 1.4 });
    if (q >= 1) arrowHead(g, a1, angle(a0, a1), C.ink);
    g.text(narrow ? 52 : (dfW + imX) / 2, narrow ? (a0.y + a1.y) / 2 + 4 : 40, 'build', { size: 12, mono: true, align: narrow ? 'left' : 'center', alpha: q });
  }
  layerGlyph(g, imX, imY, imW, { fill: s.imageExists ? C.slab : C.paper, stroke: s.imageExists ? C.ink : C.line });
  g.text(narrow ? imX + imW + 10 : imX, narrow ? imY + 18 : 74, s.imageExists ? 'image · CMD 저장' : 'image', { size: 12, color: s.imageExists ? C.ink : C.muted });
  // 컨테이너: 하나의 상자가 상태를 바꾼다
  const cX = narrow ? 0 : imX + imW + 56, cY = narrow ? imY + 30 + 46 : 0, cW = narrow ? w : w - cX, cH = 108;
  if (t >= C07.create) { const q = ease.out(span(t, C07.create, C07.create + 300)); const a0 = narrow ? { x: 40, y: imY + 34 } : { x: imX + imW + 6, y: 48 }, a1 = narrow ? { x: 40, y: cY - 6 } : { x: cX - 8, y: 48 }; g.line(a0.x, a0.y, lerp(a0.x, a1.x, q), lerp(a0.y, a1.y, q), { stroke: C.ink, lw: 1.4 }); if (q >= 1) arrowHead(g, a1, angle(a0, a1), C.ink); g.text(narrow ? 52 : (a0.x + a1.x) / 2, narrow ? (a0.y + a1.y) / 2 + 4 : 40, 'create', { size: 12, mono: true, align: narrow ? 'left' : 'center', alpha: q }); }
  const st = s.state, live = t >= C07.create && st !== 'removed', run = st === 'running';
  const rmQ = st === 'removed' ? span(t, C07.rm, C07.rm + 500) : 0;
  g.rect(cX, cY, cW, cH, { r: 12, stroke: C.line, lw: 1, dash: [3, 4] });
  if (live || rmQ < 1 && t >= C07.create) {
    const a = live ? ease.out(span(t, C07.create, C07.create + 300)) : 1 - rmQ;
    g.rect(cX, cY, cW, cH, { r: 12, fill: run ? C.blueTint : C.paper, stroke: run ? C.blue : C.ink, lw: 1.5, dash: st === 'created' ? [4, 3] : null, alpha: a });
    // 쓰기 계층
    g.rect(cX + 10, cY + 10, cW - 20, 26, { r: 6, fill: C.paper, stroke: C.blue, lw: 1.1, dash: [4, 3], alpha: a });
    g.text(cX + 20, cY + 28, s.writableData ? '쓰기 계층 · 데이터 있음' : '쓰기 계층', { size: 12, color: s.writableData ? C.blueText : C.muted, alpha: a });
    procBox(g, cX + 60, cY + 64, run ? 'CMD' : st === 'exited' ? 'CMD 종료' : 'CMD 대기', { running: run, alpha: a });
    g.text(cX + cW - 12, cY + 69, st, { size: 13, weight: 700, mono: true, align: 'right', color: run ? C.blueText : st === 'exited' ? C.orangeText : C.ink, alpha: a });
    g.text(cX + 12, cY + 98, `CMD 실행 ${s.cmdCalls}회`, { size: 12, color: C.muted, alpha: a });
  }
  if (st === 'removed') {
    // 데스크톱 본문(650)에서는 상자 폭이 좁아져 두 줄로 나눈다
    const rows = wrap('rm · 컨테이너와 쓰기 계층 삭제, 이미지는 남음', cW - 24, 12);
    rows.forEach((r, i) => g.text(cX + cW / 2, cY + cH / 2 + 4 + (i - (rows.length - 1) / 2) * 19, r, { size: 12, align: 'center', color: C.muted, alpha: rmQ }));
  }
  // 상태 기록
  const ty = cY + cH + 30;
  g.text(0, ty + 12, '상태', { size: 12, color: C.muted });
  stateTrack(g, 40, ty, w - 40, t, C07.axis, [{ a: 4000, b: 4800, label: 'created', kind: 'idle' }, { a: 4800, b: 6200, label: 'running', kind: 'run' }, { a: 6200, b: 7000, label: 'exited', kind: 'wait' }, { a: 7000, b: 8800, label: 'running', kind: 'run' }]);
  if (t >= C07.rm) { const x = 40 + (C07.rm - C07.axis[0]) / (C07.axis[1] - C07.axis[0]) * (w - 40); g.line(x, ty - 4, x, ty + 20, { stroke: C.red, lw: 1.6 }); g.text(x + 4, ty + 34, 'rm', { size: 12, mono: true, color: C.redText }); }
  return { ops: g.ops, height: Math.ceil(ty + 40), status: s.phase };
}

/* ---------- C08 개별 변경과 같은 이미지로 교체: 서버 세 대 ---------- */
const C08 = { hand: [[2000, 0], [3800, 1]], artifact: 2200, replace: [4000, 6000, 8000], move: 400 };
function immutablePanel(g: G, ox: number, oy: number, pw: number, t: number, mutable: boolean) {
  const s = state('C08', t), vers = mutable ? s.mutable : s.immutable, gap = 12, sw = (pw - 2 * gap) / 3, sy = oy + (mutable ? 54 : 94), sh = 44;
  g.text(ox, oy + 15, mutable ? 'Mutable Server · 서버마다 직접 변경' : 'Immutable Server · 같은 이미지로 교체', { size: 13, weight: 600 });
  const tone = (v: string) => v === 'v2' ? [C.greenTint, C.green, C.greenText] : v === 'v1+' ? [C.orangeTint, C.orange, C.orangeText] : [C.paper, C.ink, C.ink];
  if (!mutable) {
    // v2 이미지 artifact
    const ix = ox + pw / 2 - 50, iy = oy + 30;
    if (t >= C08.artifact) { const q = ease.out(span(t, C08.artifact, C08.artifact + 400)); layerGlyph(g, ix, iy, 100, { fill: C.greenTint, stroke: C.green, alpha: q }); g.text(ix + 110, iy + 20, 'v2 이미지', { size: 12, weight: 600, color: C.greenText, alpha: q }); }
    else { g.rect(ix, iy, 100, 28, { r: 4, stroke: C.line, lw: 1, dash: [3, 4] }); }
  }
  vers.forEach((v, i) => {
    const x = ox + i * (sw + gap), [f, st, tc] = tone(v);
    if (!mutable) {
      const at = C08.replace[i];
      if (t >= at - C08.move && t < at) {
        const q = ease.inOut(span(t, at - C08.move, at));
        serverGlyph(g, x, sy, sw, sh, { alpha: 1 - q });
        serverGlyph(g, x, lerp(sy - 40, sy, q), sw, sh, { fill: C.greenTint, stroke: C.green, alpha: q });
        g.line(ox + pw / 2, oy + 60, x + sw / 2, lerp(sy - 40, sy, q), { stroke: C.green, lw: 1.2, dash: [3, 3], alpha: q });
      } else serverGlyph(g, x, sy, sw, sh, { fill: f, stroke: st });
    } else serverGlyph(g, x, sy, sw, sh, { fill: f, stroke: st, led: v === 'v1+' ? C.orange : C.green });
    g.text(x + sw / 2, sy + sh + 20, v, { size: 13, weight: 700, mono: true, align: 'center', color: tc });
  });
  if (mutable) {
    // 직접 변경: 손이 서버마다 다녀간다
    for (const [at, i] of C08.hand) {
      if (t >= at - C08.move && t < at + 300) {
        const x = ox + i * (sw + gap) + sw / 2, q = ease.inOut(span(t, at - C08.move, at));
        chip(g, x, lerp(oy + 26, sy - 14, q), '수동 변경', 'write', 1 - span(t, at, at + 300));
      }
    }
    const diff = new Set(vers).size;
    g.text(ox, sy + sh + 48, diff > 1 ? `서로 다른 상태 ${diff}가지` : '모두 같은 상태', { size: 12, weight: 600, color: diff > 1 ? C.orangeText : C.muted });
  } else {
    const n = vers.filter(v => v === 'v2').length;
    g.text(ox, sy + sh + 48, n === 0 ? '교체 전' : n < 3 ? `교체 중 · v1과 v2가 섞여 있음` : '교체 완료 · 모두 같은 v2', { size: 12, weight: 600, color: n === 3 ? C.greenText : n ? C.orangeText : C.muted });
  }
  return sy + sh + 56;
}
function immutableV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C08', t), narrow = w < 560, gap = 36, pw = narrow ? w : (w - gap) / 2;
  let y;
  if (narrow) { y = immutablePanel(g, 0, 0, pw, t, true); g.line(0, y + 10, w, y + 10, { stroke: C.grid, lw: 1 }); y = immutablePanel(g, 0, y + 26, pw, t, false); }
  else { const a = immutablePanel(g, 0, 0, pw, t, true), b = immutablePanel(g, pw + gap, 0, pw, t, false); y = Math.max(a, b); }
  return { ops: g.ops, height: Math.ceil(y + 6), status: s.phase };
}

/* ---------- C09 쉘·프로세스·로그와 SIGHUP: fd 연결과 신호 ---------- */
const C09 = { start: 1400, close: 6200, hup: 6500, move: 400 };
function shellPanel(g: G, ox: number, oy: number, pw: number, t: number, nohup: boolean) {
  const s = state('C09', t), closed = s.sessionClosed, alive = nohup ? s.nohupAlive : s.backgroundAlive;
  g.text(ox, oy + 15, nohup ? 'nohup + 로그 redirect + &' : '일반 background (&)', { size: 13, weight: 600 });
  const lines = nohup ? ['$ nohup java -jar [jar파일명]', '  1> [로그파일명] 2>&1 &'] : ['$ java -jar [jar파일명] &'];
  const th = nohup ? 76 : 58;
  terminal(g, ox, oy + 28, pw, th, lines, { dim: closed });
  if (closed) g.text(ox + pw - 10, oy + 42, '세션 종료', { size: 12, weight: 600, align: 'right', color: C.muted });
  const py = oy + 28 + th + 66, pc = { x: ox + pw * 0.34, y: py };
  if (t >= C09.start - C09.move) {
    const q = ease.inOut(span(t, C09.start - C09.move, C09.start)), dead = !alive && t >= C09.hup;
    const a = dead ? 1 - 0.5 * span(t, C09.hup, C09.hup + 400) : q;
    const w = procBox(g, pc.x, lerp(oy + 28 + th, py, q), 'java', { running: alive, stroke: dead ? C.red : C.ink, alpha: a });
    // fd 1·2: 터미널 또는 로그 파일
    if (s.started) {
      const fx = pc.x + w / 2, fy = py, lx = ox + pw - textW('[로그파일명]', 12, true) - 24, ly = py + 40;
      for (const [k, dy] of [['1', -7], ['2', 7]] as [string, number][]) {
        g.circle(fx, fy + dy, 4, { fill: C.paper, stroke: C.ink, lw: 1.2, alpha: a });
        g.text(fx + 8, fy + dy + 4, k, { size: 12, mono: true, color: C.muted, alpha: a });
      }
      if (nohup) {
        fileGlyph(g, lx, ly - 8, null, { color: C.ink });
        g.text(lx + 20, ly + 6, '[로그파일명]', { size: 12, mono: true });
        g.path(`M${f2(fx + 18)} ${f2(fy)}C${f2(fx + 50)} ${f2(fy)} ${f2(lx - 30)} ${f2(ly)} ${f2(lx - 6)} ${f2(ly)}`, { stroke: C.blue, lw: 1.4 });
        arrowHead(g, { x: lx - 4, y: ly }, 0, C.blue);
      } else if (!closed) {
        g.path(`M${f2(fx + 18)} ${f2(fy)}C${f2(fx + 60)} ${f2(fy)} ${f2(fx + 60)} ${f2(oy + 28 + th + 8)} ${f2(fx + 30)} ${f2(oy + 28 + th + 2)}`, { stroke: C.blue, lw: 1.4 });
        g.text(fx + 64, fy - 30, '터미널로', { size: 12, color: C.muted });
      }
    }
    if (dead) { g.path(`M${f2(pc.x - 8)} ${f2(py - 8)}L${f2(pc.x + 8)} ${f2(py + 8)}M${f2(pc.x + 8)} ${f2(py - 8)}L${f2(pc.x - 8)} ${f2(py + 8)}`, { stroke: C.red, lw: 2 }); g.text(pc.x, py + 32, 'SIGHUP으로 종료', { size: 12, weight: 600, align: 'center', color: C.redText }); }
    if (nohup && t >= C09.hup) g.text(pc.x, py + 32, 'SIGHUP 무시 · 계속 실행', { size: 12, weight: 600, align: 'center', color: C.greenText, alpha: ease.out(span(t, C09.hup, C09.hup + 300)) });
  }
  // SIGHUP: 세션 종료 뒤 터미널에서 프로세스로
  if (t >= C09.close && t < C09.hup + 200) {
    const q = ease.inOut(span(t, C09.close, C09.hup)), from = { x: pc.x, y: oy + 28 + th }, p = lerpPt(from, { x: pc.x, y: py - 14 }, q);
    chip(g, p.x, p.y, 'SIGHUP', 'lost', 1 - span(t, C09.hup, C09.hup + 200));
  }
  return py + 48;
}
function shellV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C09', t), narrow = w < 560, gap = 36, pw = narrow ? w : (w - gap) / 2;
  let y;
  if (narrow) { y = shellPanel(g, 0, 0, pw, t, false); g.line(0, y + 6, w, y + 6, { stroke: C.grid, lw: 1 }); y = shellPanel(g, 0, y + 22, pw, t, true); }
  else { y = Math.max(shellPanel(g, 0, 0, pw, t, false), shellPanel(g, pw + gap, 0, pw, t, true)); }
  y = para(g, 0, y + 26, 'nohup은 SIGHUP을 무시하고 출력을 파일로 보낼 뿐, 자동 재시작이나 SIGKILL 보호는 아닙니다.', w, { color: C.muted });
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- C10 원본 10개 명령: 서버 자원 지도 위의 관찰 경로 ---------- */
const C10 = {
  first: 1200, step: 1000,
  short: ['uptime', 'dmesg', 'vmstat', 'mpstat', 'pidstat', 'iostat', 'free', 'sar DEV', 'sar TCP', 'top'],
  obs: ['load average · runnable/blocked', 'kernel 오류와 로그', 'r / b / si / so / us / sy / wa', 'CPU별 %usr / %sys / %idle', '프로세스 CPU · context switch', '디스크 await / util · IOPS', 'available · cache · swap', 'rxkB/s / txkB/s', 'active/s / passive/s / retrans/s', '프로세스와 전체 상태'],
  regions: [['load', '실행 대기열 (load)'], ['cpu', 'CPU 코어'], ['proc', '프로세스'], ['mem', '메모리'], ['disk', '디스크'], ['net', '네트워크 eth0'], ['tcp', 'TCP 연결'], ['klog', '커널 로그']],
  map: [['load'], ['klog'], ['load', 'mem', 'cpu'], ['cpu'], ['proc'], ['disk'], ['mem'], ['net'], ['tcp'], ['proc', 'cpu', 'mem', 'load']],
};
function regionIcon(g: G, key: string, x: number, y: number, color: string) {
  const o = { stroke: color, lw: 1.3 };
  if (key === 'cpu') { g.rect(x + 3, y + 3, 12, 12, { r: 2, ...o }); g.path(`M${x + 7} ${y}V${y + 3}M${x + 11} ${y}V${y + 3}M${x + 7} ${y + 15}V${y + 18}M${x + 11} ${y + 15}V${y + 18}`, o); }
  else if (key === 'mem') { g.rect(x, y + 4, 18, 9, { r: 1.5, ...o }); g.path(`M${x + 4} ${y + 13}V${y + 16}M${x + 9} ${y + 13}V${y + 16}M${x + 14} ${y + 13}V${y + 16}`, o); }
  else if (key === 'disk') cylinder(g, x + 9, y + 3, 16, 11, { stroke: color });
  else if (key === 'net') { g.rect(x + 2, y + 5, 14, 10, { r: 2, ...o }); g.path(`M${x + 6} ${y + 5}V${y + 2}H${x + 12}V${y + 5}`, o); }
  else if (key === 'tcp') { g.circle(x + 4, y + 9, 3.5, { fill: 'none', stroke: color, lw: 1.3 }); g.circle(x + 14, y + 9, 3.5, { fill: 'none', stroke: color, lw: 1.3 }); g.line(x + 7.5, y + 9, x + 10.5, y + 9, o); }
  else if (key === 'klog') { g.rect(x + 2, y + 1, 14, 17, { r: 2, ...o }); g.path(`M${x + 5} ${y + 6}H${x + 13}M${x + 5} ${y + 10}H${x + 13}M${x + 5} ${y + 14}H${x + 10}`, o); }
  else if (key === 'load') for (let i = 0; i < 3; i++) g.circle(x + 3 + i * 6, y + 9, 2.4, { fill: color });
  else if (key === 'proc') g.path(`M${x + 1} ${y + 4}H${x + 17}M${x + 1} ${y + 9}H${x + 17}M${x + 1} ${y + 14}H${x + 12}`, o);
}
function diagnoseV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('C10', t), narrow = w < 560, cols = narrow ? 2 : 4, gap = 10;
  const idx = s.visited - 1, cur = idx >= 0 && t < C10.first + 10 * C10.step ? idx : -1;
  // 터미널: 현재 명령과 그 관찰 값 이름
  const th = 64, shown = cur >= 0 ? cur : s.visited >= 10 ? 9 : -1;
  terminal(g, 0, 0, w, th, shown >= 0 ? ['$ ' + s.commands[shown], '→ ' + C10.obs[shown]] : ['$ _']);
  if (s.visited) g.text(w - 12, 13, `${s.visited} / 10`, { size: 12, mono: true, align: 'right', color: C.muted });
  // 서버 지도
  const top = th + 40, cw = (w - 28 - (cols - 1) * gap) / cols, rh = narrow ? 84 : 78, rows = Math.ceil(C10.regions.length / cols);
  g.rect(0, top - 14, w, rows * (rh + gap) - gap + 28, { r: 14, fill: C.bg, stroke: C.line, lw: 1.2 });
  g.text(14, top - 22, 'Linux 서버', { size: 12, weight: 600, color: C.muted });
  const visitedBy = (key: string) => C10.map.map((keys, i) => keys.includes(key) && i < s.visited ? i : -1).filter(i => i >= 0);
  const cell = (k: number) => ({ x: 14 + (k % cols) * (cw + gap), y: top + Math.floor(k / cols) * (rh + gap) });
  // 관찰선은 칸 뒤로 지나가 다른 칸의 글자를 가리지 않는다
  if (cur >= 0) C10.regions.forEach(([key], k) => {
    if (!C10.map[cur].includes(key)) return;
    const { x, y } = cell(k), q = ease.out(span(t, C10.first + cur * C10.step, C10.first + cur * C10.step + 300));
    g.line(x + cw / 2, th, x + cw / 2, lerp(th, y, q), { stroke: C.blue, lw: 1.4, alpha: 0.8 });
  });
  C10.regions.forEach(([key, label], k) => {
    const { x, y } = cell(k), active = cur >= 0 ? C10.map[cur].includes(key) : false, seen = visitedBy(key);
    g.rect(x, y, cw, rh, { r: 8, fill: active ? C.blueTint : C.paper, stroke: active ? C.blue : seen.length ? C.ink : C.line, lw: active ? 1.6 : 1.1 });
    regionIcon(g, key, x + cw - 28, y + 9, active ? C.blue : seen.length ? C.ink : C.faint);
    para(g, x + 10, y + 22, label, cw - 44, { size: 12, weight: 600, color: active ? C.blueText : seen.length ? C.ink : C.muted, lh: 17 });
    // 명령이 줄을 넘기면 칸 바닥에 맞춰 위로 쌓는다(데스크톱 650에서 4칸 폭이 좁아짐)
    const cmds = seen.map(i => C10.short[i]).join('  '), extra = Math.max(0, wrap(cmds, cw - 20, 12, true).length - (narrow ? 2 : 1));
    para(g, x + 10, y + rh - (narrow ? 30 : 14) - extra * 17, cmds, cw - 20, { size: 12, mono: true, color: C.blueText, lh: 17 });
  });
  const end = top + rows * (rh + gap) - gap + 14;
  const y = para(g, 0, end + 26, '원본 명령 10개와 관찰 영역의 연결입니다. 측정값은 원본 출력에만 있고, 이 지도에는 수치를 만들지 않습니다.', w, { color: C.muted });

  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- T02 Thread 상태: 상태 사이의 이동과 monitor 소유 ---------- */
const T02: { move: number; path: readonly (readonly [string, number])[]; edgeLabel: Record<string, string>; sub: Record<string, readonly [string, string]> } = {
  move: 300,
  path: [['NEW', 0], ['RUNNABLE', 1200], ['BLOCKED', 2400], ['RUNNABLE', 3400], ['WAITING', 4500], ['BLOCKED', 5900], ['RUNNABLE', 6600], ['TIMED_WAITING', 7600], ['RUNNABLE', 8600], ['TERMINATED', 9600]],
  edgeLabel: { 'NEW>RUNNABLE': 'start()', 'RUNNABLE>TERMINATED': 'run() 반환', 'WAITING>BLOCKED': 'notify 뒤' },
  sub: { BLOCKED: ['monitor 대기', 'monitor 대기'], WAITING: ['wait() · monitor 반납', 'wait() · 반납'], TIMED_WAITING: ['sleep() · monitor 유지', 'sleep() · 유지'] },
};
function threadStatesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T02', t), narrow = w < 560;
  // 모니터와 다른 스레드(peer)
  const my = 22;
  g.rect(0, 0, w, 48, { r: 10, fill: C.bg, stroke: C.line, lw: 1 });
  lockGlyph(g, 14, my - 9, s.monitor ? C.ink : C.faint, { open: !s.monitor, s: 1.3 });
  g.text(36, my + 6, 'monitor 소유:', { size: 12, weight: 600 });
  g.text(36 + textW('monitor 소유:', 12) + 8, my + 6, s.monitor || '없음', { size: 12, mono: true, weight: 600, color: s.monitor === 'worker' ? C.blueText : s.monitor === 'peer' ? C.orangeText : C.muted });
  const peer = { x: w - 40, y: my + 2 };
  g.rect(peer.x - 26, peer.y - 12, 52, 24, { r: 12, fill: s.monitor === 'peer' ? C.orangeTint : C.paper, stroke: s.monitor === 'peer' ? C.orange : C.line, lw: 1.2 });
  g.text(peer.x, peer.y + 4.5, 'peer', { size: 12, mono: true, weight: 600, align: 'center', color: s.monitor === 'peer' ? C.orangeText : C.muted });
  if (s.monitor === 'peer') lockGlyph(g, peer.x - 44, peer.y - 7, C.orangeText, { patch: true });
  // 상태 노드: 위 줄은 생명주기, 아래 줄은 세 대기 상태
  const r1 = 108, r2 = narrow ? 250 : 232;
  const pos = narrow
    ? { NEW: [0.1, r1], RUNNABLE: [0.5, r1], TERMINATED: [0.83, r1], BLOCKED: [0.14, r2], WAITING: [0.44, r2], TIMED_WAITING: [0.79, r2] }
    : { NEW: [0.08, r1], RUNNABLE: [0.5, r1], TERMINATED: [0.9, r1], BLOCKED: [0.14, r2], WAITING: [0.5, r2], TIMED_WAITING: [0.85, r2] };
  const P: Record<string, Pt> = Object.fromEntries(Object.entries(pos).map(([k, [fx, y]]) => [k, { x: fx * w, y }]));
  const nodeW = (k: string) => textW(k, 12, true) + 18;
  const offset = (a: string, b: string) => (a === 'BLOCKED' && b === 'RUNNABLE') ? 7 : (a === 'RUNNABLE' && b === 'BLOCKED') ? -7 : (a === 'TIMED_WAITING') ? 7 : (b === 'TIMED_WAITING') ? -7 : 0;
  const ends = (a: string, b: string) => {
    const A = P[a], B = P[b], ang = Math.atan2(B.y - A.y, B.x - A.x), off = offset(a, b), nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off;
    const pad = (k: string) => Math.abs(Math.cos(ang)) > 0.85 ? nodeW(k) / 2 + 4 : 19;
    return [{ x: A.x + Math.cos(ang) * pad(a) + nx, y: A.y + Math.sin(ang) * pad(a) + ny }, { x: B.x - Math.cos(ang) * pad(b) + nx, y: B.y - Math.sin(ang) * pad(b) + ny }];
  };
  const steps = T02.path, labelled = new Set<string>(), allKeys = new Set<string>();
  for (let i = 1; i < steps.length; i++) allKeys.add(steps[i - 1][0] + '>' + steps[i][0]);
  // 아직 지나지 않은 간선은 옅은 안내선
  for (const key of allKeys) { const [a, b] = key.split('>'), [p0, p1] = ends(a, b); g.line(p0.x, p0.y, p1.x, p1.y, { stroke: C.grid, lw: 1.2 }); }
  for (let i = 1; i < steps.length; i++) {
    const [b, at] = steps[i], a = steps[i - 1][0];
    if (t < at - T02.move) continue;
    const [p0, p1] = ends(a, b), key = a + '>' + b, q = ease.inOut(span(t, at - T02.move, at)), tip = lerpPt(p0, p1, q), past = t >= at;
    g.line(p0.x, p0.y, tip.x, tip.y, { stroke: past ? C.muted : C.blue, lw: past ? 1.4 : 1.8 });
    if (q >= 1) arrowHead(g, p1, angle(p0, p1), past ? C.muted : C.blue, 1, 6);
    const label = T02.edgeLabel[key], m = lerpPt(p0, p1, 0.5);
    if (!labelled.has(key) && past && label && p1.x - p0.x > textW(label, 12) + 8 || (!labelled.has(key) && past && label && p0.x - p1.x > textW(label, 12) + 8)) {
      labelled.add(key);
      g.text(m.x, m.y + (a === 'WAITING' ? 18 : -8), label, { size: 12, align: 'center', color: a === 'WAITING' ? C.orangeText : C.muted });
    }
  }
  for (const [k, p] of Object.entries(P)) {
    const cur = s.state === k, nw = nodeW(k), waitKind = k === 'BLOCKED' || k === 'WAITING' || k === 'TIMED_WAITING';
    g.rect(p.x - nw / 2, p.y - 15, nw, 30, { r: 8, fill: cur ? (waitKind ? C.orangeTint : C.blueTint) : C.paper, stroke: cur ? (waitKind ? C.orange : C.blue) : C.line, lw: cur ? 1.8 : 1.1 });
    g.text(p.x, p.y + 4.5, k, { size: 12, mono: true, weight: 600, align: 'center', color: cur ? (waitKind ? C.orangeText : C.blueText) : C.muted });
    if (T02.sub[k]) { const seen = steps.some(([st, at]) => st === k && t >= at); g.text(p.x, p.y + 34, T02.sub[k][narrow ? 1 : 0], { size: 12, align: 'center', color: seen ? C.orangeText : C.muted }); }
  }
  // worker 토큰: 상태 사이를 옮겨 다니고 monitor를 가지면 자물쇠를 단다
  let i = 0;
  while (i + 1 < steps.length && steps[i + 1][1] <= t) i++;
  const nxt = steps[i + 1], here = P[steps[i][0]];
  let wp = { x: here.x, y: here.y - 30 };
  if (nxt && t > nxt[1] - T02.move) wp = lerpPt(wp, { x: P[nxt[0]].x, y: P[nxt[0]].y - 30 }, ease.inOut(span(t, nxt[1] - T02.move, nxt[1])));
  wp.x = Math.max(32, Math.min(w - 32, wp.x));
  g.rect(wp.x - 30, wp.y - 11, 60, 22, { r: 11, fill: C.ink, stroke: C.ink, lw: 1 });
  g.text(wp.x, wp.y + 4.5, 'worker', { size: 12, mono: true, weight: 600, align: 'center', color: '#fff' });
  if (s.monitor === 'worker') lockGlyph(g, wp.x + 34, wp.y - 7, C.blueText, { patch: true });
  const y = para(g, 0, r2 + 72, 'Java SE 21 Thread.State의 한 worker 예입니다. 원본 Arthas 스냅샷: total 46 / RUNNABLE 14 / BLOCKED 0 / WAITING 14 / TIMED_WAITING 6 / internal 12. 이를 이 경로의 실측 변화로 사용하지 않고, WAITING 수만으로 장애를 판정하지 않습니다.', w, { color: C.muted });
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- T03 한 Servlet 인스턴스: 같은 인스턴스 범위 위의 init·service·destroy ---------- */
const T03 = { axis: [800, 8000], init: [1200, 1800], a: [2400, 5000], b: [3000, 5800], destroy: [6900, 7500] };
function servletV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T03', t), narrow = w < 560, lw = narrow ? 0 : 96, X = (tt: number) => lw + (tt - T03.axis[0]) / (T03.axis[1] - T03.axis[0]) * (w - lw);
  const by = narrow ? 40 : 24, rows: [string, readonly number[], 'idle' | 'run'][] = [['init()', T03.init, 'idle'], ['요청 A · service()', T03.a, 'run'], ['요청 B · service()', T03.b, 'run'], ['destroy()', T03.destroy, 'idle']];
  const rowH = narrow ? 48 : 40, last = by + 56 + 3 * rowH + 16;
  if (t >= T03.axis[0] && t <= T03.axis[1]) g.line(X(t), by - 6, X(t), last + 4, { stroke: C.blue, lw: 1, alpha: 0.55 });
  if (narrow) g.text(0, 14, 'Servlet 인스턴스 1개', { size: 12, weight: 600 }); else g.text(0, by + 15, '인스턴스', { size: 12, weight: 600 });
  // 인스턴스 범위: init 시작부터 destroy 끝까지 하나의 띠
  const live = t >= T03.init[0], end = s.destroyed ? T03.destroy[1] : Math.min(t, T03.axis[1]);
  g.rect(X(T03.init[0]), by, X(T03.destroy[1]) - X(T03.init[0]), 22, { r: 6, stroke: C.line, lw: 1, dash: [3, 4] });
  if (live) g.rect(X(T03.init[0]), by, Math.max(2, X(end) - X(T03.init[0])), 22, { r: 6, fill: C.slab, stroke: C.ink, lw: 1.3 });
  if (live && !narrow) g.text(X(T03.init[0]) + 10, by + 15, s.destroyed ? 'Servlet 인스턴스 1개 · 종료' : 'Servlet 인스턴스 1개', { size: 12, weight: 600 });
  // 두 service가 같은 인스턴스에서 겹치는 구간
  if (t >= T03.b[0]) { const a = X(T03.b[0]), e = X(Math.min(t, T03.a[1])); g.rect(a, by - 4, Math.max(0, e - a), 30, { r: 6, fill: C.blueSoft, alpha: 0.45 }); if (t >= T03.a[1] || !narrow) g.text((a + X(T03.a[1])) / 2, by - 8, '동시 실행', { size: 12, weight: 600, align: 'center', color: C.blueText, alpha: span(t, T03.b[0], T03.b[0] + 300) }); }
  rows.forEach(([label, [a, b], kind], i) => {
    const y = by + 56 + i * rowH;
    if (narrow) g.text(0, y - 6, label, { size: 12, color: C.muted }); else g.text(0, y + 12, label.replace(' · service()', ''), { size: 12, color: C.muted });
    g.rect(X(T03.axis[0]), y, w - lw, 16, { r: 3, fill: C.bg });
    if (t > a) {
      const done = t >= b;
      g.line(X(a), y, X(a), by + 22, { stroke: kind === 'run' ? C.blue : C.green, lw: 1.2, dash: [3, 3], alpha: 0.8 });
      g.rect(X(a), y, Math.max(2, X(Math.min(t, b)) - X(a)), 16, { r: 3, fill: kind === 'run' ? C.blueTint : C.greenTint, stroke: kind === 'run' ? (done ? C.blueSoft : C.blue) : C.green, lw: 1.2 });
    }
  });
  const y = para(g, 0, last + 30, `init ${s.initCalls}회 · 실행 중 service ${s.activeServices}개 · 완료 ${s.completed}개 · destroy ${s.destroyCalls}회`, w, { color: C.ink });
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- T05 실행 슬롯과 대기·완료: 같은 작업의 이동 ---------- */
const T05 = { arrivals: [1700, 2300, 2900, 3500], run: 3500, fixed: [1700, 2300, 5200, 5800], fixedSlot: [0, 1, 0, 1], move: 300 };
function poolPanel(g: G, ox: number, oy: number, pw: number, t: number, fixed: boolean) {
  const s = state('T05', t)[fixed ? 'fixed' : 'cached'], starts = fixed ? T05.fixed : T05.arrivals, slotOf = (i: number) => fixed ? T05.fixedSlot[i] : i;
  para(g, ox, oy + 15, fixed ? 'fixed(2) · 실행 슬롯 2개' : 'cached · 필요할 때 worker 생성', pw, { size: 13, weight: 600 });
  const top = oy + 34, qx = ox, qw = pw * 0.24, sx = ox + pw * 0.31, sw = pw * 0.4, dx = ox + pw * 0.78, dw = pw * 0.22, sh = 34, sg = 8;
  const nSlots = fixed ? 2 : 4, slotY = (k: number) => top + 20 + k * (sh + sg), H = 20 + 4 * (sh + sg);
  g.text(qx, top + 10, '대기', { size: 12, color: C.muted });
  g.rect(qx, top + 20, qw, H - 28, { r: 8, fill: C.orangeTint, stroke: C.orange, lw: 1, dash: [3, 3] });
  g.text(sx, top + 10, fixed ? '실행 슬롯' : 'worker', { size: 12, color: C.muted });
  for (let k = 0; k < nSlots; k++) {
    const created = fixed || t >= T05.arrivals[k] - T05.move, a = fixed ? 1 : ease.out(span(t, T05.arrivals[k] - T05.move, T05.arrivals[k]));
    if (created) g.rect(sx, slotY(k), sw, sh, { r: 8, fill: C.paper, stroke: C.ink, lw: 1.3, alpha: a });
    else g.rect(sx, slotY(k), sw, sh, { r: 8, stroke: C.line, lw: 1, dash: [3, 4] });
  }
  g.text(dx, top + 10, '완료', { size: 12, color: C.muted });
  g.rect(dx, top + 20, dw, H - 28, { r: 8, fill: C.greenTint, stroke: C.green, lw: 1, dash: [3, 3] });
  const R = 12, qPos = (k: number) => ({ x: qx + qw / 2, y: top + 44 + k * 30 }), sPos = (k: number) => ({ x: sx + 18, y: slotY(k) + sh / 2 }), dPos = (k: number) => ({ x: dx + dw / 2, y: top + 44 + k * 30 });
  for (let i = 0; i < 4; i++) {
    const a = T05.arrivals[i], st = starts[i], en = st + T05.run, id = i + 1;
    if (t < a - T05.move) continue;
    const queued = T05.arrivals.slice(0, i).filter((aa, j) => starts[j] > aa).length, qp = qPos(queued), sp = sPos(slotOf(i)), dp = dPos(i);
    const entry = st > a ? qp : sp;
    let p: Pt, kind: 'pre' | 'wait' | 'run' | 'done';
    if (t < a) { p = lerpPt({ x: ox + 14, y: entry.y - 18 }, entry, ease.inOut(span(t, a - T05.move, a))); kind = 'pre'; }
    else if (t < st - T05.move) { p = qp; kind = 'wait'; }
    else if (t < st) { p = lerpPt(qp, sp, ease.inOut(span(t, st - T05.move, st))); kind = 'wait'; }
    else if (t < en - T05.move) { p = sp; kind = 'run'; }
    else if (t < en) { p = lerpPt(sp, dp, ease.inOut(span(t, en - T05.move, en))); kind = 'run'; }
    else { p = dp; kind = 'done'; }
    if (t >= st && t < en - T05.move) {
      const x0 = sx + 36, bw = sw - 46;
      g.rect(x0, sp.y - 4, bw, 8, { r: 4, fill: C.bg, stroke: C.line, lw: 1 });
      g.rect(x0, sp.y - 4, Math.max(1, bw * span(t, st, en)), 8, { r: 4, fill: C.blue });
    }
    const tone = { pre: [C.paper, C.line, C.muted], wait: [C.paper, C.orange, C.orangeText], run: [C.blue, C.blue, '#fff'], done: [C.paper, C.green, C.greenText] }[kind];
    g.circle(p.x, p.y, R, { fill: tone[0], stroke: tone[1], strokeWidth: 1.4 });
    g.text(p.x, p.y + 4.5, id, { size: 12, mono: true, weight: 700, align: 'center', color: tone[2] });
  }
  const y = top + H + 14;
  g.text(ox, y, `유입 ${s.arrived.length} = 대기 ${s.pending.length} + 실행 ${s.active.length} + 완료 ${s.done.length}`, { size: 12, mono: true });
  if (!fixed) g.text(ox, y + 20, `worker ${Math.min(4, s.arrived.length)}개 생성 · 설정 상한 아님`, { size: 12, color: C.muted });
  return y + (fixed ? 8 : 28);
}
function poolV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T05', t), narrow = w < 560, gap = 36, pw = narrow ? w : (w - gap) / 2;
  let y;
  if (narrow) { y = poolPanel(g, 0, 0, pw, t, true); g.line(0, y + 12, w, y + 12, { stroke: C.grid, lw: 1 }); y = poolPanel(g, 0, y + 28, pw, t, false); }
  else y = Math.max(poolPanel(g, 0, 0, pw, t, true), poolPanel(g, pw + gap, 0, pw, t, false));
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}

/* ---------- T07 Virtual Thread와 Coroutine: 대기 상태를 어디에 두고 누가 재개하나 ---------- */
const T07 = { wait: 2500, resume: 5600, done: 8300, move: 400 };
function coroutinePanel(g: G, ox: number, oy: number, pw: number, t: number, kt: boolean) {
  const s = state('T07', t), saved = kt ? s.coroutine.savedContinuation : s.virtual.savedStack;
  g.text(ox, oy + 15, kt ? 'Kotlin Coroutine' : 'Java Virtual Thread', { size: 13, weight: 600 });
  const sw = (pw - 12) / 2, sy = oy + 50, sh = 46, names = kt ? ['worker A', 'worker B'] : ['carrier A', 'carrier B'];
  g.text(ox, oy + 40, kt ? 'Dispatcher의 worker 스레드' : 'carrier · 플랫폼 스레드', { size: 12, color: C.muted });
  names.forEach((n, i) => {
    const x = ox + i * (sw + 12), mine = (kt ? s.coroutine.worker : s.virtual.carrier) === (kt ? 'dispatcher ' : 'carrier ') + (i ? 'B' : 'A');
    g.rect(x, sy, sw, sh, { r: 8, fill: mine ? C.blueTint : C.paper, stroke: mine ? C.blue : C.ink, lw: 1.3 });
    g.text(x + 10, sy + 17, n, { size: 12, mono: true, color: mine ? C.blueText : C.muted });
  });
  // heap: 대기 중에 보관되는 상태
  const hy = sy + sh + 46, hh = 84, hx = ox + 12;
  g.rect(ox, hy, pw, hh, { r: 10, fill: C.bg, stroke: C.muted, lw: 1.1, dash: [4, 3] });
  g.text(ox + pw - 10, hy + 18, 'heap', { size: 12, weight: 600, align: 'right', color: C.muted });
  if (t >= T07.wait) g.text(ox + 12, hy + 18, kt ? '실제 suspend 지점에서 대기' : '지원되는 blocking I/O에서 대기', { size: 12, color: C.orangeText });
  if (saved || t >= T07.resume) {
    const q = saved ? ease.out(span(t, T07.wait, T07.wait + 300)) : 0.3, bw = Math.min(140, pw - 150);
    if (kt) { g.rect(hx, hy + 32, bw, 40, { r: 6, fill: C.orangeTint, stroke: C.orange, lw: 1.3, alpha: q }); g.text(hx + 10, hy + 49, 'continuation', { size: 12, mono: true, color: C.orangeText, alpha: q }); g.text(hx + 10, hy + 65, 'label · 지역 변수', { size: 12, color: C.orangeText, alpha: q }); }
    else { for (let i = 0; i < 3; i++) g.rect(hx, hy + 34 + i * 12, bw, 10, { r: 2, fill: C.orangeTint, stroke: C.orange, lw: 1.1, alpha: q }); g.text(hx + bw + 8, hy + 56, 'stack 보관', { size: 12, color: C.orangeText, alpha: q }); }
  }
  // 정체성 토큰: A에서 실행 → heap에 보관 → B에서 재개 → 완료
  const A = { x: ox + sw / 2, y: sy + 32 }, B = { x: ox + sw + 12 + sw / 2, y: sy + 32 }, Hp = { x: ox + pw - 44, y: hy + 44 }, label = kt ? 'C1' : 'VT1';
  let p = A, kind: 'run' | 'wait' | 'done' = 'run';
  if (t >= T07.wait - T07.move && t < T07.wait) p = lerpPt(A, Hp, ease.inOut(span(t, T07.wait - T07.move, T07.wait)));
  else if (t >= T07.wait && t < T07.resume - T07.move) { p = Hp; kind = 'wait'; }
  else if (t >= T07.resume - T07.move && t < T07.resume) { p = lerpPt(Hp, B, ease.inOut(span(t, T07.resume - T07.move, T07.resume))); kind = 'wait'; }
  else if (t >= T07.resume) { p = B; kind = s.finished ? 'done' : 'run'; }
  // 대기로 내려가고(A → heap), 재개 주체가 다른 worker로 올린다(heap → B)
  if (t >= T07.wait) g.line(A.x, sy + sh + 2, A.x, hy - 2, { stroke: C.orange, lw: 1.2, dash: [4, 3], alpha: 0.7 });
  if (t >= T07.resume) {
    g.line(B.x, hy - 2, B.x, sy + sh + 6, { stroke: C.blue, lw: 1.3 });
    arrowHead(g, { x: B.x, y: sy + sh + 4 }, -Math.PI / 2, C.blue, 1, 6);
    g.text(B.x - 8, (sy + sh + hy) / 2 + 4, kt ? 'Dispatcher가 재개' : 'JVM scheduler가 재개', { size: 12, align: 'right', color: C.blueText });
  }
  const tone = { run: [C.blue, C.blue, '#fff'], wait: [C.orangeTint, C.orange, C.orangeText], done: [C.greenTint, C.green, C.greenText] }[kind];
  g.rect(p.x - 24, p.y - 11, 48, 22, { r: 11, fill: tone[0], stroke: tone[1], lw: 1.3 });
  g.text(p.x, p.y + 4.5, label, { size: 12, mono: true, weight: 700, align: 'center', color: tone[2] });
  return hy + hh;
}
function coroutineV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('T07', t), narrow = w < 560, gap = 36, pw = narrow ? w : (w - gap) / 2;
  let y;
  if (narrow) { y = coroutinePanel(g, 0, 0, pw, t, false); g.line(0, y + 14, w, y + 14, { stroke: C.grid, lw: 1 }); y = coroutinePanel(g, 0, y + 30, pw, t, true); }
  else y = Math.max(coroutinePanel(g, 0, 0, pw, t, false), coroutinePanel(g, pw + gap, 0, pw, t, true));
  y = para(g, 0, y + 30, '두 모델을 같은 메커니즘으로 그리지 않습니다. Coroutine의 일반 blocking 호출은 자동 suspend되지 않으며 context와 dispatcher에 따라 worker 선택이 달라집니다. 재개 worker B는 이 예의 선택입니다.', w, { color: C.muted });
  return { ops: g.ops, height: Math.ceil(y + 10), status: s.phase };
}


/* ---------- 내보내기 ---------- */
export const systemRenderers: Record<SystemFigureId, (width: number, elapsed: number) => LessonFrame> = { C01: vmV2, C02: cliV2, C03: namespacesV2, C04: layersV2, C05: bridgeV2, C06: volumesV2, C07: lifeV2, C08: immutableV2, C09: shellV2, C10: diagnoseV2, T02: threadStatesV2, T03: servletV2, T04: counterV2, T05: poolV2, T06: carriersV2, T07: coroutineV2, T08: copiesV2 };
export const systemZones = T06.zones;
export const systemZoneAt = zoneAt;
