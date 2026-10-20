/** B07 과정 5종과 B08 채택 1종(X05) 렌더러. 공통 그리기 도구(lessonCanvas)와 사건 모델(process-models)만 쓰고, Canvas와 정적 SVG가 같은 명령을 읽는다. */
import { C, TONE, appear, arrowHead, draw, ease, f2, frame, para, span, textW, wrap, type G, type LessonFrame, type Pt } from './lessonCanvas';
import { along, route } from './infraCanvas';
import { E01, E01_BUBBLE, E01_DASHES, E01_NODES, E02, E02_CLEAN, E02_COLS, E02_ROWS, E03, E03_CARDS, E03_DUP, E03_HOTSPOTS, E03_LEGEND, E03_PATH, E03_REST, E04, E04_ARROWS, E04_LIT, E04_MANAGEMENT, E04_NODES, E05, E05_CARD_AT, E05_CODE, E05_HISTORY, e01, e02, e02CellAt, e02Points, e03, e03At, e03Leg, e04, e04ArrowDone, e05, x05, X05, X05_ACTION, X05_LANES, X05_STAGES, type Cell, type E04Node, type ProcessFigureId, type Sticky } from './process-models';

/* B07 공통 도구 */
type Box = { x: number; y: number; w: number; h: number };
const mid = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
// 상자 가운데에서 q 쪽으로 나가는 선이 테두리와 만나는 점
function edge(b: Box, q: Pt): Pt {
  const c = mid(b), dx = q.x - c.x, dy = q.y - c.y;
  const k = Math.min(Math.abs(dx) > 1e-6 ? b.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}
// [a, b] 동안 경로를 따라 그려지는 화살표: 그 사이에는 머리 점, 도착 뒤에는 완성된 화살표
function grow(g: G, t: number, pts: Pt[], a: number, b: number, color: string, o: { dash?: number[] | null; lw?: number } = {}) {
  if (t < a) return;
  if (t >= b) { route(g, pts, color, { dash: o.dash, lw: o.lw ?? 1.5 }); return; }
  const u = ease.inOut(span(t, a, b)), head = along(pts, u), seg = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)), total = seg.reduce((n, d) => n + d, 0);
  const drawn: Pt[] = [pts[0]];
  let d = u * total;
  for (let i = 0; i < seg.length && d > seg[i]; i++) { drawn.push(pts[i + 1]); d -= seg[i]; }
  drawn.push(head);
  g.path('M' + drawn.map(p => `${f2(p.x)} ${f2(p.y)}`).join('L'), { stroke: color, lw: o.lw ?? 1.5, dash: o.dash ?? null });
  g.circle(head.x, head.y, 4.5, { fill: color });
}
// 경로 위를 지나가는 점만(선은 이미 있을 때)
function dot(g: G, t: number, pts: Pt[], a: number, b: number, color: string = C.blue) {
  if (t < a || t >= b) return;
  const h = along(pts, ease.inOut(span(t, a, b)));
  g.circle(h.x, h.y, 4.5, { fill: color });
}
// 가운데 정렬 여러 줄 글자
function lines(g: G, b: Box, rows: readonly string[], o: { size?: number; weight?: number; color?: string; mono?: boolean; alpha?: number; lh?: number } = {}) {
  const size = o.size ?? 11, lh = o.lh ?? 14, top = b.y + b.h / 2 - (rows.length - 1) * lh / 2 + size * 0.36;
  rows.forEach((r, i) => g.text(b.x + b.w / 2, top + i * lh, r, { size, weight: o.weight ?? 400, color: o.color ?? C.ink, mono: o.mono, align: 'center', alpha: o.alpha ?? 1, cont: i > 0 }));
}

/* ---------- E01 ATDD 과정: 원본 그림의 C자 배치(넓은 폭) / 두 열 지그재그(좁은 폭) ---------- */
const E01_X = [100, 218, 332, 439, 515, 433, 324, 212, 103], E01_Y = [125, 80, 34, 80, 160, 235, 280, 235, 280];
function atddV2(w: number, t: number): LessonFrame {
  const g = draw(), s = e01(t), wide = w >= 560;
  const boxes: Box[] = E01_NODES.map(([text, kind], i) => {
    const bw = kind === 'activity' ? 92 : textW(text, 12) + 30, bh = 30;
    const cx = wide ? E01_X[i] * w / 650 : (kind === 'activity' ? 0.27 : 0.64) * w, cy = wide ? E01_Y[i] : 26 + i * 44;
    return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
  });
  // 점선 3개: 활동끼리(다음 활동이 켜질 때)
  E01_DASHES.forEach(([from, to], i) => {
    if (!s.dashes[i]) return;
    const a = boxes[from], b = boxes[to], p = wide ? edge(a, mid(b)) : { x: mid(a).x, y: a.y + a.h }, q = wide ? edge(b, mid(a)) : { x: mid(b).x, y: b.y };
    route(g, [p, q], C.orange, { dash: [4, 4], alpha: 0.55 * appear(t, s.on[to]) });
  });
  // 실선 8개: 노드 i → i+1, 지나가는 점이 도착하면 완성
  E01.legs.forEach(([a, b], i) => grow(g, t, [edge(boxes[i], mid(boxes[i + 1])), edge(boxes[i + 1], mid(boxes[i]))], a, b, C.orange));
  // 노드: 켜지기 전에는 점선 윤곽, 켜지면 활동(사각형)·산출물(타원) 색
  E01_NODES.forEach(([text, kind], i) => {
    const b = boxes[i], r = kind === 'activity' ? 4 : b.h / 2, tone = kind === 'activity' ? TONE.orange : TONE.green;
    g.rect(b.x, b.y, b.w, b.h, { r, fill: C.paper, stroke: C.line, dash: [3, 3] });
    if (s.lit[i]) g.rect(b.x, b.y, b.w, b.h, { r, fill: tone.tint, stroke: tone.line, lw: 1.3, alpha: appear(t, s.on[i]) });
    g.text(b.x + b.w / 2, b.y + 19.5, text, { size: 12, weight: 600, align: 'center', color: s.lit[i] ? (kind === 'activity' ? C.ink : C.greenText) : C.muted });
  });
  // Develop 말풍선 5칸
  const dev = boxes[5];
  let top: number, chips: Box[], bottom: number;
  if (wide) {
    top = 322; bottom = 412;
    const x0 = 24, x1 = w - 8, cw = (x1 - x0 - 28 - 4 * 18) / 5;
    g.rect(x0, top, x1 - x0, bottom - top, { r: 18, fill: C.bg, stroke: C.line, lw: 1.2 });
    const tx = mid(dev).x;
    g.path(`M${f2(tx - 12)} ${top + 0.6}L${f2(tx + 4)} ${dev.y + dev.h + 8}L${f2(tx + 10)} ${top + 0.6}Z`, { fill: C.bg });
    g.line(tx - 12, top, tx + 4, dev.y + dev.h + 8, { stroke: C.line, lw: 1.2 });
    g.line(tx + 10, top, tx + 4, dev.y + dev.h + 8, { stroke: C.line, lw: 1.2 });
    chips = E01_BUBBLE.map((_, i) => ({ x: x0 + 14 + i * (cw + 18), y: top + 25, w: cw, h: 40 }));
  } else {
    top = boxes[8].y + boxes[8].h + 24;
    const cw = (w - 24 - 2 * 14) / 3, r1 = top + 12, r2 = r1 + 40 + 22;
    bottom = r2 + 40 + 12;
    g.rect(0, top, w, bottom - top, { r: 14, fill: C.bg, stroke: C.line, lw: 1.2 });
    chips = E01_BUBBLE.map((_, i) => ({ x: 12 + (i % 3) * (cw + 14), y: i < 3 ? r1 : r2, w: cw, h: 40 }));
  }
  chips.forEach((b, i) => {
    if (i > 0 && s.chips[i]) {
      const p = chips[i - 1], a = appear(t, E01.chips[i]);
      if (p.y === b.y) route(g, [{ x: p.x + p.w + 2, y: p.y + p.h / 2 }, { x: b.x - 2, y: b.y + b.h / 2 }], C.orange, { alpha: a });
      else route(g, [{ x: p.x + p.w / 2, y: p.y + p.h }, { x: p.x + p.w / 2, y: p.y + p.h + 11 }, { x: b.x + b.w / 2, y: p.y + p.h + 11 }, { x: b.x + b.w / 2, y: b.y - 1 }], C.orange, { alpha: a });
    }
    g.rect(b.x, b.y, b.w, b.h, { r: 4, fill: C.paper, stroke: C.line, dash: [3, 3] });
    if (s.chips[i]) g.rect(b.x, b.y, b.w, b.h, { r: 4, fill: TONE.orange.tint, stroke: TONE.orange.line, lw: 1.2, alpha: appear(t, E01.chips[i]) });
    lines(g, b, E01_BUBBLE[i], { weight: 600, color: s.chips[i] ? C.ink : C.muted });
  });
  return frame(g, bottom + 6, s.phase);
}

