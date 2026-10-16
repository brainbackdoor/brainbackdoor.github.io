/** B06 인프라·운영 16종 렌더러. 공통 그리기 도구(lessonCanvas)와 사건 모델(infra-models)만 쓰고, Canvas와 정적 SVG가 같은 명령을 읽는다. */
import { C, TONE, appear, arrow, draw, ease, f2, fileGlyph, frame, label, lerp, lerpPt, lockGlyph, para, pill, span, textW, token, wrap, type G, type LessonFrame, type Pt, type Tone } from './lessonCanvas';
import { A01, A01_BLOCKED, A01_RULES, A02, A03, A04, A04_ROWS, A05, A06, A07, A07_USERDATA, O01, O02, O02_LATENCY, O03, O04, O04_ROWS, O05, O07, O08, a01, a02, a03, a04, a05, a06, a07, o01, o02, o03, o04, o05, o06, o07, o08, o09, type InfraFigureId } from './infra-models';

/* B06 공통 도구: 사건 시각에 도착하는 이동, 꺾인 경로 이동, 여러 줄 카드, 허용·차단 표시 */
// [a, b] 동안 p → q로 이동해 b에 도착(도착 뒤에는 그리지 않음). 글자 위를 지나는 짧은 구간은 글자 없는 점
function travel(g: G, t: number, p: Pt, q: Pt, a: number, b: number, text: string, tone: Tone, o: { dot?: boolean; r?: number } = {}) {
  if (t < a || t >= b) return;
  const h = lerpPt(p, q, ease.inOut(span(t, a, b)));
  if (o.dot) g.circle(h.x, h.y, 4.5, { fill: TONE[tone].line });
  else token(g, h.x, h.y, text, tone, { solid: true, r: o.r ?? 9 });
}
// 꺾인 경로 위의 위치(길이 비율)
export function along(pts: Pt[], u: number): Pt {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)), total = seg.reduce((n, d) => n + d, 0);
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) return lerpPt(pts[i], pts[i + 1], seg[i] ? Math.min(1, d / seg[i]) : 1); d -= seg[i]; }
  return pts[pts.length - 1];
}
function travelAlong(g: G, t: number, pts: Pt[], a: number, b: number, text: string, tone: Tone, o: { dot?: boolean } = {}) {
  if (t < a || t >= b) return;
  const h = along(pts, ease.inOut(span(t, a, b)));
  if (o.dot) g.circle(h.x, h.y, 4.5, { fill: TONE[tone].line });
  else token(g, h.x, h.y, text, tone, { solid: true, r: 9 });
}
// 꺾인 선 + 끝 화살촉
export function route(g: G, pts: Pt[], color: string, o: { dash?: number[] | null; lw?: number; alpha?: number; head?: boolean } = {}) {
  g.path('M' + pts.map(p => `${f2(p.x)} ${f2(p.y)}`).join('L'), { stroke: color, lw: o.lw ?? 1.4, dash: o.dash ?? null, alpha: o.alpha ?? 1 });
  if (o.head === false) return;
  const q = pts[pts.length - 1], p = pts[pts.length - 2], ang = Math.atan2(q.y - p.y, q.x - p.x), s = 6;
  g.path(`M${f2(q.x + s * Math.cos(ang + Math.PI - 0.45))} ${f2(q.y + s * Math.sin(ang + Math.PI - 0.45))}L${f2(q.x)} ${f2(q.y)}L${f2(q.x + s * Math.cos(ang + Math.PI + 0.45))} ${f2(q.y + s * Math.sin(ang + Math.PI + 0.45))}Z`, { fill: color, stroke: color, lw: 1, alpha: o.alpha ?? 1 });
}
type Line = { text: string; size?: number; weight?: number; mono?: boolean; color?: string };
// 여러 줄 카드: 위에서부터 줄을 쌓는다. 높이를 돌려준다
function card(g: G, x: number, y: number, w: number, lines: Line[], o: { tone?: Tone; on?: boolean; dash?: boolean; fill?: string; h?: number; pad?: number } = {}) {
  const pad = o.pad ?? 9, lh = 15, h = o.h ?? pad * 2 + lines.length * lh - 2, on = o.on ?? true, tone = o.tone;
  g.rect(x, y, w, h, { r: 8, fill: o.fill ?? (on && tone ? TONE[tone].tint : C.paper), stroke: on ? (tone ? TONE[tone].line : C.ink) : C.grid, lw: 1.2, dash: o.dash || !on ? [3, 3] : null });
  lines.forEach((l, i) => g.text(x + pad, y + pad + 11 + i * lh, l.text, { size: l.size ?? 11, weight: l.weight ?? (i === 0 ? 700 : 400), mono: l.mono, color: l.color ?? (on ? (i === 0 && tone ? TONE[tone].text : C.ink) : C.muted) }));
  return h;
}
// 허용(✓)·차단(✕) 표시
function mark(g: G, x: number, y: number, ok: boolean, alpha = 1) {
  if (ok) g.path(`M${f2(x - 5)} ${f2(y)}L${f2(x - 1.5)} ${f2(y + 4)}L${f2(x + 5.5)} ${f2(y - 4.5)}`, { stroke: C.green, lw: 2.2, alpha });
  else { g.line(x - 5, y - 5, x + 5, y + 5, { stroke: C.red, lw: 2.2, alpha }); g.line(x - 5, y + 5, x + 5, y - 5, { stroke: C.red, lw: 2.2, alpha }); }
}

/* 인프라 7종: 망·프록시·인증서·프로필·배포·ASG·모듈 지도 */

