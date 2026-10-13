import { networkState as state, probeGains, nagleAckTiming, type NetworkFigureId } from './network-models';
import type { DrawOp, LessonFrame } from './lessonCanvas';
type SequenceEvent = readonly [
    number,
    number,
    string,
    0 | 1,
    ('loss' | 'wait')?
];
type WaterfallRow = readonly [
    string,
    number,
    number,
    number,
    number
];
const C = { ink: '#343a40', muted: '#586b80', line: '#ced4da', grid: '#e9ecef', bg: '#f8f9fa', blue: '#228be6', green: '#12b886', orange: '#fd7e14', red: '#fa5252', blueText: '#1864ab', greenText: '#087f5b', orangeText: '#9c4b00', redText: '#c92a2a' };
const p = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
function draw() {
    const ops: DrawOp[] = [];
    return { ops,
        rect: (x: number, y: number, w: number, h: number, fill = C.bg, stroke = C.line) => ops.push({ type: 'rect', x, y, w, h, fill, stroke }),
        text: (x: number, y: number, text: string | number, color = C.ink, size = 12, align: CanvasTextAlign = 'left', bold = false) => ops.push({ type: 'text', x, y, text: String(text), color, size, align, bold }),
        line: (x1: number, y1: number, x2: number, y2: number, color = C.line, dash = false) => ops.push({ type: 'line', x1, y1, x2, y2, color, dash }),
        circle: (x: number, y: number, r: number, color: string) => ops.push({ type: 'circle', x, y, r, color }) };
}
function arrow(g: ReturnType<typeof draw>, x1: number, y1: number, x2: number, y2: number, color: string, dash = false) { g.line(x1, y1, x2, y2, color, dash); const a = Math.atan2(y2 - y1, x2 - x1); g.line(x2, y2, x2 - 6 * Math.cos(a - .45), y2 - 6 * Math.sin(a - .45), color); g.line(x2, y2, x2 - 6 * Math.cos(a + .45), y2 - 6 * Math.sin(a + .45), color); }
function dot(g: ReturnType<typeof draw>, t: number, a: number, b: number, x1: number, y1: number, x2: number, y2: number, color: string) { if (t >= a && t < b) {
    const q = p(t, a, b);
    g.circle(x1 + (x2 - x1) * q, y1 + (y2 - y1) * q, 4, color);
} }
function wraps(text: string | number, width: number, size = 12) { const max = Math.max(10, (width - 4) / size), out = []; let line = '', len = 0; for (const ch of String(text)) {
    const l = ch.charCodeAt(0) > 255 ? 1 : .57;
    if (len + l > max) {
        out.push(line);
        line = '';
        len = 0;
    }
    line += ch;
    len += l;
} if (line)
    out.push(line); return out; }
