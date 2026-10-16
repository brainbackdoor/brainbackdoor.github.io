/** B05 DB·SQL·Spark 13종 렌더러. 공통 그리기 도구(lessonCanvas)와 사건 모델(data-models)만 쓰고, Canvas와 정적 SVG가 같은 명령을 읽는다. */
import { C, TONE, appear, arrow, cross, cylinder, draw, ease, frame, label, lerp, lerpPt, para, pill, span, textW, token, twoUp, wrap, type G, type LessonFrame, type Pt, type Tone } from './lessonCanvas';
import { D01, D02, D04, D05, D05_INDEX, D06, D06_MATCH, D08, D09, D09_Q1, D09_Q2, D09_Q3, S01, S02, S02_ROWS, S04, S05, S05_AGES, S06, d01, d02, d04, d05, d06, d07, d08, d09, s01, s02, s04, s05, s06, type DataFigureId } from './data-models';

/* DB·SQL 8종: 서버·로그·인덱스·테이블·파이프라인의 형태로 그린다. 의미 값은 models에서 읽는다. */
// [a, b] 동안 p → q로 이동해 b에 도착하는 토큰(도착 뒤에는 그리지 않음)
function travel(g: G, t: number, p: Pt, q: Pt, a: number, b: number, text: string, tone: Tone, o: { line?: boolean; dot?: boolean; r?: number } = {}) {
  if (t < a || t >= b) return;
  const u = ease.inOut(span(t, a, b)), h = lerpPt(p, q, u);
  if (o.line !== false) g.line(p.x, p.y, h.x, h.y, { stroke: TONE[tone].line, lw: 1.4, alpha: 0.6 });
  // 글자 사이를 지나는 짧은 왕복은 글자 없는 점으로 그린다(값은 도착 칸이 보여 줌)
  if (o.dot) g.circle(h.x, h.y, 4.5, { fill: TONE[tone].line });
  else token(g, h.x, h.y, text, tone, { solid: true, r: o.r ?? 10 });
}
// 서버 상자: 이름 줄 + 내부 영역
function server(g: G, x: number, y: number, w: number, h: number, name: string, sub = '') {
  g.rect(x, y, w, h, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.3 });
  g.text(x + 12, y + 20, name, { size: 12, weight: 700, mono: true });
  if (sub) g.text(x + w - 10, y + 20, sub, { size: 11, mono: true, align: 'right', color: C.muted });
}
// 값 칸: 바뀌는 순간부터 강조
function valueCell(g: G, x: number, y: number, w: number, name: string, v: string, changedAt: number, t: number) {
  const on = t >= changedAt, a = appear(t, changedAt);
  g.rect(x, y, w, 30, { r: 6, fill: on ? C.greenTint : C.paper, stroke: on ? C.green : C.line, lw: 1.2 });
  g.text(x + 10, y + 19.5, name, { size: 11, color: C.muted });
  g.text(x + w - 12, y + 20, v, { size: 14, weight: 700, mono: true, align: 'right', color: on ? C.greenText : C.ink, alpha: on ? Math.max(0.4, a) : 1 });
}
// 로그: 쌓인 이벤트 막대(마지막이 새 이벤트)
function logStack(g: G, x: number, y: number, w: number, title: string, base: string, fresh: boolean, freshAt: number, t: number) {
  g.text(x, y - 6, title, { size: 11, weight: 600, mono: true, color: C.muted });
  g.rect(x, y, w, 20, { r: 4, fill: C.slab, stroke: C.line, lw: 1 });
  g.text(x + 8, y + 14, base, { size: 11, mono: true, color: C.muted });
  if (fresh) { const a = appear(t, freshAt); g.rect(x, y + 24, w, 20, { r: 4, fill: C.blueTint, stroke: C.blue, lw: 1.2, alpha: a }); g.text(x + 8, y + 38, '행 변경 이벤트', { size: 11, weight: 600, color: C.blueText, alpha: a }); }
  else g.rect(x, y + 24, w, 20, { r: 4, stroke: C.grid, lw: 1, dash: [3, 3] });
}

/* ---------- D01 복제: binlog → relay log → applier, 커밋 응답은 복제를 기다리지 않는다 ---------- */
function replicationV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d01(t), wide = w >= 560;
  const appW = wide ? 96 : w, appH = 52, mw = wide ? (w - appW - 52) / 2 : w;
  const app = { x: 0, y: wide ? 40 : 0, w: appW, h: appH };
  const mst = { x: wide ? appW + 26 : 0, y: wide ? 0 : appH + 40, w: mw, h: 196 };
  const rep = { x: wide ? mst.x + mw + 26 : 0, y: wide ? 0 : mst.y + 196 + 44, w: mw, h: 250 };
  g.rect(app.x, app.y, app.w, app.h, { r: 8, fill: C.paper, stroke: C.ink, lw: 1.3 });
  g.text(app.x + app.w / 2, app.y + 31, '앱', { size: 13, weight: 700, align: 'center' });
  server(g, mst.x, mst.y, mst.w, mst.h, 'mysql-master', ':13306');
  valueCell(g, mst.x + 12, mst.y + 34, mst.w - 24, '역 이름 (설명용)', s.masterValue, D01.write[1], t);
  logStack(g, mst.x + 12, mst.y + 96, mst.w - 24, 'binlog.000002', '… @683 이전', s.binlogEvent, D01.write[1], t);
  g.text(mst.x + 12, mst.y + 176, 'Binlog Dump', { size: 11, mono: true, color: C.muted });
  server(g, rep.x, rep.y, rep.w, rep.h, 'mysql-slave', ':13307');
  g.text(rep.x + 12, rep.y + 42, 'I/O(receiver) 스레드', { size: 11, mono: true, color: C.muted });
  logStack(g, rep.x + 12, rep.y + 68, rep.w - 24, 'relay log', '… @683부터 수신', s.relayEvent, D01.ship[1], t);
  g.text(rep.x + 12, rep.y + 136, 'SQL(applier) 스레드', { size: 11, mono: true, color: C.muted });
  valueCell(g, rep.x + 12, rep.y + 150, rep.w - 24, '역 이름', s.replicaValue, D01.apply[1], t);
  if (t >= D01.ship[1] && t < D01.apply[1]) label(g, rep.x + rep.w / 2, rep.y + 200, '아직 A · 적용 전', { size: 11, weight: 600, color: C.orangeText });
  g.text(rep.x + 12, rep.y + 230, 'IO Yes · SQL Yes', { size: 11, mono: true, color: C.muted });
  // 경로
  const ax = w * 0.2;
  const appR = wide ? { x: app.x + app.w, y: app.y + 18 } : { x: ax, y: app.y + app.h }, mstL = wide ? { x: mst.x, y: app.y + 18 } : { x: ax, y: mst.y };
  const appR2 = wide ? { x: app.x + app.w, y: app.y + 38 } : { x: ax + 36, y: app.y + app.h }, mstL2 = wide ? { x: mst.x, y: app.y + 38 } : { x: ax + 36, y: mst.y };
  if (t >= D01.write[1]) arrow(g, appR, mstL, { stroke: C.blue, lw: 1.3, size: 6 });
  travel(g, t, appR, mstL, D01.write[0], D01.write[1], 'UPDATE', 'blue');
  if (t >= D01.ack[1]) {
    arrow(g, mstL2, appR2, { stroke: C.green, lw: 1.3, size: 6 });
    const a = appear(t, D01.ack[1]), lx = wide ? 0 : ax + 50, ly = wide ? app.y + app.h + 20 : (app.y + app.h + mst.y) / 2 - 3;
    g.text(lx, ly, '커밋 OK', { size: 11, weight: 700, color: C.greenText, alpha: a });
    g.text(lx, ly + 14, '복제를 기다리지 않음', { size: 11, color: C.greenText, alpha: a });
  }
  travel(g, t, mstL2, appR2, D01.ack[0], D01.ack[1], 'OK', 'green');
  const shipA = wide ? { x: mst.x + mst.w, y: mst.y + 130 } : { x: w / 2, y: mst.y + mst.h }, shipB = wide ? { x: rep.x, y: rep.y + 102 } : { x: w / 2, y: rep.y };
  if (t >= D01.ship[1]) arrow(g, shipA, shipB, { stroke: C.blue, lw: 1.3, size: 6 }); else g.line(shipA.x, shipA.y, shipB.x, shipB.y, { stroke: C.grid, lw: 1.2, dash: [3, 4] });
  travel(g, t, shipA, shipB, D01.ship[0], D01.ship[1], '이벤트', 'blue');
  travel(g, t, { x: rep.x + rep.w - 44, y: rep.y + 114 }, { x: rep.x + rep.w - 44, y: rep.y + 165 }, D01.apply[0], D01.apply[1], '적용', 'green', { line: false });
  const by = Math.max(app.y + app.h, mst.y + mst.h, rep.y + rep.h) + 34;
  const y = para(g, 0, by, '비동기 복제(기본) · binlog 파일·위치 기반 · source 1 : replica 1', w, { size: 12, weight: 600 });
  return frame(g, y + 10, s.phase);
}