/* ---------- E02 테스트 범위·격리: 테스트 5종 × 칸 5개, 인수테스트의 @BeforeEach TRUNCATE ---------- */
function testScopeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = e02(t), wide = w >= 560;
  const L = wide ? 140 : 0, gap = wide ? 8 : 4, cw = (w - L - 4 * gap) / 5, top0 = wide ? 26 : 22, rowH = wide ? 46 : 64, cellY = wide ? 4 : 20, ch = 36;
  const colX = (c: number) => L + c * (cw + gap);
  const short = ['Ctrl', 'Svc', 'Repo', 'DB', '도메인'];
  E02_COLS.forEach((name, c) => g.text(colX(c) + cw / 2, 14, wide ? name : short[c], { size: 11, weight: 600, align: 'center', color: C.muted }));
  const rowStart = (r: number) => r === 0 ? E02.acc1[0] : E02.rows[r - 1][0];
  E02_ROWS.forEach((row, r) => {
    const ry = top0 + r * rowH, started = t >= rowStart(r), y = ry + cellY;
    if (wide) { g.text(0, ry + 18, row.name, { size: 12, weight: 700, color: started ? C.ink : C.muted }); g.text(0, ry + 33, row.driver, { size: 11, color: C.muted }); }
    else { g.text(0, ry + 13, row.name, { size: 12, weight: 700, color: started ? C.ink : C.muted }); g.text(textW(row.name, 12) + 8, ry + 13, row.driver, { size: 11, color: C.muted }); }
    row.cells.forEach((kind: Cell, c) => {
      const x = colX(c), at = e02CellAt(r, c);
      if (kind === 'na') return;
      g.rect(x, y, cw, ch, { r: 5, stroke: C.grid, dash: [3, 3] });
      if (kind === 'out') {
        if (!started) return;
        g.rect(x, y, cw, ch, { r: 5, fill: C.bg, stroke: C.grid, alpha: appear(t, rowStart(r)) });
        g.text(x + cw / 2, y + 22, '—', { size: 11, align: 'center', color: C.muted });
        return;
      }
      if (at === null || t < at) return;
      const a = appear(t, at), mockText = wide ? 'MockBean' : 'Mock', b = { x, y, w: cw, h: ch };
      if (kind === 'mock') { g.rect(x, y, cw, ch, { r: 5, fill: C.paper, stroke: C.orange, dash: [4, 3], lw: 1.3, alpha: a }); lines(g, b, [mockText], { weight: 600, color: C.orangeText }); return; }
      g.rect(x, y, cw, ch, { r: 5, fill: C.greenTint, stroke: C.green, lw: 1.3, alpha: a });
      if (kind === 'run') lines(g, b, ['실행'], { weight: 600, color: C.greenText });
      else if (kind === 'h2') lines(g, b, ['h2'], { weight: 600, color: C.greenText, mono: true });
      else if (kind === 'db') { g.text(x + cw / 2, y + 15, 'DB', { size: 11, weight: 600, align: 'center', color: C.greenText }); g.text(x + cw / 2, y + 29, `행 ${s.rows}`, { size: 11, align: 'center', color: C.ink }); }
      else { g.text(x + cw / 2, y + 15, '웹 계층', { size: 11, weight: 600, align: 'center', color: C.greenText }); g.text(x + cw / 2, y + 29, mockText, { size: 11, weight: 600, align: 'center', color: C.orangeText }); }
    });
    // 요청 점: path의 칸을 차례로 지난다(구간마다 같은 시간, 도착 시각 = 칸이 켜지는 시각). 직접 호출은 첫 칸에서 출발
    const xs = e02Points(r).map(c => c < 0 ? (wide ? L - 14 : 6) : colX(c) + cw / 2), n = xs.length - 1, cy = y + ch / 2;
    const windows = r === 0 ? [E02.acc1, E02.acc2] : [E02.rows[r - 1]];
    if (n > 0) windows.forEach(([a, b]) => {
      if (t < a || t >= b) return;
      const u = (t - a) / (b - a) * n, k = Math.min(n - 1, Math.floor(u)), x = xs[k] + (xs[k + 1] - xs[k]) * ease.inOut(u - k);
      g.circle(x, cy, 4.5, { fill: C.blue });
    });
  });
  // 범례
  let y = top0 + 5 * rowH + 14;
  const legend = wide ? ['— 범위 밖 · 도메인 열은 단위 테스트만 표시'] : ['Ctrl·Svc·Repo: Controller·Service·Repository', 'Mock: @MockBean · — 범위 밖', '도메인 열은 단위 테스트만 표시'];
  legend.forEach(l => { y = para(g, 0, y, l, w, { size: 11, color: C.muted }) + 16; });
  // 인수테스트 격리: 다음 테스트의 @BeforeEach에서 databaseCleanup.execute()
  y = para(g, 0, y + 8, '@BeforeEach → databaseCleanup.execute()', w, { size: 12, weight: 700, color: t >= E02.clean[0] ? C.ink : C.muted }) + 12;
  E02_CLEAN.forEach((step, i) => {
    const bw = textW(step, 11, true) + 16, by = y + i * 28, on = s.clean[i];
    if (i > 0) g.line(10, by - 6, 10, by, { stroke: on ? C.blue : C.line, lw: 1.3 });
    g.rect(0, by, bw, 22, { r: 5, fill: C.paper, stroke: C.line, dash: [3, 3] });
    if (on) g.rect(0, by, bw, 22, { r: 5, fill: C.blueTint, stroke: C.blue, lw: 1.2, alpha: appear(t, E02.clean[i]) });
    g.text(8, by + 15, step, { size: 11, mono: true, weight: on ? 600 : 400, color: on ? C.blueText : C.muted });
  });
  return frame(g, y + 4 * 28 + 2, s.phase);
}