function lines(g: ReturnType<typeof draw>, x: number, y: number, text: string | number, width: number, color = C.ink, size = 12, bold = false) { const a = wraps(text, width, size); a.forEach((s, i) => g.text(x, y + i * 20, s, color, size, 'left', bold)); return y + a.length * 20; }
function pair(w: number, height: number) { return w >= 560 ? [{ x: 0, y: 0, w: (w - 24) / 2 }, { x: (w + 24) / 2, y: 0, w: (w - 24) / 2 }] : [{ x: 0, y: 0, w }, { x: 0, y: height + 30, w }]; }
function seq(g: ReturnType<typeof draw>, w: number, t: number, events: readonly SequenceEvent[], left = '송신', right = '수신', x = 0, y = 0) { g.text(x + 8, y + 14, left, C.ink, 12, 'left', true); g.text(x + w - 8, y + 14, right, C.ink, 12, 'right', true); const a = x + 16, b = x + w - 16, rows = events.length; g.line(a, y + 34, a, y + rows * 64 + 40); g.line(b, y + 34, b, y + rows * 64 + 40); events.forEach((e, i) => { const yy = y + 61 + i * 64, from = e[3] === 1 ? b : a, to = e[3] === 1 ? a : b, c = e[4] === 'loss' ? C.red : e[3] === 1 ? C.green : C.blue, tc = e[4] === 'loss' ? C.redText : e[3] === 1 ? C.greenText : C.blueText; const label = wraps(e[2], w - 20, 11); label.forEach((s, j) => g.text(x + w / 2, yy - 14 - (label.length - 1 - j) * 16, s, t >= e[0] ? tc : C.muted, 11, 'center')); if (t < e[0])
    g.line(from, yy, to, yy, C.grid, true);
else if (e[4] === 'wait') {
    g.text(x + w / 2, yy + 10, 'RTO 타이머 대기', C.muted, 11, 'center');
}
else if (e[4] === 'loss') {
    g.line(from, yy, from + (to - from) * p(t, e[0], e[1]) * .53, yy, C.red, true);
    if (t >= e[1])
        g.text(x + w / 2, yy + 17, '× 유실', C.redText, 11, 'center');
}
else {
    if (t >= e[1])
        arrow(g, from, yy, to, yy, c);
    else
        g.line(from, yy, from + (to - from) * p(t, e[0], e[1]), yy, c);
    dot(g, t, e[0], e[1], from, yy, to, yy, c);
} }); return y + rows * 64 + 68; }
function panelNotes(g: ReturnType<typeof draw>, at: number, w: number, texts: readonly string[]) { let yy = at; for (const a of texts)
    yy = lines(g, 0, yy, a, w, C.muted, 11) + 8; return yy; }
function bdp(w: number, t: number): LessonFrame { const g = draw(), s = state('N02', t); let base = lines(g, 0, 14, '100 Mbps × 40 ms ÷ 8 = 500,000 B', w, C.ink, 12, true) + 20; const ps = pair(w, 240); for (let i = 0; i < 2; i++) {
    const q = ps[i], x = q.x, y = base + q.y, ww = q.w;
    g.text(x, y, i ? '윈도 500,000 B' : '윈도 64,000 B', C.ink, 12, 'left', true);
    g.rect(x, y + 22, ww, 182);
    g.text(x + 12, y + 46, '송신             경로             수신', C.muted, 10.5);
    g.rect(x + 12, y + 66, ww - 24, 24, '#fff');
    const fill = (ww - 24) * (i ? 1 : .128) * p(t, 1100, 2200);
    if (fill > 0)
        g.rect(x + 12, y + 66, fill, 24, '#e7f5ff', C.blue);
    g.text(x + 12, y + 113, i ? '경로 용량 500 kB' : '경로의 12.8%만 채움', C.blueText, 11);
    arrow(g, x + ww - 12, y + 137, x + 12, y + 137, t >= 5000 ? C.green : C.line);
    dot(g, t, 3500, 5000, x + ww - 12, y + 137, x + 12, y + 137, C.green);
    g.text(x + 12, y + 167, '누적 ACK 왕복', C.muted, 11);
    g.text(x, y + 231, `처리량 상한 ${i ? s.largeMbps : s.smallMbps} Mbps`, C.greenText, 12);
} return { ops: g.ops, height: base + ps[1].y + 252, status: s.phase }; }
function handshake(w: number, t: number): LessonFrame { const g = draw(), s = state('N04', t); const end = seq(g, w, t, [[1100, 1700, 'SYN  seq=1000', 0], [2300, 2900, 'SYN/ACK  seq=5000 ack=1001', 1], [3500, 4100, 'ACK  seq=1001 ack=5001', 0], [4400, 5000, 'DATA  seq=1001 len=1460', 0], [5200, 5800, 'ACK  ack=2461 rwnd=8192', 1]]); let h = panelNotes(g, end, w, [`클라이언트 ${s.client}`, `서버 ${s.server}`, `수신 DATA ${s.receivedBytes} B · 알려진 rwnd ${s.window === null ? '—' : s.window + ' B'}`]); return { ops: g.ops, height: h, status: s.phase }; }
function congestion(w: number, t: number): LessonFrame { const g = draw(), s = state('N05', t), x = 30, ww = w - 42, y = 42, h = 230; g.text(0, 14, 'cwnd / SMSS   (1 SMSS = 1,460 B)', C.ink, 11, 'left', true); for (let n = 0; n <= 10; n += 2) {
    const yy = y + h - n * h / 11;
    g.line(x, yy, w - 6, yy, C.grid);
    g.text(x - 8, yy + 4, n, C.muted, 11, 'right');
} const xx = (tm: number) => x + (tm - 1300) / 9300 * ww, yy = (n: number) => y + h - n * h / 11; g.line(x, yy(s.threshold), w - 6, yy(s.threshold), C.orange, true); g.text(w - 6, yy(s.threshold) - 8, `ssthresh ${s.threshold}`, C.orangeText, 11, 'right'); const pts = s.points; pts.forEach((a, i) => { if (i)
    g.line(xx(pts[i - 1][0]), yy(pts[i - 1][1]), xx(a[0]), yy(a[1]), a[0] === 7000 ? C.red : C.blue); g.circle(xx(a[0]), yy(a[1]), 3, a[0] === 7000 ? C.red : C.blue); }); g.text(x, y + h + 27, '연출 시간 →', C.muted, 11); if (t >= 7000)
    g.text(xx(7000), y + h - 10, 'RTO', C.redText, 11, 'center'); let end = lines(g, 0, y + h + 60, `cwnd ${s.cwnd} SMSS = ${(s.cwnd * 1460).toLocaleString()} B`, w, C.blueText, 12, true); end = panelNotes(g, end + 12, w, ['ssthresh 전: 새 데이터 ACK에 따른 증가', 'ssthresh 후: RTT당 약 1 SMSS 증가', 'RTO: FlightSize 10 → ssthresh 5 / cwnd 1']); return { ops: g.ops, height: end, status: s.phase }; }