/* ---------- D02 라우팅: readOnly로 대상 선택, 적용 전 slave 읽기는 이전 값 ---------- */
function routingV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d02(t), wide = w >= 560;
  // 넓은 배치가 막 시작되는 560~640px에서는 서비스·라우터 상자를 최소 폭으로 줄여 DB 상자 자리를 남긴다
  const svW = wide ? (w >= 640 ? 232 : 212) : w, rtW = wide ? (w >= 640 ? 190 : 156) : w, dbW = wide ? w - svW - rtW - 56 : (w - 12) / 2, rtH = 88, svH = 156;
  const sv = { x: 0, y: wide ? 30 : 0 }, rt = { x: wide ? svW + 28 : 0, y: wide ? 64 : svH + 26 }, db0 = { x: wide ? svW + rtW + 56 : 0, y: wide ? 0 : svH + 26 + rtH + 34 };
  // 서비스: 원문의 findLines()(master 조회)·findAllStations()(slave 조회)와, 값을 바꾸는 설명용 쓰기를 따로 둔다
  g.rect(sv.x, sv.y, svW, svH, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.3 });
  g.text(sv.x + 12, sv.y + 20, 'StationService', { size: 12, weight: 700, mono: true });
  const rows = [
    { name: 'findLines()', mono: true, tag: 'readOnly 아님', ro: false, y: sv.y + 52 },
    { name: '쓰기 (설명용)', mono: false, tag: 'readOnly 아님', ro: false, y: sv.y + 92 },
    { name: 'findAllStations()', mono: true, tag: 'readOnly', ro: true, y: sv.y + 132 },
  ];
  rows.forEach((r, i) => {
    const tone: Tone = r.ro ? 'green' : 'blue';
    if (s.call === i) g.rect(sv.x + 6, r.y - 18, svW - 12, 28, { r: 6, fill: TONE[tone].tint });
    g.text(sv.x + 12, r.y, r.name, { size: 12, mono: r.mono, weight: 600 });
    const pw = textW(r.tag, 11) + 22;
    pill(g, sv.x + svW - 8 - pw / 2, r.y - 4, r.tag, { size: 11, h: 20, fill: C.paper, stroke: TONE[tone].line, color: TONE[tone].text });
  });
  // 라우터
  g.rect(rt.x, rt.y, rtW, rtH, { r: 10, fill: C.paper, stroke: C.ink, lw: 1.3 });
  g.text(rt.x + 10, rt.y + 20, 'RoutingDataSource', { size: 11, weight: 700, mono: true });
  g.text(rt.x + 10, rt.y + 40, 'isCurrentTransaction', { size: 11, mono: true, color: C.muted });
  g.text(rt.x + 10, rt.y + 55, 'ReadOnly() ?', { size: 11, mono: true, color: C.muted });
  if (s.route) pill(g, rt.x + rtW / 2, rt.y + 72, '→ ' + s.route, { size: 11, h: 20, mono: true, fill: s.route === 'master' ? C.blueTint : C.greenTint, stroke: s.route === 'master' ? C.blue : C.green, color: s.route === 'master' ? C.blueText : C.greenText });
  // DB 둘
  const mst = { x: db0.x, y: db0.y }, slv = { x: wide ? db0.x : db0.x + dbW + 12, y: wide ? db0.y + 112 : db0.y };
  for (const [b, name, v, at] of [[mst, 'master :13306', s.masterValue, D02.write[2]], [slv, 'slave :13307', s.replicaValue, D02.apply]] as const) {
    g.rect(b.x, b.y, dbW, 86, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.3 });
    g.text(b.x + 10, b.y + 20, name, { size: 11, weight: 700, mono: true });
    const on = t >= at;
    g.rect(b.x + 10, b.y + 36, dbW - 20, 34, { r: 6, fill: on ? C.greenTint : C.paper, stroke: on ? C.green : C.line, lw: 1.2 });
    g.text(b.x + 20, b.y + 57, '역 이름', { size: 11, color: C.muted });
    g.text(b.x + dbW - 20, b.y + 58, v, { size: 14, weight: 700, mono: true, align: 'right', color: on ? C.greenText : C.ink });
  }
  // 복제(지연, 설명용): master → slave
  const ra = wide ? { x: mst.x + dbW / 2, y: mst.y + 86 } : { x: mst.x + dbW, y: mst.y + 43 }, rb = wide ? { x: slv.x + dbW / 2, y: slv.y } : { x: slv.x, y: slv.y + 43 };
  if (t >= D02.apply) arrow(g, ra, rb, { stroke: C.green, lw: 1.3, size: 6 });
  else if (t >= D02.write[2]) { g.line(ra.x, ra.y, rb.x, rb.y, { stroke: C.orange, lw: 1.3, dash: [4, 3] }); label(g, wide ? w - 6 : w / 2, wide ? (ra.y + rb.y) / 2 + 4 : db0.y + 86 + 18, '복제 지연(설명용)', { size: 11, color: C.orangeText, align: wide ? 'right' : 'center' }); }
  // 요청 경로
  const svOut = (i: number) => wide ? { x: sv.x + svW, y: rows[i].y - 4 } : { x: w * (rows[i].ro ? 0.7 : 0.3), y: sv.y + svH }, rtIn = wide ? { x: rt.x - 14, y: rt.y + 32 } : { x: w / 2, y: rt.y - 12 };
  const rtOut = (dst: 'master' | 'slave') => { const b = dst === 'master' ? mst : slv; return [wide ? { x: rt.x + rtW + 20, y: rt.y + 32 } : { x: dst === 'master' ? w * 0.25 : w * 0.75, y: rt.y + rtH }, wide ? { x: b.x, y: b.y + 43 } : { x: b.x + dbW / 2, y: b.y }] as const; };
  // 서비스 → 라우터는 readOnly 값을 실은 토큰, 라우터 → DB는 DB 제목 옆을 지나므로 글자 없는 점(값은 DB 칸과 결과 알약이 보여 줌)
  travel(g, t, svOut(0), rtIn, D02.lines[0], D02.lines[1], 'false', 'blue');
  travel(g, t, ...rtOut('master'), D02.lines[1], D02.lines[2], '조회', 'blue', { dot: true });
  travel(g, t, svOut(1), rtIn, D02.write[0], D02.write[1], 'false', 'blue');
  travel(g, t, ...rtOut('master'), D02.write[1], D02.write[2], 'B', 'blue', { dot: true });
  travel(g, t, svOut(2), rtIn, D02.read1[0], D02.read1[1], 'true', 'green');
  travel(g, t, ...rtOut('slave'), D02.read1[1], D02.read1[2], 'SELECT', 'green', { dot: true });
  travel(g, t, svOut(2), rtIn, D02.read2[0], D02.read2[1], 'true', 'green');
  travel(g, t, ...rtOut('slave'), D02.read2[1], D02.read2[2], 'SELECT', 'green', { dot: true });
  // 조회 결과
  const by = (wide ? Math.max(sv.y + svH, slv.y + 86) : db0.y + 86 + 18) + 30;
  // 결과 알약: 넓은 폭은 한 줄, 좁은 폭은 왼쪽 정렬로 두 줄
  const res = (txt: string, at: number, tone: Tone, k: number) => {
    if (t < at) return;
    const pw = textW(txt, 12) + 22, x = wide ? (k ? Math.min(w * 0.75, w - 80) : Math.min(w * 0.25, 90)) : pw / 2 + 1, y = wide ? by + 4 : by + 4 + k * 34;
    pill(g, x, y, txt, { size: 12, h: 26, fill: TONE[tone].tint, stroke: TONE[tone].line, color: TONE[tone].text, alpha: appear(t, at) });
  };
  g.text(0, by - 12, 'findAllStations() 결과', { size: 12, weight: 600 });
  res('1회차: A · 적용 전', D02.read1[2], 'orange', 0);
  res('2회차: B · 적용 후', D02.read2[2], 'green', 1);
  const y = para(g, 0, by + (wide ? 48 : 82), '판단 기준은 트랜잭션 시작 시점의 readOnly. slave가 멈춰도 master로 자동 전환하지 않습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- D04 컬럼 가공: 모든 행을 계산 / 시작점에서 범위 밖까지 ---------- */
function columnV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d04(t), wide = w >= 560;
  // 좁은 폭에서는 '…' 칸을 빼고 리프 묶음을 진행 막대로 줄인다(글자는 줄이지 않음)
  const all: [string, number][] = [['첫 행', 44], ['…', 22], ['10999', 46], ['', 0], ['11010', 46], ['…', 22], ['끝', 36]];
  // '…' 칸은 리프 10칸에 11000·11009가 들어갈 자리가 남을 때만 둔다
  const dots = wide && (w - all.reduce((n, [, cw0]) => n + cw0 + 4, -4) - 16) / 10 - 3 >= textW('11000', 10, true) + 2;
  const cells = dots ? all : all.filter(([c]) => c !== '…'), blockIx = cells.findIndex(([c]) => c === ''), stopIx = cells.findIndex(([c]) => c === '11010');
  const fixed = cells.reduce((n, [, cw0]) => n + cw0, 0) + (cells.length - 1) * 4, blockW = w - fixed, cw = cells.map(([, cw0]) => cw0 || blockW);
  const xs: number[] = []; let x = 0; for (const c of cw) { xs.push(x); x += c + 4; }
  const strip = (y: number, n: number, tone: Tone, stopped = false) => {
    cells.forEach(([c], i) => {
      const stop = stopped && i === stopIx;
      g.rect(xs[i], y, cw[i], 30, { r: 6, fill: i === blockIx ? C.bg : C.paper, stroke: stop ? C.red : C.line, lw: stop ? 1.6 : 1 });
      if (c) g.text(xs[i] + cw[i] / 2, y + 19.5, c, { size: 11, mono: true, align: 'center', weight: stop ? 700 : 400, color: stop ? C.redText : C.muted });
    });
    const bx = xs[blockIx];
    if (wide) for (let k = 0; k < 10; k++) {
      const cwk = (blockW - 16) / 10, tx = bx + 8 + k * cwk, on = k < n;
      g.rect(tx, y + 6, cwk - 3, 18, { r: 3, fill: on ? TONE[tone].tint : C.paper, stroke: on ? TONE[tone].line : C.grid, lw: 1 });
      if (k === 0 || k === 9) g.text(tx + (cwk - 3) / 2, y + 19, k ? '11009' : '11000', { size: 10, mono: true, align: 'center', color: on ? TONE[tone].text : C.muted });
    } else {
      g.rect(bx + 4, y + 4, Math.max(0, (blockW - 8) * n / 10), 22, { r: 4, fill: TONE[tone].tint });
      g.text(bx + blockW / 2, y + 19.5, `${n}/10`, { size: 11, mono: true, weight: 700, align: 'center', color: n ? TONE[tone].text : C.muted });
    }
  };
  // 1) 범위 조건: 루트 → 브랜치 → 리프 시작점, 11010에서 멈춤
  const q2 = para(g, 0, 14, 'WHERE id BETWEEN 11000 AND 11009', w, { size: 11, mono: true, weight: 600 });
  const root = { x: Math.max(xs[blockIx] + blockW * 0.5, w / 2), y: q2 + 22 }, branch = { x: xs[blockIx] + blockW * 0.3, y: q2 + 62 }, leafY = q2 + 92, start = { x: xs[blockIx] + 14, y: leafY };
  pill(g, root.x, root.y, '루트', { size: 11, h: 22 }); pill(g, branch.x, branch.y, '브랜치', { size: 11, h: 22 });
  g.line(root.x, root.y + 11, branch.x, branch.y - 11, { stroke: C.line, lw: 1.2 });
  g.line(branch.x, branch.y + 11, start.x, leafY, { stroke: C.line, lw: 1.2 });
  strip(leafY, s.rightFound, 'green', s.rightStopped);
  if (t >= D04.descend[0] && t < D04.descend[1]) { const u = ease.inOut(span(t, D04.descend[0], D04.descend[1])), pt = u < 0.5 ? lerpPt(root, branch, u * 2) : lerpPt(branch, start, u * 2 - 1); g.circle(pt.x, pt.y, 5, { fill: C.blue }); }
  if (t >= D04.scan[0]) {
    const end = s.rightStopped ? xs[stopIx] + cw[stopIx] : xs[blockIx] + 8 + s.rightFound * ((blockW - 16) / 10);
    g.rect(xs[blockIx], leafY + 34, Math.max(2, end - xs[blockIx]), 4, { r: 2, fill: C.blue });
  }
  g.text(0, leafY + 62, s.rightStopped ? '시작점 11000 → 11010(범위 밖)에서 멈춤' : s.rightFound ? '시작점에서 리프를 읽는 중' : t >= D04.descend[1] ? '시작점 11000에 도착' : '시작점을 찾아 내려가는 중', { size: 12, weight: 600, color: C.blueText });
  // 2) 가공한 조건: 처음부터 끝까지 행마다 함수 계산
  const q1 = para(g, 0, leafY + 104, 'WHERE SUBSTRING(id, 1, 4) = 1100 AND LENGTH(id) = 5', w, { size: 11, mono: true, weight: 600 });
  // 칸은 커서 끝이 그 칸의 가운데를 지날 때 켜진다(넓은 폭은 10칸, 좁은 폭은 진행 막대의 10등분)
  const cx = lerp(xs[0] + 6, x - 4 - 6, s.leftProgress), bx = xs[blockIx];
  const center = (k: number) => wide ? bx + 8 + k * ((blockW - 16) / 10) + ((blockW - 16) / 10 - 3) / 2 : bx + 4 + (k + 0.5) * (blockW - 8) / 10;
  const lit = t < D04.sweep[0] ? 0 : Array.from({ length: 10 }, (_, k) => k).filter(k => center(k) <= cx).length;
  const y1 = q1 + 16; strip(y1, lit, 'orange');
  if (t >= D04.sweep[0]) {
    g.rect(xs[0], y1 + 34, Math.max(2, cx - xs[0]), 4, { r: 2, fill: C.orange });
    g.path(`M${cx - 6} ${y1 + 46}L${cx} ${y1 + 38}L${cx + 6} ${y1 + 46}Z`, { fill: C.orange });
  }
  g.text(0, y1 + 66, s.leftDone ? '모든 행 계산 · 멈출 지점 없음' : t >= D04.sweep[0] ? '행마다 SUBSTRING·LENGTH 계산 중' : '처음 행부터 함수를 계산할 차례', { size: 12, weight: 600, color: C.orangeText });
  const done = s.leftDone && s.rightStopped;
  const y = para(g, 0, y1 + 96, done ? '두 결과 모두 10행: 11000 … 11009' : '결과 10행을 찾는 중', w, { size: 13, weight: 700, color: done ? C.greenText : C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- D05 covering index: 인덱스 항목만으로 반환 / 항목마다 테이블 왕복 ---------- */
function coveringPanel(g: G, x: number, y: number, pw: number, t: number, covering: boolean) {
  // 읽기 커서가 지면 안에 들어오도록 인덱스 열을 12px 들여 쓴다
  const s = d05(t), ix = x + 12, ixW = Math.min(110, pw * 0.36), tbX = ix + ixW + 24, tbW = Math.min(120, pw - 12 - ixW - 24), rh = 24, top = y + 52;
  g.text(x, y + 14, covering ? 'SELECT id … 커버링' : 'SELECT * … 테이블 왕복', { size: 12, weight: 700 });
  g.text(x, y + 34, '보조 인덱스 (age, id)', { size: 11, color: C.muted });
  g.text(tbX, y + 34, '테이블 (PK id)', { size: 11, color: C.muted });
  const rows = [...D05_INDEX].map(([, id]) => id).sort((a, b) => a - b);
  D05_INDEX.forEach(([age, id], i) => {
    const yy = top + i * rh, inR = age >= 30 && age <= 39, k = D05_INDEX.filter(([a]) => a >= 30 && a <= 39).findIndex(e => e[1] === id), read = inR && k < s.read;
    g.rect(ix, yy, ixW, rh - 3, { r: 4, fill: read ? C.blueTint : C.paper, stroke: read ? C.blue : C.line, lw: 1 });
    g.text(ix + 8, yy + 15, `${age}`, { size: 11, mono: true, weight: 700, color: inR ? C.ink : C.muted });
    g.text(ix + ixW - 8, yy + 15, `${id}`, { size: 11, mono: true, align: 'right', color: read ? C.blueText : C.muted });
  });
  rows.forEach((id, i) => {
    const yy = top + i * rh, k = D05_INDEX.filter(([a]) => a >= 30 && a <= 39).findIndex(e => e[1] === id), hit = !covering && k >= 0 && k < s.tableRows;
    g.rect(tbX, yy, tbW, rh - 3, { r: 4, fill: hit ? C.orangeTint : covering ? C.slab : C.paper, stroke: hit ? C.orange : C.line, lw: 1 });
    g.text(tbX + 8, yy + 15, `${id} · 행`, { size: 11, mono: true, color: hit ? C.orangeText : C.muted });
  });
  // 커서와 왕복
  const inRange = D05_INDEX.map((e, i) => ({ e, i })).filter(({ e }) => e[0] >= 30 && e[0] <= 39);
  if (t >= D05.seek[0] && !s.stopped) { const k = Math.min(s.read, inRange.length - 1), yy = top + (s.read === 0 ? 1 : inRange[k].i) * rh + 10; g.path(`M${x} ${yy - 6}L${x + 8} ${yy}L${x} ${yy + 6}Z`, { fill: C.blue }); }
  if (!covering) inRange.forEach(({ e, i }, k) => {
    const at = D05.read + k * D05.gap; if (t < at) return;
    const ty = top + rows.indexOf(e[1]) * rh + 10, iy = top + i * rh + 10;
    if (t < at + D05.hop) travel(g, t, { x: ix + ixW, y: iy }, { x: tbX, y: ty }, at, at + D05.hop, `${e[1]}`, 'orange', { dot: true });
    else g.line(ix + ixW + 2, iy, tbX - 2, ty, { stroke: C.orange, lw: 1, alpha: 0.5 });
  });
  const by = top + 7 * rh + 22;
  g.text(x, by, `반환 id ${s.read} · 테이블 접근 ${covering ? 0 : s.tableAccess}회`, { size: 12, weight: 700, color: covering ? C.blueText : C.orangeText });
  return by + 10 - y;
}
function coveringV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d05(t), { cols, pw } = twoUp(w);
  g.text(0, 14, 'WHERE age BETWEEN 30 AND 39', { size: 12, mono: true, weight: 600 });
  const h = coveringPanel(g, 0, 24, pw, t, true);
  coveringPanel(g, cols === 2 ? pw + 28 : 0, cols === 2 ? 24 : 24 + h + 30, pw, t, false);
  if (cols === 1) g.line(0, 24 + h + 14, w, 24 + h + 14, { stroke: C.grid, lw: 1 });
  const y = (cols === 2 ? 24 + h : 24 + h * 2 + 30) + 30;
  const yy = para(g, 0, y, '보조 인덱스 항목에는 PK가 들어 있어 id만 필요하면 테이블에 가지 않습니다(MySQL 문서 기준 Extra: Using index · 원문에는 EXPLAIN 출력 없음).', w, { size: 12, color: C.muted });
  return frame(g, yy + 10, s.phase);
}

/* ---------- D06 조인: 드리븐 인덱스 탐색 + 연속 항목 / 인덱스 없이 전체 비교 ---------- */
const PRODUCTS: readonly (readonly [string, string])[] = [['1', 'Chais'], ['2', 'Chang'], ['3', 'Aniseed Syrup'], ['4', "Chef Anton's Cajun Seasoning"], ['5', "Chef Anton's Gumbo Mix"], ['…', ''], ['77', 'Original Frankfurter grüne Soße']];
function joinV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d06(t), { cols, pw } = twoUp(w);
  // 드라이빙: Products
  g.text(0, 14, '드라이빙 Products (ProductID, ProductName)', { size: 12, weight: 700 });
  const rh = 22, py = 26;
  PRODUCTS.forEach(([id, name], i) => {
    const on = i === 0 && s.picked;
    g.rect(0, py + i * rh, Math.min(w, 300), rh - 3, { r: 4, fill: on ? C.blueTint : C.paper, stroke: on ? C.blue : C.line, lw: 1 });
    g.text(8, py + i * rh + 14, id, { size: 11, mono: true, weight: 700, color: on ? C.blueText : C.ink });
    if (name) g.text(40, py + i * rh + 14, name, { size: 11, color: on ? C.blueText : C.muted });
  });
  const top = py + PRODUCTS.length * rh + 30;
  // 드리븐 OrderDetails: (ProductID, OrderDetailID)
  const driven = [['1', '100'], ['1', '124'], ['1', '185'], ['1', '270'], ['1', '283'], ['2', '…'], ['…', '…'], ['77', '2155']] as const;
  const scatter = [[3, '1', '270'], [0, '1', '100'], [6, '…', '…'], [1, '1', '124'], [5, '2', '…'], [2, '1', '185'], [7, '77', '2155'], [4, '1', '283']] as const;
  for (let pnl = 0; pnl < 2; pnl++) {
    const idx = pnl === 0, x = cols === 2 ? pnl * (pw + 28) : 0, y = cols === 2 ? top : top + pnl * 270;
    g.text(x, y, idx ? '드리븐 조인 키에 인덱스 있음' : '인덱스 없음 · 전체 비교(설명용)', { size: 12, weight: 700, color: idx ? C.blueText : C.orangeText });
    const ty = y + 16;
    if (idx) {
      // 탐색 점이 지면 안에 들어오도록 인덱스 열을 12px 들여 쓴다
      const ix = x + 12, iw = 60, tx = ix + iw + 40, tw = Math.min(110, pw - 12 - iw - 40);
      g.text(x, ty + 10, '인덱스', { size: 11, color: C.muted }); g.text(tx, ty + 10, '테이블 · 설명용 배치', { size: 11, color: C.muted });
      driven.forEach(([pid], i) => { const read = i < s.read, stop = i === 5 && s.indexStopped; g.rect(ix, ty + 18 + i * rh, iw, rh - 3, { r: 4, fill: read ? C.blueTint : C.paper, stroke: read ? C.blue : stop ? C.red : C.line, lw: stop ? 1.6 : 1 }); g.text(ix + iw / 2, ty + 18 + i * rh + 14, pid, { size: 11, mono: true, align: 'center', weight: stop ? 700 : 400, color: read ? C.blueText : stop ? C.redText : C.muted }); });
      scatter.forEach(([, pid, od], j) => { const k = pid === '1' ? D06_MATCH.indexOf(Number(od) as typeof D06_MATCH[number]) : -1, hit = k >= 0 && k < s.arrived; g.rect(tx, ty + 18 + j * rh, tw, rh - 3, { r: 4, fill: hit ? C.greenTint : C.paper, stroke: hit ? C.green : C.line, lw: 1 }); g.text(tx + 8, ty + 18 + j * rh + 14, `${pid} · ${od}`, { size: 11, mono: true, color: hit ? C.greenText : C.muted }); });
      D06_MATCH.forEach((od, k) => {
        const at = D06.read + k * D06.gap; if (t < at) return;
        const iy = ty + 18 + k * rh + 10, j = scatter.findIndex(e => e[2] === String(od)), sy = ty + 18 + j * rh + 10;
        if (t < at + D06.hop) travel(g, t, { x: ix + iw, y: iy }, { x: tx, y: sy }, at, at + D06.hop, `${od}`, 'green', { dot: true }); else g.line(ix + iw + 2, iy, tx - 2, sy, { stroke: C.green, lw: 1, alpha: 0.45 });
      });
      if (t >= D06.seek[0] && t < D06.seek[1]) { const u = ease.inOut(span(t, D06.seek[0], D06.seek[1])); g.circle(x + 5, lerp(ty + 14, ty + 28, u), 5, { fill: C.blue }); }
    } else {
      const tw = Math.min(150, pw - 20);
      g.text(x, ty + 10, '테이블 전체(설명용 배치)', { size: 11, color: C.muted });
      scatter.forEach(([, pid, od], j) => { const pos = (j + 0.5) / scatter.length, passed = s.scanProgress >= pos, hit = passed && pid === '1'; g.rect(x, ty + 18 + j * rh, tw, rh - 3, { r: 4, fill: hit ? C.greenTint : passed ? C.slab : C.paper, stroke: hit ? C.green : C.line, lw: 1 }); g.text(x + 8, ty + 18 + j * rh + 14, `${pid} · ${od}`, { size: 11, mono: true, color: hit ? C.greenText : C.muted }); });
      if (t >= D06.sweep[0]) { const cy = ty + 18 + Math.min(1, s.scanProgress) * scatter.length * rh; g.path(`M${x + tw + 4} ${cy - 6}L${x + tw + 12} ${cy}L${x + tw + 4} ${cy + 6}Z`, { fill: C.orange }); }
    }
    const done = idx ? s.indexStopped : t >= D06.sweep[1];
    g.text(x, ty + 18 + 8 * rh + 22, idx ? `탐색 1회 + 연속 ${s.read}항목${s.indexStopped ? ' · 키 2에서 멈춤' : ''}` : `드리븐 ${Math.round(Math.min(1, s.scanProgress) * 8)} / 8 비교`, { size: 12, weight: 700, color: done ? C.ink : C.muted });
  }
  const end = cols === 2 ? top + 16 + 18 + 8 * rh + 22 : top + 270 + 16 + 18 + 8 * rh + 22;
  // 결과 문장이 나타날 때 높이가 바뀌지 않도록 긴 문장의 줄 수만큼 자리를 잡아 둔다
  const both = s.indexStopped && t >= D06.sweep[1], result = `두 경우 결과는 같은 5행: ${D06_MATCH.join(' · ')}`;
  para(g, 0, end + 30, both ? result : '결과 행을 찾는 중', w, { size: 13, weight: 700, color: both ? C.greenText : C.muted });
  return frame(g, end + 30 + (wrap(result, w, 13).length - 1) * 21 + 10, s.phase);
}

/* ---------- D07 모수 줄이기: 두 파이프라인의 단계와 행 수 막대(설명용) ---------- */
function pipeline(g: G, x: number, y: number, pw: number, title: string, stages: readonly (readonly [string, number])[], reached: number, tone: Tone) {
  g.text(x, y + 14, title, { size: 12, weight: 700 });
  let yy = y + 30;
  stages.forEach(([name, vol], i) => {
    const on = i < reached, lines = wrap(name, pw - 20, 11, true), h = 28 + lines.length * 12;
    g.rect(x, yy, pw, h, { r: 8, fill: on ? C.paper : C.bg, stroke: on ? C.ink : C.grid, lw: 1.2, dash: on ? null : [3, 3] });
    lines.forEach((ln, k) => g.text(x + 10, yy + 17 + k * 13, ln, { size: 11, mono: true, weight: 600, color: on ? C.ink : C.muted }));
    if (on) g.rect(x + 10, yy + h - 15, Math.max(10, (pw - 20) * vol), 8, { r: 3, fill: TONE[tone].tint, stroke: TONE[tone].line, lw: 1 });
    if (i < stages.length - 1) arrow(g, { x: x + pw / 2, y: yy + h + 1 }, { x: x + pw / 2, y: yy + h + 13 }, { stroke: on ? C.ink : C.grid, lw: 1.2, size: 5 });
    yy += h + 16;
  });
  return yy;
}
function prefilterV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d07(t), { pw } = twoUp(w), cols = 2, cw = cols === 2 && w >= 560 ? pw : (w - 16) / 2;
  const A = [['employee ⋈ salary', 0.6], ['GROUP BY id · SUM', 0.4], ['ORDER BY SUM DESC', 0.4], ['LIMIT 150,10', 0.03], ['10행', 0.03]] as const;
  const B = [['salary 10001~50000', 0.6], ['GROUP BY id · SUM', 0.4], ['ORDER BY SUM DESC', 0.4], ['LIMIT 150,10', 0.03], ['10 id ⋈ employee', 0.03], ['10행', 0.03]] as const;
  const aEnd = pipeline(g, 0, 0, cw, 'A · 바로 조인', A, Math.max(0, s.aStage - 1), 'orange');
  const bEnd = pipeline(g, cw + 16, 0, cw, 'B · 먼저 줄이고 조인', B, Math.max(0, s.bStage - 1), 'blue');
  let y = Math.max(aEnd, bEnd) + 10;
  y = para(g, 0, y, '막대: 단계를 지나는 행의 양(설명용). 조인에 참여하는 행이 A는 범위 전체, B는 10행입니다.', w, { size: 12, color: C.muted }) + 22;
  y = para(g, 0, y, 'B는 바깥 ORDER BY가 없으면 출력 순서가 보장되지 않습니다.', w, { size: 12, color: C.orangeText });
  return frame(g, y + 10, s.phase);
}