/* ---------- E03 이벤트스토밍: 카드 색은 글의 범례(주황 이벤트·파랑 커맨드·연보라 정책·분홍 시스템·노랑 액터·초록 리드 모델·자주 핫스팟·연노랑 애그리거트) ---------- */
// 포스트잇 색은 이 도해 전용(공용 팔레트의 주황은 다른 도해에서 다른 뜻). 글자는 모두 진한 회색으로 4.5:1 이상
const STICKY: Record<Sticky, { fill: string; line: string }> = {
  event: { fill: '#ffc078', line: '#e8590c' }, command: { fill: '#a5d8ff', line: '#1c7ed6' }, policy: { fill: '#d0bfff', line: '#7048e8' }, system: { fill: '#fcc2d7', line: '#d6336c' },
  actor: { fill: '#ffe066', line: '#f08c00' }, read: { fill: '#b2f2bb', line: '#37b24d' }, hotspot: { fill: '#ff8787', line: '#e03131' }, aggregate: { fill: '#fff3bf', line: '#f08c00' },
};
const SCATTER: Record<string, [number, number]> = { e1: [16, -10], e2: [-16, -10], e2b: [-14, -6], e3: [-18, 8], e4: [16, 10], dup: [-14, 12] };
function sticky(g: G, b: Box, text: string, kind: Sticky, alpha = 1) {
  g.rect(b.x, b.y, b.w, b.h, { r: 3, fill: STICKY[kind].fill, stroke: STICKY[kind].line, lw: 1, alpha });
  lines(g, b, wrap(text, b.w - 10, 11), { alpha });
}
function stormV2(w: number, t: number): LessonFrame {
  const g = draw(), s = e03(t), gap = 10, CH = 50;
  const cw = Math.min(150, (w - 40 - 2 * gap) / 3), X0 = (w - (3 * cw + 2 * gap)) / 2, X1 = X0 + 3 * cw + 2 * gap;
  const colX = (c: number) => X0 + c * (cw + gap), xL = X0 - 16, xR1 = X1 + 16, xR2 = X1 + 10;
  // 범례: 글의 8종(흐르는 칩)
  let lx = 0, ly = 12;
  for (const [kind, name] of E03_LEGEND) {
    const iw = 14 + textW(name, 11) + 12;
    if (lx + iw > w) { lx = 0; ly += 18; }
    g.rect(lx, ly - 9, 10, 10, { r: 2, fill: STICKY[kind].fill, stroke: STICKY[kind].line, lw: 1 });
    g.text(lx + 14, ly, name, { size: 11, color: C.muted });
    lx += iw;
  }
  // 시간 축(왼쪽 → 오른쪽)
  const ty = ly + 22;
  if (t >= E03.align[0]) {
    const a = appear(t, E03.align[0]);
    g.text(X0, ty + 4, '시간', { size: 11, color: C.muted, alpha: a });
    route(g, [{ x: X0 + 30, y: ty }, { x: X1, y: ty }], C.faint, { alpha: a });
  }
  // 줄 위치
  const hot = E03_HOTSPOTS.map(h => ({ ...h, rows: wrap(h.text, 2 * cw + gap - 10, 11) }));
  const hotH = (i: number) => hot[i].rows.length * 14 + 14;
  const bm = ty + 16, row1 = bm + 8 + 26 + 12, hot1 = row1 + CH + 10, row2 = hot1 + hotH(0) + 20, row3 = row2 + 2 * CH + 6 + 22, row4 = row3 + CH + 16, mBottom = row4 + CH + 8;
  const ba = mBottom + 22, entry = ba + 8 + 26 + 12, login = entry + CH + 22, hot2 = login + CH + 10, aBottom = hot2 + hotH(1) + 8;
  const rowTop = (area: string, row: number) => area === 'm' ? [0, row1, row2, row3, row4][row] : [0, entry, login][row];
  const slot = (id: string): Box => { const c = E03_CARDS.find(x => x.id === id)!; return { x: colX(c.col), y: rowTop(c.area, c.row) + ('stack' in c ? CH + 6 : 0), w: cw, h: CH }; };
  // 경계와 애그리거트(경계 단계)
  if (s.bound) {
    const a = appear(t, E03.bound);
    for (const [y0, y1, name] of [[bm, mBottom, '회원'], [ba, aBottom, '인증']] as const) {
      g.rect(X0 - 6, y0, X1 - X0 + 12, y1 - y0, { r: 10, stroke: C.ink, lw: 1.2, alpha: a });
      sticky(g, { x: colX(0), y: y0 + 8, w: cw, h: 26 }, name, 'aggregate', a);
    }
  }
  // 핫스팟과 붙은 정책 사이 점선
  hot.forEach((h, i) => {
    if (t < E03.extra) return;
    const a = appear(t, E03.extra), y = i === 0 ? hot1 : hot2, x = colX(i === 0 ? 0 : 1), pol = slot(i === 0 ? 'p1' : 'p3');
    // 정책 아래 가운데는 다음 줄로 가는 화살표가 쓰므로, 핫스팟 1은 정책 왼쪽 아래 모서리에서 잇는다
    if (i === 0) g.line(pol.x + 8, pol.y + pol.h, x + 2 * cw + gap, y + hotH(0) / 2, { stroke: STICKY.hotspot.line, lw: 1, dash: [3, 3], alpha: a });
    else g.line(pol.x + pol.w / 2, pol.y + pol.h, pol.x + pol.w / 2, y, { stroke: STICKY.hotspot.line, lw: 1, dash: [3, 3], alpha: a });
    g.rect(x, y, 2 * cw + gap, hotH(i), { r: 3, fill: STICKY.hotspot.fill, stroke: STICKY.hotspot.line, lw: 1, alpha: a });
    lines(g, { x, y, w: 2 * cw + gap, h: hotH(i) }, h.rows, { alpha: a });
  });
  // 중심 경로 화살표(흐르는 점) — 같은 줄은 가로, 줄 끝 정책 → 다음 줄 첫 커맨드는 꺾어서
  const legPts = (k: number): Pt[] => {
    const a = slot(E03_PATH[k]), b = slot(E03_PATH[k + 1]);
    if (Math.abs(a.y - b.y) < 1) return [{ x: a.x + a.w + 1, y: a.y + CH / 2 }, { x: b.x - 1, y: b.y + CH / 2 }];
    const yMid = b.y - 11;
    return [{ x: a.x + a.w / 2, y: a.y + a.h }, { x: a.x + a.w / 2, y: yMid }, { x: b.x + b.w / 2, y: yMid }, { x: b.x + b.w / 2, y: b.y - 1 }];
  };
  E03_PATH.slice(1).forEach((_, k) => grow(g, t, legPts(k), ...e03Leg(k), C.ink));
  // 인증 줄 안의 화살표(로그인 → 로그인했다 → 로그인 정책)
  [['c4', 'e4'], ['e4', 'p3']].forEach(([p, q], i) => { if (s.login[i]) { const a = slot(p), b = slot(q); route(g, [{ x: a.x + a.w + 1, y: a.y + CH / 2 }, { x: b.x - 1, y: b.y + CH / 2 }], C.ink, { alpha: appear(t, E03.login[i], 200) }); } });
  // 경계를 넘는 화살표 3개: 왼쪽·오른쪽 바깥 통로로 돌아 카드 위를 지나지 않는다
  const c0 = slot('c0'), c1 = slot('c1'), p2 = slot('p2'), c4 = slot('c4'), p3 = slot('p3'), c5 = slot('c5');
  grow(g, t, [{ x: c0.x + cw / 2, y: c0.y }, { x: c0.x + cw / 2, y: entry - 6 }, { x: xL, y: entry - 6 }, { x: xL, y: c1.y + CH / 2 }, { x: c1.x - 1, y: c1.y + CH / 2 }], E03.a1[0], E03.a1[1], C.blueText);
  grow(g, t, [{ x: p2.x + cw + 1, y: p2.y + CH / 2 }, { x: xR1, y: p2.y + CH / 2 }, { x: xR1, y: login - 11 }, { x: c4.x + cw / 2, y: login - 11 }, { x: c4.x + cw / 2, y: c4.y - 1 }], E03.a11[0], E03.a11[1], C.blueText);
  grow(g, t, [{ x: p3.x + cw + 1, y: p3.y + CH / 2 }, { x: xR2, y: p3.y + CH / 2 }, { x: xR2, y: c5.y + CH / 2 }, { x: c5.x + cw + 1, y: c5.y + CH / 2 }], E03.a12[0], E03.a12[1], C.blueText);
  // 카드: 이벤트는 흩어진 자리에서 정렬되고, 나머지는 종류별 시각에 놓인다
  for (const c of E03_CARDS) {
    const at = e03At(c.id);
    if (t < at) continue;
    const b = slot(c.id), off = SCATTER[c.id], k = 1 - ease.inOut(s.aligned);
    if (off) { b.x += off[0] * k; b.y += off[1] * k; }
    sticky(g, b, c.text, c.kind, appear(t, at));
  }
  // 탐험 단계의 중복 카드(설명용): 빈 칸에 있다가 ✕ 표시 뒤 사라진다
  if (t >= E03.drop && !s.dupGone) {
    const b = slot('p2'), k = 1 - ease.inOut(s.aligned), a = appear(t, E03.drop) * (1 - span(t, E03.dup[0], E03.dup[1]));
    b.x += SCATTER.dup[0] * k; b.y += SCATTER.dup[1] * k;
    sticky(g, b, E03_DUP, 'event', a);
    if (s.dupCrossed) { g.line(b.x + 4, b.y + 4, b.x + b.w - 4, b.y + b.h - 4, { stroke: C.red, lw: 2, alpha: a }); g.line(b.x + 4, b.y + b.h - 4, b.x + b.w - 4, b.y + 4, { stroke: C.red, lw: 2, alpha: a }); }
  }
  // 추가 흐름은 원본의 라벨만 남기고 제작 설명은 덜어 낸다.
  let ry = aBottom + 10;
  const ra = s.bound ? appear(t, E03.bound) : 0;
  const prefixes = ['가입 확인 ←', '회원여부 정책 → (조건 미표기)', '회원:', '인증:'];
  for (const [i, source] of E03_REST.entries()) {
    const line = i < prefixes.length ? prefixes[i] + source.slice(source.indexOf(':') + 1) : '오른쪽이 잘려 연결 3개 생략';
    // 항목 머리에만 '·'를 두고, 이어지는 줄은 들여 쓴다(목록 안의 '·'는 줄 끝에 붙여 새 항목처럼 보이지 않게)
    const rows = wrap(line.replace(/ · /g, '\u00a0· '), w - 10, 11);
    ry += 18;
    if (ra > 0) { g.text(0, ry, '·', { size: 11, color: C.muted, alpha: ra }); rows.forEach((r, i) => g.text(10, ry + i * 18, r, { size: 11, color: C.muted, alpha: ra, cont: i > 0 })); }
    ry += (rows.length - 1) * 18;
  }
  return frame(g, ry + 8, s.phase);
}

