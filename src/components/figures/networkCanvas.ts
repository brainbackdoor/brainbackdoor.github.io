import { networkState as state, nagleAckTiming, probeGains, type NetworkFigureId } from './network-models';
import { C, TONE, appear, arrow, cursor, draw, ease, frame, host, hostWidth, label, lerp, para, pill, seq, span, textW, token, twoUp, wrap, type G, type LaneState, type LessonFrame, type Msg, type Tone } from './lessonCanvas';

/* 운영 network·HTTP 16종(R04 v2, 2026-10-14 승인): 사건 의미는 network-models에서 읽고 여기서는 형태·위치·전개만 계산한다. */
const notes = (g: G, y: number, w: number, list: readonly (string | readonly [string, string])[]) => {
  let yy = y;
  for (const n of list) { const [s, color] = typeof n === 'string' ? [n, C.muted] : n; yy = para(g, 0, yy, s, w, { color, size: 12 }) + 22; }
  return yy - 22;
};

/* ---------- N02 BDP: 같은 왕복 경로 위에서 윈도가 채우는 길이와 ACK의 귀환 ---------- */
function bdpPanel(g: G, x: number, y: number, pw: number, t: number, big: boolean) {
  const s = state('N02', t), hw = 52, lx = x + hw + 10, rx = x + pw - hw - 10, top = y + 46, bot = y + 104;
  g.text(x, y + 14, big ? '윈도 500,000 B' : '윈도 64,000 B', { size: 13, weight: 600 });
  host(g, x + hw / 2, (top + bot) / 2 - 13, '송신', { min: hw });
  host(g, x + pw - hw / 2, (top + bot) / 2 - 13, '수신', { min: hw });
  // 경로: 위는 데이터(→), 아래는 ACK(←). 둘을 합친 왕복이 RTT 40 ms
  g.rect(lx, top - 12, rx - lx, 24, { r: 12, fill: C.paper, stroke: C.line, lw: 1.2 });
  g.rect(lx, bot - 10, rx - lx, 20, { r: 10, fill: C.paper, stroke: C.line, lw: 1 });
  const frac = big ? 1 : 0.128, fill = (rx - lx) * frac * span(t, 1100, 2200);
  if (fill > 0) g.rect(lx, top - 12, Math.max(fill, 6), 24, { r: 12, fill: C.blueTint, stroke: C.blue, lw: 1.4 });
  if (t >= 2200) {
    const a = appear(t, 2200);
    if (!big) g.text(lx + fill + 10, top + 4.5, '빈 경로', { size: 11, color: C.muted, alpha: a });
    g.text(big ? (lx + rx) / 2 : lx + 4, top - 18, big ? '경로 용량 500 kB' : '경로의 12.8%만 채움', { size: 11, weight: 600, align: big ? 'center' : 'left', color: C.blueText, alpha: a });
  }
  // 누적 ACK가 아래 경로를 따라 돌아온다 [3500, 5000]
  const back = s.acknowledged > 0;
  if (t >= 3500) {
    const q = ease.inOut(span(t, 3500, 5000)), hx = lerp(rx, lx, q);
    g.line(rx, bot, hx, bot, { stroke: C.green, lw: 1.6 });
    if (back) arrow(g, { x: lx + 20, y: bot }, { x: lx + 2, y: bot }, { stroke: C.green, lw: 1.6, size: 6 });
    else g.circle(hx, bot, 4.5, { fill: C.green });
  }
  g.text((lx + rx) / 2, bot + 24, back ? '누적 ACK 왕복 완료' : '누적 ACK 왕복', { size: 11, align: 'center', color: back ? C.greenText : C.muted });
  g.text(x, y + 166, `처리량 상한 ${big ? s.largeMbps : s.smallMbps} Mbps`, { size: 13, weight: 600, color: C.greenText });
  return 176;
}
function bdpV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N02', t), { cols, pw } = twoUp(w);
  const base = para(g, 0, 14, '100 Mbps × 40 ms ÷ 8 = 500,000 B', w, { size: 13, weight: 600, mono: true }) + 24;
  const h = bdpPanel(g, 0, base, pw, t, false);
  bdpPanel(g, cols === 2 ? pw + 28 : 0, cols === 2 ? base : base + h + 24, pw, t, true);
  if (cols === 1) g.line(0, base + h + 8, w, base + h + 8, { stroke: C.grid, lw: 1 });
  return frame(g, base + (cols === 2 ? h : h * 2 + 24) + 4, s.phase);
}

/* ---------- N04 연결 수립: 양 끝 상태를 사건 시각에 바꾼다 ---------- */
function handshakeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N04', t), wide = w >= 560;
  const client: LaneState[] = [[0, 'CLOSED', 'muted'], [1100, 'SYN-SENT', 'orange'], [2900, 'ESTABLISHED', 'green']];
  const server: LaneState[] = [[0, 'LISTEN', 'muted'], [1700, 'SYN-RECEIVED', 'orange'], [4100, 'ESTABLISHED', 'green']];
  const geo = seq(g, t, {
    x: 0, y: 0, w, t0: 600, t1: 6300, k: 0.062, lanes: ['클라이언트', '서버'], stateWidth: wide ? 96 : 0, states: [client, server],
    msgs: [
      { a: 1100, b: 1700, from: 0, label: 'SYN seq=1000', tone: 'blue' },
      { a: 2300, b: 2900, from: 1, label: 'SYN/ACK seq=5000 ack=1001', tone: 'green' },
      { a: 3500, b: 4100, from: 0, label: 'ACK seq=1001 ack=5001', tone: 'blue' },
      { a: 4400, b: 5000, from: 0, label: 'DATA seq=1001 len=1460', tone: 'blue' },
      { a: 5200, b: 5800, from: 1, label: 'ACK ack=2461 rwnd=8192', tone: 'green' },
    ],
  });
  cursor(g, geo, t, 600, 6300);
  const y = notes(g, geo.bottom + 30, w, [[`수신 DATA ${s.receivedBytes} B · 알려진 rwnd ${s.window === null ? '—' : s.window + ' B'}`, C.ink]]);
  return frame(g, y + 10, s.phase);
}