/* ---------- D08 메모리·연결: 전역 버퍼 고정, 연결·연산 버퍼, 한도 초과 오류 ---------- */
function memoryV2(w: number, t: number): LessonFrame {
  const g = draw(), s = d08(t), wide = w >= 560;
  g.text(0, 14, 'mysqld 메모리 (크기는 설명용)', { size: 12, weight: 700 });
  // 넓은 폭: 한 줄 막대 / 좁은 폭: 전역 버퍼 한 줄 + 연결·연산 버퍼 한 줄
  const by = 26, gw = wide ? w * 0.46 : w, unit = wide ? w * 0.08 : (w - 5 * 3) / 6, ow = wide ? w * 0.07 : unit, rowY = wide ? by : by + 40;
  g.rect(0, by, gw, 34, { r: 6, fill: C.blueTint, stroke: C.blue, lw: 1.2 });
  g.text(8, by + 21, 'Global Buffer', { size: 11, weight: 700, color: C.blueText });
  let x = wide ? gw + 4 : 0;
  for (let i = 0; i < s.conns; i++) { const a = appear(t, D08.conns[i]); g.rect(x, rowY, unit, 34, { r: 6, fill: C.orangeTint, stroke: C.orange, lw: 1.2, alpha: a }); g.text(x + unit / 2, rowY + 21, `C${i + 1}`, { size: 11, mono: true, weight: 700, align: 'center', color: C.orangeText, alpha: a }); x += unit + 3; }
  if (s.sort) { g.rect(x, rowY, ow, 34, { r: 6, fill: C.redTint, stroke: C.red, lw: 1.2 }); g.text(x + ow / 2, rowY + 21, 'sort', { size: 10, mono: true, align: 'center', color: C.redText }); x += ow + 3; }
  if (s.join) { g.rect(x, rowY, ow, 34, { r: 6, fill: C.redTint, stroke: C.red, lw: 1.2 }); g.text(x + ow / 2, rowY + 21, 'join', { size: 10, mono: true, align: 'center', color: C.redText }); }
  let ny = para(g, 0, rowY + 56, 'innodb_buffer_pool_size · key_buffer_size(MyISAM): 시작할 때 한 번', w, { size: 11, color: C.blueText });
  ny = para(g, 0, ny + 20, '연결 C1…: 스레드·연결 버퍼 / sort·join: 그 연산 동안만', w, { size: 11, color: C.orangeText });
  // 연결 칸: max_connections 4(설명용) + 관리자 1
  const sy = ny + 34, n = 5, sw = (w - (n - 1) * 8) / n;
  g.text(0, sy - 10, 'max_connections = 4 (설명용) + 관리자용 1', { size: 12, weight: 600 });
  for (let i = 0; i < n; i++) {
    const admin = i === 4, used = !admin && i < s.conns, x0 = i * (sw + 8);
    g.rect(x0, sy, sw, 40, { r: 8, fill: used ? C.orangeTint : C.paper, stroke: admin ? C.faint : used ? C.orange : C.line, lw: 1.2, dash: admin ? [3, 3] : null });
    g.text(x0 + sw / 2, sy + 25, admin ? '관리자' : used ? `C${i + 1}` : '빈 칸', { size: 11, mono: !admin && used, weight: used ? 700 : 400, align: 'center', color: used ? C.orangeText : C.muted });
    if (used && i === 1 && s.sort) label(g, x0 + sw / 2, sy + 56, 'ORDER BY 실행 중', { size: 10, color: C.redText });
    if (used && i === 2 && s.join) label(g, x0 + sw / 2, sy + 72, '인덱스 없는 조인', { size: 10, color: C.redText });
  }
  // 다섯 번째 연결: 대기열이 아니라 오류
  const ry = sy + 96;
  if (t >= D08.reject[0]) {
    // C5는 지면 안에서 출발해 거절 지점에 도착한다(좁은 폭은 오른쪽에서 왼쪽으로)
    const cx = wide ? w * 0.4 : 18, from = wide ? 18 : w - 24, u = ease.inOut(span(t, D08.reject[0], D08.reject[1]));
    if (!s.rejected) token(g, lerp(from, cx, u), ry, 'C5', 'orange', { solid: true, r: 10 });
    else { cross(g, cx, ry, C.red); label(g, cx + 14, ry + 4, 'C5 · Too many connections 오류', { size: 12, weight: 700, align: 'left', color: C.redText, alpha: appear(t, D08.reject[1]) }); }
  }
  let y = ry + 34;
  y = para(g, 0, y, 'back_log는 연결을 수락하기 직전의 짧은 TCP 대기열이며 한도를 넘은 연결을 보관하지 않습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- D09 SQL 정답: 1번 단계와 상위 8행, 2번→3번 순위 변화(기울기) ---------- */
function sqlV2(w: number, t: number): LessonFrame {
  // 순위 기울기는 오른쪽 열에 긴 고객명과 금액이 함께 들어가는 600px부터 쓴다(그 아래는 표에 순위 변화를 적는 배치)
  const g = draw(), s = d09(t), wide = w >= 600;
  // 1번 단계
  const stages = ['예시 스키마 연결', '상품별 SUM(수량)', '≥ 200', '수량 내림차순'];
  const sw = (w - 3 * 14) / 4, bh = wide ? 40 : 52;
  stages.forEach((name, i) => {
    const on = i < s.q1Stage, x = i * (sw + 14), rows = wide ? [name] : name.split(' ');
    g.rect(x, 0, sw, bh, { r: 8, fill: on ? C.blueTint : C.paper, stroke: on ? C.blue : C.grid, lw: 1.2, dash: on ? null : [3, 3] });
    rows.forEach((r, k) => g.text(x + sw / 2, bh / 2 + 4 + (k - (rows.length - 1) / 2) * 13, r, { size: 11, weight: 600, align: 'center', color: on ? C.blueText : C.muted }));
    if (i < 3) arrow(g, { x: x + sw + 1, y: bh / 2 }, { x: x + sw + 12, y: bh / 2 }, { stroke: on ? C.blue : C.grid, lw: 1.2, size: 5 });
  });
  const ty = para(g, 0, bh + 24, '1번 · 200개 이상 팔린 상품 (72행 중 원본 캡처 상위 8행)', w, { size: 12, weight: 700 }) + 10, rh = 24;
  D09_Q1.forEach(([id, name, n], i) => {
    if (i >= s.q1Rows) return;
    const a = appear(t, D09.rows[0] + i * 125, 200), yy = ty + i * rh;
    g.rect(0, yy, w, rh - 2, { r: 4, fill: i % 2 ? C.paper : C.bg, alpha: a });
    g.text(8, yy + 15, String(id), { size: 11, mono: true, color: C.muted, alpha: a });
    g.text(40, yy + 15, name, { size: 11, alpha: a });
    g.text(w - 8, yy + 15, String(n), { size: 11, mono: true, weight: 700, align: 'right', alpha: a });
  });
  // 2번 → 3번
  const y2 = ty + 8 * rh + 34;
  const ly = para(g, 0, y2, '2번 수량 순위 → 3번 금액 순위 (각 91행 중 상위 8행)', w, { size: 12, weight: 700, color: s.q2 ? C.ink : C.muted }) + 18, lh = wide ? 26 : 40, colW = wide ? (w - 120) / 2 : w;
  if (s.q2) {
    if (wide) {
      const lx = 0, rx = colW + 120;
      D09_Q2.forEach(([id, name, n], i) => { const yy = ly + i * lh; g.text(lx, yy + 16, `${i + 1}. ${id} ${name}`, { size: 11 }); g.text(lx + colW - 4, yy + 16, String(n), { size: 11, mono: true, align: 'right', weight: 700 }); });
      if (t >= D09.q3[0]) {
        const q = span(t, D09.q3[0], D09.q3[1]);
        D09_Q3.forEach(([id, name, v], j) => { const a = appear(t, D09.q3[0] + j * 120); const yy = ly + j * lh; g.text(rx, yy + 16, `${j + 1}. ${id} ${name}`, { size: 11, alpha: a }); g.text(w - 4, yy + 16, v, { size: 11, mono: true, align: 'right', weight: 700, alpha: a }); });
        D09_Q2.forEach(([id], i) => {
          const j = D09_Q3.findIndex(e => e[0] === id), y1 = ly + i * lh + 12;
          if (j < 0) { g.text(colW + 8, y1 + 4, '상위 8 밖', { size: 10, color: C.muted, alpha: q }); return; }
          const y3 = ly + j * lh + 12, up = j < i, col = id === 63 ? C.green : up ? C.blue : C.line;
          const ex = lerp(colW + 6, rx - 6, q), ey = lerp(y1, y3, q);
          g.line(colW + 6, y1, ex, ey, { stroke: col, lw: id === 63 ? 2.2 : 1.4 });
        });
      }
    } else {
      // 좁은 폭: 3번 표에 2번 순위를 함께 적는다
      const src = t >= D09.q3[1] ? D09_Q3.map(([id, name, v]) => [id, name, v, D09_Q2.findIndex(e => e[0] === id)] as const) : D09_Q2.map(([id, name, n], i) => [id, name, String(n), i] as const);
      src.forEach(([id, name, v, from], j) => {
        const yy = ly + j * lh;
        g.text(0, yy + 14, `${j + 1}. ${id} ${name}`, { size: 11 });
        g.text(w, yy + 14, v, { size: 11, mono: true, weight: 700, align: 'right' });
        if (t >= D09.q3[1]) g.text(0, yy + 30, from < 0 ? '수량 상위 8 밖' : `수량 ${from + 1}위 → 금액 ${j + 1}위`, { size: 10, color: from >= 0 && from > j ? C.greenText : C.muted, alpha: appear(t, D09.q3[1]) });
      });
    }
  }
  const end = ly + 8 * lh + 20;
  // 마지막 문장이 바뀌어도 높이가 그대로이도록 긴 문장의 줄 수만큼 자리를 잡는다
  const done = 'QUICK-Stop(63)은 수량 3위 → 금액 1위. 25·24·35는 금액 상위 8 밖, 51·34·62가 새로 들어옵니다.', before = '정답 SQL은 원문에 없고 결과 캡처만 있습니다.';
  para(g, 0, end, s.q3 ? done : before, w, { size: 12, color: s.q3 ? C.greenText : C.muted });
  return frame(g, end + (Math.max(wrap(done, w, 12).length, wrap(before, w, 12).length) - 1) * 19 + 10, s.phase);
}

const dbRenderers = { D01: replicationV2, D02: routingV2, D04: columnV2, D05: coveringV2, D06: joinV2, D07: prefilterV2, D08: memoryV2, D09: sqlV2 };


/* Spark 5종: S03(지연 실행)과 같은 어휘 — 변환은 파랑, action·결과는 초록, partition은 칩, 집계는 Driver. */
function box(g: G, x: number, y: number, w: number, h: number, title: string, o: { on?: boolean; tone?: Tone; dash?: boolean; sub?: string } = {}) {
  const tone = o.tone ?? 'blue', on = o.on ?? true;
  g.rect(x, y, w, h, { r: 8, fill: on ? TONE[tone].tint : C.paper, stroke: on ? TONE[tone].line : C.grid, lw: 1.3, dash: o.dash || !on ? [3, 3] : null });
  g.text(x + w / 2, y + (o.sub ? h / 2 - 2 : h / 2 + 4), title, { size: 11, weight: 700, align: 'center', color: on ? TONE[tone].text : C.muted });
  if (o.sub) g.text(x + w / 2, y + h / 2 + 13, o.sub, { size: 10, align: 'center', color: C.muted });
}

/* ---------- S01 저장소 ⇄ Spark API 층 → 작업 영역 ---------- */
const STORES = ['kafka', 'HDFS', 'cassandra', 'PostgreSQL', 'Object Stores', 'elastic', 'Data Warehouses', '…and many more'] as const;
const AREAS = ['Streaming', 'ETL', 'Machine Learning', 'Analysis', 'Graph Processing', 'Data Lake'] as const;
function stackV2(w: number, t: number): LessonFrame {
  const g = draw(), s = s01(t), wide = w >= 560;
  const stW = wide ? 128 : w, arW = wide ? 136 : w, spX = wide ? stW + 28 : 0, spW = wide ? w - stW - arW - 56 : w;
  // 저장소
  const sh = 24, stw = wide ? stW : (w - 8) / 2;
  g.text(0, 12, '저장소 · connector', { size: 11, weight: 600, color: C.muted });
  const storePos = (i: number) => wide ? { x: 0, y: 22 + i * (sh + 6) } : { x: (i % 2) * (stw + 8), y: 22 + Math.floor(i / 2) * (sh + 6) };
  STORES.forEach((n, i) => { const p = storePos(i); g.rect(p.x, p.y, stw, sh, { r: 6, fill: C.paper, stroke: C.ink, lw: 1.1 }); g.text(p.x + 8, p.y + 16, n, { size: 11, mono: i < 7, color: i < 7 ? C.ink : C.muted }); });
  const storesBottom = wide ? 22 + 8 * (sh + 6) - 6 : 22 + 4 * (sh + 6) - 6;
  // Spark 층
  const spY = wide ? 0 : storesBottom + 48, L = { x: spX, w: spW };
  g.text(L.x, spY + 12, 'Apache Spark', { size: 12, weight: 700 });
  const topY = spY + 22, libsW = (L.w - 12) / 3;
  ['Structured Streaming', 'Advanced Analytics', 'Libraries & Ecosystem'].forEach((n, i) => box(g, L.x + i * (libsW + 6), topY, libsW, 40, n.split(' ')[0], { on: s.libs, sub: n.split(' ').slice(1).join(' ') }));
  const midY = topY + 52;
  const apis = [['Datasets', 'Scala · Java'], ['DataFrames', 'Python · Scala · Java · R'], ['SQL', '모든 언어(spark.sql)']] as const, aw = (L.w - 28) / 3;
  const langRows = apis.map(([, langs]) => wrap(langs, aw - 8, 10)), apiH = 30 + Math.max(...langRows.map(r => r.length)) * 12 + 6;
  g.rect(L.x, midY, L.w, apiH + 36, { r: 8, fill: s.structured ? C.blueTint : C.paper, stroke: s.structured ? C.blue : C.grid, lw: 1.3, dash: s.structured ? null : [3, 3] });
  g.text(L.x + 10, midY + 18, 'Structured APIs', { size: 12, weight: 700, color: s.structured ? C.blueText : C.muted });
  apis.forEach(([n], i) => {
    const x = L.x + 8 + i * (aw + 6);
    g.rect(x, midY + 28, aw, apiH, { r: 6, fill: C.paper, stroke: s.structured ? C.blue : C.grid, lw: 1 });
    g.text(x + aw / 2, midY + 46, n, { size: 11, weight: 700, mono: true, align: 'center', color: s.structured ? C.ink : C.muted });
    if (s.langs) langRows[i].forEach((r, k) => g.text(x + aw / 2, midY + 62 + k * 12, r, { size: 10, align: 'center', color: C.greenText, alpha: appear(t, S01.langs) }));
  });
  const lowY = midY + apiH + 48;
  box(g, L.x, lowY, L.w, 40, 'Low-level APIs', { on: s.low, sub: 'RDDs · Distributed Variables', tone: 'blue' });
  // 작업 영역
  const arX = wide ? w - arW : 0, arY = wide ? 0 : lowY + 70;
  const arT = para(g, arX, arY + 12, '한 프레임워크로 묶은 작업 영역', arW, { size: 11, weight: 600, color: C.muted, lh: 14 });
  AREAS.forEach((n, i) => {
    const aw2 = wide ? arW : (w - 8) / 2, x = wide ? arX : (i % 2) * (aw2 + 8), y = arT + 10 + (wide ? i * 30 : Math.floor(i / 2) * 30);
    g.rect(x, y, aw2, 24, { r: 12, fill: s.areas ? C.greenTint : C.paper, stroke: s.areas ? C.green : C.grid, lw: 1, dash: s.areas ? null : [3, 3] });
    g.text(x + aw2 / 2, y + 16, n, { size: 11, align: 'center', color: s.areas ? C.greenText : C.muted });
  });
  const areasBottom = arT + 10 + (wide ? 6 : 3) * 30 - 6;
  // 읽기·쓰기 흐름
  const inA = wide ? { x: stW + 2, y: 140 } : { x: w * 0.62, y: storesBottom + 6 }, inB = wide ? { x: L.x - 2, y: lowY + 20 } : { x: w * 0.62, y: spY - 6 };
  if (s.read) arrow(g, inA, inB, { stroke: C.blue, lw: 1.3, size: 6 });
  travel(g, t, inA, inB, S01.read[0], S01.read[1], '읽기', 'blue', { line: false, r: 9 });
  const outA = wide ? { x: L.x - 2, y: topY + 20 } : { x: w * 0.38, y: spY - 6 }, outB = wide ? { x: stW + 2, y: 60 } : { x: w * 0.38, y: storesBottom + 6 };
  if (s.written) arrow(g, outA, outB, { stroke: C.green, lw: 1.3, size: 6 });
  travel(g, t, outA, outB, S01.write[0], S01.write[1], '쓰기', 'green', { line: false, r: 9 });
  const bottom = wide ? Math.max(storesBottom, lowY + 40, areasBottom) : areasBottom;
  let y = bottom + 30;
  if (s.managers) y = para(g, 0, y, '실행: Standalone · YARN · Kubernetes (원문의 Mesos는 Spark 4.0에서 제거)', w, { size: 12, color: C.muted, alpha: appear(t, S01.managers) });
  return frame(g, y + 10 + (s.managers ? 0 : 19 * (wrap('실행: Standalone · YARN · Kubernetes (원문의 Mesos는 Spark 4.0에서 제거)', w, 12).length - 1)), s.phase);
}

/* ---------- S02 하나의 논리 표 → partition → executor → driver ---------- */
function partitionV2(w: number, t: number): LessonFrame {
  const g = draw(), s = s02(t), wide = w >= 560;
  const tw = wide ? 300 : w, rh = 22, split = appear(t, S02.split[1]);
  g.text(0, 12, 'DataFrame (논리 뷰 · 하나의 표)', { size: 12, weight: 700 });
  // 열 위치: 머리글 폭을 재서 남는 폭을 두 간격에 나눈다(좁은 폭에서 머리글이 붙지 않음)
  const cols = ['customer_id', 'Invoice_id', 'creation_date'], hw = cols.map(c => textW(c, 11, true)), gap = Math.min(28, (tw - 12 - hw[0] - hw[1] - hw[2]) / 2);
  const cx = [6, 6 + hw[0] + gap, 6 + hw[0] + hw[1] + 2 * gap];
  g.rect(0, 22, tw, rh, { r: 4, fill: C.slab });
  cols.forEach((c, i) => g.text(cx[i], 37, c, { size: 11, mono: true, weight: 700 }));
  // 나눔 사건(split)에서 행이 partition 색으로 칠해진다
  S02_ROWS.forEach((r, i) => {
    const yy = 22 + (i + 1) * rh;
    g.rect(0, yy, tw, rh - 2, { r: 3, fill: C.bg });
    if (s.split) g.rect(0, yy, tw, rh - 2, { r: 3, fill: i < 3 ? C.orangeTint : C.blueTint, alpha: split });
    r.forEach((v, k) => g.text(cx[k], yy + 15, String(v), { size: 11, mono: true }));
  });
  const tableBottom = 22 + 7 * rh;
  // Worker / Executor / Partition: 넓은 폭은 오른쪽 세로, 좁은 폭은 표 아래 세로
  const wx = wide ? tw + 40 : 0, wy = wide ? 0 : tableBottom + 30, ww = wide ? w - wx : w, wh = 112;
  const workers = [0, 1].map(k => ({ x: wx, y: wy + k * (wh + 12), w: ww }));
  workers.forEach((b, k) => {
    const tone: Tone = k ? 'blue' : 'orange';
    // action 전에는 논리 partition만 있다. Worker·Executor 틀은 action 때 task가 배정되는 순간 나타난다
    if (s.assigned) {
      const a = appear(t, S02.assign);
      g.rect(b.x, b.y, b.w, wh, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.3, alpha: a });
      g.text(b.x + 10, b.y + 18, `Worker ${k + 1} · Executor`, { size: 11, weight: 700, alpha: a });
      g.text(b.x + 10, b.y + 100, s.counted ? 'count = 3' : '처리 중', { size: 11, weight: 600, color: s.counted ? C.greenText : C.muted });
    }
    const px = b.x + 10, py = b.y + 28, pw2 = Math.min(b.w - 20, 220);
    g.rect(px, py, pw2, 52, { r: 8, fill: s.assigned ? TONE[tone].tint : C.paper, stroke: s.split ? TONE[tone].line : C.grid, lw: 1.2, dash: s.assigned ? null : [3, 3] });
    g.text(px + 8, py + 15, s.assigned ? `Partition ${k + 1}` : `Partition ${k + 1} · 논리`, { size: 10.5, weight: 700, color: C.muted });
    if (s.split) S02_ROWS.slice(k * 3, k * 3 + 3).forEach((r, i) => token(g, px + 30 + i * 52, py + 36, r[1], tone, { r: 9, alpha: split }));
  });
  // Driver: 각 executor의 3이 오른쪽 가장자리를 따라 내려온다(partition 글자를 가리지 않음)
  const dy = wide ? Math.max(tableBottom, wy + 2 * wh + 12) + 30 : wy + 2 * wh + 12 + 30;
  g.rect(0, dy, w, 44, { r: 10, fill: s.result !== null ? C.greenTint : C.paper, stroke: s.result !== null ? C.green : C.line, lw: 1.3 });
  g.text(12, dy + 27, s.action ? 'Driver · count()' : 'Driver', { size: 12, weight: 700 });
  workers.forEach((b, k) => { const tx = b.x + b.w - 22 - k * 40; travel(g, t, { x: tx, y: b.y + wh - 12 }, { x: tx, y: dy + 22 }, S02.driver[0], S02.driver[1], '3', 'green', { line: false, r: 9 }); });
  if (s.result !== null) g.text(w - 12, dy + 28, '3 + 3 = 6', { size: 14, weight: 700, mono: true, align: 'right', color: C.greenText, alpha: appear(t, S02.driver[1]) });
  if (s.split && !s.action) label(g, w / 2, dy - 10, '그림 기준 예시 분할 · 아직 계산 전', { size: 11, color: C.muted, alpha: split });
  const y = para(g, 0, dy + 74, '논리 표의 6행 = partition 3 + 3. 사용자는 하나의 표를, Spark는 partition 단위 작업을 봅니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- S04 실행계획: Analyzed → (가지치기·병합) → Optimized ---------- */
// 원문 explain("extended") 출력의 노드. 긴 인자는 원문 형식 그대로 줄이고 …로 표시한다
const RELATION = '[ID#16,…,AcceptedCmp1#39,... 5 more fields] csv';
const ANALYZED = [['GlobalLimit 5', ''], ['LocalLimit 5', ''], ['Project', '[education#238]'], ['Project', '[…, … AS date_joined#257]'], ['Project', '[ID#16 AS id#236, …, Education#18 AS education#238, … 7개]'], ['Relation', RELATION]] as const;
const OPTIMIZED = [['GlobalLimit 5', ''], ['LocalLimit 5', ''], ['Project', '[Education#18 AS education#238]'], ['Relation', RELATION]] as const;
function planV2(w: number, t: number): LessonFrame {
  const g = draw(), s = s04(t), wide = w >= 560;
  // 단계 칩: 글자 폭에 맞춰 흐르고, 넘치면 다음 줄로
  const stages = ['Unresolved', 'Analyzed', 'Optimized', 'Physical', 'RDDs'], at = [0, S04.analyzed[0], S04.optimize[1], S04.physical, S04.rdd];
  const chipW = stages.map(n => textW(n, 11) + 20), gap = 16;
  let cx = 0, cy = 0, physAt: Pt = { x: 0, y: 0 };
  stages.forEach((n, i) => {
    // 줄을 넘기면 다음 줄 앞에 이어짐 화살표를 둔다
    if (cx + chipW[i] > w) { cx = 0; cy += 44; arrow(g, { x: 0, y: cy + 14 }, { x: 12, y: cy + 14 }, { stroke: t >= at[i] ? C.blue : C.grid, lw: 1, size: 4 }); cx = 16; }
    const on = t >= at[i], cur = on && (i === stages.length - 1 || t < at[i + 1]), phys = i === 3;
    g.rect(cx, cy, chipW[i], 28, { r: 6, fill: cur ? C.blueTint : C.paper, stroke: on ? (phys ? C.faint : C.blue) : C.grid, lw: cur ? 1.8 : 1, dash: phys || !on ? [3, 3] : null });
    g.text(cx + chipW[i] / 2, cy + 18, n, { size: 11, weight: 600, align: 'center', color: on ? (phys ? C.muted : C.blueText) : C.muted });
    if (phys) physAt = { x: cx + chipW[i] / 2, y: cy + 42 };
    const nx = cx + chipW[i] + gap;
    if (i < 4 && nx + chipW[i + 1] <= w) arrow(g, { x: cx + chipW[i] + 2, y: cy + 14 }, { x: nx - 2, y: cy + 14 }, { stroke: on ? C.blue : C.grid, lw: 1, size: 4 });
    cx = nx;
  });
  // 줄 끝의 Physical 칩 아래 라벨이 지면 밖으로 나가지 않게 중심을 당긴다
  const physW = textW('원문 출력 없음', 10) + 10;
  if (s.physical) label(g, Math.min(Math.max(physAt.x, physW / 2 + 1), w - physW / 2 - 1), physAt.y, '원문 출력 없음', { size: 10, color: C.muted });
  // 코드: 한 줄에 안 들어가면 메서드 경계에서 나눈다
  const code = 'xx.select("education").limit(5).explain("extended")', codeLines = textW(code, 11, true) <= w ? [code] : ['xx.select("education")', '  .limit(5).explain("extended")'];
  const codeY = cy + 66;
  codeLines.forEach((ln, i) => g.text(0, codeY + i * 15, ln, { size: 11, mono: true, weight: 600 }));
  const cw = wide ? (w - 28) / 2 : w, nodeH = 36, top = codeY + (codeLines.length - 1) * 15 + 16;
  const tree = (x: number, y: number, title: string, nodes: readonly (readonly [string, string])[], visible: (i: number) => number, dim: (i: number) => boolean, show = true) => {
    if (show) g.text(x, y + 12, title, { size: 12, weight: 700 });
    // 인자가 한 줄에 안 들어가면 노드를 키워 줄을 나눈다(글자는 줄이지 않음)
    let yy = y + 22;
    nodes.forEach(([op, args], i) => {
      const indent = Math.min(i * 6, 30), rows = args ? wrap(args, cw - indent - 16, 10, true) : [], h = nodeH + Math.max(0, rows.length - 1) * 13;
      const a = visible(i), d = dim(i);
      if (a > 0) {
        g.rect(x + indent, yy, cw - indent, h, { r: 6, fill: d ? C.slab : C.paper, stroke: d ? C.line : C.ink, lw: 1.1, alpha: a });
        g.text(x + indent + 8, yy + 15, op, { size: 11, weight: 700, mono: true, color: d ? C.muted : C.ink, alpha: a });
        rows.forEach((r, k) => g.text(x + indent + 8, yy + 29 + k * 13, r, { size: 10, mono: true, color: d ? C.muted : C.blueText, alpha: a }));
      }
      yy += h + 6;
    });
    return yy;
  };
  const q = span(t, S04.optimize[0], S04.optimize[1]);
  const aEnd = tree(0, top, 'Analyzed Logical Plan', ANALYZED, i => (5 - i) < s.built ? 1 : 0, i => s.optimizing && (i === 3 || i === 4) && q > 0.2);
  // Optimized 트리 자리는 처음부터 잡아 둔다(나타날 때 높이가 바뀌지 않음)
  const ox = wide ? cw + 28 : 0, oy = wide ? top : aEnd + 30;
  const oEnd = tree(ox, oy, 'Optimized Logical Plan', OPTIMIZED, i => s.optimizing ? appear(t, S04.optimize[0] + 400 + (3 - i) * 250, 250) : 0, () => false, s.optimizing);
  // 가지치기 표시는 넓은 폭에서 Optimized 트리 아래, 좁은 폭에서 두 트리 사이
  if (s.optimizing) label(g, wide ? cw + 28 : 5, wide ? oEnd + 8 : aEnd + 14, '가지치기 · Project 병합', { size: 11, weight: 600, align: 'left', color: C.blueText, alpha: appear(t, S04.optimize[0]) });
  // 결과 문장이 바뀌어도 높이가 그대로이도록 긴 문장의 줄 수만큼 자리를 잡는다
  const y = Math.max(aEnd, oEnd) + 26, done = '결과 스키마 education: string · 최대 5행 — 최적화 전후 같음', before = '최적화는 결과를 바꾸지 않고 연산만 줄입니다.';
  para(g, 0, y, s.result ? done : before, w, { size: 12, weight: s.result ? 700 : 400, color: s.result ? C.greenText : C.muted });
  return frame(g, y + (Math.max(wrap(done, w, 12).length, wrap(before, w, 12).length) - 1) * 19 + 10, s.phase);
}

/* ---------- S05 predicate pushdown: 같은 결과, 건너는 행 수 ---------- */
function laneV2(g: G, y: number, w: number, t: number, push: boolean) {
  const s = s05(t), dbW = Math.min(150, w * 0.38), spW = Math.min(120, w * 0.34), spX = w - spW, rh = 18;
  g.text(0, y + 12, push ? 'pushdown: 저장소에서 거른 뒤 전송' : 'pushdown 없음: 전송 뒤 Spark에서 거름', { size: 12, weight: 700, color: push ? C.blueText : C.orangeText });
  const top = y + 22, boxH = 8 * rh + 28, under = top + boxH + 18;
  g.rect(0, top, dbW, boxH, { r: 8, fill: C.bg, stroke: C.ink, lw: 1.2 });
  g.text(8, top + 15, 'DB · people', { size: 11, weight: 700, mono: true });
  const dbFilt = push && s.dbFiltered;
  S05_AGES.forEach((age, i) => { const keep = age > 30, yy = top + 24 + i * rh, out = dbFilt && !keep; g.text(10, yy + 12, `age ${age}`, { size: 11, mono: true, color: out ? C.muted : C.ink }); if (out) g.line(8, yy + 8, 58, yy + 8, { stroke: C.red, lw: 1.2, alpha: appear(t, S05.dbFilter) }); });
  // Spark
  g.rect(spX, top, spW, boxH, { r: 8, fill: C.bg, stroke: C.ink, lw: 1.2 });
  g.text(spX + 8, top + 15, 'Spark', { size: 11, weight: 700 });
  // 조건 알약: 상자 아래에 두고, pushdown이면 Spark 아래에서 DB 아래로 옮겨 SQL WHERE가 된다
  // 좁은 폭에서도 알약이 지면 안에 머물도록 중심을 당긴다
  const fw = textW('Filter age > 30', 11) + 22, ww = textW('WHERE age > 30', 11, true) + 22;
  const spC = Math.min(spX + spW / 2, w - fw / 2 - 1), dbC = Math.max(dbW / 2, Math.max(fw, ww) / 2 + 1);
  if (!push) pill(g, spC, under, 'Filter age > 30', { size: 11, h: 22, fill: C.orangeTint, stroke: C.orange, color: C.orangeText });
  else if (t < S05.push[0]) pill(g, spC, under, 'Filter age > 30', { size: 11, h: 22, fill: C.paper, stroke: C.blue, color: C.blueText });
  else if (t < S05.push[1]) pill(g, lerp(spC, dbC, ease.inOut(span(t, S05.push[0], S05.push[1]))), under, 'Filter age > 30', { size: 11, h: 22, fill: C.blueTint, stroke: C.blue, color: C.blueText });
  else pill(g, dbC, under, 'WHERE age > 30', { size: 11, h: 22, mono: true, fill: C.blueTint, stroke: C.blue, color: C.blueText });
  // 네트워크를 건너는 행
  const moved = push ? s.moved2 : s.moved, list = push ? S05_AGES.filter(a => a > 30) : [...S05_AGES];
  const gapX0 = dbW + 8, gapX1 = spX - 8, midY = top + boxH / 2;
  g.line(gapX0, midY, gapX1, midY, { stroke: C.grid, lw: 1, dash: [3, 4] });
  list.slice(0, moved).forEach((age, i) => { const yy = top + 24 + i * rh, kept = age > 30, filt = !push && s.filtered && !kept; g.text(spX + 10, yy + 12, `age ${age}`, { size: 11, mono: true, color: filt ? C.muted : C.greenText }); if (filt) cross(g, spX + spW - 16, yy + 8, C.red, appear(t, S05.filter), 4); });
  const [ta, tb] = push ? S05.transfer2 : S05.transfer, n = push ? 5 : 8;
  if (t >= ta && t < tb) { const k = Math.min(n - 1, Math.floor(span(t, ta, tb) * n)), u = (span(t, ta, tb) * n) % 1; token(g, lerp(gapX0 + 16, gapX1 - 16, u), midY - 14, list[k], push ? 'blue' : 'orange', { r: 9 }); }
  g.text((gapX0 + gapX1) / 2, midY + 22, `건넌 행 ${moved}`, { size: 11, weight: 700, align: 'center', color: push ? C.blueText : C.orangeText });
  return under + 16;
}
function pushdownV2(w: number, t: number): LessonFrame {
  const g = draw(), s = s05(t);
  const head = para(g, 0, 12, '.filter($"age" > 30) · JDBC (원문 그림, 값은 설명용)', w, { size: 11, mono: true, weight: 600 });
  const e1 = laneV2(g, head + 12, w, t, false);
  g.line(0, e1 + 10, w, e1 + 10, { stroke: C.grid, lw: 1 });
  const e2 = laneV2(g, e1 + 24, w, t, true);
  let y = e2 + 26;
  y = para(g, 0, y, '두 경우 결과는 같은 5행(34·41·52·31·38). 실제 JDBC 조회는 필요한 열 목록을 씁니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- S06 반복: 잡마다 HDFS 왕복 / cache 재사용과 lineage 재계산 ---------- */
function iterateV2(w: number, t: number): LessonFrame {
  const g = draw(), s = s06(t), wide = w >= 560;
  // MapReduce: 넓은 폭은 잡 셋을 가로로, 좁은 폭은 세로로. 읽기·쓰기 칩은 상자 윗변에 잠깐 뜬다
  g.text(0, 12, 'MapReduce · 잡마다 HDFS에 쓰고 다시 읽음', { size: 12, weight: 700, color: C.orangeText });
  const y1 = 30, jx0 = 50, jw = wide ? (w - jx0 - 2 * 40) / 3 : w - jx0, jh = 46, step = wide ? jw + 40 : jh + 30;
  cylinder(g, 22, y1 + 6, 36, 34, { fill: C.slab });
  g.text(22, y1 + 58, 'HDFS', { size: 10, align: 'center', color: C.muted });
  S06.mr.forEach(([a, b], i) => {
    const x = wide ? jx0 + i * step : jx0, y = wide ? y1 : y1 + i * step, done = t >= b, run = t >= a && !done;
    g.rect(x, y, jw, jh, { r: 8, fill: run ? C.orangeTint : done ? C.paper : C.bg, stroke: run || done ? C.orange : C.grid, lw: 1.2, dash: t < a ? [3, 3] : null });
    g.text(x + jw / 2, y + 20, `Job ${i + 1}`, { size: 11, weight: 700, align: 'center', color: t >= a ? C.orangeText : C.muted });
    g.text(x + jw / 2, y + 36, 'map → reduce', { size: 10, mono: true, align: 'center', color: C.muted });
    if (t >= a && t < a + 400) token(g, x + 26, y, '읽기', 'orange', { r: 8 });
    if (t >= b - 400 && t < b) token(g, x + jw - 26, y, '쓰기', 'orange', { r: 8 });
    if (i < 2) {
      const p = wide ? { x: x + jw + 2, y: y + jh / 2 } : { x: x + jw / 2, y: y + jh + 2 }, q = wide ? { x: x + jw + 38, y: y + jh / 2 } : { x: x + jw / 2, y: y + jh + 28 };
      g.line(p.x, p.y, q.x, q.y, { stroke: done ? C.orange : C.grid, lw: 1.2, dash: [4, 3] });
      if (done) label(g, wide ? (p.x + q.x) / 2 : p.x + 12, wide ? y + jh + 16 : (p.y + q.y) / 2 + 4, 'HDFS', { size: 10, align: wide ? 'center' : 'left', color: C.orangeText });
    }
  });
  const mrEnd = wide ? y1 + jh : y1 + 2 * step + jh;
  g.text(w, mrEnd + 36, `디스크 읽기·쓰기 ${s.mrIO}회(설명용)`, { size: 11, weight: 700, align: 'right', color: C.orangeText });
  // Spark
  const y2 = mrEnd + 72;
  g.text(0, y2, 'Spark · 첫 action에서 cache를 채우고 재사용', { size: 12, weight: 700, color: C.blueText });
  const src = { x: 22, y: y2 + 30 };
  cylinder(g, src.x, src.y - 12, 36, 34, { fill: C.slab });
  g.text(src.x, src.y + 40, '원본', { size: 10, align: 'center', color: C.muted });
  const ex = 60, ew = w - ex, ey = y2 + 40, eh = 74;
  if (t >= S06.cacheMark) pill(g, ex + 50, y2 + 22, 'cache() 표시', { size: 10, h: 20, fill: C.paper, stroke: C.blue, color: C.blueText, alpha: appear(t, S06.cacheMark) });
  g.rect(ex, ey, ew, eh, { r: 10, fill: C.bg, stroke: C.ink, lw: 1.2 });
  g.text(ex + 10, ey + 17, 'executor 메모리', { size: 11, weight: 700 });
  const cellW = Math.min(120, (ew - 32) / 2), cy = ey + 28;
  [0, 1].forEach(k => {
    const x = ex + 10 + k * (cellW + 12), filled = t >= S06.fill[1] && !(k === 1 && s.lost), lost = k === 1 && s.lost;
    g.rect(x, cy, cellW, 36, { r: 6, fill: filled ? C.blueTint : lost ? C.redTint : C.paper, stroke: filled ? C.blue : lost ? C.red : C.grid, lw: 1.2, dash: filled ? null : [3, 3] });
    g.text(x + cellW / 2, cy + 22, lost ? `P${k + 1} 잃음` : `Partition ${k + 1}`, { size: 11, weight: 700, align: 'center', color: filled ? C.blueText : lost ? C.redText : C.muted });
  });
  // 채우기·재계산: 원본에서 각 칸 아래쪽으로 들어오는 점
  const fillTo = (k: number) => ({ x: ex + 10 + k * (cellW + 12) + cellW / 2, y: cy + 36 });
  [0, 1].forEach(k => { if (t >= S06.fill[0] && t < S06.fill[1]) { const h = lerpPt({ x: src.x + 18, y: src.y + 20 }, fillTo(k), ease.inOut(span(t, S06.fill[0], S06.fill[1]))); g.circle(h.x, h.y, 4.5, { fill: C.blue }); } });
  if (t >= S06.recompute[0] && t < S06.recompute[1]) { const h = lerpPt({ x: src.x + 18, y: src.y + 20 }, fillTo(1), ease.inOut(span(t, S06.recompute[0], S06.recompute[1]))); g.circle(h.x, h.y, 4.5, { fill: C.green }); }
  // 반복 칩은 상자 아래 한 줄
  const ry = ey + eh + 18, its = [S06.fill[1], S06.it2[1], S06.it3[1]];
  its.forEach((at, i) => { const on = t >= at; pill(g, ex + 30 + i * 62, ry, `반복 ${i + 1}`, { size: 10, h: 20, fill: on ? C.greenTint : C.paper, stroke: on ? C.green : C.grid, color: on ? C.greenText : C.muted }); });
  if (t >= S06.recompute[0]) label(g, ex + 5, ry + 30, s.recovered ? 'P2는 lineage로 그 부분만 다시 계산됨' : 'lineage로 P2만 다시 계산 중', { size: 11, weight: 600, align: 'left', color: C.greenText, alpha: appear(t, S06.recompute[0]) });
  // 재계산 뒤에는 원본을 P2만큼 한 번 더 읽는다. 문장이 길어져도 높이가 그대로이도록 긴 문장 기준으로 자리를 잡는다
  const sumLong = '원본 읽기 1회 + P2 재계산 1회 · 메모리 재사용 2회(설명용)';
  para(g, 0, ry + 58, s.recovered ? sumLong : `원본 읽기 1회 · 메모리 재사용 ${Math.max(0, s.iterations - 1)}회(설명용)`, w, { size: 11, weight: 700, color: C.blueText });
  const sumY = ry + 58 + (wrap(sumLong, w, 11).length - 1) * 18;
  let y = sumY + 30;
  y = para(g, 0, y, s.recovered ? '두 줄의 결과는 같습니다. 디스크를 거친 횟수가 다릅니다(shuffle 중간 파일은 Spark도 디스크에 씁니다).' : 'cache()는 표시일 뿐이고 첫 action에서 채워집니다.', w, { size: 12, color: C.muted });
  return frame(g, Math.max(y, sumY + 30 + 19 * (wrap('두 줄의 결과는 같습니다. 디스크를 거친 횟수가 다릅니다(shuffle 중간 파일은 Spark도 디스크에 씁니다).', w, 12).length - 1)) + 10, s.phase);
}

const sparkRenderers = { S01: stackV2, S02: partitionV2, S04: planV2, S05: pushdownV2, S06: iterateV2 };

export const dataRenderers: Record<DataFigureId, (w: number, t: number) => LessonFrame> = { ...dbRenderers, ...sparkRenderers };