/* ---------- E04 데이터 플랫폼: 원본 3열 배치(넓은 폭) / 영역을 세로로 쌓기(좁은 폭) ---------- */
function nodeH(w: number, n: E04Node) { const [, name, tools] = E04_NODES[n]; return 10 + wrap(name, w - 16, 12).length * 15 + (tools ? wrap(tools, w - 16, 11).length * 14 : 0) + 4; }
function node(g: G, b: Box, n: E04Node, lit: boolean, a: number) {
  const [, name, tools] = E04_NODES[n];
  g.rect(b.x, b.y, b.w, b.h, { r: 6, fill: C.paper, stroke: C.line, lw: 1 });
  if (lit) g.rect(b.x, b.y, b.w, b.h, { r: 6, fill: C.blueTint, stroke: C.blue, lw: 1.3, alpha: a });
  let y = b.y + 18;
  wrap(name, b.w - 16, 12).forEach((r, i) => { g.text(b.x + 8, y, r, { size: 12, weight: 600, color: C.ink, cont: i > 0 }); y += 15; });
  (tools ? wrap(tools, b.w - 16, 11) : []).forEach((r, i) => { g.text(b.x + 8, y - 1, r, { size: 11, color: C.muted, cont: i > 0 }); y += 14; });
}
function area(g: G, b: Box, title: string, o: { dash?: boolean } = {}) {
  g.rect(b.x, b.y, b.w, b.h, { r: 10, fill: o.dash ? C.paper : C.bg, stroke: C.line, lw: 1.1, dash: o.dash ? [4, 3] : null });
  g.text(b.x + 10, b.y + 16, title, { size: 11, weight: 700, color: C.muted });
}
function platformV2(w: number, t: number): LessonFrame {
  const g = draw(), s = e04(t), wide = w >= 560, B = {} as Record<E04Node, Box>;
  let mTop: number;
  const routes: Record<string, Pt[]> = {};
  const top = (b: Box) => ({ x: b.x + b.w / 2, y: b.y }), bot = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h });
  if (wide) {
    const k = w / 650, lx0 = 0, lx1 = 150 * k, mx0 = 168 * k, mx1 = 468 * k, rx0 = 486 * k, rx1 = w, mh = (mx1 - mx0 - 24) / 2;
    area(g, { x: lx0, y: 0, w: lx1 - lx0, h: 84 }, 'COLLECTION'); B.collector = { x: lx0 + 8, y: 24, w: lx1 - lx0 - 16, h: nodeH(lx1 - lx0 - 16, 'collector') };
    area(g, { x: lx0, y: 112, w: lx1 - lx0, h: 84 }, 'DATA BUS'); B.kafka = { x: lx0 + 8, y: 136, w: lx1 - lx0 - 16, h: nodeH(lx1 - lx0 - 16, 'kafka') };
    area(g, { x: mx0, y: 0, w: mx1 - mx0, h: 76 }, 'BATCH'); B.workflow = { x: mx0 + 8, y: 24, w: mx1 - mx0 - 16, h: nodeH(mx1 - mx0 - 16, 'workflow') };
    area(g, { x: mx0, y: 96, w: mx1 - mx0, h: 80 }, 'DATA STORE'); B.hdfs = { x: mx0 + 8, y: 120, w: mh, h: nodeH(mh, 'hdfs') }; B.es = { x: mx0 + 16 + mh, y: 120, w: mh, h: nodeH(mh, 'hdfs') };
    area(g, { x: mx0, y: 196, w: mx1 - mx0, h: 80 }, 'STREAM'); B.sink = { x: mx0 + 8, y: 220, w: mh, h: nodeH(mh, 'sink') }; B.streaming = { x: mx0 + 16 + mh, y: 220, w: mh, h: nodeH(mh, 'streaming') };
    area(g, { x: rx0, y: 0, w: rx1 - rx0, h: 276 }, 'SERVICE');
    const rw = rx1 - rx0 - 16;
    B.drill = { x: rx0 + 8, y: 24, w: rw, h: nodeH(rw, 'drill') };
    B.api = { x: rx0 + 8, y: mid(B.es).y - nodeH(rw, 'api') / 2, w: rw, h: nodeH(rw, 'api') };
    B.app = { x: rx0 + 8, y: 268 - nodeH(rw, 'app'), w: rw, h: nodeH(rw, 'app') };
    const gx1 = (lx1 + mx0) / 2, gx2 = (mx1 + rx0) / 2;
    routes.a1 = [bot(B.collector), top(B.kafka)];
    routes.a2 = [{ x: B.kafka.x + B.kafka.w, y: mid(B.kafka).y }, { x: gx1, y: mid(B.kafka).y }, { x: gx1, y: mid(B.sink).y }, { x: B.sink.x, y: mid(B.sink).y }];
    routes.a3 = [{ x: mid(B.kafka).x, y: B.kafka.y + B.kafka.h }, { x: mid(B.kafka).x, y: 288 }, { x: mid(B.streaming).x, y: 288 }, bot(B.streaming)];
    routes.a4 = [top(B.sink), bot(B.hdfs)];
    routes.a5 = [{ x: B.sink.x + B.sink.w - 12, y: B.sink.y }, { x: B.es.x + 12, y: B.es.y + B.es.h }];
    // 영역 제목(DATA STORE)을 지나지 않게 HDFS 오른쪽에서 오르내린다
    const hx = B.hdfs.x + B.hdfs.w * 0.7, hx8 = B.hdfs.x + B.hdfs.w - 12;
    routes.a6 = [{ x: hx, y: B.workflow.y + B.workflow.h }, { x: hx, y: B.hdfs.y }];
    routes.a7 = [{ x: mid(B.es).x, y: B.workflow.y + B.workflow.h }, top(B.es)];
    routes.a8 = [{ x: hx8, y: B.hdfs.y }, { x: hx8, y: 86 }, { x: gx2, y: 86 }, { x: gx2, y: mid(B.drill).y }, { x: B.drill.x, y: mid(B.drill).y }];
    routes.a9 = [{ x: B.es.x + B.es.w, y: mid(B.es).y }, { x: B.api.x, y: mid(B.es).y }];
    routes.a10 = [bot(B.api), top(B.app)];
    mTop = 300;
  } else {
    const X0 = 16, X1 = w - 16, half = (X1 - X0 - 24) / 2, full = X1 - X0 - 16, xL = 6, xR = w - 6;
    let y = 0;
    const one = (title: string, n: E04Node) => { const h = nodeH(full, n); area(g, { x: X0, y, w: X1 - X0, h: h + 32 }, title); B[n] = { x: X0 + 8, y: y + 24, w: full, h }; y += h + 32 + 22; };
    const two = (title: string, a: E04Node, b: E04Node) => { const h = Math.max(nodeH(half, a), nodeH(half, b)); area(g, { x: X0, y, w: X1 - X0, h: h + 32 }, title); B[a] = { x: X0 + 8, y: y + 24, w: half, h }; B[b] = { x: X0 + 16 + half, y: y + 24, w: half, h }; y += h + 32 + 22; };
    one('COLLECTION', 'collector'); one('DATA BUS', 'kafka'); two('STREAM', 'sink', 'streaming'); two('DATA STORE', 'hdfs', 'es'); one('BATCH', 'workflow');
    const h1 = Math.max(nodeH(half, 'drill'), nodeH(half, 'api')), h2 = nodeH(half, 'app');
    area(g, { x: X0, y, w: X1 - X0, h: h1 + h2 + 24 + 32 }, 'SERVICE');
    B.drill = { x: X0 + 8, y: y + 24, w: half, h: h1 }; B.api = { x: X0 + 16 + half, y: y + 24, w: half, h: h1 }; B.app = { x: X0 + 16 + half, y: y + 24 + h1 + 24, w: half, h: h2 };
    y += h1 + h2 + 24 + 32 + 22;
    routes.a1 = [bot(B.collector), top(B.kafka)];
    routes.a2 = [{ x: mid(B.sink).x, y: B.kafka.y + B.kafka.h }, top(B.sink)];
    routes.a3 = [{ x: mid(B.streaming).x, y: B.kafka.y + B.kafka.h }, top(B.streaming)];
    // Sink → HDFS는 영역 제목(DATA STORE) 오른쪽으로 내려간다
    const sx = B.sink.x + B.sink.w - 24;
    routes.a4 = [{ x: sx, y: B.sink.y + B.sink.h }, { x: sx, y: B.hdfs.y }];
    routes.a5 = [{ x: B.sink.x + B.sink.w - 8, y: B.sink.y + B.sink.h }, { x: B.es.x + 10, y: B.es.y }];
    routes.a6 = [{ x: mid(B.hdfs).x, y: B.workflow.y }, bot(B.hdfs)];
    routes.a7 = [{ x: mid(B.es).x, y: B.workflow.y }, bot(B.es)];
    routes.a8 = [{ x: B.hdfs.x, y: mid(B.hdfs).y }, { x: xL, y: mid(B.hdfs).y }, { x: xL, y: mid(B.drill).y }, { x: B.drill.x, y: mid(B.drill).y }];
    routes.a9 = [{ x: B.es.x + B.es.w, y: mid(B.es).y }, { x: xR, y: mid(B.es).y }, { x: xR, y: mid(B.api).y }, { x: B.api.x + B.api.w, y: mid(B.api).y }];
    routes.a10 = [bot(B.api), top(B.app)];
    mTop = y - 4;
  }
  // 화살표 10개: 처음에는 흐린 윤곽, 데이터가 지나간 뒤 진하게(양방향은 양끝 머리)
  for (const [, , key] of E04_ARROWS) {
    const pts = routes[key], both = key === 'a3' || key === 'a6', done = t >= e04ArrowDone(key);
    route(g, pts, done ? C.blue : C.line, { lw: done ? 1.5 : 1.2, alpha: done ? Math.max(0.35, appear(t, e04ArrowDone(key))) : 1 });
    if (both) { const p = pts[0], q = pts[1]; arrowHead(g, p, Math.atan2(p.y - q.y, p.x - q.x), done ? C.blue : C.line, 1, 6); }
  }
  const api = B.api, app = B.app;
  g.text(api.x + api.w / 2 + 8, (api.y + api.h + app.y) / 2 + 4, 'gRPC', { size: 11, weight: 600, color: C.muted });
  for (const n of Object.keys(E04_NODES) as E04Node[]) node(g, B[n], n, t >= E04_LIT[n], appear(t, E04_LIT[n]));
  // 데이터 점(설명용): 화살표를 따라 사건 시각에 도착
  const rev = (pts: Pt[]) => [...pts].reverse();
  dot(g, t, routes.a1, E04.a1[0], E04.a1[1]);
  dot(g, t, routes.a2, E04.a2[0], E04.a2[1]);
  dot(g, t, routes.a3, E04.a3[0], E04.a3[1]); dot(g, t, rev(routes.a3), E04.a3[1], E04.a3[2]);
  dot(g, t, routes.a4, E04.a4[0], E04.a4[1]); dot(g, t, routes.a5, E04.a5[0], E04.a5[1]);
  dot(g, t, rev(routes.a6), E04.a6[0], E04.a6[1]); dot(g, t, routes.a6, E04.a6[2], E04.a6[3]); dot(g, t, routes.a7, E04.a7[0], E04.a7[1]);
  if (s.working) { const c = mid(B.workflow); g.circle(B.workflow.x + B.workflow.w - 14, c.y, 4.5, { fill: C.blue }); }
  dot(g, t, routes.a8, E04.a8[0], E04.a8[1]); dot(g, t, routes.a9, E04.a9[0], E04.a9[1]); dot(g, t, routes.a10, E04.a10[0], E04.a10[1]);
  // 관리 영역: 데이터 경로와 선 없음(점선 테두리로 분리)
  // 열 수는 가장 긴 도구 이름(Coda Hale Metrics)이 한 줄에 들어가는 만큼
  const cols = w >= 648 ? 5 : w >= 560 ? 3 : 2, gw = 8, cwm = (w - 16 - (cols - 1) * gw) / cols;
  const chips = E04_MANAGEMENT.map(([name, tools]) => ({ name: wrap(name, cwm - 12, 11), tools: wrapTools(tools, cwm - 12) }));
  const rowsN = Math.ceil(chips.length / cols), rowH = Array.from({ length: rowsN }, (_, r) => Math.max(...chips.slice(r * cols, r * cols + cols).map(c => 12 + (c.name.length + c.tools.length) * 14)));
  const mH = 28 + rowH.reduce((n, h) => n + h + 8, 0);
  area(g, { x: 0, y: mTop, w, h: mH }, 'MANAGEMENT', { dash: true });
  chips.forEach((c, i) => {
    const r = Math.floor(i / cols), x = 8 + (i % cols) * (cwm + gw), y = mTop + 26 + rowH.slice(0, r).reduce((n, h) => n + h + 8, 0);
    g.rect(x, y, cwm, rowH[r], { r: 6, fill: C.bg, stroke: C.grid, lw: 1 });
    c.name.forEach((l, j) => g.text(x + 6, y + 16 + j * 14, l, { size: 11, weight: 600, color: C.ink, cont: j > 0 }));
    c.tools.forEach((l, j) => g.text(x + 6, y + 16 + (c.name.length + j) * 14, l, { size: 11, color: C.muted, cont: j > 0 }));
  });
  return frame(g, mTop + mH + 2, s.phase);
}