/* ---------- N05 cwnd: RTT마다 계단으로 바뀌는 값과 문턱·RTO 사건 ---------- */
function congestionV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N05', t), x0 = 30, x1 = w - 8, y0 = 46, h = 230;
  g.text(0, 14, 'cwnd / SMSS   (1 SMSS = 1,460 B)', { size: 12, weight: 600 });
  const X = (tm: number) => x0 + (Math.min(Math.max(tm, 1300), 10600) - 1300) / 9300 * (x1 - x0), Y = (n: number) => y0 + h - n * h / 11;
  // 국면 띠: slow start / 혼잡 회피 (사건 시각에 바뀐다)
  const bands: [number, number, string, string][] = [[1300, 4000, 'slow start', C.blueTint], [4000, 7000, '혼잡 회피', C.greenTint], [7000, 9700, 'slow start', C.blueTint], [9700, 10600, '혼잡 회피', C.greenTint]];
  for (const [a, b, name, fill] of bands) {
    if (t < a) continue;
    const xb = X(Math.min(b, t)), xa = X(a);
    g.rect(xa, y0, Math.max(0, xb - xa), h, { r: 0, fill, alpha: 0.7 });
    if (X(b) - xa > textW(name, 11) + 8) g.text(xa + 4, y0 + 14, name, { size: 11, color: C.muted, alpha: appear(t, a) });
  }
  for (let n = 0; n <= 10; n += 2) { g.line(x0, Y(n), x1, Y(n), { stroke: C.grid, lw: 1 }); g.text(x0 - 8, Y(n) + 4, n, { size: 11, align: 'right', color: C.muted }); }
  // ssthresh: 8 → RTO에서 5
  const thr: [number, number, number][] = [[1300, 7000, 8], [7000, 10600, 5]];
  for (const [a, b, v] of thr) { if (t < a) continue; g.line(X(a), Y(v), X(Math.min(b, t)), Y(v), { stroke: C.orange, lw: 1.4, dash: [5, 4] }); }
  label(g, x0 + 4, Y(s.threshold) - 7, `ssthresh ${s.threshold}`, { size: 11, weight: 600, align: 'left', color: C.orangeText });
  // RTO 사건
  if (t >= 7000) {
    const a = appear(t, 7000);
    g.line(X(7000), y0, X(7000), y0 + h, { stroke: C.red, lw: 1.4, alpha: a });
    label(g, X(7000) + 4, Y(7.4), w >= 560 ? 'RTO · FlightSize 10 → ssthresh 5' : 'RTO', { size: 11, weight: 600, align: 'left', color: C.redText, alpha: a });
  }
  // cwnd 계단: 값은 RTT 사건 시각에만 바뀐다
  const pts = s.points;
  if (pts.length) {
    let d = `M${X(pts[0][0])} ${Y(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) d += `H${X(pts[i][0])}V${Y(pts[i][1])}`;
    d += `H${X(t)}`;
    g.path(d, { stroke: C.blue, lw: 2 });
    pts.forEach(p => g.circle(X(p[0]), Y(p[1]), 3, { fill: p[0] === 7000 ? C.red : C.blue }));
    const cur = pts[pts.length - 1], cx = X(Math.min(t, 10600));
    g.circle(cx, Y(cur[1]), 5, { fill: C.paper, stroke: C.blue, lw: 2 });
    label(g, cx + (cx > w - 70 ? -8 : 8), Y(cur[1]) - 10, `cwnd ${cur[1]}`, { size: 11, weight: 700, mono: true, align: cx > w - 70 ? 'right' : 'left', color: C.blueText });
  }
  g.text(x0, y0 + h + 22, '연출 시간 →', { size: 11, color: C.muted });
  let y = para(g, 0, y0 + h + 54, `cwnd ${s.cwnd} SMSS = ${(s.cwnd * 1460).toLocaleString()} B`, w, { size: 13, weight: 600, color: C.blueText }) + 26;
  for (const n of ['ssthresh 전: 새 데이터 ACK에 따른 증가', 'ssthresh 후: RTT당 약 1 SMSS 증가', 'RTO: FlightSize 10 → ssthresh 5 / cwnd 1']) y = para(g, 0, y, n, w, { color: C.muted }) + 21;
  return frame(g, y - 10, s.phase);
}

/* ---------- N06 RTO와 빠른 재전송: 같은 시간 눈금에서 대기 원인과 복구 시각을 비교 ---------- */
function retransmitV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N06', t), { cols, pw } = twoUp(w), k = 0.066, t0 = 800, t1 = 7300;
  let bottom = 0;
  for (let i = 0; i < 2; i++) {
    const fast = i === 1, x = cols === 2 ? i * (pw + 28) : 0, y0 = cols === 2 ? 0 : i * (bottom + 40);
    g.text(x, y0 + 14, fast ? '후속 있음 · 빠른 재전송' : '후속 없음 · RTO', { size: 13, weight: 600 });
    const msgs: Msg[] = fast
      ? [{ a: 1100, b: 1700, from: 0, label: '1번 DATA', tone: 'red', loss: true }, { a: 2100, b: 2400, from: 0, label: '2번 DATA', tone: 'blue' }, { a: 2400, b: 2700, from: 1, label: '중복 ACK 1', tone: 'orange' }, { a: 2900, b: 3200, from: 0, label: '3번 DATA', tone: 'blue' }, { a: 3200, b: 3500, from: 1, label: '중복 ACK 2', tone: 'orange' }, { a: 3700, b: 4000, from: 0, label: '4번 DATA', tone: 'blue' }, { a: 4000, b: 4300, from: 1, label: '중복 ACK 3', tone: 'orange' }, { a: 4900, b: 5500, from: 0, label: '1번 재전송', tone: 'blue' }]
      : [{ a: 1100, b: 1700, from: 0, label: '1번 DATA', tone: 'red', loss: true }, { a: 6300, b: 7000, from: 0, label: 'RTO → 1번 재전송', tone: 'blue' }];
    const st = fast ? s.fast : s.rto, done = fast ? 5500 : 7000;
    const geo = seq(g, t, {
      x, y: y0 + 30, w: pw, t0, t1, k, lanes: ['송신', '수신'], msgs,
      holds: fast ? [{ lane: 0, a: 2700, b: 4300, label: '중복 ACK 3회', tone: 'orange' }] : [{ lane: 0, a: 1100, b: 6300, label: 'RTO 타이머 대기', tone: 'orange' }], gutters: [64, 0],
      states: [[], [[done, '복구', 'green']]],
    });
    // 안내는 대기 막대 오른쪽 자리에 둔다(좁은 폭에서는 두 줄로, 바탕이 막대를 끊지 않게)
    if (!fast && t >= 2400) {
      const left = geo.ax + 20, note = '후속 DATA 없음 → 중복 ACK 없음', rows = textW(note, 11) <= geo.bx - left - 10 ? [note] : ['후속 DATA 없음 →', '중복 ACK 없음'], cx = Math.max(geo.mid, left + Math.max(...rows.map(r => textW(r, 11))) / 2 + 5);
      rows.forEach((r, j) => label(g, cx, geo.Y(2700) + (j - (rows.length - 1) / 2) * 15, r, { size: 11, color: C.muted, alpha: appear(t, 2400) }));
    }
    cursor(g, geo, t, t0, t1);
    g.text(x, geo.bottom + 26, `중복 ACK ${st.dupacks} · ${st.delivered ? '복구 완료' : st.retransmitted ? '재전송 중' : '대기'}`, { size: 12, weight: 600, color: st.delivered ? C.greenText : C.muted });
    bottom = Math.max(bottom, geo.bottom + 26 - y0);
    if (cols === 1 && i === 0) g.line(0, geo.bottom + 46, w, geo.bottom + 46, { stroke: C.grid, lw: 1 });
  }
  return frame(g, (cols === 2 ? bottom : bottom * 2 + 40) + 10, s.phase);
}

/* ---------- N07 프레임: 바이트 영역이 바깥으로 붙으며 포함 범위가 넓어진다 ---------- */
function layersV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N07', t), wide = w >= 560;
  const parts = [{ key: 'L2 header', short: 'L2', bytes: '14 B', lv: 3, f: 0.15 }, { key: 'IPv4 header', short: 'IPv4', bytes: '20 B', lv: 2, f: 0.15 }, { key: 'TCP header', short: 'TCP', bytes: '20 B', lv: 1, f: 0.15 }, { key: 'payload', short: 'payload', bytes: '1,460 B', lv: 0, f: 0.43 }, { key: 'FCS', short: 'FCS', bytes: '4 B', lv: 3, f: 0.12 }];
  const attachAt = [0, 1700, 3000, 4300], bx = 0, bw = w, by = para(g, 0, 14, '한 프레임 안의 바이트 영역 · 너비는 바이트 비례가 아님', w, { size: 12, color: C.muted }) + 16, bh = 52;
  let x = bx;
  const pos = parts.map(p => { const r = { x, w: bw * p.f }; x += bw * p.f; return r; });
  parts.forEach((p, i) => {
    const at = attachAt[p.lv], r = pos[i];
    if (t < at - 400) { g.rect(r.x + 2, by, r.w - 4, bh, { r: 7, stroke: C.grid, lw: 1, dash: [3, 3] }); return; }
    // 붙는 시각에 맞춰 위에서 내려와 도착한다
    const q = p.lv === 0 ? 1 : ease.out(span(t, at - 400, at)), y = lerp(by - 26, by, q), excluded = p.lv === 3;
    const fill = excluded ? C.orangeTint : p.lv === 0 ? C.blueTint : C.paper, stroke = excluded ? C.orange : p.lv === 0 ? C.blue : C.ink;
    g.rect(r.x + 2, y, r.w - 4, bh, { r: 7, fill, stroke, lw: 1.4, alpha: q });
    const name = wide ? p.key : p.short, color = excluded ? C.orangeText : p.lv === 0 ? C.blueText : C.ink;
    g.text(r.x + r.w / 2, y + 22, name, { size: wide ? 12 : 11, weight: 700, align: 'center', color, alpha: q });
    g.text(r.x + r.w / 2, y + 40, p.bytes, { size: 11, mono: true, align: 'center', color: C.muted, alpha: q });
  });
  // 포함 범위: 바깥 계층일수록 아래·넓게
  const spans: [number, number, number, string, string][] = [[3, 3, 0, 'payload · MSS 1,460 B', C.blue], [2, 3, 1, 'TCP segment · 1,480 B', C.ink], [1, 3, 2, 'IP packet · MTU 1,500 B', C.blue], [0, 4, 3, 'Ethernet frame · 1,518 B', C.ink]];
  let sy = by + bh + 22;
  for (const [a, b, lv, text, col] of spans) {
    if (s.level < lv) { sy += 34; continue; }
    const al = appear(t, attachAt[lv]), x1 = pos[a].x + 4, x2 = pos[b].x + pos[b].w - 4, mtu = lv === 2;
    g.path(`M${x1} ${sy - 10}V${sy}H${x2}V${sy - 10}`, { stroke: col, lw: mtu ? 2 : 1.4, alpha: al });
    const tw = textW(text, 12) + 10, cx = Math.min(Math.max((x1 + x2) / 2, tw / 2), w - tw / 2);
    label(g, cx, sy + 15, text, { size: 12, weight: mtu ? 700 : 600, color: mtu ? C.blueText : C.ink, alpha: al });
    sy += 34;
  }
  let y = sy + 8;
  if (s.level >= 3) y = para(g, 0, y, 'IP MTU 제외: L2 header / FCS', w, { size: 12, weight: 600, color: C.orangeText }) + 22;
  if (!wide) y = para(g, 0, y, 'L2 header 14 B · IPv4 header 20 B · TCP header 20 B · payload 1,460 B · FCS 4 B', w, { size: 11, color: C.muted }) + 18;
  return frame(g, y - 8, s.phase);
}

/* ---------- N08 관측값: 같은 경로 위에서 Reno는 손실 신호를, BBR은 전달률·최소 RTT를 읽는다 ---------- */
function pathRow(g: G, y: number, w: number, t: number, rate: number, queueFrac: number, qLabel = '병목 큐') {
  const sx = 0, qx = w * 0.46, qw = Math.min(110, w * 0.26), rx = w - 56;
  host(g, sx + 28, y + 6, '송신', { min: 56 });
  host(g, rx + 28, y + 6, '수신', { min: 56 });
  // 병목 큐
  g.rect(qx, y, qw, 38, { r: 8, fill: C.paper, stroke: C.ink, lw: 1.3 });
  if (queueFrac > 0) g.rect(qx + 3, y + 3, (qw - 6) * queueFrac, 32, { r: 6, fill: C.orangeTint, stroke: C.orange, lw: 1 });
  g.text(qx + qw / 2, y + 54, qLabel, { size: 11, align: 'center', color: queueFrac > 0 ? C.orangeText : C.muted });
  g.line(sx + 56, y + 19, qx, y + 19, { stroke: C.line, lw: 1.2 });
  g.line(qx + qw, y + 19, rx, y + 19, { stroke: C.line, lw: 1.2 });
  // 보내는 속도: 점 간격이 좁을수록 빠르다(표현 전용 흐름)
  // 보내는 속도: 점 간격이 좁을수록 빠르다(표현 전용 흐름). 모델에 속도가 없는 Reno 줄은 rate 0으로 점을 그리지 않는다
  if (rate > 0) {
    const gapPx = 26 / rate;
    for (let d = (t * 0.06) % gapPx; d < qx - sx - 60; d += gapPx) g.circle(sx + 60 + d, y + 19, 2.4, { fill: C.blue });
    for (let d = (t * 0.06) % 26; d < rx - qx - qw - 6; d += 26) g.circle(qx + qw + 4 + d, y + 19, 2.4, { fill: C.blue });
  }
  return { qx, qw, rx };
}
function bbrV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N08', t);
  // Reno
  g.text(0, 14, 'Reno · 손실 신호', { size: 13, weight: 700 });
  const r = pathRow(g, 30, w, t, 0, 0);
  // 중복 ACK 세 개가 함께 돌아와 4200에 도착 → ssthresh 20 → 10
  const ay = 98;
  g.line(56, ay, r.rx, ay, { stroke: C.grid, lw: 1, dash: [3, 4] });
  if (t >= 3600) {
    const q = ease.inOut(span(t, 3600, 4200));
    if (t < 4200) token(g, lerp(r.rx - 30, 90, q), ay, '중복 ACK ×3', 'orange', { r: 9 });
  }
  const decided = s.renoThreshold === 10, a = appear(t, 4200);
  g.rect(0, ay + 18, Math.min(w, 300), 74, { r: 8, fill: decided ? C.redTint : C.paper, stroke: decided ? C.red : C.line, lw: 1.2 });
  g.text(12, ay + 39, decided ? '관측: 3개의 중복 ACK → 손실 추정' : '관측: 손실 신호 대기', { size: 12, weight: 600, color: decided ? C.redText : C.muted });
  g.text(12, ay + 60, 'FlightSize 20 SMSS', { size: 12, mono: true });
  g.text(12, ay + 80, `ssthresh ${s.renoThreshold} SMSS`, { size: 12, mono: true, weight: decided ? 700 : 400, color: decided ? C.orangeText : C.ink, alpha: decided ? Math.max(0.4, a) : 1 });
  let y = para(g, 0, ay + 118, '선택한 Reno 사건의 결정 기준만 비교합니다. CUBIC 성능 곡선은 그리지 않습니다.', w, { size: 12, color: C.muted }) + 30;
  g.line(0, y - 8, w, y - 8, { stroke: C.grid, lw: 1 });
  // BBRv1
  g.text(0, y + 14, 'BBRv1 · 관측 모델', { size: 13, weight: 700 });
  pathRow(g, y + 30, w, t, s.gain, s.queueBytes / 125000, `설명용 큐 ${s.queueBytes.toLocaleString()} B`);
  const oy = y + 98;
  g.rect(0, oy, Math.min(w, 300), 52, { r: 8, fill: C.blueTint, stroke: C.blue, lw: 1.2 });
  g.text(12, oy + 21, '추정: BtlBw 100 Mbps / RTprop 40 ms', { size: 12, weight: 600, color: C.blueText });
  g.text(12, oy + 42, `BDP ${s.bbrBdp.toLocaleString()} B`, { size: 12, mono: true });
  // pacing gain 주기: 1.25 → 0.75 → 1.0 × 6
  const gy = oy + 76, cw = (w - 7 * 4) / 8;
  probeGains.forEach((gain, j) => {
    const x = j * (cw + 4), on = t >= 2000 + j * 1000, cur = on && j === s.step && t < 10000;
    const col = gain > 1 ? C.orange : gain < 1 ? C.blue : C.line;
    g.rect(x, gy, cw, 30, { r: 6, fill: cur ? (gain > 1 ? C.orangeTint : gain < 1 ? C.blueTint : C.slab) : C.paper, stroke: on ? col : C.grid, lw: cur ? 2 : 1 });
    g.text(x + cw / 2, gy + 19.5, gain === 1 ? '1.0' : String(gain), { size: 11, mono: true, weight: cur ? 700 : 400, align: 'center', color: on ? C.ink : C.muted });
  });
  y = para(g, 0, gy + 56, `pacing gain ${s.gain} · ${s.rateMbps} Mbps`, w, { size: 12, weight: 600, mono: true, color: C.blueText });
  return frame(g, y + 10, s.phase);
}

/* ---------- N09 Nagle: 두 번째 작은 쓰기가 송신 측에 머무는 구간 ---------- */
function nagleV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N09', t), { cols, pw } = twoUp(w), k = 0.072, t0 = 800, t1 = 5500, A = nagleAckTiming;
  let bottom = 0;
  for (let i = 0; i < 2; i++) {
    const nodelay = i === 1, x = cols === 2 ? i * (pw + 28) : 0, y0 = cols === 2 ? 0 : i * (bottom + 40);
    g.text(x, y0 + 14, nodelay ? 'TCP_NODELAY=1' : 'Nagle on', { size: 13, weight: 600, mono: true });
    const geo = seq(g, t, {
      x, y: y0 + 30, w: pw, t0, t1, k, lanes: ['송신', '수신'],
      msgs: [{ a: 1100, b: 1700, from: 0, label: '작은 쓰기 A', tone: 'blue' }, { a: A.sentAt, b: A.receivedAt, from: 1, label: '확인 ACK', tone: 'green' }, nodelay ? { a: 2500, b: 3100, from: 0, label: '작은 쓰기 B', tone: 'blue' } : { a: A.receivedAt, b: 5200, from: 0, label: '작은 쓰기 B', tone: 'blue' }],
      holds: [...(nodelay ? [] : [{ lane: 0 as const, a: 2500, b: A.receivedAt, label: 'B 보관 · ACK 대기', tone: 'orange' as const }]), { lane: 1, a: 1700, b: A.sentAt, label: 'delayed ACK', tone: 'muted' }],
    });
    // 앱의 두 번째 write 시각: 두 패널 모두 2500
    if (t >= 2500) { const a = appear(t, 2500); g.circle(geo.ax, geo.Y(2500), 4, { fill: C.ink, alpha: a }); }
    cursor(g, geo, t, t0, t1);
    const st = nodelay ? s.nodelay : s.nagle;
    g.text(x, geo.bottom + 26, `B: ${st.secondSent ? '전송' : 'ACK 대기'}`, { size: 12, weight: 600, color: st.secondSent ? C.blueText : C.orangeText });
    bottom = Math.max(bottom, geo.bottom + 26 - y0);
    if (cols === 1 && i === 0) g.line(0, geo.bottom + 46, w, geo.bottom + 46, { stroke: C.grid, lw: 1 });
  }
  const y = (cols === 2 ? bottom : bottom * 2 + 40) + 30;
  g.circle(4, y - 4, 4, { fill: C.ink });
  g.text(14, y, '앱의 두 번째 write · 두 패널 같은 시각', { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

/* ---------- N10 TIME_WAIT: 마지막 ACK 유실, FIN 재전송, 2MSL 재시작 ---------- */
function closeV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N10', t), wide = w >= 560;
  const active: LaneState[] = [[0, 'ESTABLISHED', 'muted'], [1100, 'FIN_WAIT_1', 'orange'], [2900, 'FIN_WAIT_2', 'orange'], [4200, 'TIME_WAIT', 'blue'], [10000, 'CLOSED', 'muted']];
  const passive: LaneState[] = [[0, 'ESTABLISHED', 'muted'], [1700, 'CLOSE_WAIT', 'orange'], [3500, 'LAST-ACK', 'orange'], [8500, 'CLOSED', 'muted']];
  const geo = seq(g, t, {
    x: 0, y: 0, w, t0: 600, t1: 10300, k: 0.042, lanes: ['능동 종료', '수동 종료'], stateWidth: wide ? 96 : 0, states: [active, passive],
    msgs: [
      { a: 1100, b: 1700, from: 0, label: 'FIN', tone: 'blue' }, { a: 2300, b: 2900, from: 1, label: 'ACK', tone: 'green' },
      { a: 3500, b: 4200, from: 1, label: 'FIN', tone: 'green' }, { a: 4700, b: 5300, from: 0, label: '마지막 ACK', tone: 'red', loss: true },
      { a: 6500, b: 7200, from: 1, label: 'RTO → FIN 재전송', tone: 'green' }, { a: 7800, b: 8500, from: 0, label: 'ACK 재응답', tone: 'blue' },
    ],
    holds: [{ lane: 0, a: 4200, b: 7200, label: '2MSL', tone: 'blue' }, { lane: 0, a: 7200, b: 10000, label: '2MSL 재시작', tone: 'blue' }, { lane: 1, a: 3500, b: 6500, label: '재전송 타이머', tone: 'orange' }],
  });
  cursor(g, geo, t, 600, 10300);
  const y = notes(g, geo.bottom + 30, w, [
    [`능동: ${s.active} · 수동: ${s.passive}`, C.ink],
    s.active === 'CLOSED' ? '압축한 2MSL 만료 → 이전 상태 해제' : s.active === 'TIME_WAIT' ? '같은 4-tuple의 이전 연결 상태 유지' : s.active === 'ESTABLISHED' ? '연결 사용 중 · 종료 시작 전' : 'FIN/ACK 교환 · 종료 진행 중',
    'TIME_WAIT은 모든 로컬 포트를 잠그는 상태가 아닙니다.',
  ]);
  return frame(g, y + 10, s.phase);
}

/* ---------- N11 HOL: 누락된 2번 뒤에서 3·4번이 기다리는 수신 버퍼 ---------- */
function holV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N11', t);
  const geo = seq(g, t, {
    x: 0, y: 0, w, t0: 800, t1: 7000, k: 0.062, lanes: ['송신', '수신'],
    msgs: [{ a: 1100, b: 1700, from: 0, label: 'DATA 1', tone: 'blue' }, { a: 1900, b: 2500, from: 0, label: 'DATA 2', tone: 'red', loss: true }, { a: 2700, b: 3300, from: 0, label: 'DATA 3', tone: 'blue' }, { a: 3600, b: 4200, from: 0, label: 'DATA 4', tone: 'blue' }, { a: 6100, b: 6700, from: 0, label: 'DATA 2 재전송', tone: 'blue' }],
    holds: [{ lane: 1, a: 3300, b: 6700, label: '2 누락 · 대기', tone: 'orange' }],
  });
  cursor(g, geo, t, 800, 7000);
  // 수신 버퍼 칸과 앱: 바이트 순서대로만 앱에 넘긴다
  const y = geo.bottom + 40, appW = w >= 400 ? 92 : 64, slotW = (w - appW - 40) / 4;
  g.text(0, y - 12, '수신 버퍼 (바이트 순서)', { size: 12, weight: 600 });
  [1, 2, 3, 4].forEach((n, i) => {
    const x = i * slotW, wait = s.buffer.includes(n), done = s.delivered.includes(n), missing = n === 2 && t >= 2500 && !done;
    const fill = done ? C.greenTint : wait ? C.orangeTint : C.paper, stroke = done ? C.green : wait ? C.orange : missing ? C.red : C.line;
    g.rect(x + 2, y, slotW - 6, 34, { r: 7, fill, stroke, lw: 1.3, dash: missing ? [4, 3] : null });
    const c = done ? C.greenText : wait ? C.orangeText : missing ? C.redText : C.muted;
    // 칸이 좁으면 번호와 '누락'을 두 줄로(글자는 줄이지 않는다)
    const cx = x + 2 + (slotW - 6) / 2;
    if (missing && textW('2 누락', 12, true) + 8 > slotW - 6) { g.text(cx, y + 15, '2', { size: 12, mono: true, weight: 700, align: 'center', color: c }); g.text(cx, y + 29, '누락', { size: 11, weight: 700, align: 'center', color: c }); }
    else g.text(cx, y + 22, missing ? '2 누락' : String(n), { size: 12, mono: true, weight: 700, align: 'center', color: c });
  });
  const ax = w - appW;
  g.rect(ax, y - 4, appW, 42, { r: 8, fill: s.delivered.length ? C.greenTint : C.paper, stroke: s.delivered.length ? C.green : C.line, lw: 1.3 });
  g.text(ax + appW / 2, y + 22, '앱', { size: 12, weight: 600, align: 'center', color: s.delivered.length ? C.greenText : C.muted });
  arrow(g, { x: 4 * slotW + 2, y: y + 17 }, { x: ax - 6, y: y + 17 }, { stroke: s.delivered.length ? C.green : C.line, lw: 1.4 });
  g.text(0, y + 66, `앱 전달: ${s.delivered.join(' → ') || '없음'}`, { size: 12, weight: 600, color: C.greenText });
  return frame(g, y + 76, s.phase);
}

/* ---------- N12 keepalive: idle·interval·마지막 대기를 같은 시간 눈금에 ---------- */
function keepaliveV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N12', t), { cols, pw } = twoUp(w), k = 0.045, t0 = 0, t1 = 8500;
  let bottom = 0;
  for (let i = 0; i < 2; i++) {
    const dead = i === 1, x = cols === 2 ? i * (pw + 28) : 0, y0 = cols === 2 ? 0 : i * (bottom + 40);
    g.text(x, y0 + 14, dead ? '응답 없음' : '응답 있음', { size: 13, weight: 600 });
    const geo = seq(g, t, {
      x, y: y0 + 30, w: pw, t0, t1, k, lanes: ['확인 측', '상대'], gutters: [74, 0],
      msgs: dead
        ? [{ a: 3500, b: 4100, from: 0, label: 'probe 1 · idle 30 s', tone: 'blue' }, { a: 5000, b: 5600, from: 0, label: 'probe 2 · +10 s', tone: 'blue' }, { a: 6500, b: 7100, from: 0, label: 'probe 3 · +10 s', tone: 'blue' }]
        : [{ a: 3500, b: 4100, from: 0, label: 'probe · idle 30 s', tone: 'blue' }, { a: 4100, b: 4500, from: 1, label: 'TCP ACK', tone: 'green' }],
      holds: dead
        ? [{ lane: 0, a: 0, b: 3500, label: 'idle 30 s', tone: 'muted' }, { lane: 0, a: 3500, b: 5000, label: 'interval 10 s', tone: 'muted' }, { lane: 0, a: 5000, b: 6500, label: 'interval 10 s', tone: 'muted' }, { lane: 0, a: 6500, b: 8000, label: '마지막 10 s', tone: 'red' }]
        : [{ lane: 0, a: 0, b: 3500, label: 'idle 30 s', tone: 'muted' }, { lane: 0, a: 4500, b: 8500, label: 'idle 재시작', tone: 'green' }],
      states: dead ? [[[8000, '실패', 'red']], []] : undefined,
    });
    cursor(g, geo, t, t0, t1);
    const msg = dead ? (s.failed ? '마지막 10 s 대기 → 실패' : `전송 probe ${s.unanswered}/3`) : (s.idleReset ? '응답 도착 → idle 재시작' : 'idle 만료 대기');
    g.text(x, geo.bottom + 26, msg, { size: 12, weight: 600, color: dead && s.failed ? C.redText : dead ? C.muted : C.greenText });
    bottom = Math.max(bottom, geo.bottom + 26 - y0);
    if (cols === 1 && i === 0) g.line(0, geo.bottom + 46, w, geo.bottom + 46, { stroke: C.grid, lw: 1 });
  }
  return frame(g, (cols === 2 ? bottom : bottom * 2 + 40) + 10, s.phase);
}

/* ---------- N13 연결 재사용: 연결(관)을 몇 번 만드는가 ---------- */
function connPanel(g: G, x: number, y: number, pw: number, t: number, reuse: boolean) {
  const s = state('N13', t), st = reuse ? s.reuse : s.fresh, hs = reuse ? [1100] : [1100, 3600, 6100], rq = reuse ? [2500, 4300, 6100] : [2500, 5000, 7500];
  g.text(x, y + 14, reuse ? '한 연결 재사용' : '매번 새 연결', { size: 13, weight: 700 });
  const colW = 70, top = y + 30, H = 196, lx = x + colW + 6, rx = x + pw - colW - 6, rowY = (n: number) => top + 40 + n * 60;
  // 양 끝: 클라이언트·서버 기둥
  for (const [cx, name] of [[x, '클라이언트'], [x + pw - colW, '서버']] as const) {
    g.rect(cx, top, colW, H, { r: 10, fill: C.paper, stroke: C.ink, lw: 1.3 });
    g.text(cx + colW / 2, top + 20, name, { size: 12, weight: 600, align: 'center' });
  }
  // 연결 관: handshake 시각부터 만들어진다. 새 연결 쪽은 응답 뒤 닫힌다
  hs.forEach((h, n) => {
    const yy = reuse ? rowY(1) : rowY(n);
    if (t < h) { g.rect(lx, yy - 13, rx - lx, 26, { r: 13, stroke: C.grid, lw: 1, dash: [3, 4] }); return; }
    const closedAt = reuse ? 9000 : rq[n] + 1100, closed = t >= closedAt, a = appear(t, h, 500);
    g.rect(lx, yy - 13, rx - lx, 26, { r: 13, fill: closed ? C.paper : C.blueTint, stroke: closed ? C.line : C.blue, lw: 1.4, dash: closed ? [4, 3] : null, alpha: Math.max(0.15, a) });
    if (t < h + 900) {
      // SYN → SYN/ACK → ACK: 관을 한 번 반 왕복
      const q = span(t, h, h + 900), leg = Math.min(2, Math.floor(q * 3)), u = q * 3 - leg;
      g.circle(leg % 2 === 0 ? lerp(lx + 8, rx - 8, u) : lerp(rx - 8, lx + 8, u), yy, 4, { fill: C.blue });
      label(g, (lx + rx) / 2, yy - 19, 'handshake', { size: 11, weight: 600, color: C.blueText });
    }
    if (closed) { if (reuse) label(g, (lx + rx) / 2, yy + 30, 'Connection: close', { size: 11, mono: true, color: C.muted, alpha: appear(t, closedAt) }); else g.text((lx + rx) / 2 + 12, yy + 4, '연결 닫힘', { size: 11, align: 'center', color: C.muted, alpha: appear(t, closedAt) }); }
  });
  // 요청·응답이 관 안을 왕복하고, 끝난 요청은 관 위에 번호로 남는다
  rq.forEach((r0, n) => {
    if (t < r0) return;
    const yy = reuse ? rowY(1) : rowY(n);
    if (t < r0 + 500) token(g, lerp(lx + 22, rx - 22, ease.inOut(span(t, r0, r0 + 500))), yy, `GET ${n + 1}`, 'blue', { solid: true, r: 9 });
    else if (t < r0 + 1000) token(g, lerp(rx - 22, lx + 22, ease.inOut(span(t, r0 + 500, r0 + 1000))), yy, '200', 'green', { solid: true, r: 9 });
    else token(g, reuse ? lx + 12 + n * 24 : lx + 18, reuse ? yy - 30 : yy, n + 1, 'green', { r: 9 });
  });
  const by = top + H + 26;
  g.text(x, by, `GET ${st.requests} · handshake ${st.handshakes}`, { size: 13, weight: 700 });
  para(g, x, by + 24, reuse && s.reuse.closed ? 'Connection: close → 종료' : 'HTTP/1.1 · 직렬 요청', pw, { size: 12, color: C.muted });
  return by + 34 - y;
}
function reuseV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('N13', t), { cols, pw } = twoUp(w);
  const h1 = connPanel(g, 0, 0, pw, t, false);
  const h2 = connPanel(g, cols === 2 ? pw + 28 : 0, cols === 2 ? 0 : h1 + 30, pw, t, true);
  if (cols === 1) g.line(0, h1 + 12, w, h1 + 12, { stroke: C.grid, lw: 1 });
  return frame(g, (cols === 2 ? Math.max(h1, h2) : h1 + 30 + h2) + 6, s.phase);
}

/* ---------- W01 waterfall: 시간 커서가 ms 눈금을 지나며 TTFB와 HTML 완료를 표시 ---------- */
const ROWS: readonly (readonly [string, number, number, number, number, 'prep' | 'wait' | 'body'])[] = [['DNS', 0, 40, 1100, 1600, 'prep'], ['TCP', 40, 120, 1600, 2400, 'prep'], ['TLS', 120, 200, 2400, 3200, 'prep'], ['첫 바이트 대기', 200, 320, 3200, 3900, 'wait'], ['HTML 수신', 320, 380, 3900, 4900, 'body'], ['CSS', 380, 490, 5000, 6300, 'body'], ['JS', 400, 540, 5300, 7000, 'body']];
function waterfallV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('W01', t), narrow = w < 420, bx = narrow ? 0 : 112, bw = w - bx - 4, step = narrow ? 64 : 46, top = 58;
  const M = (ms: number) => bx + bw * ms / 540;
  g.text(0, 14, '설명용 0–540 ms', { size: 12, weight: 600 });
  for (let ms = 0; ms <= 500; ms += 100) { g.line(M(ms), top - 14, M(ms), top + step * 7 - 10, { stroke: C.grid, lw: 1 }); g.text(M(ms), top - 20, ms, { size: 11, mono: true, align: ms === 0 ? 'left' : 'center', color: C.muted }); }
  const tone = { prep: [C.blueTint, C.blue], wait: [C.orangeTint, C.orange], body: [C.greenTint, C.green] } as const;
  // 구간 라벨(좁은 폭에서는 행 이름도)은 커서·TTFB 선보다 나중에 바탕과 함께 그려 선에 끊기지 않게 한다
  const spans: [number, number, string, 'left' | 'right'][] = [];
  const names: (() => void)[] = [];
  ROWS.forEach(([name, a, b, ta, tb, kind], i) => {
    const yy = top + i * step, by = narrow ? yy + 10 : yy - 4;
    const nameOp = () => {
      if (narrow) g.rect(0, yy - 12, textW(name, 12) + 6, 16, { r: 3, fill: C.paper });
      g.text(0, narrow ? yy : yy + 10, name, { size: 12, weight: kind === 'wait' ? 600 : 400, color: kind === 'wait' ? C.orangeText : C.ink });
    };
    if (narrow) names.push(nameOp); else nameOp();
    g.rect(M(a), by, Math.max(2, M(b) - M(a)), 18, { r: 5, fill: C.paper, stroke: C.line, lw: 1 });
    const q = span(t, ta, tb);
    if (q > 0) g.rect(M(a), by, Math.max(2, (M(b) - M(a)) * q), 18, { r: 5, fill: tone[kind][0], stroke: tone[kind][1], lw: 1.2 });
    spans.push([narrow ? w - 4 : M(b) + 6 > w - 70 ? M(a) - 6 : M(b) + 6, narrow ? yy : by + 13, `${a}–${b} ms`, narrow || M(b) + 6 > w - 70 ? 'right' : 'left']);
  });
  // ms 커서: 진행 중인 막대의 머리
  let cur = 0;
  for (const [, a, b, ta, tb] of ROWS) if (t >= ta) cur = Math.max(cur, a + (b - a) * span(t, ta, tb));
  if (t >= 1100 && t < 7000) g.line(M(cur), top - 14, M(cur), top + step * 7 - 10, { stroke: C.blue, lw: 1.2, alpha: 0.5, dash: [3, 3] });
  const mark = (ms: number, at: number, text: string, color: string) => {
    if (t < at) return;
    const a = appear(t, at);
    g.line(M(ms), top - 14, M(ms), top + step * 7 - 10, { stroke: color, lw: 1.6, alpha: a });
    label(g, M(ms) + 4, top + step * 7 + 8, text, { size: 11, weight: 700, align: 'left', color, alpha: a });
  };
  mark(320, 3900, 'TTFB 320 ms', C.blueText);
  names.forEach(f => f());
  for (const [x, yy, text, align] of spans) label(g, x, yy, text, { size: 11, mono: true, align, color: C.muted });
  let y = top + step * 7 + (t >= 3900 ? 44 : 22);
  y = para(g, 0, y, `TTFB ${s.firstByte ? '도착' : '대기'} / HTML ${s.htmlComplete ? '완료' : '수신 전 / 수신 중'}`, w, { size: 12, weight: 600, color: C.blueText });
  return frame(g, y + 10, s.phase);
}

/* ---------- W02 gzip: 같은 문서의 압축 → 전송 → 복원, 처리 구간과 전송 구간을 따로 ---------- */
function gzipV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('W02', t), T0 = 1000, T1 = 7400, ratio = s.gzipBytes / s.rawBytes;
  const lane = (y: number, gz: boolean) => {
    g.text(0, y + 14, gz ? 'Content-Encoding: gzip' : 'Content-Encoding: identity', { size: 12, weight: 700, mono: true });
    const sw = hostWidth('서버'), bw = hostWidth('브라우저'), by = y + 50, mid = w / 2, lx = sw + 10, rx = w - bw - 10, half = Math.min(mid - lx, rx - mid) - 6;
    host(g, sw / 2, by - 13, '서버');
    host(g, w - bw / 2, by - 13, '브라우저');
    // 전송 선: 가운데 경계를 지난 바이트만 브라우저에 있다(같은 전송률)
    g.line(mid, by - 14, mid, by + 22, { stroke: C.ink, lw: 1.2, dash: [3, 3] });
    g.rect(lx, by - 11, mid - 6 - lx, 22, { r: 6, fill: C.bg });
    g.rect(mid + 6, by - 11, rx - mid - 6, 22, { r: 6, fill: C.bg });
    const sent = gz ? s.gzipSentBytes / s.gzipBytes : s.rawSentBytes / s.rawBytes;
    const len = gz ? lerp(1, ratio, ease.inOut(span(t, 1600, s.gzipSendAt))) : 1, compressing = gz && t >= 1600 && t < s.gzipSendAt;
    const rest = half * len * (1 - sent);
    if (rest > 1) g.rect(mid - 6 - rest, by - 11, rest, 22, { r: 6, fill: compressing ? C.orangeTint : C.blueTint, stroke: compressing ? C.orange : C.blue, lw: 1.3 });
    const done = gz ? s.decoded : s.rawReceived, decoding = gz && s.gzipReceived && !s.decoded;
    const got = gz ? (s.gzipReceived ? lerp(ratio, 1, ease.inOut(span(t, 3400, 3900))) : ratio * sent) : sent;
    if (got > 0) g.rect(mid + 6, by - 11, half * got, 22, { r: 6, fill: done ? C.greenTint : decoding ? C.orangeTint : C.blueTint, stroke: done ? C.green : decoding ? C.orange : C.blue, lw: 1.3 });
    if (sent > 0 && sent < 1) for (let d = (t * 0.05) % 14; d < 12; d += 6) g.circle(mid - 6 + d, by, 1.8, { fill: C.blue });
    // 압축 구간은 아래 시간 눈금과 같이 1600부터
    const stat = t < 1600 ? '전송 전' : gz ? (t < s.gzipSendAt ? '압축 중' : s.gzipReceived ? '수신 완료' : '전송 중') : (s.rawReceived ? '수신 완료' : '전송 중');
    g.text(lx, by - 20, `${(gz ? s.gzipBytes : s.rawBytes).toLocaleString()} B 전송 · 상태: ${stat}`, { size: 12, weight: 600, color: C.blueText });
    const same = '같은 JSON 500행 · 원문 18,891 B', ty = by + 30 + (wrap(same, rx - mid - 6, 11).length - 1) * 18;
    if (done) para(g, mid + 6, by + 30, same, rx - mid - 6, { size: 11, weight: 600, color: C.greenText, alpha: appear(t, gz ? 3900 : 6900) });
    // 처리 구간과 전송 구간: 같은 시간 눈금
    const ry = ty + 26, X = (tt: number) => lx + (tt - T0) / (T1 - T0) * (rx - lx);
    g.rect(lx, ry, rx - lx, 16, { r: 4, fill: C.bg });
    const segs: [number, number, string, string, string][] = gz ? [[1600, s.gzipSendAt, '압축', C.orangeTint, C.orange], [s.gzipSendAt, 3400, '전송', C.blueTint, C.blue], [3400, 3900, '해제', C.orangeTint, C.orange]] : [[1600, 6900, '전송', C.blueTint, C.blue]];
    for (const [a, b, name, fill, stroke] of segs) {
      if (t < a) continue;
      const x1 = X(a), x2 = X(Math.min(b, t));
      g.rect(x1, ry, Math.max(2, x2 - x1), 16, { r: 4, fill, stroke, lw: 1 });
      if (X(b) - x1 > textW(name, 11) + 6) g.text((x1 + X(b)) / 2, ry + 12, name, { size: 11, align: 'center', alpha: appear(t, a) });
    }
    // 시간 커서는 막대 위아래 눈금으로만(막대 속 구간 이름을 지나지 않게)
    if (t > T0 && t < T1) for (const [y0, y1] of [[ry - 5, ry + 1], [ry + 15, ry + 21]]) g.line(X(t), y0, X(t), y1, { stroke: C.blue, lw: 1, alpha: 0.6 });
    return ry + 16 - y;
  };
  const h1 = lane(0, false);
  g.line(0, h1 + 18, w, h1 + 18, { stroke: C.grid, lw: 1 });
  const h2 = lane(h1 + 36, true);
  const y = para(g, 0, h1 + 36 + h2 + 30, 'gzip 수신 완료 → decode → 사용', w, { size: 12, weight: 600, color: C.orangeText });
  return frame(g, y + 10, s.phase);
}

/* ---------- W04 ETag: 저장된 표현이 304에서 재사용되고 200에서 교체되는 자리 ---------- */
function etagV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('W04', t), wide = w >= 560, side = wide ? 132 : 0;
  const geo = seq(g, t, {
    x: side, y: 0, w: w - side, t0: 1200, t1: 8200, k: 0.05, lanes: ['브라우저', '서버'],
    msgs: [{ a: 1500, b: 2300, from: 0, label: 'GET If-None-Match: v1', tone: 'blue' }, { a: 2800, b: 3500, from: 1, label: '304 · 새 본문 0 B', tone: 'green' }, { a: 5700, b: 6400, from: 0, label: 'GET If-None-Match: v1', tone: 'blue' }, { a: 7200, b: 7800, from: 1, label: '200 · ETag v2 + 본문', tone: 'green' }],
  });
  cursor(g, geo, t, 1200, 8200);
  // 저장된 표현 카드: 처음 v1 → 304에서 재사용 → 200 완료 뒤 v2로 교체
  const cards: [number, string, string, Tone | 'ink'][] = [[1200, 'v1 저장', 'ETag v1 · 본문', 'ink'], [3500, 'v1 재사용', '헤더만 갱신', 'green'], [7800, 'v2 교체', '새 본문 저장', 'blue']];
  const cy = wide ? (at: number) => geo.Y(at) - 10 : () => geo.bottom + 24;
  cards.forEach(([at, title, sub, tone], i) => {
    if (t < at) return;
    const a = appear(t, at), cw = wide ? side - 20 : (w - 16) / 3, x = wide ? 0 : i * (cw + 8), y = cy(at);
    const col = tone === 'ink' ? C.ink : TONE[tone].line, txt = tone === 'ink' ? C.ink : TONE[tone].text;
    g.rect(x, y, cw, 46, { r: 8, fill: tone === 'ink' ? C.paper : TONE[tone].tint, stroke: col, lw: 1.3, alpha: a });
    g.text(x + 10, y + 19, title, { size: 12, weight: 700, color: txt, alpha: a });
    g.text(x + 10, y + 37, sub, { size: 11, color: C.muted, alpha: a });
    if (wide && i) arrow(g, { x: geo.ax - 4, y: geo.Y(at) }, { x: cw + 4, y: y + 23 }, { stroke: col, lw: 1.2, alpha: a, size: 6 });
  });
  let y = (wide ? geo.bottom : geo.bottom + 24 + 46) + 32;
  y = notes(g, y, w, [[`저장 태그: ${s.changed.tag} · 304 후 본문 v1 재사용`, C.greenText], 'no-cache: 저장 가능, 사용 전 재검증', 'no-store: 새 응답 저장 금지', 'must-revalidate: stale 응답 재사용 금지', 'unsafe 성공 요청: 대상 URI 캐시 무효화']);
  return frame(g, y + 10, s.phase);
}

/* ---------- W05 HTTP/2: 앞 바이트 범위 하나가 세 stream의 분배를 막는다 ---------- */
function streamsV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('W05', t);
  const geo = seq(g, t, {
    x: 0, y: 0, w, t0: 1200, t1: 7500, k: 0.055, lanes: ['TCP 송신', 'TCP 수신'],
    msgs: [{ a: 1500, b: 2200, from: 0, label: 'TCP 범위 A · stream 1', tone: 'red', loss: true }, { a: 2600, b: 3300, from: 0, label: 'TCP 범위 B · stream 3', tone: 'blue' }, { a: 3600, b: 4300, from: 0, label: 'TCP 범위 C · stream 5', tone: 'blue' }, { a: 6500, b: 7200, from: 0, label: '범위 A 재전송', tone: 'blue' }],
    holds: [{ lane: 1, a: 3300, b: 7200, label: 'B·C 대기', tone: 'orange' }], gutters: [0, w >= 560 ? 0 : 44],
  });
  cursor(g, geo, t, 1200, 7500);
  // TCP 수신 버퍼(연속 바이트) → HTTP/2 분배
  const y = geo.bottom + 40, cw = (w - 12) / 3, ranges: [string, number, number][] = [['A', 1, 7200], ['B', 3, 3300], ['C', 5, 4300]];
  g.text(0, y - 12, 'TCP 수신 버퍼 · 연속 바이트', { size: 12, weight: 600 });
  const delivered = s.deliveredStreams.length > 0;
  ranges.forEach(([r, , at], i) => {
    const x = i * (cw + 6), here = t >= at, gap = r === 'A' && !here && t >= 2200;
    const fill = delivered ? C.greenTint : here ? C.orangeTint : C.paper, stroke = delivered ? C.green : here ? C.orange : gap ? C.red : C.line;
    g.rect(x, y, cw, 30, { r: 6, fill, stroke, lw: 1.3, dash: gap ? [4, 3] : null });
    g.text(x + cw / 2, y + 20, gap ? 'A 누락' : `범위 ${r}`, { size: 12, mono: true, weight: 600, align: 'center', color: delivered ? C.greenText : here ? C.orangeText : gap ? C.redText : C.muted });
  });
  const sy = y + 74;
  ranges.forEach(([, n], i) => {
    const x = i * (cw + 6), done = s.deliveredStreams.includes(n), a = appear(t, 7200);
    if (done) arrow(g, { x: x + cw / 2, y: y + 32 }, { x: x + cw / 2, y: sy - 2 }, { stroke: C.green, lw: 1.4, alpha: a, size: 6 });
    g.rect(x, sy + 4, cw, 44, { r: 8, fill: done ? C.greenTint : C.paper, stroke: done ? C.green : C.line, lw: 1.2 });
    g.text(x + 10, sy + 22, `stream ${n}`, { size: 12, mono: true, weight: 600 });
    g.text(x + 10, sy + 40, done ? '분배 완료' : '바이트 대기', { size: 11, color: done ? C.greenText : C.orangeText });
  });
  // 분배 화살표 위에 바탕을 깔아 계층 이름이 가려지지 않게 한다
  label(g, 4, sy - 12, 'HTTP/2 분배 (TCP 위 계층)', { size: 12, weight: 600, align: 'left' });
  return frame(g, sy + 58, s.phase);
}

/* ---------- W06 200 / 404: 무엇을 대상 리소스로 보는지에 따라 응답 문서가 달라진다 ---------- */
function statusV2(w: number, t: number): LessonFrame {
  const g = draw(), s = state('W06', t), { cols, pw } = twoUp(w);
  let bottom = 0;
  for (let i = 0; i < 2; i++) {
    const missing = i === 1, x = cols === 2 ? i * (pw + 28) : 0, y0 = cols === 2 ? 0 : i * (bottom + 30);
    let y = para(g, x, y0 + 14, missing ? '대상 representation이 없음' : '정상 endpoint / 데이터 없음', pw, { size: 13, weight: 700 });
    y += 18;
    [s.endpoint.single, s.endpoint.collection].forEach((uri, n) => {
      const ry = y + n * 112;
      // 요청이 리소스 경계까지 [400, 1200]
      const reach = ease.inOut(span(t, 400, 1200)), bx = x + pw * 0.42, bw = pw * 0.58;
      g.text(x, ry + 14, uri, { size: 12, mono: true, weight: 600 });
      const p = { x: x + 20, y: ry + 46 }, q = { x: bx - 6, y: ry + 46 };
      if (t >= 400) { if (t < 1200) { g.line(p.x, p.y, lerp(p.x, q.x, reach), p.y, { stroke: C.blue, lw: 1.5 }); token(g, lerp(p.x, q.x, reach), p.y, 'GET', 'blue', { solid: true, r: 9 }); } else arrow(g, p, q, { stroke: C.blue, lw: 1.5, size: 6 }); }
      // 해석: 정상 endpoint(실선 경계, 데이터만 빔) / 대상 표현 없음(점선 경계, 비어 있음). 두 전제는 처음부터 나란히 둔다
      g.rect(bx, ry + 26, bw, 40, { r: 8, fill: missing ? C.paper : C.bg, stroke: missing ? C.orange : C.blue, lw: 1.3, dash: missing ? [4, 3] : null });
      g.text(bx + 10, ry + 51, missing ? '대상 없음' : 'endpoint · 결과 0건', { size: 11, color: missing ? C.orangeText : C.blueText });
      // 응답 문서: 4000에 나타난다
      const ra = appear(t, 4000), code = s.ready ? (missing ? '404' : '200') : '—';
      g.text(x, ry + 92, '조회 결과 없음', { size: 11, color: C.muted });
      if (s.ready) pill(g, x + pw - 34, ry + 88, code, { size: 13, h: 26, min: 56, fill: missing ? C.orangeTint : C.blueTint, stroke: missing ? C.orange : C.blue, color: missing ? C.orangeText : C.blueText, alpha: ra, mono: true });
      else g.text(x + pw - 12, ry + 94, code, { size: 13, align: 'right', color: C.muted });
    });
    bottom = Math.max(bottom, y + 224 - y0);
    if (cols === 1 && i === 0) g.line(0, y0 + bottom + 12, w, y0 + bottom + 12, { stroke: C.grid, lw: 1 });
  }
  let y = (cols === 2 ? bottom : bottom * 2 + 30) + 30;
  y = para(g, 0, y, '별도 전제: 컬렉션 리소스는 존재하고 검색 결과만 없음 → 200 + []', w, { size: 12, color: C.muted });
  return frame(g, y + 10, s.phase);
}

export const networkRenderers: Record<NetworkFigureId, (width: number, elapsed: number) => LessonFrame> = { N02: bdpV2, N04: handshakeV2, N05: congestionV2, N06: retransmitV2, N07: layersV2, N08: bbrV2, N09: nagleV2, N10: closeV2, N11: holV2, N12: keepaliveV2, N13: reuseV2, W01: waterfallV2, W02: gzipV2, W04: etagV2, W05: streamsV2, W06: statusV2 };