/* ---------- A01 망 구성: 허용 경로 5개와 막히는 직접 접근 ---------- */
function vpcV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a01(t), wide = w >= 560;
  const W = w - 16, top = 50, x0 = 16, gap = 10, cw = (W - x0 - 10 - gap) / 2, x1 = x0 + cw + gap;
  // 행위자: 로컬 PC는 왼쪽(관리망 AZ1으로 왼쪽 여백을 따라), 인터넷 사용자는 오른쪽(외부망 AZ2로)
  const lx = Math.max(x0 + cw * 0.3, 52), ux = w - (wide ? 90 : 60), lanes = [ux - 34, ux - 66, lx + 34];
  pill(g, lx, 13, '로컬 PC 공인 IP', { size: 11, h: 24 });
  pill(g, ux, 13, '인터넷 사용자', { size: 11, h: 24 });
  // 망 카드: 좁은 폭은 CIDR을 주소와 '/접두사 · 역할' 두 줄로 나눈다
  const cidr = (c: string, role: string, extra: string): Line[] => wide ? [{ text: c, mono: true }, ...(extra ? [{ text: extra, color: C.muted }] : [])] : [{ text: c.split('/')[0], mono: true }, { text: `/${c.split('/')[1]}${role ? ' · ' + role : ''}`, mono: true }, ...(extra ? [{ text: extra, color: C.muted }] : [])];
  const rowH = wide ? 61 : 76, row1 = top + 14, row2 = row1 + rowH + 30;
  g.rect(0, top, W, row2 + rowH + 34 - top, { r: 12, fill: C.bg, stroke: C.ink, lw: 1.3 });
  card(g, x0, row1, cw, [{ text: wide ? 'AZ1 · 외부망 · proxy·WAS' : 'AZ1 · 외부망' }, ...cidr('192.168.0.0/26', 'WAS', '')], { tone: 'blue', h: rowH });
  card(g, x1, row1, cw, [{ text: wide ? 'AZ2 · 외부망 · proxy·WAS' : 'AZ2 · 외부망' }, ...cidr('192.168.0.64/26', 'WAS', '')], { tone: 'blue', h: rowH });
  pill(g, x1 + cw - 32, row1 + rowH - 14, 'NAT GW', { size: 10, h: 18, fill: C.paper });
  // 원본 그림에서 NAT로만 나가는 192.168.0.160/27을 내부망으로(배정은 설명용)
  card(g, x0, row2, cw, [{ text: wide ? 'AZ1 · 관리망 · Bastion' : 'AZ1 · 관리망' }, ...cidr('192.168.0.128/27', 'Bastion', '배정은 설명용')], { tone: 'green', h: rowH });
  card(g, x1, row2, cw, [{ text: wide ? 'AZ2 · 내부망 · DB' : 'AZ2 · 내부망' }, ...cidr('192.168.0.160/27', 'DB', '배정은 설명용')], { tone: 'orange', h: rowH });
  const bottom = row2 + rowH + 34;
  g.text(0, bottom + 18, 'VPC 192.168.0.0/24 · IGW · AZ 2개', { size: 12, weight: 700 });
  // NAT 아웃바운드(내부망 → NAT GW, 점선)
  g.line(x1 + cw - 32, row2 - 2, x1 + cw - 32, row1 + rowH - 4, { stroke: C.orange, lw: 1.2, dash: [3, 3] });
  // 허용 경로(사건 시각에 도착)
  const green = C.green;
  const web: Pt[] = [{ x: ux, y: 26 }, { x: ux, y: row1 }];
  const adminPath: Pt[] = [{ x: lx, y: 26 }, { x: lx, y: 36 }, { x: 5, y: 36 }, { x: 5, y: row2 + rowH / 2 }, { x: x0, y: row2 + rowH / 2 }];
  const toWeb: Pt[] = [{ x: x0 + cw / 2, y: row2 }, { x: x0 + cw / 2, y: row1 + rowH }];
  const toDb: Pt[] = [{ x: x0 + cw / 2, y: row2 + rowH }, { x: x0 + cw / 2, y: row2 + rowH + 16 }, { x: x1 + cw / 2, y: row2 + rowH + 16 }, { x: x1 + cw / 2, y: row2 + rowH }];
  const db: Pt[] = [{ x: x1 + cw * 0.4, y: row1 + rowH }, { x: x1 + cw * 0.4, y: row2 }];
  const flows: [Pt[], readonly number[], string, number][] = [[web, A01.web, '443', 0], [adminPath, A01.admin, '22', 4], [toWeb, A01.toWeb22, '22', 1], [toDb, A01.toDb22, '22', 3], [db, A01.db, '3306', 2]];
  for (const [pts, [a, b], port, rule] of flows) {
    if (s.allowed[rule]) route(g, pts, green, { alpha: Math.max(0.35, appear(t, b)) });
    // 관리 경로는 지면 왼쪽 여백을 따라 돌므로 글자 없는 점으로 그린다
    travelAlong(g, t, pts, a, b, port, 'green', { dot: pts === adminPath });
  }
  if (s.allowed[0]) g.text(ux + 6, 40, ':443', { size: 10.5, mono: true, color: C.greenText });
  if (s.allowed[1]) g.text(x0 + cw / 2 + 7, row1 + rowH + 19, ':22', { size: 10.5, mono: true, color: C.greenText });
  if (s.allowed[2]) g.text(x1 + cw * 0.4 + 7, row1 + rowH + 19, ':3306', { size: 10.5, mono: true, color: C.greenText });
  if (s.allowed[3]) g.text((x0 + x1 + cw) / 2, row2 + rowH + 29, ':22', { size: 10.5, mono: true, align: 'center', color: C.greenText });
  // 막히는 직접 접근: 경계에서 ✕
  A01_BLOCKED.forEach(([, , port], i) => {
    const x = lanes[i], at = A01.block[i];
    travel(g, t, { x, y: 26 }, { x, y: top }, at, at + 600, String(port), 'red');
    if (s.blocked[i]) mark(g, x, top, false, appear(t, at + 600));
  });
  // 규칙 표
  const ty = bottom + 44, colW = wide ? (w - 24) / 2 : w, bx = wide ? colW + 24 : 0, by = wide ? ty : ty + 22 + 6 * 22 + 18;
  g.text(0, ty, '보안 그룹 인바운드(대상 ← 출발지 : 포트)', { size: 11, weight: 700 });
  A01_RULES.forEach(([dst, src, port], i) => {
    const y = ty + 10 + i * 22, on = s.allowed[i];
    g.rect(0, y, colW, 19, { r: 4, fill: on ? C.greenTint : C.bg });
    g.text(8, y + 14, `${dst} ← ${src} : ${port}`, { size: 11, color: on ? C.greenText : C.ink });
    if (on) mark(g, colW - 12, y + 9, true, appear(t, [A01.web, A01.toWeb22, A01.db, A01.toDb22, A01.admin][i][1]));
  });
  const ny = ty + 10 + 5 * 22;
  g.rect(0, ny, colW, 19, { r: 4, fill: C.orangeTint });
  g.text(8, ny + 14, '내부망 → 인터넷 : NAT 경유 아웃바운드만', { size: 11, color: C.orangeText });
  g.text(bx, by, '막힘(허용 규칙 없음)', { size: 11, weight: 700 });
  A01_BLOCKED.forEach(([src, dst, port], i) => {
    const y = by + 10 + i * 22, on = s.blocked[i];
    g.rect(bx, y, colW, 19, { r: 4, fill: on ? C.redTint : C.bg });
    g.text(bx + 8, y + 14, `${src} → ${dst} : ${port}`, { size: 11, color: on ? C.redText : C.muted });
    if (on) mark(g, bx + colW - 12, y + 9, false, appear(t, A01.block[i] + 600));
  });
  const end = wide ? ty + 10 + 6 * 22 : by + 10 + 3 * 22;
  const y = para(g, 0, end + 22, '규칙에 없는 인바운드는 보안 그룹이 거부합니다(허용된 요청의 응답은 자동 허용).', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- A02 Reverse Proxy와 TLS 종료 ---------- */
function tlsV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a02(t), wide = w >= 560;
  const nodes: Line[][] = [
    [{ text: '클라이언트' }, { text: '브라우저', color: C.muted }],
    [{ text: 'nginx' }, { text: 'proxy :80 · :443', mono: true }, { text: 'fullchain · privkey', mono: true, color: C.muted }, { text: s.tls ? 'TLS 종료 지점' : ' ', color: C.blueText }],
    [{ text: 'WAS' }, { text: '172.17.0.1:8080', mono: true }, { text: '(호스트)', color: C.muted }],
    [{ text: 'DB' }, { text: ':3306', mono: true }],
  ];
  // 넓은 폭: 노드 폭을 내용에 맞추고 남는 폭을 세 구간에 나눈다. 좁은 폭: 세로
  const nwW = [92, 150, 130, 70], nh = 74, gapW = (w - nwW.reduce((a, b) => a + b, 0)) / 3, gapN = 46;
  const pos = (i: number) => wide ? { x: nwW.slice(0, i).reduce((a, b) => a + b, 0) + i * gapW, y: 0, w: nwW[i] } : { x: 0, y: i * (nh + gapN), w };
  nodes.forEach((ln, i) => { const p = pos(i); card(g, p.x, p.y, p.w, ln, { tone: i === 1 ? 'blue' : undefined, h: nh }); });
  // 구간: 0 클라이언트–nginx, 1 nginx–WAS, 2 WAS–DB. 위 줄은 요청, 아래 줄은 응답
  const lane = (i: number, back: boolean): [Pt, Pt] => {
    const a = pos(i), b = pos(i + 1);
    if (wide) { const y = back ? nh * 0.72 : nh * 0.3; return back ? [{ x: b.x - 4, y }, { x: a.x + a.w + 4, y }] : [{ x: a.x + a.w + 4, y }, { x: b.x - 4, y }]; }
    const x = back ? w * 0.72 : w * 0.28; return back ? [{ x, y: b.y - 4 }, { x, y: a.y + nh + 4 }] : [{ x, y: a.y + nh + 4 }, { x, y: b.y - 4 }];
  };
  for (let i = 0; i < 3; i++) for (const back of [false, true]) { const [p, q] = lane(i, back); arrow(g, p, q, { stroke: C.grid, lw: 1, size: 5 }); }
  // 구간 이름: 넓은 폭은 구간 아래 가운데, 좁은 폭은 두 길 사이
  const segAt = (i: number) => { const a = pos(i), b = pos(i + 1); return wide ? { x: (a.x + a.w + b.x) / 2, y: nh + 18 } : { x: w / 2, y: (a.y + nh + b.y) / 2 + 4 }; };
  const segLabel = (i: number, text: string, color: string, at: number) => { const c = segAt(i); label(g, c.x, c.y, text, { size: 10.5, weight: 600, color, alpha: appear(t, at) }); };
  if (s.tls) { const c = segAt(0), a = appear(t, A02.hand[1]); lockGlyph(g, c.x - 5, wide ? nh * 0.5 - 7 : c.y - 34, C.green, { alpha: a }); segLabel(0, 'TLS', C.greenText, A02.hand[1]); }
  else if (s.redirected && t < A02.hand[0]) segLabel(0, ':80 → 301', C.muted, A02.http[2]);
  if (s.decrypted) segLabel(1, 'HTTP 평문', C.orangeText, A02.req[1]);
  if (t >= A02.db[1]) segLabel(2, '암호화 원문 없음', C.muted, A02.db[1]);
  // 토큰: 핸드셰이크 중에는 구간 위에 '핸드셰이크'
  travel(g, t, ...lane(0, false), A02.http[0], A02.http[1], ':80', 'blue');
  travel(g, t, ...lane(0, true), A02.http[1], A02.http[2], '301', 'blue');
  if (t >= A02.hand[0] && t < A02.hand[1]) { const c = segAt(0); label(g, c.x, c.y, '핸드셰이크', { size: 10.5, color: C.blueText }); }
  travel(g, t, ...lane(0, false), A02.req[0], A02.req[1], 'TLS', 'green', { dot: wide && gapW < 80 });
  travel(g, t, ...lane(1, false), A02.plain[0], A02.plain[1], 'HTTP', 'orange', { dot: wide && gapW < 80 });
  travel(g, t, ...lane(2, false), A02.db[0], A02.db[1], 'SQL', 'blue', { dot: true });
  travel(g, t, ...lane(2, true), A02.back[0], A02.back[1], '행', 'blue', { dot: true });
  travel(g, t, ...lane(1, true), A02.back[1], A02.back[2], 'HTTP', 'orange', { dot: wide && gapW < 80 });
  travel(g, t, ...lane(0, true), A02.back[2], A02.back[3], 'TLS', 'green', { dot: wide && gapW < 80 });
  const end = wide ? nh + 30 : pos(3).y + nh;
  const y = para(g, 0, end + 26, '원문 설정의 ssl_protocols는 TLSv1·TLSv1.1·TLSv1.2이고 http2는 켜져 있지 않습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- A03 DNS-01 챌린지와 인증서 적용 ---------- */
function dns01V2(w: number, t: number): LessonFrame {
  const g = draw(), s = a03(t), wide = w >= 560;
  const cw = wide ? (w - 2 * 36) / 3 : w - 28, chH = 92;
  // 넓은 폭: certbot | DNS | CA 가로, 좁은 폭: certbot / DNS / CA 세로. certbot ↔ CA는 바깥 길로 돈다
  const at = (i: number) => wide ? { x: i * (cw + 36), y: 24 } : { x: 0, y: i * (chH + 30) };
  const lines: Line[][] = [
    [{ text: '서버 · certbot' }, { text: 'manual · dns-01', mono: true }, ...(s.asked ? [{ text: '_acme-challenge TXT', mono: true, color: C.orangeText }, { text: '값: <토큰>', mono: true, color: C.muted }] : [])],
    [{ text: 'DNS 사이트' }, { text: '도메인 레코드', color: C.muted }, ...(s.txt ? [{ text: 'TXT _acme-challenge', mono: true, color: C.orangeText }] : []), ...(s.dug ? [{ text: 'dig로 반영 확인', color: C.greenText }] : [])],
    [{ text: "Let's Encrypt" }, { text: 'acme-v02', mono: true, color: C.muted }, ...(s.verified ? [{ text: 'TXT 조회 · 검증 성공', color: C.greenText }] : [])],
  ];
  lines.forEach((ln, i) => { const p = at(i); card(g, p.x, p.y, cw, ln, { tone: i === 2 ? 'green' : i === 1 ? 'orange' : 'blue', h: chH }); });
  // 경로
  const A = at(0), D = at(1), CA = at(2);
  const out: Pt[] = wide ? [{ x: A.x + cw / 2, y: A.y }, { x: A.x + cw / 2, y: 8 }, { x: CA.x + cw / 2, y: 8 }, { x: CA.x + cw / 2, y: CA.y }] : [{ x: A.x + cw, y: A.y + 24 }, { x: w - 6, y: A.y + 24 }, { x: w - 6, y: CA.y + 24 }, { x: CA.x + cw, y: CA.y + 24 }];
  const back: Pt[] = wide ? [{ x: CA.x + cw / 2, y: CA.y + chH }, { x: CA.x + cw / 2, y: CA.y + chH + 14 }, { x: A.x + cw / 2, y: A.y + chH + 14 }, { x: A.x + cw / 2, y: A.y + chH }] : [{ x: CA.x + cw, y: CA.y + chH - 22 }, { x: w - 6, y: CA.y + chH - 22 }, { x: w - 6, y: A.y + chH - 22 }, { x: A.x + cw, y: A.y + chH - 22 }];
  const toDns: [Pt, Pt] = wide ? [{ x: A.x + cw + 3, y: A.y + chH / 2 }, { x: D.x - 3, y: D.y + chH / 2 }] : [{ x: cw * 0.35, y: A.y + chH + 3 }, { x: cw * 0.35, y: D.y - 3 }];
  const caDns: [Pt, Pt] = wide ? [{ x: CA.x - 3, y: CA.y + chH / 2 }, { x: D.x + cw + 3, y: D.y + chH / 2 }] : [{ x: cw * 0.35, y: CA.y - 3 }, { x: cw * 0.35, y: D.y + chH + 3 }];
  route(g, out, C.grid, { lw: 1 }); route(g, back, C.grid, { lw: 1 }); arrow(g, ...toDns, { stroke: s.txt ? C.orange : C.grid, lw: 1.2, size: 5 }); arrow(g, ...caDns, { stroke: s.verified ? C.green : C.grid, lw: 1.2, size: 5 });
  // 좁은 폭의 바깥 길은 지면 오른쪽 여백이라 글자 없는 점으로
  travelAlong(g, t, out, A03.order[0], A03.order[1], '주문', 'blue', { dot: !wide });
  travelAlong(g, t, [...out].reverse(), A03.ask[0], A03.ask[1], 'TXT 값', 'orange', { dot: !wide });
  travel(g, t, ...toDns, A03.txt[0], A03.txt[1], 'TXT', 'orange', { dot: !wide });
  travel(g, t, ...caDns, A03.verify[0], A03.verify[1], '조회', 'green', { dot: !wide });
  travelAlong(g, t, back, A03.verify[1], A03.issued, '인증서', 'green', { dot: !wide });
  // 발급된 파일과 적용 단계
  const fy = wide ? 24 + chH + 34 : CA.y + chH + 24;
  g.text(0, fy, '/etc/letsencrypt/live/[도메인주소]/', { size: 11, mono: true, weight: 600, color: s.issued ? C.ink : C.muted });
  ['fullchain.pem', 'privkey.pem'].forEach((f, i) => { const x = i * (wide ? 150 : 128); fileGlyph(g, x, fy + 10, { color: s.issued ? C.ink : C.grid, s: 0.9 }); g.text(x + 18, fy + 24, f, { size: 11, mono: true, color: s.issued ? C.ink : C.muted }); });
  g.text(0, fy + 46, '개인키는 서버에서 만들고 CA로 보내지 않습니다.', { size: 11, color: C.muted });
  const steps = ['cp → 작업 폴더', 'Dockerfile COPY', 'nginx ssl_certificate', ':0.0.2 재실행 -p 443'], sy = fy + 64;
  const sw = wide ? (w - 3 * 24) / 4 : w;
  steps.forEach((st, i) => {
    const on = s.applied > i, x = wide ? i * (sw + 24) : 0, y = wide ? sy : sy + i * 34;
    g.rect(x, y, sw, 26, { r: 6, fill: on ? C.blueTint : C.paper, stroke: on ? C.blue : C.grid, lw: 1.1, dash: on ? null : [3, 3] });
    g.text(x + sw / 2, y + 17, st, { size: 10.5, mono: i > 0, align: 'center', color: on ? C.blueText : C.muted });
    if (wide && i < 3) arrow(g, { x: x + sw + 3, y: y + 13 }, { x: x + sw + 21, y: y + 13 }, { stroke: on ? C.blue : C.grid, lw: 1, size: 4 });
  });
  const ly = wide ? sy + 50 : sy + 4 * 34 + 14;
  lockGlyph(g, 0, ly - 10, s.served ? C.green : C.grid, { alpha: 1 });
  g.text(18, ly, s.served ? ':443이 이 인증서로 응답' : ':443 아직 아님', { size: 12, weight: 700, color: s.served ? C.greenText : C.muted });
  const y = para(g, 0, ly + 28, '발급은 TXT 검증을 통과한 뒤입니다. installer None이라 적용은 손으로 합니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- A04 프로필별 설정 파일과 DB ---------- */
function profileV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a04(t), wide = w >= 560;
  let y = para(g, 0, 12, 'application.properties(기본) 위에 프로필 파일이 덮어씁니다', w, { size: 11, color: C.muted }) + 14;
  A04_ROWS.forEach(([prof, run, user, db], i) => {
    const on = s.on[i], act = s.active === i, done = s.done[i], tone: Tone = i === 0 ? 'green' : i === 1 ? 'orange' : 'blue';
    const runLines = wrap(run, w - 20, 11, true), chipH = wide ? 38 : [38, 52, 38], blockH = wide ? 34 + runLines.length * 15 + 46 : 34 + runLines.length * 15 + 38 + 52 + 38 + 2 * 8 + 14;
    g.rect(0, y, w, blockH, { r: 10, fill: act ? TONE[tone].tint : C.bg, stroke: on ? TONE[tone].line : C.grid, lw: act ? 1.6 : 1.1 });
    g.text(10, y + 18, `실행: ${['테스트', '로컬', '배포'][i]}`, { size: 11, weight: 700, color: on ? TONE[tone].text : C.muted });
    runLines.forEach((ln, k) => g.text(10, y + 34 + k * 15, ln, { size: 11, mono: true, color: on ? C.ink : C.muted }));
    const cy = y + 34 + runLines.length * 15 + 4;
    // 프로필 → 파일 → DB
    const chips: [string, string, boolean][] = [[prof, '프로필', true], [`application-${prof}.properties`, `account.name = ${user} · password = ••••`, false], [db, i === 2 ? 'DB URL 원문 없음' : '요구사항 기준', false]];
    const widths = wide ? [70, 0, 140] : [w - 20, w - 20, w - 20];
    if (wide) widths[1] = w - 20 - widths[0] - widths[2] - 2 * 26;
    let x = 10;
    chips.forEach(([main, sub, mono0], k) => {
      const h = Array.isArray(chipH) ? chipH[k] : chipH, cyp = wide ? cy : cy + (k === 0 ? 0 : k === 1 ? 46 : 46 + 60), cxp = wide ? x : 10, cwp = widths[k], lit = s.chipsOn[i][k];
      // 좁은 폭의 파일 칩은 account 줄을 name·password 두 줄로 나눈다
      const subs = !wide && k === 1 ? sub.split(' · ') : [sub];
      g.rect(cxp, cyp, cwp, h, { r: 6, fill: C.paper, stroke: lit ? TONE[tone].line : C.grid, lw: 1, dash: lit ? null : [3, 3] });
      g.text(cxp + 8, cyp + 15, main, { size: 11, mono: k < 2 || mono0, weight: 700, color: lit ? C.ink : C.muted });
      subs.forEach((sb, m) => g.text(cxp + 8, cyp + 30 + m * 14, sb, { size: 10, mono: k === 1, color: C.muted }));
      if (wide && k < 2) arrow(g, { x: cxp + cwp + 4, y: cyp + 19 }, { x: cxp + cwp + 22, y: cyp + 19 }, { stroke: s.chipsOn[i][k + 1] ? TONE[tone].line : C.grid, lw: 1.1, size: 4 });
      x += cwp + 26;
    });
    if (done) mark(g, w - 16, y + 14, true, appear(t, [A04.test, A04.local, A04.prod][i][1]));
    y += blockH + 10;
  });
  const yy = para(g, 0, y + 14, 'password 값은 가렸습니다. 실행 방법과 프로필의 연결 방식은 원문에 없어 설명용입니다. 스크립트 사용법의 { prod | dev }와 달리 예제 프로필은 test·local·prod입니다.', w, { size: 12, color: C.muted });
  return frame(g, yy + 10, s.phase);
}

/* ---------- A05 배포 스크립트의 흐름과 중단 구간 ---------- */
function deployV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a05(t), wide = w >= 560;
  const steps: [string, string, number, boolean][] = [
    ['cron', '매 10분 실행(crontab 줄은 원문 없음)', A05.cron2, false], ['check_df', 'git fetch · rev-parse $BRANCH ≠ origin/$BRANCH', A05.diff, true],
    ['pull', 'git pull origin master', A05.pull, true], ['build', '주석뿐 · G02: ./gradlew clean build', A05.build[1], false],
    ['종료', '주석뿐 · G02: pgrep -f java · kill -2', A05.kill, false], ['기동', '주석뿐 · G02: nohup java -jar … &', A05.start, false], ['확인', 'G02: curl http://localhost:8080', A05.curl, false],
  ];
  const sw = wide ? w * 0.58 : w;
  g.text(0, 12, '배포 스크립트(실행 2: 변경 있음)', { size: 12, weight: 700 });
  let sy = 22;
  steps.forEach(([name, cmd, at, real]) => {
    const on = s.run >= 2 && t >= at, lines = wrap(cmd, sw - 90, 10.5, true), h = Math.max(34, 10 + lines.length * 13 + 4);
    g.rect(0, sy, sw, h, { r: 6, fill: on ? (real ? C.blueTint : C.slab) : C.paper, stroke: on ? (real ? C.blue : C.ink) : C.grid, lw: 1.1, dash: real ? null : [3, 3] });
    g.text(8, sy + h / 2 + 4, name, { size: 11, weight: 700, color: on ? (real ? C.blueText : C.ink) : C.muted });
    lines.forEach((ln, k) => g.text(78, sy + h / 2 + 4 - (lines.length - 1) * 6.5 + k * 13, ln, { size: 10.5, mono: true, color: on ? C.ink : C.muted }));
    sy += h + 6;
  });
  const noteY = para(g, 0, sy + 8, '실선 = 스크립트에 실제 코드 · 점선 = 주석 또는 다른 글(G02)의 명령', sw, { size: 10.5, color: C.muted });
  // 실행 기록
  const lx = wide ? sw + 20 : 0, ly = wide ? 22 : noteY + 26, lw = wide ? w - lx : w;
  g.rect(lx, ly, lw, 110, { r: 8, fill: C.bg, stroke: C.line, lw: 1 });
  g.text(lx + 10, ly + 18, '실행 기록', { size: 11, weight: 700 });
  // 원문 echo 문자열(Nothing to do!!!, Pull Request) 외의 줄은 설명용
  const logs: [number, string, string][] = [[A05.same, '[실행 1] Nothing to do!!!', C.muted], [A05.diff, '[실행 2] 변경 감지(설명용)', C.blueText], [A05.pull, '[실행 2] Pull Request', C.blueText], [A05.kill, '[실행 2] 프로세스 종료(설명용)', C.redText], [A05.start, '[실행 2] 새 프로세스(설명용)', C.greenText]];
  logs.forEach(([at, txt, color], i) => { if (t >= at) g.text(lx + 10, ly + 36 + i * 15, txt, { size: 10.5, mono: true, color, alpha: appear(t, at) }); });
  // 프로세스 시간줄: 기존 → 빈 구간 → 새 프로세스
  const ty = (wide ? Math.max(noteY, ly + 110) : ly + 110) + 30, X0 = 0, X1 = w, xAt = (ms: number) => X0 + (X1 - X0) * (ms - A05.cron2) / (A05.end - A05.cron2);
  g.text(0, ty, '프로세스(실행 2 구간)', { size: 11, weight: 700 });
  const by = ty + 10;
  g.rect(X0, by, (t >= A05.kill ? xAt(A05.kill) : X1) - X0, 22, { r: 4, fill: C.blueTint, stroke: C.blue, lw: 1 });
  g.text(X0 + 8, by + 15, '기존 PID', { size: 10.5, weight: 600, color: C.blueText });
  if (t >= A05.kill) { const a = appear(t, A05.kill); g.rect(xAt(A05.kill) + 2, by, xAt(A05.start) - xAt(A05.kill) - 4, 22, { r: 4, fill: C.redTint, stroke: C.red, lw: 1, dash: [3, 3], alpha: a }); g.text((xAt(A05.kill) + xAt(A05.start)) / 2, by + 15, '빈 구간', { size: 10.5, weight: 700, align: 'center', color: C.redText, alpha: a }); }
  if (t >= A05.start) { const a = appear(t, A05.start); g.rect(xAt(A05.start), by, X1 - xAt(A05.start), 22, { r: 4, fill: C.greenTint, stroke: C.green, lw: 1, alpha: a }); g.text(X1 - 8, by + 15, '새 PID', { size: 10.5, weight: 600, align: 'right', color: C.greenText, alpha: a }); }
  const y = para(g, 0, by + 48, '빈 구간에는 proxy가 연결할 WAS가 없습니다(502는 설명용). 종료 후 기동이라 무중단 배포가 아닙니다.', w, { size: 12, color: s.down ? C.redText : C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- A06 ASG 증설·대상 등록·축소 ---------- */
function asgV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a06(t), wide = w >= 560;
  // 위: CPU 계기 · ALB(좁은 폭은 CPU, ALB 순서)
  const hw = wide ? (w - 20) / 2 : w, gx = wide ? hw + 20 : 0, gy = 0, ax0 = 0, ay0 = wide ? 0 : 56;
  g.rect(gx, gy, hw, 46, { r: 8, fill: C.paper, stroke: C.line, lw: 1 });
  g.text(gx + 10, gy + 17, `평균 CPU ${s.cpu}% (설명용) · 목표 50`, { size: 11, weight: 700, color: s.cpu > 50 ? C.orangeText : C.ink });
  const bw = hw - 20;
  g.rect(gx + 10, gy + 26, bw, 10, { r: 3, fill: C.bg, stroke: C.line, lw: 1 });
  g.rect(gx + 10, gy + 26, bw * s.cpu / 100, 10, { r: 3, fill: s.cpu > 50 ? C.orangeTint : C.blueTint, stroke: s.cpu > 50 ? C.orange : C.blue, lw: 1 });
  g.line(gx + 10 + bw / 2, gy + 23, gx + 10 + bw / 2, gy + 39, { stroke: C.ink, lw: 1.4 });
  card(g, ax0, ay0, hw, [{ text: 'ALB · brainbackdoor-tg' }, { text: 'healthy 대상에만 요청 전달', color: C.muted }], { tone: 'blue', h: 46 });
  // 인스턴스 자리 4개(최대 4). 트래픽은 healthy 인스턴스의 표식으로
  const ay = ay0 + 46 + 16, gap = 8, iw = wide ? (w - 3 * gap) / 4 : (w - gap) / 2, ih = 66;
  const slots: [string, string, string][] = [['EC2 1', '2a', s.oldest], ['EC2 2', '2c', 'healthy'], ['EC2 3', '2a', s.third], ['', '', 'empty']];
  const sp = (i: number) => wide ? { x: i * (iw + gap), y: ay } : { x: (i % 2) * (iw + gap), y: ay + Math.floor(i / 2) * (ih + gap) };
  const text: Record<string, string> = { healthy: 'healthy', initial: 'initial', booting: '사용자 데이터 실행', draining: '종료 중', gone: '종료됨', none: '대기(최대 4)', empty: '대기(최대 4)' };
  slots.forEach(([name, az, st], i) => {
    const p = sp(i), healthy = st === 'healthy', tone: Tone | undefined = healthy ? 'green' : st === 'initial' ? 'orange' : st === 'draining' ? 'red' : undefined;
    const on = !['none', 'empty', 'gone'].includes(st);
    card(g, p.x, p.y, iw, [{ text: on || st === 'gone' ? `${name} · ${az}` : '빈 자리' }, { text: text[st], color: tone ? TONE[tone].text : C.muted }, { text: healthy ? '● 트래픽 받음' : on ? '트래픽 없음' : ' ', color: healthy ? C.blueText : C.muted }], { tone, on, h: ih });
  });
  // ASG 설정과 종료 정책
  const py = ay + (wide ? ih : 2 * ih + gap) + 24;
  const head = para(g, 0, py, `ASG · conference-lt Latest(1) · 원하는 ${s.desired} · 최소 1 · 최대 4`, w, { size: 11, weight: 700 });
  g.text(0, head + 22, '종료 정책 순서 · 기본 휴지 300초', { size: 11, weight: 700 });
  const pol = ['먼저 AZ 균형: 2대인 2a에서 줄임', '① 가장 오래된 시작 템플릿(v1 하나뿐이라 같음)', '② 가장 오래된 인스턴스 → EC2 1', '③ 기본값'];
  let yy = head + 22;
  pol.forEach((ln, i) => { const hit = i === 2 && t >= A06.scaleIn; yy = para(g, 8, yy + 18, ln, w - 8, { size: 11, weight: hit ? 700 : 400, color: hit ? C.redText : C.ink }); });
  const y = para(g, 0, yy + 28, '새 인스턴스 AZ(2a)·CPU 값·헬스 체크 기준은 설명용입니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- A07 모듈·DB·배포본 연결 ---------- */
function modulesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = a07(t), wide = w >= 560;
  // 왼쪽(좁은 폭: 위): S3와 사용자 데이터
  const lw = wide ? 250 : w;
  card(g, 0, 0, lw, [{ text: 'S3 · [S3버킷 경로]' }, { text: 'config.json', mono: true }, { text: 'conference-0.0.1-SNAPSHOT.jar', mono: true }], { tone: 'orange', h: 62 });
  g.text(0, 84, 'EC2 사용자 데이터 · 명령 요약(… 생략)', { size: 11, weight: 700 });
  // 명령이 길면 줄을 나눠 모두 그린다(잘라내지 않음)
  let uy = 94;
  A07_USERDATA.forEach((ln, i) => {
    const on = s.ran > i, rows = wrap(ln, lw - 26, 10.5, true);
    g.text(0, uy + 12, `${i + 1}`, { size: 10.5, weight: 700, color: on ? C.blueText : C.muted });
    rows.forEach((r, k) => g.text(14, uy + 12 + k * 14, r, { size: 10.5, mono: true, color: on ? C.ink : C.muted }));
    uy += 8 + rows.length * 14;
  });
  // 오른쪽(좁은 폭: 아래): 모듈 지도
  const mx = wide ? lw + 30 : 0, my = wide ? 0 : uy + 24, mw = wide ? w - mx : w, col = (mw - 2 * 10) / 3, bh = 40;
  const cx = (c: number) => mx + c * (col + 10);
  pill(g, mx + mw / 2, my + 12, '사용자', { size: 11, h: 24 });
  const mods: [string, number, number][] = [['front', 0, 1], ['member', 2, 1], ['conference', 0, 2], ['analysis', 1, 2]];
  const rowY = (r: number) => my + 30 + (r - 1) * (bh + 34) + 10;
  const pad = wide ? 9 : 6;
  for (const [name, c, r] of mods) { const p = { x: cx(c), y: rowY(r) }; card(g, p.x, p.y, col, [{ text: name, mono: true }, { text: name === 'front' ? 'DB 없음' : 'prod 프로필', color: C.muted }], { tone: 'blue', on: s.up, h: bh, pad }); }
  const dbs: [string, number, number, number][] = [['conference DB', 0, 3, 0], ['analysis DB', 1, 3, 2], ['member DB', 2, 2, 1]];
  dbs.forEach(([name, c, r, k]) => { const p = { x: cx(c), y: rowY(r) }, on = s.db > k; card(g, p.x, p.y, col, [{ text: name.replace(' DB', '') }, { text: 'DB :3306', mono: true, color: C.muted }], { tone: 'green', on, h: bh, pad }); });
  // 연결: DB(사건 시각에 나타남), 호출(사건 시각에 도착)
  const mid = (c: number, r: number, side: 'top' | 'bottom') => ({ x: cx(c) + col / 2, y: rowY(r) + (side === 'bottom' ? bh : 0) });
  const dbLinks: [number, number, number, number][] = [[0, 2, 0, 3], [2, 1, 2, 2], [1, 2, 1, 3]];
  dbLinks.forEach(([c1, r1, c2, r2], k) => { if (s.db > k) arrow(g, mid(c1, r1, 'bottom'), mid(c2, r2, 'top'), { stroke: C.green, lw: 1.3, size: 5, alpha: appear(t, A07.db[k]) }); });
  const user = { x: mx + mw / 2, y: my + 24 };
  const calls: [Pt, Pt, number][] = [[user, mid(0, 1, 'top'), 0], [user, mid(2, 1, 'top'), 0], [mid(0, 1, 'bottom'), mid(0, 2, 'top'), 1], [{ x: cx(0) + col * 0.8, y: rowY(1) + bh }, mid(1, 2, 'top'), 2]];
  calls.forEach(([p, q, k]) => { const at = A07.calls[k]; if (s.calls > k) arrow(g, p, q, { stroke: C.blue, lw: 1.3, size: 5, alpha: appear(t, at) }); travel(g, t, p, q, at - 500, at, '', 'blue', { dot: true }); });
  const end = Math.max(wide ? uy : 0, rowY(3) + bh);
  const y = para(g, 0, end + 30, '모듈 관계는 원본 구조도, 시작 명령은 실습환경 가이드 기준입니다. conference 외 jar·DB 이름은 원문에 없습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

const infraOnly = { A01: vpcV2, A02: tlsV2, A03: dns01V2, A04: profileV2, A05: deployV2, A06: asgV2, A07: modulesV2 };

/* 운영·성능 9종: 수집 경로·지표·APM·부하·계산·차단·큐 */

/* ---------- O01 로그·메트릭 수집 경로 ---------- */
function collectV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o01(t), wide = w >= 560;
  const top0 = para(g, 0, 12, 'EC2 · CloudWatch agent(config.json 예시, 60초)', w, { size: 12, weight: 700 }) - 12;
  const rows: [string, string, string, readonly [number, number], Tone | 'none'][] = [
    ['disk · mem_available · netstat', '메트릭 · agent', '지표(namespace 원문 없음)', O01.metrics, 'blue'],
    ['/var/log/syslog', '로그 · agent', '로그 그룹 syslog / {instance_id}', O01.logs, 'orange'],
    ['Spring 앱 · Micrometer', '메트릭 · 앱이 직접', 'namespace brainbackdoor', O01.micrometer, 'blue'],
    ['EC2 기본 지표', 'CPU · Network · EBS', 'AWS/EC2', O01.ec2, 'blue'],
    ['log/file.log(logback)', '로그', '수집 설정 없음', [O01.missing, O01.missing], 'none'],
    ['/var/log/nginx(마운트)', '로그', '수집 설정 없음', [O01.missing, O01.missing], 'none'],
  ];
  const srcW = wide ? w * 0.44 : w, dstX = wide ? srcW + 40 : 18, dstW = wide ? w - dstX : w - 18, rh = wide ? 40 : 76;
  rows.forEach(([src, kind, dst, [from, at], tone], i) => {
    const y = top0 + 24 + i * (rh + 8), on = t >= at, miss = tone === 'none';
    card(g, 0, y, srcW, [{ text: src, mono: src.startsWith('/') || src.startsWith('log') }, { text: kind, color: C.muted }], { h: wide ? rh : 38 });
    const dy = wide ? y : y + 44, dh = wide ? rh : 30;
    g.rect(dstX, dy, dstW, dh, { r: 6, fill: on && !miss ? TONE[tone].tint : C.paper, stroke: on ? (miss ? C.red : TONE[tone].line) : C.grid, lw: 1.1, dash: on && !miss ? null : [3, 3] });
    g.text(dstX + 8, dy + dh / 2 + 4, dst, { size: 11, mono: dst.includes('/') || dst.startsWith('namespace'), weight: on ? 700 : 400, color: on ? (miss ? C.redText : TONE[tone].text) : C.muted, alpha: on ? appear(t, at) : 1 });
    const p: Pt = wide ? { x: srcW + 4, y: y + rh / 2 } : { x: 9, y: y + 38 }, q: Pt = wide ? { x: dstX - 4, y: dy + dh / 2 } : { x: 9, y: dy + dh / 2 };
    if (!wide) g.line(9, y + 38, 9, dy + dh / 2, { stroke: on ? (miss ? C.red : TONE[tone].line) : C.grid, lw: 1, dash: on && !miss ? null : [3, 3] });
    else arrow(g, p, q, { stroke: on ? (miss ? C.red : TONE[tone].line) : C.grid, lw: 1.1, size: 5, dash: on && !miss ? null : [3, 3] });
    if (on && miss) mark(g, wide ? (p.x + q.x) / 2 : 9 + 1, wide ? p.y : q.y - 12, false, appear(t, at));
    if (!miss) travel(g, t, p, q, from, at, kind.startsWith('로그') ? '로그' : '지표', tone === 'orange' ? 'orange' : 'blue', { dot: !wide });
  });
  const by = top0 + 24 + rows.length * (rh + 8) + 14;
  g.text(0, by + 8, '대시보드', { size: 11, weight: 700, color: s.dash ? C.ink : C.muted });
  const widgets = ['CPUUtilization', 'NetworkIn/Out', 'disk_used_percent', 'mem_available', 'netstat_tcp_syn_*'];
  let x = 0, yy = by + 18;
  widgets.forEach(wd => { const pw = wd.length * 6.6 + 18; if (x + pw > w) { x = 0; yy += 28; } g.rect(x, yy, pw, 22, { r: 11, fill: s.dash ? C.blueTint : C.paper, stroke: s.dash ? C.blue : C.grid, lw: 1, dash: s.dash ? null : [3, 3] }); g.text(x + pw / 2, yy + 15, wd, { size: 11, mono: true, align: 'center', color: s.dash ? C.blueText : C.muted, alpha: s.dash ? appear(t, O01.dash) : 1 }); x += pw + 8; });
  const ay = yy + 34;
  g.rect(0, ay, w, 28, { r: 6, fill: C.paper, stroke: C.grid, lw: 1, dash: [3, 3] });
  g.text(10, ay + 18, '알람 · 원문에 설정 없음', { size: 11, color: C.muted });
  const y = para(g, 0, ay + 52, '본문이 대시보드에 넣으라는 mem_used_percent는 이 설정으로 수집되지 않습니다(mem_available만 수집).', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- O02 한 실행의 지표를 함께 보기 ---------- */
function observeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o02(t), wide = w >= 560;
  const head = para(g, 0, 12, 'k6 smoke: VU 1 · 10초 · 반복 = 로그인 + 내 정보 + sleep(1)', w, { size: 12, weight: 700 });
  const lw = wide ? 92 : 58, x0 = lw, x1 = w - 8, X = (sec: number) => lerp(x0, x1, sec / 10), top = head + 22, lh = 34;
  // 시간 레인: 같은 실행의 VU와 RPS를 한 커서로
  ['VU', 'RPS'].forEach((ln, i) => { const y = top + i * lh; g.rect(0, y, w, lh - 4, { r: 6, fill: i ? C.paper : C.bg }); g.text(8, y + 19, ln, { size: 11, weight: 700 }); });
  const cur = s.cursor, yVU = top + 15, yRps = top + lh + 15;
  if (cur > 0) { g.line(X(0), yVU, X(cur), yVU, { stroke: C.blue, lw: 2 }); g.line(X(0), yRps, X(cur), yRps, { stroke: C.green, lw: 2 }); }
  if (cur >= 10) { g.text(X(10), yVU - 5, '1', { size: 11, mono: true, weight: 700, align: 'right', color: C.blueText }); g.text(X(10), yRps - 5, 'avg·max 2.000', { size: 11, mono: true, weight: 700, align: 'right', color: C.greenText }); }
  if (cur > 0 && cur < 10) g.line(X(cur), top, X(cur), top + 2 * lh - 4, { stroke: C.ink, lw: 1, dash: [3, 3] });
  const ay = top + 2 * lh + 6;
  [0, 5, 10].forEach(sec => g.text(X(sec), ay + 6, `${sec}s`, { size: 10.5, mono: true, align: sec === 10 ? 'right' : sec === 0 ? 'left' : 'center', color: C.muted }));
  // 실행 전체 통계(Grafana 통계 패널)
  const sy = ay + 34;
  g.text(0, sy, '실행 전체 통계', { size: 11, weight: 700, color: s.stats ? C.ink : C.muted });
  const L = O02_LATENCY, a = appear(t, O02.stats), rows: [string, string[], string][] = [
    ['오류', ['No data(0으로 단정하지 않음)'], C.muted],
    ['지연', wide ? [`mean ${L.mean} · p95 ${L.p95} · p90 ${L.p90} ms`, `min ${L.min} · med ${L.med} · max ${L.max} ms`] : [`mean ${L.mean} · p95 ${L.p95}`, `p90 ${L.p90} · med ${L.med}`, `min ${L.min} · max ${L.max} ms`], C.orangeText],
    ['checks', ['logged in successfully 10/10', 'retrieved member 10/10'], C.greenText],
  ];
  let y = sy + 10;
  rows.forEach(([name, lines, color], i) => {
    const h = 12 + lines.length * 15;
    g.rect(0, y, w, h, { r: 6, fill: i % 2 ? C.paper : C.bg });
    g.text(8, y + 17, name, { size: 11, weight: 700 });
    if (s.stats) lines.forEach((ln, k) => g.text(x0, y + 17 + k * 15, ln, { size: 11, mono: name !== '오류', color, alpha: a }));
    y += h + 4;
  });
  g.rect(0, y, w, 30, { r: 6, fill: C.bg });
  g.text(8, y + 19, '자원', { size: 11, weight: 700 });
  if (s.gaps) { g.rect(x0, y + 5, x1 - x0, 20, { r: 4, stroke: C.faint, lw: 1, dash: [3, 3], alpha: appear(t, O02.gaps) }); g.text(x0 + 8, y + 19, '이 실행에는 자원 지표 없음', { size: 11, color: C.muted, alpha: appear(t, O02.gaps) }); }
  const yy = para(g, 0, y + 56, '같은 시각에 함께 보이는 것은 원인이 아닙니다. 원인은 trace·로그로 따로 확인합니다.', w, { size: 12, color: C.muted });
  return frame(g, yy + 10, s.phase);
}

/* ---------- O03 APM agent·collector·저장·web ---------- */
function apmV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o03(t), wide = w >= 560;
  g.text(0, 12, '요청 경로', { size: 11, weight: 700, color: C.blueText });
  // 요청: USER → front-api → member-api(·conference-api)
  const cw = wide ? (w - 2 * 34 - 90) / 2 : (w - 10) / 2, ry = 22;
  const userP = wide ? { x: 40, y: ry + 30 } : { x: w / 2, y: ry + 12 };
  pill(g, userP.x, userP.y, 'USER', { size: 11, h: 24 });
  const fx = wide ? 114 : 0, fy = wide ? ry : ry + 44, fw = wide ? cw : w;
  card(g, fx, fy, fw, [{ text: 'front-api', mono: true }, { text: '-javaagent · agentId front-api', mono: true, color: C.muted }], { tone: 'blue', h: 58 });
  const mx = wide ? fx + fw + 34 : 0, my = wide ? ry : fy + 58 + 34, mw = wide ? cw : (w - 10) / 2;
  card(g, mx, my, mw, [{ text: 'member-api', mono: true }, { text: '/api/auth/me', mono: true, color: C.muted }], { h: 46 });
  const c2x = wide ? mx : mx + mw + 10, c2y = wide ? my + 52 : my;
  card(g, c2x, c2y, mw, [{ text: 'conference-api', mono: true }, { text: 'servermap 노드', color: C.muted }], { h: 46, on: true });
  const uq: [Pt, Pt] = wide ? [{ x: userP.x + 28, y: userP.y }, { x: fx - 3, y: fy + 29 }] : [{ x: userP.x, y: userP.y + 13 }, { x: w / 2, y: fy - 3 }];
  const fm: [Pt, Pt] = wide ? [{ x: fx + fw + 3, y: fy + 20 }, { x: mx - 3, y: my + 20 }] : [{ x: mw / 2, y: fy + 58 + 3 }, { x: mw / 2, y: my - 3 }];
  arrow(g, ...uq, { stroke: C.blue, lw: 1.2, size: 5 }); arrow(g, ...fm, { stroke: C.blue, lw: 1.2, size: 5 });
  // servermap의 front-api → conference-api 경로(정적)
  const fc: [Pt, Pt] = wide ? [{ x: fx + fw + 3, y: fy + 44 }, { x: c2x - 3, y: c2y + 20 }] : [{ x: c2x + mw / 2, y: fy + 58 + 3 }, { x: c2x + mw / 2, y: c2y - 3 }];
  arrow(g, ...fc, { stroke: C.blue, lw: 1.2, size: 5 });
  travel(g, t, ...uq, O03.user[0], O03.user[1], '요청', 'blue');
  travel(g, t, ...fm, O03.call[0], O03.call[1], '', 'blue', { dot: true });
  travel(g, t, fm[1], fm[0], O03.reply[0], O03.reply[1], '', 'blue', { dot: true });
  // 모니터링: agent → collector → HBase → web
  const ty = (wide ? Math.max(fy + 58, c2y + 46) : c2y + 46) + 34;
  g.text(0, ty, '모니터링 경로(요청과 별도)', { size: 11, weight: 700, color: C.orangeText });
  const boxes: [string, string, string][] = [['collector', 'gRPC [Collector IP]', ' '], ['HBase', '저장소', ' '], ['web :8080', 'Servermap · Callstack', 'Inspector']];
  const bw = wide ? (w - 2 * 30) / 3 : w, bh = 60;
  const bp = (i: number) => wide ? { x: i * (bw + 30), y: ty + 12 } : { x: 0, y: ty + 12 + i * (bh + 28) };
  boxes.forEach(([a, b, c], i) => { const p = bp(i), on = i === 0 ? s.sent : i === 1 ? s.stored : s.shown; card(g, p.x, p.y, bw, [{ text: a, mono: i !== 1 }, { text: b, mono: i === 0, color: C.muted }, { text: c, color: C.muted }], { tone: 'orange', on, h: bh }); });
  // span: front-api(agent) → collector
  const sp: [Pt, Pt] = wide ? [{ x: fx + 60, y: fy + 58 + 3 }, { x: fx + 60, y: bp(0).y - 3 }] : [{ x: w - 20, y: fy + 58 }, { x: w - 20, y: bp(0).y - 3 }];
  if (!wide) route(g, [{ x: w - 20, y: fy + 58 }, { x: w - 6, y: fy + 66 }, { x: w - 6, y: bp(0).y - 10 }, { x: w - 20, y: bp(0).y - 3 }], s.sent ? C.orange : C.grid, { dash: [4, 3] });
  else arrow(g, ...sp, { stroke: s.sent ? C.orange : C.grid, lw: 1.2, size: 5, dash: [4, 3] });
  travel(g, t, ...sp, O03.span[0], O03.span[1], 'span', 'orange', { dot: !wide });
  for (let i = 0; i < 2; i++) { const a = bp(i), b = bp(i + 1); const p: Pt = wide ? { x: a.x + bw + 3, y: a.y + bh / 2 } : { x: w / 2, y: a.y + bh + 3 }, q: Pt = wide ? { x: b.x - 3, y: b.y + bh / 2 } : { x: w / 2, y: b.y - 3 }; arrow(g, p, q, { stroke: (i === 0 ? s.stored : s.shown) ? C.orange : C.grid, lw: 1.2, size: 5 }); }
  travel(g, t, wide ? { x: bp(0).x + bw + 3, y: bp(0).y + bh / 2 } : { x: w / 2, y: bp(0).y + bh + 3 }, wide ? { x: bp(1).x - 3, y: bp(1).y + bh / 2 } : { x: w / 2, y: bp(1).y - 3 }, O03.store[0], O03.store[1], '', 'orange', { dot: true });
  const end = wide ? bp(0).y + bh : bp(2).y + bh;
  const y = para(g, 0, end + 26, 'sampling-rate=1이면 모든 요청을 수집합니다(주석: 20 → 5%, 100 → 1%). 저장소 방향은 Pinpoint 구조 기준입니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- O04 호출 트리와 구간 시간 ---------- */
function treeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o04(t), wide = w >= 560;
  const head = para(g, 0, 12, 'mixed view · /api/conferences · 11:30:24.372 기준 ms', w, { size: 11, weight: 700 });
  const lw = wide ? 250 : 0, x0 = lw, x1 = w - 4, X = (ms: number) => lerp(x0, x1, ms / 800), rh = wide ? 30 : 46;
  // 눈금
  const ay = head + 14;
  [0, 200, 400, 600, 800].forEach(ms => { g.text(X(ms), ay + 8, `${ms}`, { size: 10, mono: true, align: ms === 800 ? 'right' : ms === 0 ? 'left' : 'center', color: C.muted }); g.line(X(ms), ay + 14, X(ms), ay + 14 + O04_ROWS.length * rh, { stroke: C.grid, lw: 1 }); });
  O04_ROWS.forEach(([depth, name, start, exec, self, app], i) => {
    const y = ay + 18 + i * rh, shown = s.ms >= start, grow = Math.max(0, Math.min(exec, s.ms - start)), tone: Tone = app === 'front' ? 'blue' : 'green', remote = i === 3;
    const nameY = wide ? y + 18 : y + 12, barY = wide ? y + 6 : y + 20;
    g.text(wide ? depth * 4 : Math.min(depth * 4, 20), nameY, name, { size: 10.5, mono: true, color: shown ? C.ink : C.muted });
    if (!shown) return;
    g.rect(X(start), barY, Math.max(2, X(start + grow) - X(start)), 16, { r: 3, fill: remote ? C.orangeTint : TONE[tone].tint, stroke: remote ? C.orange : TONE[tone].line, lw: 1 });
    if (grow >= exec) {
      const txt = `${exec} · self ${self}`, tw = txt.length * 6 + 8, inside = X(start + exec) - X(start) > tw + 4, right = X(start + exec) + tw < x1;
      g.text(inside ? X(start) + 5 : right ? X(start + exec) + 4 : X(start) - 4, barY + 12, txt, { size: 10, mono: true, color: remote ? C.orangeText : TONE[tone].text, align: inside || right ? 'left' : 'right' });
    }
  });
  // 오류 전파: 아래(403)에서 위(500)로
  const errs: [number, string][] = [[4, '403'], [3, 'IOException'], [0, '500']];
  errs.forEach(([row, txt], k) => { if (s.err <= k) return; const y = ay + 18 + row * rh + (wide ? 6 : 20); label(g, x1 - 2, y + 12, txt, { size: 10.5, weight: 700, align: 'right', color: C.redText, alpha: appear(t, O04.err[k]) }); });
  const end = ay + 18 + O04_ROWS.length * rh;
  let y = para(g, 0, end + 22, '실행 = self + 같은 앱 자식. getInputStream의 self 507에는 member-api 응답 대기가 들어 있습니다.', w, { size: 12, color: C.muted });
  y = para(g, 0, y + 20, '원격 span이 호출 구간보다 5 ms 늦게 끝나며, 표 아래가 잘려 2 ms·20 ms는 보이는 행으로 설명되지 않습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- O05 부하 발생기와 대상 서버 ---------- */
function loadgenV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o05(t), wide = w >= 560;
  const lw = wide ? w * 0.58 : w, bh = 50;
  g.text(0, 12, '부하 발생기', { size: 11, weight: 700, color: C.blueText });
  const ctrl = { x: 0, y: 22 }, agent = { x: 0, y: 22 + bh + 34 };
  const cwid = wide ? lw : w;
  card(g, ctrl.x, ctrl.y, cwid, [{ text: 'nGrinder controller 3.5.8' }, { text: '웹 8080 · 스크립트·결과', color: C.muted }], { tone: 'blue', h: bh });
  card(g, agent.x, agent.y, cwid, [{ text: `agent 3.5.8 · region NONE${s.approved ? ' · Approved' : ''}` }, { text: '다른 서버 · 캡처상 1대', color: C.muted }], { tone: 'blue', h: bh, on: true });
  const tx = wide ? lw + 40 : 0, tyT = wide ? 22 : agent.y + bh + 34, tw = wide ? w - tx : w;
  g.text(tx, wide ? 12 : tyT - 10, '대상 서버', { size: 11, weight: 700, color: C.orangeText });
  card(g, tx, tyT, tw, [{ text: '[테스트 대상 도메인]', mono: true }, { text: '위치 원문 없음', color: C.muted }], { tone: 'orange', h: bh });
  // 등록·스크립트·요청·결과
  const ca: [Pt, Pt] = [{ x: cwid * 0.3, y: agent.y - 3 }, { x: cwid * 0.3, y: ctrl.y + bh + 3 }];
  const ac: [Pt, Pt] = [{ x: cwid * 0.6, y: ctrl.y + bh + 3 }, { x: cwid * 0.6, y: agent.y - 3 }];
  arrow(g, ...ca, { stroke: s.approved ? C.blue : C.grid, lw: 1.1, size: 5 }); arrow(g, ...ac, { stroke: s.scripted ? C.blue : C.grid, lw: 1.1, size: 5 });
  if (s.approved) g.text(cwid * 0.3 + 8, (ca[0].y + ca[1].y) / 2 + 4, ':16001', { size: 10.5, mono: true, color: C.blueText });
  travel(g, t, ...ca, O05.register[0], O05.register[1], '등록', 'blue');
  travel(g, t, ...ac, O05.script[0], O05.script[1], 'Groovy', 'blue');
  const at: [Pt, Pt] = wide ? [{ x: lw + 3, y: agent.y + bh / 2 }, { x: tx - 3, y: tyT + bh / 2 }] : [{ x: w * 0.5, y: agent.y + bh + 3 }, { x: w * 0.5, y: tyT - 3 }];
  if (wide) route(g, [at[0], { x: lw + 20, y: agent.y + bh / 2 }, { x: lw + 20, y: tyT + bh / 2 }, at[1]], s.loaded ? C.orange : C.grid, {});
  else arrow(g, ...at, { stroke: s.loaded ? C.orange : C.grid, lw: 1.1, size: 5 });
  travel(g, t, at[0], at[1], O05.load[0], O05.load[1], 'GET', 'orange', { dot: wide });
  if (s.reported) g.text(cwid * 0.6 + 8, (ac[0].y + ac[1].y) / 2 + 4, wide ? '결과 보고(경로 설명용)' : '결과(설명용)', { size: 10.5, color: C.muted, alpha: appear(t, O05.result[1]) });
  travel(g, t, ac[1], ac[0], O05.result[0], O05.result[1], '', 'blue', { dot: true });
  // k6
  const ky = Math.max(agent.y + bh, tyT + bh) + 36;
  g.text(0, ky, 'k6(같은 호스트에 InfluxDB · Grafana)', { size: 11, weight: 700, color: C.greenText });
  const kw = wide ? lw : w;
  card(g, 0, ky + 10, kw, [{ text: 'k6 run smoke.js', mono: true }, { text: 'InfluxDB :8086 myk6db', mono: true, color: s.viewed ? C.greenText : C.muted }, { text: '→ Grafana :3000(대시보드 2587)', mono: true, color: s.viewed ? C.greenText : C.muted }], { tone: 'green', h: 64 });
  const kt: [Pt, Pt] = wide ? [{ x: kw + 3, y: ky + 35 }, { x: tx + tw / 2, y: tyT + bh + 3 }] : [{ x: w * 0.8, y: ky + 7 }, { x: w * 0.8, y: tyT + bh + 3 }];
  arrow(g, ...kt, { stroke: s.k6 ? C.green : C.grid, lw: 1.1, size: 5 });
  travel(g, t, ...kt, O05.k6[0], O05.k6[1], '', 'green', { dot: true });
  const y = para(g, 0, ky + 100, '부하 발생기와 대상 서버를 나눠야 발생기의 자원 사용이 측정에 섞이지 않습니다. nGrinder 결과 수치는 원문에 없습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- O06 Smoke·Load·Stress 부하 모양 ---------- */
function shapesV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o06(t), wide = w >= 560;
  const cw = wide ? (w - 2 * 24) / 3 : w, ch = 120;
  // 모양(시간 0~1, VU): 원본 그래프 근사
  // [이름, 부제, 축 최댓값 VU, 모양(시간 0~1, VU), 진행, 색]
  const charts: [string, string, number, [number, number][], number, Tone][] = [
    ['Smoke', '1 VU', 1, [[0, 0], [0.05, 1], [0.95, 1], [1, 0]], s.smoke, 'green'],
    ['Load', '0 → 100 VU · 유지', 100, [[0, 0], [0.33, 100], [0.84, 100], [1, 42]], s.load, 'blue'],
    ['Stress', '100 → 200 → 300 → 400', 400, [[0, 0], [0.04, 100], [0.17, 100], [0.18, 200], [0.32, 200], [0.33, 300], [0.47, 300], [0.48, 400], [0.62, 400], [1, 0]], s.stress, 'orange'],
  ];
  charts.forEach(([name, sub, ymax, pts, prog, tone], i) => {
    const x = wide ? i * (cw + 24) : 0, y = wide ? 0 : i * (ch + 56);
    g.text(x, y + 12, name, { size: 12, weight: 700, color: TONE[tone].text });
    g.text(x + cw, y + 12, sub, { size: 10.5, align: 'right', color: C.muted });
    const px = x + 26, py = y + 22, pw = cw - 30, ph = ch - 34;
    g.line(px, py, px, py + ph, { stroke: C.line, lw: 1 }); g.line(px, py + ph, px + pw, py + ph, { stroke: C.line, lw: 1 });
    g.text(px - 4, py + 8, String(ymax), { size: 10, mono: true, align: 'right', color: C.muted });
    g.text(px + pw, py + ph + 14, '시간(근사)', { size: 10, align: 'right', color: C.muted });
    const P = ([u, v]: [number, number]) => ({ x: px + u * pw, y: py + ph - (v / ymax) * (ph - 8) });
    if (prog > 0) {
      const out: Pt[] = [];
      for (let k = 0; k < pts.length; k++) { const [u] = pts[k]; if (u <= prog) out.push(P(pts[k])); else { const [u0, v0] = pts[k - 1]; const f = (prog - u0) / (u - u0); out.push(P([prog, v0 + (pts[k][1] - v0) * f])); break; } }
      if (out.length > 1) g.path('M' + out.map(q => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('L'), { stroke: TONE[tone].line, lw: 2 });
    }
    if (i === 1 && prog >= 1) g.text(px + pw * 0.97, py + ph - 26, '하강 잘림', { size: 10, align: 'right', color: C.muted });
  });
  const end = wide ? ch : 3 * (ch + 56) - 56;
  let y = para(g, 0, end + 22, '모양은 원본 그래프에서 읽은 근사입니다. 지연·오류 결과 곡선은 원문에 없어 그리지 않았습니다.', w, { size: 12, color: C.muted });
  y = para(g, 0, y + 20, '목표: VUser별 iteration time 100ms 이하.', w, { size: 12, weight: 600 });
  return frame(g, y + 10, s.phase);
}

/* ---------- O07 DAU·RPS·VU 계산 ---------- */
function vuV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o07(t), wide = w >= 560;
  const chain = ['DAU × 1인당 요청 수', '÷ 86,400(초/일)', '= 1일 평균 rps', '× 최대/평소 = 최대 rps'];
  const cw = wide ? (w - 3 * 16) / 4 : w;
  chain.forEach((c, i) => { const on = s.chain > i, x = wide ? i * (cw + 16) : 0, y = wide ? 0 : i * 32; g.rect(x, y, cw, 26, { r: 6, fill: on ? C.blueTint : C.paper, stroke: on ? C.blue : C.grid, lw: 1, dash: on ? null : [3, 3] }); g.text(x + cw / 2, y + 17, c, { size: 10.5, align: 'center', color: on ? C.blueText : C.muted }); });
  const cy = (wide ? 26 : 4 * 32 - 6) + 18;
  g.text(0, cy, '값은 원문에 없음 · 예시 목표 300 rps', { size: 10.5, color: C.muted });
  // 한 VU의 반복: 요청 0.5 s × 2 + 대기 1 s
  const iy = cy + 26, X = (sec: number) => lerp(0, w, sec / 2);
  g.text(0, iy, 'VU 하나의 반복(R = 2)', { size: 11, weight: 700 });
  const segs: [number, number, string, Tone | 'muted'][] = [[0, 0.5, '요청 1 · 0.5 s', 'blue'], [0.5, 1, '요청 2 · 0.5 s', 'blue'], [1, 2, '대기 a · 1 s', 'muted']];
  const fill = s.iter * 2;
  segs.forEach(([a, b, txt, tone]) => {
    const x = X(a), wv = X(b) - X(a), f = Math.max(0, Math.min(b, fill) - a) / (b - a);
    g.rect(x + 1, iy + 10, wv - 2, 26, { r: 4, fill: C.paper, stroke: C.line, lw: 1 });
    if (f > 0) g.rect(x + 1, iy + 10, (wv - 2) * f, 26, { r: 4, fill: tone === 'muted' ? C.slab : C.blueTint });
    g.text(x + wv / 2, iy + 27, txt, { size: 10.5, align: 'center', color: tone === 'muted' ? C.muted : C.blueText });
  });
  g.text(w, iy + 52, 'T = 2 × 0.5 + 1 = 2 s', { size: 11, mono: true, weight: 700, align: 'right', color: fill >= 2 ? C.ink : C.muted });
  const ry = iy + 78;
  const lines: [boolean, string, string][] = [
    [t >= O07.perVu, 'VU 하나 = 2 요청 / 2 s = 1 rps', C.ink],
    [t >= O07.vu, 'VU = (300 × 2) / 2 = 300 → 300 VU × 1 rps = 300 rps', C.greenText],
    [t >= O07.vu, 'VU ≠ rps ≠ 사용자 수(R/T = 1이라 같은 숫자)', C.orangeText],
    [s.real, '실측 smoke: VU 1 → RPS 2.000(요청 7.52 ms라 T ≈ 1.015 s)', C.blueText],
  ];
  let y = ry;
  lines.forEach(([on, txt, color], i) => { const at = [O07.perVu, O07.vu, O07.vu, O07.real][i]; if (on) para(g, 0, y, txt, w, { size: 11.5, weight: 600, color, alpha: Math.max(0.05, appear(t, at)) }); y += (wrap(txt, w, 11.5).length - 1) * 18 + 22; });
  return frame(g, y - 12, s.phase);
}

/* ---------- O08 증설과 서킷 브레이커 ---------- */
function breakerV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o08(t), wide = w >= 560;
  const colW = wide ? 150 : w, bh = 46;
  const F = { x: 0, y: 0 }, Cf = wide ? { x: w - colW, y: 0 } : { x: 0, y: 2 * bh + 96 };
  const scaled = s.scaled, sa = appear(t, O08.scale[1]);
  card(g, F.x, F.y, colW, [{ text: 'front' }, { text: scaled ? '증설(대수 설명용)' : 'scale out 전', color: C.muted }], { tone: 'blue', h: bh });
  if (scaled) g.rect(F.x + 6, F.y + bh + 4, colW - 12, 8, { r: 3, fill: C.blueTint, stroke: C.blue, lw: 1, alpha: sa });
  card(g, Cf.x, Cf.y, colW, [{ text: 'conference' }, { text: scaled ? '증설(대수 설명용)' : 'scale out 전', color: C.muted }], { tone: 'orange', h: bh });
  if (scaled) g.rect(Cf.x + 6, Cf.y + bh + 4, colW - 12, 8, { r: 3, fill: C.orangeTint, stroke: C.orange, lw: 1, alpha: sa });
  // 차단기(front의 conference 호출 위, 위치는 설명용)
  const st = s.state, stTone: Tone = st === 'OPEN' ? 'red' : st === 'HALF-OPEN' ? 'orange' : 'green';
  const bx = wide ? w / 2 : w / 2, byc = wide ? bh / 2 : bh + 48;
  const p: Pt = wide ? { x: colW + 4, y: bh / 2 } : { x: w / 2, y: bh + 16 }, q: Pt = wide ? { x: w - colW - 4, y: bh / 2 } : { x: w / 2, y: Cf.y - 4 };
  if (st === 'OPEN') { g.line(p.x, p.y, wide ? bx - 50 : p.x, wide ? p.y : byc - 14, { stroke: C.red, lw: 1.4, dash: [3, 3] }); }
  else arrow(g, p, q, { stroke: st === 'HALF-OPEN' ? C.orange : C.grid, lw: 1.3, size: 5 });
  pill(g, bx, byc, `서킷 브레이커 · ${st}`, { size: 11, h: 24, fill: TONE[stTone].tint, stroke: TONE[stTone].line, color: TONE[stTone].text, weight: 700 });
  // 실패 증가 → OPEN → 대체 응답 → HALF-OPEN 시험 → CLOSED
  for (let k = 0; k < 3; k++) { const a = O08.burst[0] + k * 500; travel(g, t, p, q, a, a + 450, '', 'blue', { dot: true }); if (t >= a + 450 && t < O08.open) mark(g, q.x + (wide ? -10 : 14 + k * 14), q.y + (wide ? -16 - 0 : 0) + (wide ? 0 : 0), false, appear(t, a + 450)); }
  if (t >= O08.fallback[0] && t < O08.half) label(g, wide ? colW / 2 : 5, bh + 30, '호출 없이 즉시 실패·대체 응답', { size: 10.5, weight: 600, align: wide ? 'center' : 'left', color: C.redText, alpha: appear(t, O08.fallback[0]) });
  travel(g, t, p, q, O08.trial[0], O08.trial[1], '시험', 'orange', { dot: true });
  if (t >= O08.trial[1]) mark(g, wide ? q.x - 10 : q.x + 14, wide ? q.y - 16 : q.y, true, appear(t, O08.trial[1]));
  // 상태 줄
  const sy = (wide ? bh + 56 : Cf.y + bh + 36);
  const states: [string, number, Tone][] = [['CLOSED', 0, 'green'], ['OPEN', O08.open, 'red'], ['HALF-OPEN', O08.half, 'orange'], ['CLOSED', O08.close, 'green']];
  const sw = wide ? (w - 3 * 18) / 4 : (w - 18) / 2;
  states.forEach(([name, at, tone], i) => { const on = t >= at, x = wide ? i * (sw + 18) : (i % 2) * (sw + 18), y = wide ? sy : sy + Math.floor(i / 2) * 34; g.rect(x, y, sw, 26, { r: 13, fill: on ? TONE[tone].tint : C.paper, stroke: on ? TONE[tone].line : C.grid, lw: 1, dash: on ? null : [3, 3] }); g.text(x + sw / 2, y + 17, name, { size: 11, mono: true, weight: 700, align: 'center', color: on ? TONE[tone].text : C.muted }); });
  const ey = sy + (wide ? 26 : 60) + 22;
  let y = para(g, 0, ey, '목표: VUser별 iteration time 100ms 이하. 실패율 임계·대기 시간·대수는 원문에 없어 설명용입니다.', w, { size: 12, color: C.muted });
  y = para(g, 0, y + 20, '증설한 대수만큼 처리량이 그대로 늘지 않을 수 있습니다(공유 DB 등). "n대 증설 시 rps"는 측정 과제입니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- O09 동기·비동기와 큐 ---------- */
function queueV2(w: number, t: number): LessonFrame {
  const g = draw(), s = o09(t), wide = w >= 560;
  const badge = '개념 예시 · 원문에 구현 없음(취소선)', bw = textW(badge, 10.5) + 22;
  pill(g, wide ? w - bw / 2 - 1 : w / 2, 12, badge, { size: 10.5, h: 22, fill: C.paper, stroke: C.faint, color: C.muted });
  const lw = wide ? 92 : 64, x0 = lw, x1 = w - 8, X = (sec: number) => lerp(x0, x1, sec / 3.5), top = 34, lh = 40;
  const lanes = ['동기', '비동기', '워커'];
  lanes.forEach((ln, i) => { const y = top + i * lh; g.rect(0, y, w, lh - 4, { r: 6, fill: i % 2 ? C.paper : C.bg }); g.text(8, y + 22, ln, { size: 11, weight: 700 }); });
  const sec = s.sec;
  // 동기: 처리 끝날 때까지 대기
  g.rect(X(0), top + 9, Math.max(2, X(Math.min(sec, 3)) - X(0)), 18, { r: 4, fill: C.orangeTint, stroke: C.orange, lw: 1 });
  if (sec < 3) g.text(X(0) + 6, top + 22, '대기', { size: 10.5, color: C.orangeText });
  if (s.syncDone) label(g, X(3), top + 22, '응답', { size: 10.5, weight: 700, color: C.orangeText });
  // 비동기: 큐 → 즉시 접수
  const ay = top + lh;
  g.rect(X(0), ay + 9, Math.max(2, X(Math.min(sec, 0.6)) - X(0)), 18, { r: 4, fill: C.blueTint, stroke: C.blue, lw: 1 });
  if (s.accepted) label(g, X(0.6) + 4, ay + 22, '접수됨', { size: 10.5, weight: 700, align: 'left', color: C.blueText });
  // 워커: 꺼내 처리 → 완료
  const wy = top + 2 * lh;
  if (sec > 0.6) g.rect(X(0.6), wy + 9, Math.max(2, X(Math.min(sec, 3.2)) - X(0.6)), 18, { r: 4, fill: C.greenTint, stroke: C.green, lw: 1 });
  if (s.done) label(g, X(3.2), wy + 22, '처리 완료', { size: 10.5, weight: 700, align: 'right', color: C.greenText });
  if (sec > 0 && sec < 3.2) g.line(X(sec), top, X(sec), top + 3 * lh - 4, { stroke: C.ink, lw: 1, dash: [3, 3] });
  g.text(X(0), top + 3 * lh + 10, '0 s', { size: 10, mono: true, color: C.muted });
  g.text(X(3.5), top + 3 * lh + 10, '시간(설명용)', { size: 10, align: 'right', color: C.muted });
  // 몰림: 큐 길이
  const qy = top + 3 * lh + 34;
  g.text(0, qy, '선착순 몰림: 접수는 즉시, 완료는 큐 뒤에서', { size: 11, weight: 700, color: s.queued ? C.ink : C.muted });
  const qw = Math.min(w, 300);
  g.rect(0, qy + 10, qw, 34, { r: 8, fill: C.bg, stroke: C.line, lw: 1 });
  for (let k = 0; k < 4; k++) { const on = s.queued > k; g.rect(8 + k * ((qw - 16) / 4), qy + 16, (qw - 16) / 4 - 6, 22, { r: 5, fill: on ? C.blueTint : C.paper, stroke: on ? C.blue : C.grid, lw: 1, dash: on ? null : [3, 3] }); if (on) g.text(8 + k * ((qw - 16) / 4) + ((qw - 16) / 4 - 6) / 2, qy + 31, `요청 ${k + 1}`, { size: 10, align: 'center', color: C.blueText }); }
  const y = para(g, 0, qy + 70, '큐 종류·워커 수·재시도·결과 통지 방식은 원문에 없습니다. "접수됨" 응답이 처리 완료를 뜻하지 않습니다.', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

const opsOnly = { O01: collectV2, O02: observeV2, O03: apmV2, O04: treeV2, O05: loadgenV2, O06: shapesV2, O07: vuV2, O08: breakerV2, O09: queueV2 };

export const infraRenderers: Record<InfraFigureId, (w: number, t: number) => LessonFrame> = { ...infraOnly, ...opsOnly };