// 도구 목록 줄바꿈: 도구 이름 단위로 나누고, 한 이름이 칸보다 길 때만 그 이름 안에서 나눈다
function wrapTools(s: string, maxW: number) {
  const out: string[] = [];
  let line = '';
  for (const tool of s.split(' · ')) {
    const cand = line ? line + ' · ' + tool : tool;
    if (textW(cand, 11) <= maxW) { line = cand; continue; }
    if (line) out.push(line + ' ·');
    if (textW(tool, 11) <= maxW) line = tool;
    else { const parts = wrap(tool, maxW, 11); out.push(...parts.slice(0, -1)); line = parts[parts.length - 1]; }
  }
  if (line) out.push(line);
  return out;
}

/* ---------- E05 Temporal: Server의 Event History와 Worker A/B ---------- */
function bar(g: G, x: number, y: number, w: number, q: number, color: string) {
  g.rect(x, y - 4, w, 6, { r: 3, fill: C.grid });
  if (q > 0) g.rect(x, y - 4, Math.max(3, w * q), 6, { r: 3, fill: color });
}
// 꼬리표: 점선은 '기록된 결과 사용'에만 쓴다(범례와 같은 뜻)
function tag(g: G, x: number, y: number, text: string, color: string, line: string, alpha = 1, dashed = false) {
  const bw = textW(text, 11) + 10;
  g.rect(x, y - 11, bw, 16, { r: 4, fill: C.paper, stroke: line, dash: dashed ? [3, 2] : null, lw: 1, alpha });
  g.text(x + 5, y + 1, text, { size: 11, weight: 600, color, alpha });
}
function temporalV2(w: number, t: number): LessonFrame {
  const g = draw(), s = e05(t), wide = w >= 560;
  // 바깥(매니저) → Server: 승인 신호
  const sw = wide ? Math.round(w * 0.54) : w, sTop = 30;
  const pillX = sw - 54, pillW = textW('매니저', 11) + 20;
  g.rect(pillX - pillW / 2, 2, pillW, 22, { r: 11, fill: C.paper, stroke: C.line, lw: 1 });
  g.text(pillX, 17, '매니저', { size: 11, weight: 600, align: 'center', color: C.ink });
  // Server · Event History: 상자를 먼저 칠하고 제목을 쓴다(글자가 상자에 덮이지 않게)
  const y = sTop + 32;
  const cardH = 38, cardW = sw - 24, cards: Box[] = E05_HISTORY.map((_, i) => ({ x: 12, y: y + i * (cardH + 6), w: cardW, h: cardH }));
  const sBottom = cards[5].y + cardH + 26;
  g.rect(0, sTop, sw, sBottom - sTop, { r: 10, fill: C.bg, stroke: C.blue, lw: 1.2 });
  g.text(12, sTop + 20, 'Server · Event History', { size: 12, weight: 700, color: C.ink });
  if (t >= E05.signal[0]) route(g, [{ x: pillX, y: 24 }, { x: pillX, y: sTop - 1 }], t >= E05.signal[1] ? C.ink : C.line, { lw: 1.3 });
  E05_HISTORY.forEach(([name, sub], i) => {
    const b = cards[i];
    if (!s.cards[i]) return;
    const a = appear(t, E05_CARD_AT[i]), pending = i === 2 && !s.calcResult;
    g.rect(b.x, b.y, b.w, b.h, { r: 6, fill: i === 2 && !pending ? C.orangeTint : C.paper, stroke: pending ? C.line : i === 2 ? C.orange : C.ink, lw: 1.1, alpha: a });
    g.text(b.x + 10, b.y + 16, name, { size: 11, weight: 600, color: i === 2 && !pending ? C.orangeText : C.ink, alpha: a });
    g.text(b.x + 10, b.y + 31, pending ? '결과 없음' : sub, { size: 11, color: pending ? C.muted : C.ink, mono: i === 2 && !pending, alpha: a });
    // 재시도로 결과가 채워진 카드에는 그 사실을 남긴다(정지 장면에서도 재시도가 보이게)
    if (i === 2 && s.calcResult) g.text(b.x + b.w - 10, b.y + 16, '재시도로 완료', { size: 11, weight: 600, align: 'right', color: C.orangeText, alpha: appear(t, E05.calcRep[1]) });
    if (i === 2 && s.timeout > 0 && t < E05.timeout[1]) {
      g.text(b.x + b.w - 10, b.y + 16, '타임아웃', { size: 11, weight: 600, align: 'right', color: C.orangeText });
      bar(g, b.x + b.w - 70, b.y + 30, 60, s.timeout, C.orange);
    }
  });
  g.text(24, cards[5].y + cardH + 17, '…', { size: 12, color: C.muted });
  // 승인 신호 점은 사건 카드 위로 지나 SignalReceived 자리에 닿는다(카드보다 나중에 칠한다)
  dot(g, t, [{ x: pillX, y: 24 }, { x: pillX, y: cards[4].y }], E05.signal[0], E05.signal[1], C.orange);
  // Worker A·B
  const wx = wide ? sw + 36 : 0, ww = wide ? w - wx : (w - 8) / 2, wTop = wide ? sTop : sBottom + 30, wH = 24 + 32 + 4 * 22 + 30;
  const workers = [{ x: wx, y: wTop, name: 'Worker A' }, { x: wide ? wx : ww + 8, y: wide ? wTop + wH + 18 : wTop, name: 'Worker B' }];
  // Server ↔ Worker 연결선(사건이 지나는 길)
  const link = (i: number): Pt[] => wide ? [{ x: sw, y: workers[i].y + wH / 2 }, { x: workers[i].x, y: workers[i].y + wH / 2 }] : [{ x: workers[i].x + ww / 2, y: sBottom }, { x: workers[i].x + ww / 2, y: wTop }];
  [0, 1].forEach(i => { const [p, q] = link(i); g.line(p.x, p.y, q.x, q.y, { stroke: C.line, lw: 1.2 }); });
  const down = (i: number) => link(i), up = (i: number) => [...link(i)].reverse();
  dot(g, t, down(0), E05.started, E05.collect[0]);
  dot(g, t, up(0), E05.collectRep[0], E05.collectRep[1]);
  dot(g, t, down(0), E05.calcSched, E05.calc1[0]);
  dot(g, t, down(1), E05.retry[0], E05.retry[1]);
  dot(g, t, up(1), E05.calcRep[0], E05.calcRep[1]);
  dot(g, t, down(1), E05.replay[0], E05.replay[1], C.green);
  dot(g, t, down(1), E05.wake[0], E05.wake[1]);
  dot(g, t, up(1), E05.creditRep[0], E05.creditRep[1]);
  workers.forEach((wk, i) => {
    const dead = i === 0 && s.crashed;
    g.rect(wk.x, wk.y, ww, wH, { r: 10, fill: dead ? C.redTint : C.paper, stroke: dead ? C.red : i === 1 && t >= E05.retry[1] ? C.green : C.ink, lw: 1.2 });
    g.text(wk.x + 10, wk.y + 20, wk.name, { size: 12, weight: 700, color: dead ? C.redText : C.ink });
    // 설명 줄은 두 줄까지(좁은 폭) 자리를 잡아 둔다
    // Worker B의 부제는 Replay 입력(점)이 도착할 때 바뀐다
    const replayed = i === 1 && t >= E05.replay[1];
    if (replayed) para(g, wk.x + 10, wk.y + 36, 'Event History로 Replay', ww - 20, { size: 11, lh: 14, color: C.greenText });
    // 좁은 폭(Worker 두 칸이 나란히)은 여백을 줄여 표시 자리를 확보한다
    const pad = wide ? 10 : 8, codeW = textW('승인 대기(7일)', 11), mx = wk.x + pad + codeW + (wide ? 8 : 3), mw = ww - (mx - wk.x) - (wide ? 10 : 4);
    E05_CODE.forEach((code, j) => {
      const ly = wk.y + 72 + j * 22;
      let on = false;
      if (i === 0) {
        on = j === 0 ? s.collect > 0 : j === 1 ? s.calc1 > 0 : false;
        if (j === 0 && s.collect > 0) bar(g, mx, ly, mw, s.collect, C.blue);
        if (j === 1 && s.calc1 > 0) bar(g, mx, ly, mw, s.calc1, dead ? C.faint : C.blue);
      } else {
        if (j <= 1 && s.bLines[j]) { on = true; tag(g, mx, ly, wide && j === 1 ? '기록값 50,000' : '기록값', C.greenText, C.green, appear(t, j === 0 ? E05.replayLines[0] : E05.replayLines[1]), true); }
        else if (j === 1 && s.calc2 > 0) { on = true; bar(g, mx, ly, mw, s.calc2, C.blue); }
        if (j === 2 && s.bLines[2]) { on = true; tag(g, mx, ly, t >= E05.wake[1] ? (wide ? '✓ 승인' : '승인됨') : '대기', t >= E05.wake[1] ? C.greenText : C.orangeText, t >= E05.wake[1] ? C.green : C.orange, appear(t, t >= E05.wake[1] ? E05.wake[1] : E05.timer)); }
        if (j === 3 && s.credit > 0) { on = true; bar(g, mx, ly, mw, s.credit, C.blue); }
      }
      g.text(wk.x + pad, ly + 4, code, { size: 11, color: on ? C.ink : C.muted });
    });
    if (dead) g.text(wk.x + 10, wk.y + wH - 10, '✕ 프로세스 죽음', { size: 11, weight: 700, color: C.redText, alpha: appear(t, E05.crash) });
  });
  return frame(g, Math.max(sBottom, workers[1].y + wH) + 10, s.phase);
}