function retransmit(w: number, t: number): LessonFrame { const g = draw(), s = state('N06', t), ps = pair(w, 600); for (let i = 0; i < 2; i++) {
    const q = ps[i];
    const events: SequenceEvent[] = i ? [[1100, 1700, '1번 DATA', 0, 'loss'], [2100, 2400, '2번 DATA', 0], [2400, 2700, '중복 ACK 1', 1], [2900, 3200, '3번 DATA', 0], [3200, 3500, '중복 ACK 2', 1], [3700, 4000, '4번 DATA', 0], [4000, 4300, '중복 ACK 3', 1], [4900, 5500, '1번 재전송', 0]] : [[1100, 1700, '1번 DATA', 0, 'loss'], [2400, 3600, '후속 DATA 없음', 0, 'wait'], [6300, 7000, 'RTO → 1번 재전송', 0]];
    g.text(q.x, q.y + 14, i ? '후속 있음 · 빠른 재전송' : '후속 없음 · RTO', C.ink, 12, 'left', true);
    seq(g, q.w, t, events, '송신', '수신', q.x, q.y + 28);
    const st = i ? s.fast : s.rto;
    g.text(q.x, q.y + 575, `중복 ACK ${st.dupacks} · ${st.delivered ? '복구 완료' : st.retransmitted ? '재전송 중' : '대기'}`, st.delivered ? C.greenText : C.muted, 11);
} return { ops: g.ops, height: ps[1].y + 600, status: s.phase }; }
function layers(w: number, t: number): LessonFrame { const g = draw(), s = state('N07', t); let yy = 12; ['payload · MSS 1,460 B', 'TCP segment · 1,480 B', 'IP packet · MTU 1,500 B', 'Ethernet frame · 1,518 B'].forEach((label, i) => { const on = s.level >= i; g.rect(i * 6, yy, w - i * 12, 55, on ? '#e7f5ff' : '#fff', on ? C.blue : C.line); lines(g, i * 6 + 12, yy + 23, label, w - i * 12 - 24, on ? C.blueText : C.muted, 11, true); yy += 75; }); yy += 6; s.parts.forEach(v => { g.text(10, yy, v.label, C.ink, 12); g.text(w - 10, yy, `${v.bytes.toLocaleString()} B`, C.muted, 12, 'right'); yy += 28; }); yy = lines(g, 0, yy + 12, 'IP MTU 제외: L2 header / FCS', w, C.orangeText, 11); return { ops: g.ops, height: yy + 8, status: s.phase }; }
function bbr(w: number, t: number): LessonFrame {
    const g = draw(), s = state('N08', t), ps = pair(w, 400);
    for (let i = 0; i < 2; i++) {
        const q = ps[i], x = q.x, y = q.y, ww = q.w;
        g.text(x, y + 14, i ? 'BBRv1 · 관측 모델' : 'Reno · 손실 신호', C.ink, 12, 'left', true);
        if (!i) {
            let yy = lines(g, x, y + 58, '3개의 중복 ACK → 손실 추정', ww, C.redText, 12);
            g.rect(x, yy + 16, ww, 75, '#fff');
            g.text(x + 12, yy + 40, 'FlightSize 20 SMSS', C.ink, 12);
            g.text(x + 12, yy + 65, `ssthresh ${s.renoThreshold} SMSS`, C.orangeText, 12);
            lines(g, x, yy + 130, '선택한 Reno 사건의 결정 기준만 비교합니다. CUBIC 성능 곡선은 그리지 않습니다.', ww, C.muted, 11);
        }
        else {
            let yy = lines(g, x, y + 55, 'BtlBw 100 Mbps / RTprop 40 ms', ww, C.blueText, 11);
            g.text(x, yy + 14, `BDP ${s.bbrBdp.toLocaleString()} B`, C.ink, 11);
            const pw = ww - 28;
            const gx = x + 24, gy = yy + 45;
            [.75, 1, 1.25].forEach(v => { const hy = gy + (1.35 - v) * 140; g.line(gx, hy, x + ww, hy, C.grid); g.text(gx - 4, hy + 3, v, C.muted, 10, 'right'); });
            probeGains.forEach((gain, j) => { const xx = gx + j * (pw / 7), hy = gy + (1.35 - gain) * 140; if (t >= 2000 + j * 1000) {
                if (j)
                    g.line(gx + (j - 1) * (pw / 7), gy + (1.35 - probeGains[j - 1]) * 140, xx, hy, C.blue);
                g.circle(xx, hy, 3, j === s.step ? C.orange : C.blue);
            } });
            g.text(x, gy + 120, `pacing gain ${s.gain} · ${s.rateMbps} Mbps`, C.blueText, 11);
            g.rect(x, gy + 141, ww, 16, '#fff');
            if (s.queueBytes > 0)
                g.rect(x, gy + 141, ww * s.queueBytes / 125000, 16, '#fff4e6', C.orange);
            g.text(x, gy + 185, `설명용 큐 ${s.queueBytes.toLocaleString()} B`, C.orangeText, 11);
        }
    }
    return { ops: g.ops, height: ps[1].y + 405, status: s.phase };
}
function nagle(w: number, t: number): LessonFrame {
    const g = draw(), s = state('N09', t), ps = pair(w, 335);
    for (let i = 0; i < 2; i++) {
        const q = ps[i], y = q.y;
        g.text(q.x, y + 14, i ? 'TCP_NODELAY=1' : 'Nagle on', C.ink, 12, 'left', true);
        seq(g, q.w, t, [[1100, 1700, '작은 쓰기 A', 0], [nagleAckTiming.sentAt, nagleAckTiming.receivedAt, '확인 ACK', 1], [i ? 2500 : nagleAckTiming.receivedAt, i ? 3100 : 5200, '작은 쓰기 B', 0]], '송신', '수신', q.x, y + 28);
        const st = i ? s.nodelay : s.nagle;
        g.text(q.x, y + 316, `B: ${st.secondSent ? '전송' : 'ACK 대기'}`, st.secondSent ? C.blueText : C.orangeText, 12);
    }
    return { ops: g.ops, height: ps[1].y + 342, status: s.phase };
}
function close(w: number, t: number): LessonFrame { const g = draw(), s = state('N10', t), end = seq(g, w, t, [[1100, 1700, 'FIN', 0], [2300, 2900, 'ACK', 1], [3500, 4200, 'FIN', 1], [4700, 5300, '마지막 ACK', 0, 'loss'], [6500, 7200, 'RTO → FIN 재전송', 1], [7800, 8500, 'ACK 재응답', 0]], '능동 종료', '수동 종료'); const h = panelNotes(g, end, w, [`능동: ${s.active}`, `수동: ${s.passive}`, s.active === 'CLOSED' ? '압축한 2MSL 만료 → 이전 상태 해제' : s.active === 'TIME_WAIT' ? '같은 4-tuple의 이전 연결 상태 유지' : s.active === 'ESTABLISHED' ? '연결 사용 중 · 종료 시작 전' : 'FIN/ACK 교환 · 종료 진행 중', 'TIME_WAIT은 모든 로컬 포트를 잠그는 상태가 아닙니다.']); return { ops: g.ops, height: h, status: s.phase }; }
function hol(w: number, t: number): LessonFrame { const g = draw(), s = state('N11', t); const end = seq(g, w, t, [[1100, 1700, 'DATA 1', 0], [1900, 2500, 'DATA 2', 0, 'loss'], [2700, 3300, 'DATA 3', 0], [3600, 4200, 'DATA 4', 0], [6100, 6700, 'DATA 2 재전송', 0]]); g.text(0, end, '수신 버퍼', C.muted, 11, 'left', true); [1, 2, 3, 4].forEach((n, i) => { const xx = i * (w / 4); const wait = s.buffer.includes(n), done = s.delivered.includes(n); g.rect(xx, end + 14, w / 4 - 8, 38, wait ? '#fff4e6' : done ? '#e6fcf5' : '#fff', wait ? C.orange : C.line); g.text(xx + (w / 4 - 8) / 2, end + 38, n, wait ? C.orangeText : done ? C.greenText : C.muted, 12, 'center'); }); let h = lines(g, 0, end + 84, `앱 전달: ${s.delivered.join(' → ') || '없음'}`, w, C.greenText, 12, true); return { ops: g.ops, height: h + 8, status: s.phase }; }
function keepalive(w: number, t: number): LessonFrame {
    const g = draw(), s = state('N12', t), ps = pair(w, 345);
    for (let i = 0; i < 2; i++) {
        const q = ps[i];
        g.text(q.x, q.y + 14, i ? '응답 없음' : '응답 있음', C.ink, 12, 'left', true);
        const events: SequenceEvent[] = i ? [[3500, 4100, 'probe 1 · idle 30 s', 0], [5000, 5600, 'probe 2 · +10 s', 0], [6500, 7100, 'probe 3 · +10 s', 0]] : [[3500, 4100, 'probe · idle 30 s', 0], [4100, 4500, 'TCP ACK', 1]];
        seq(g, q.w, t, events, '확인 측', '상대', q.x, q.y + 30);
        lines(g, q.x, q.y + 296, i ? (s.failed ? '마지막 10 s 대기 → 실패' : `전송 probe ${s.unanswered}/3`) : (s.idleReset ? '응답 도착 → idle 재시작' : 'idle 만료 대기'), q.w, i && s.failed ? C.redText : C.greenText, 11);
    }
    return { ops: g.ops, height: ps[1].y + 352, status: s.phase };
}
function reuse(w: number, t: number): LessonFrame {
    const g = draw(), s = state('N13', t), ps = pair(w, 440);
    for (let i = 0; i < 2; i++) {
        const q = ps[i], x = q.x, y = q.y, ww = q.w;
        g.text(x, y + 14, i ? '한 연결 재사용' : '매번 새 연결', C.ink, 12, 'left', true);
        for (let n = 0; n < 3; n++) {
            const start = i ? [1100, 3500, 5300][n] : [1100, 3600, 6100][n], yy = y + 47 + n * 82;
            g.rect(x, yy, ww, 64, '#fff', t >= start ? C.blue : C.line);
            g.text(x + 12, yy + 23, `요청 ${n + 1}`, C.ink, 12, 'left', true);
            g.text(x + 12, yy + 47, i && n ? '기존 연결 → GET → 응답' : 'handshake → GET → 응답', t >= start ? C.blueText : C.muted, 11);
            dot(g, t, start, start + 1200, x + 12, yy + 59, x + ww - 12, yy + 59, C.green);
        }
        const st = i ? s.reuse : s.fresh;
        g.text(x, y + 327, `GET ${st.requests} · handshake ${st.handshakes}`, C.ink, 12);
        lines(g, x, y + 354, i && s.reuse.closed ? 'Connection: close → 종료' : 'HTTP/1.1 · 직렬 요청', ww, C.muted, 11);
    }
    return { ops: g.ops, height: ps[1].y + 410, status: s.phase };
}
const waterfallRows: WaterfallRow[] = [['DNS', 0, 40, 1100, 1600], ['TCP', 40, 120, 1600, 2400], ['TLS', 120, 200, 2400, 3200], ['첫 바이트 대기', 200, 320, 3200, 3900], ['HTML 수신', 320, 380, 3900, 4900], ['CSS', 380, 490, 5000, 6300], ['JS', 400, 540, 5300, 7000]];
function waterfall(w: number, t: number): LessonFrame { const g = draw(), s = state('W01', t), narrow = w < 420, barX = narrow ? 0 : 112, barW = w - barX, step = narrow ? 75 : 51; g.text(0, 14, '설명용 0–540 ms', C.muted, 11); waterfallRows.forEach((r, i) => { const yy = 46 + i * step; g.text(0, yy, r[0], C.ink, 12); const by = narrow ? yy + 13 : yy - 12; g.line(barX, by + 9, w, by + 9, C.grid); g.rect(barX + barW * r[1] / 540, by, Math.max(1, barW * (r[2] - r[1]) / 540), 18, '#fff'); const portion = p(t, r[3], r[4]); if (portion > 0)
    g.rect(barX + barW * r[1] / 540, by, barW * (r[2] - r[1]) / 540 * portion, 18, i >= 4 ? '#e6fcf5' : '#e7f5ff', i >= 4 ? C.green : C.blue); g.text(w, yy + (narrow ? 52 : 22), `${r[1]}–${r[2]} ms`, C.muted, 10.5, 'right'); }); let end = lines(g, 0, step * 7 + 78, `TTFB ${s.firstByte ? '도착' : '대기'} / HTML ${s.htmlComplete ? '완료' : '수신 전 / 수신 중'}`, w, C.blueText, 11); return { ops: g.ops, height: end + 10, status: s.phase }; }