/* ---------- X05 팀 회고: 카드 → 그룹 → 투표 → 액션 플랜(레인 두 개) ---------- */
type RetroBox = { head: string; headColor: string; headSize: number; body: string[]; bodySize: number; bodyColor: string; fill: string; stroke: string } | null;
function retroV2(w: number, t: number): LessonFrame {
  const g = draw(), s = x05(t), wide = w >= 560, gap = wide ? 26 : 10;
  const boxW = wide ? (w - 3 * gap) / 4 : (w - gap) / 2;
  // 단계(열) × 레인 내용. 보이지 않을 때도 자리를 잡아 높이가 바뀌지 않게 한다
  const content = (c: number, l: number, on: boolean): RetroBox => {
    const lane = X05_LANES[l], tone = l === 0 ? TONE.blue : TONE.red, out = l === 0 && s.voted;
    if (c === 0) return { head: lane.kind, headColor: tone.text, headSize: 11, body: wrap(lane.card, boxW - 16, 12), bodySize: 12, bodyColor: C.ink, fill: tone.tint, stroke: tone.line };
    if (c === 1) return { head: lane.group, headColor: out && on ? C.muted : C.ink, headSize: 12, body: [], bodySize: 11, bodyColor: C.muted, fill: out && on ? C.bg : C.paper, stroke: out && on ? C.line : C.ink };
    if (l === 0) return null;
    if (c === 2) return { head: '선택됨', headColor: C.greenText, headSize: 12, body: [], bodySize: 11, bodyColor: C.ink, fill: C.greenTint, stroke: C.green };
    return { head: '액션 플랜', headColor: C.greenText, headSize: 11, body: wrap(X05_ACTION, boxW - 16, 12), bodySize: 12, bodyColor: C.ink, fill: C.greenTint, stroke: C.green };
  };
  const hOf = (b: RetroBox) => b ? 14 + 16 + b.body.length * 15 : 0;
  const visible = (c: number, l: number) => c === 0 ? s.cards[l] : c === 1 ? s.grouped : c === 2 ? s.voted : s.acted;
  const appearAt = (c: number, l: number) => c === 0 ? X05.cards[l] : c === 1 ? X05.group[1] : c === 2 ? X05.vote[1] : X05.action[1];
  // 배치: 넓은 폭은 열 4개 × 레인 2개, 좁은 폭은 단계마다 레인 두 칸을 위에서 아래로
  const boxes: (Box | null)[][] = [[], [], [], []];
  const headY: number[] = [];
  let bottom = 0;
  if (wide) {
    const laneH = [0, 1].map(l => Math.max(...[0, 1, 2, 3].map(c => hOf(content(c, l, false)))));
    const laneY = [30, 30 + laneH[0] + 16];
    for (let c = 0; c < 4; c++) { headY[c] = 16; for (let l = 0; l < 2; l++) boxes[c][l] = content(c, l, false) ? { x: c * (boxW + gap), y: laneY[l], w: boxW, h: hOf(content(c, l, false)) } : null; }
    bottom = laneY[1] + laneH[1];
  } else {
    let y = 0;
    for (let c = 0; c < 4; c++) {
      headY[c] = y + 14;
      const h = Math.max(hOf(content(c, 0, false)), hOf(content(c, 1, false)));
      for (let l = 0; l < 2; l++) boxes[c][l] = content(c, l, false) ? { x: l * (boxW + gap), y: y + 22, w: boxW, h: hOf(content(c, l, false)) } : null;
      y += 22 + h + 26;
      bottom = y - 26;
    }
  }
  // 단계 이름: 지금 단계는 굵게, 지나온 단계는 보통, 아직 오지 않은 단계는 흐리게
  X05_STAGES.forEach((name, c) => g.text(wide ? c * (boxW + gap) : 0, headY[c], name, { size: 12, weight: c === s.stage ? 700 : c < s.stage ? 400 : 600, color: c <= s.stage ? C.ink : C.muted }));
  // 화살표: 칸에서 다음 단계 칸으로, 점이 지나간 뒤 완성
  const link = (c: number, l: number): Pt[] => { const a = boxes[c][l]!, b = boxes[c + 1][l]!; return wide ? [{ x: a.x + a.w + 2, y: a.y + 22 }, { x: b.x - 2, y: b.y + 22 }] : [{ x: a.x + a.w / 2, y: a.y + a.h + 2 }, { x: b.x + b.w / 2, y: b.y - 2 }]; };
  // 고르지 않은 그룹으로 가는 화살표는 투표 순간 그룹과 함께 흐려진다
  grow(g, t, link(0, 0), X05.group[0], X05.group[1], s.voted ? C.line : C.ink);
  grow(g, t, link(0, 1), X05.group[0], X05.group[1], C.ink);
  grow(g, t, link(1, 1), X05.vote[0], X05.vote[1], C.ink);
  grow(g, t, link(2, 1), X05.action[0], X05.action[1], C.ink);
  for (let c = 0; c < 4; c++) for (let l = 0; l < 2; l++) {
    const b = boxes[c][l];
    if (!b || !visible(c, l)) continue;
    const k = content(c, l, true)!, a = appear(t, appearAt(c, l));
    g.rect(b.x, b.y, b.w, b.h, { r: 6, fill: k.fill, stroke: k.stroke, lw: 1.2, alpha: a });
    g.text(b.x + 8, b.y + 18, k.head, { size: k.headSize, weight: c === 1 || c === 2 ? 700 : 600, color: k.headColor, alpha: a });
    k.body.forEach((r, i) => g.text(b.x + 8, b.y + 34 + i * 15, r, { size: k.bodySize, color: k.bodyColor, alpha: a, cont: i > 0 }));
  }
  return frame(g, bottom + 4, s.phase);
}

export const processRenderers: Record<ProcessFigureId, (width: number, elapsed: number) => LessonFrame> = { E01: atddV2, E02: testScopeV2, E03: stormV2, E04: platformV2, E05: temporalV2, X05: retroV2 };