function gzip(w: number, t: number): LessonFrame { const g = draw(), s = state('W02', t), ps = pair(w, 320); for (let i = 0; i < 2; i++) {
    const q = ps[i], x = q.x, y = q.y, ww = q.w;
    g.text(x, y + 14, i ? 'Content-Encoding: gzip' : 'Content-Encoding: identity', C.ink, 11, 'left', true);
    let yy = lines(g, x, y + 55, `${i ? s.gzipBytes.toLocaleString() : s.rawBytes.toLocaleString()} B 전송`, ww, C.blueText, 13, true);
    g.rect(x, yy + 20, ww, 26, '#fff');
    const amount = i ? s.gzipSentBytes / s.gzipBytes : s.rawSentBytes / s.rawBytes;
    if (amount > 0)
        g.rect(x, yy + 20, ww * (i ? s.gzipBytes / s.rawBytes : 1) * amount, 26, '#e7f5ff', C.blue);
    g.text(x, yy + 75, `상태: ${i ? t < s.gzipSendAt ? '압축 중' : s.gzipReceived ? '수신 완료' : '전송 중' : s.rawReceived ? '수신 완료' : t < 1600 ? '전송 전' : '전송 중'}`, C.muted, 11);
    const restored = i ? s.decoded : s.rawReceived;
    g.rect(x, yy + 102, ww, 62, restored ? '#e6fcf5' : '#fff', restored ? C.green : C.line);
    g.text(x + 12, yy + 126, restored ? '같은 JSON 500행' : '복원 / 수신 대기', restored ? C.greenText : C.muted, 12);
    g.text(x + 12, yy + 149, '원문 18,891 B', C.muted, 11);
    if (i)
        lines(g, x, yy + 201, 'gzip 수신 완료 → decode → 사용', ww, C.orangeText, 11);
} return { ops: g.ops, height: ps[1].y + 350, status: s.phase }; }
function etag(w: number, t: number): LessonFrame { const g = draw(), s = state('W04', t); const end = seq(g, w, t, [[1500, 2300, 'GET If-None-Match: v1', 0], [2800, 3500, '304 · 새 본문 0 B', 1], [5700, 6400, 'GET If-None-Match: v1', 0], [7200, 7800, '200 · ETag v2 + 본문', 1]], '브라우저', '서버'); let yy = lines(g, 0, end, `저장 태그: ${s.changed.tag} · 304 후 본문 v1 재사용`, w, C.greenText, 12, true); const texts = ['no-cache: 저장 가능, 사용 전 재검증', 'no-store: 새 응답 저장 금지', 'must-revalidate: stale 응답 재사용 금지', 'unsafe 성공 요청: 대상 URI 캐시 무효화']; yy = panelNotes(g, yy + 14, w, texts); return { ops: g.ops, height: yy, status: s.phase }; }
function streams(w: number, t: number): LessonFrame { const g = draw(), s = state('W05', t); const end = seq(g, w, t, [[1500, 2200, 'TCP 범위 A · stream 1', 0, 'loss'], [2600, 3300, 'TCP 범위 B · stream 3', 0], [3600, 4300, 'TCP 범위 C · stream 5', 0], [6500, 7200, '범위 A 재전송', 0]], 'TCP 송신', 'TCP 수신'); let yy = lines(g, 0, end, 'HTTP/2 분배 (TCP 위 계층)', w, C.ink, 12, true); [1, 3, 5].forEach((n, i) => { g.rect(0, yy + i * 51, w, 40, s.deliveredStreams.includes(n) ? '#e6fcf5' : '#fff'); g.text(12, yy + i * 51 + 26, `stream ${n}`, C.ink, 12); g.text(w - 12, yy + i * 51 + 26, s.deliveredStreams.includes(n) ? '분배 완료' : '바이트 대기', s.deliveredStreams.includes(n) ? C.greenText : C.orangeText, 11, 'right'); }); return { ops: g.ops, height: yy + 163, status: s.phase }; }
function statusCodes(w: number, t: number): LessonFrame {
    const g = draw(), s = state('W06', t), ps = pair(w, 362);
    for (let i = 0; i < 2; i++) {
        const q = ps[i], x = q.x, y = q.y, ww = q.w;
        let yy = lines(g, x, y + 14, i ? '대상 representation이 없음' : '정상 endpoint / 데이터 없음', ww, C.ink, 12, true);
        for (let n = 0; n < 2; n++) {
            g.rect(x, yy + 18 + n * 119, ww, 100, '#fff');
            lines(g, x + 12, yy + 42 + n * 119, n ? s.endpoint.collection : s.endpoint.single, ww - 24, C.muted, 11);
            g.text(x + 12, yy + 73 + n * 119, '조회 결과 없음', C.muted, 11);
            g.text(x + ww - 12, yy + 101 + n * 119, t >= 4000 ? i ? '404' : '200' : '—', i ? C.orangeText : C.blueText, 16, 'right', true);
        }
    }
    let yy = ps[1].y + 390;
    yy = lines(g, 0, yy, '별도 전제: 컬렉션 리소스는 존재하고 검색 결과만 없음 → 200 + []', w, C.muted, 11);
    return { ops: g.ops, height: yy + 8, status: s.phase };
}
export const networkRenderers: Record<NetworkFigureId, (width: number, elapsed: number) => LessonFrame> = { N02: bdp, N04: handshake, N05: congestion, N06: retransmit, N07: layers, N08: bbr, N09: nagle, N10: close, N11: hol, N12: keepalive, N13: reuse, W01: waterfall, W02: gzip, W04: etag, W05: streams, W06: statusCodes };
