import { describe, expect, it } from 'vitest';
import { D02, D04, D05, D05_INDEX, D06, D08, D09, D09_Q1, D09_Q2, D09_Q3, S02, S05, S05_AGES, S06, d01, d02, d04, d05, d06, d08, d09, dataInfo, s02, s05, s06, type DataFigureId } from './data-models';
import { dataRenderers } from './dataCanvas';
import { C, textW, type DrawOp, type LessonFrame } from './lessonCanvas';

const ids = dataInfo.map(item => item.id) as DataFigureId[];
const info = (id: DataFigureId) => dataInfo.find(i => i.id === id)!;
const loop = (id: DataFigureId, step = 50) => Array.from({ length: Math.floor(info(id).duration / step) + 1 }, (_, i) => i * step);
type Text = Extract<DrawOp, { type: 'text' }>;
const texts = (f: LessonFrame) => f.ops.filter((o): o is Text => o.type === 'text');
const said = (f: LessonFrame) => texts(f).filter(o => (o.alpha ?? 1) > 0).map(o => o.text).join(' ') + ' ' + f.status;
const ARTICLE_WIDTHS = [650, 625, 346, 321, 284, 259];

describe('B05 DB and Spark event models keep the source meaning', () => {
  it('covers the 13 DB, SQL and Spark figures', () => {
    expect(ids).toEqual(['D01', 'D02', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'S01', 'S02', 'S04', 'S05', 'S06']);
    for (const item of dataInfo) { expect(item.final).toBeLessThan(item.duration); expect(item.steps).toHaveLength(3); expect(item.notes).toHaveLength(3); }
  });

  it('D01 answers the commit before shipping and changes the replica only when the applier runs', () => {
    for (const t of loop('D01')) {
      const s = d01(t);
      if (s.relayEvent) expect(s.committed).toBe(true);
      if (s.replicaValue === 'B') expect(s.relayEvent).toBe(true);
    }
    expect(d01(4300)).toMatchObject({ relayEvent: true, replicaValue: 'A' });
    expect(info('D01').caption).toContain('비동기(기본)');
    for (const label of ['커밋 OK', 'relay log', 'SQL(applier) 스레드']) expect(said(dataRenderers.D01(650, info('D01').final))).toContain(label);
  });

  it('D02 routes by readOnly and reads the old value before replication applies', () => {
    expect([d02(D02.lines[1] - 1).route, d02(D02.lines[1]).route, d02(D02.write[1]).route]).toEqual([null, 'master', 'master']);
    expect(d02(D02.read1[1]).route).toBe('slave');
    expect([d02(D02.read1[2]).read1, d02(D02.read1[2]).replicaValue]).toEqual(['A', 'A']);
    expect([d02(D02.read2[2]).read2, d02(D02.read2[2]).masterValue]).toEqual(['B', 'B']);
  });

  it('D04 stops the range scan at 11010 while the function condition reads every row', () => {
    const stop = d04(D04.stop);
    expect([stop.rightFound, stop.rightStopped, stop.leftDone]).toEqual([10, true, false]);
    expect(d04(D04.sweep[1]).leftDone).toBe(true);
    expect(texts(dataRenderers.D04(284, D04.sweep[1])).filter(o => o.text === '10/10')).toHaveLength(2);
  });

  it('D05 returns the same five ids with zero or five table visits', () => {
    const end = d05(info('D05').final);
    expect([end.read, end.tableAccess]).toEqual([5, 5]);
    const f = said(dataRenderers.D05(650, info('D05').final));
    expect(f).toContain('반환 id 5 · 테이블 접근 0회');
    expect(f).toContain('반환 id 5 · 테이블 접근 5회');
  });

  it('D06 reads the five consecutive ProductID=1 entries and stops at key 2', () => {
    expect(d06(D06.stop)).toMatchObject({ read: 5, indexStopped: true });
    expect(said(dataRenderers.D06(650, info('D06').final))).toContain('같은 5행: 100 · 124 · 185 · 270 · 283');
  });

  it('D08 holds four illustrative connections and rejects the fifth with an error', () => {
    for (const t of loop('D08')) expect(d08(t).conns).toBeLessThanOrEqual(4);
    expect(d08(info('D08').final).rejected).toBe(true);
    expect(said(dataRenderers.D08(650, info('D08').final))).toContain('C5 · Too many connections 오류');
  });

  it('D09 shows the top eight rows of the original captures and the QUICK-Stop rank change', () => {
    expect([D09_Q1[0], D09_Q1[7]]).toEqual([[60, 'Camembert Pierrot', 1577], [40, 'Boston Crab Meat', 1103]]);
    expect([D09_Q2[2], D09_Q3[0]]).toEqual([[63, 'QUICK-Stop', 3961], [63, 'QUICK-Stop', '122199.74']]);
    expect(d09(info('D09').final).q3).toBe(true);
    expect(said(dataRenderers.D09(259, info('D09').final))).toContain('수량 3위 → 금액 1위');
  });

  it('S02 sums 3 + 3 = 6 at the driver only after the count action', () => {
    for (const t of loop('S02')) { const s = s02(t); if (s.result !== null) expect([s.action, s.counted, s.result]).toEqual([true, true, 6]); }
  });

  it('S04 keeps the original explain output and leaves the physical plan undrawn', () => {
    const f = said(dataRenderers.S04(650, info('S04').final));
    for (const s of ['[Education#18 AS education#238]', '[education#238]', '원문 출력 없음', '결과 스키마 education: string']) expect(f).toContain(s);
  });

  it('S05 moves eight rows without pushdown and five with it, keeping the same result', () => {
    const end = s05(info('S05').final);
    expect([end.moved, end.moved2]).toEqual([8, 5]);
    expect(S05_AGES.filter(a => a > 30)).toEqual([34, 41, 52, 31, 38]);
    for (const t of loop('S05', 250)) expect(said(dataRenderers.S05(650, t))).not.toContain('PushedFilters');
  });

  it('S06 fills the cache at the first action and recomputes only the lost partition', () => {
    for (const t of loop('S06')) { const s = s06(t); if (s.iterations > 0) expect(s.cacheFilled).toBe(true); }
    expect(s06(info('S06').final)).toMatchObject({ recovered: true, lost: false, iterations: 3 });
  });

  it('keeps invented values and example passwords out of the scenes', () => {
    for (const item of dataInfo) for (const w of [650, 284]) for (const t of [...item.steps, item.final]) {
      const f = said(dataRenderers[item.id](w, t));
      for (const s of ['semi-sync', 'masterpw', 'slavepw', 'replication_pw', '100배']) expect(f, `${item.id} ${s}`).not.toContain(s);
    }
  });
});

describe('B05 scenes stay readable at every article width', () => {
  it('keeps visible labels apart and inside the figure through the whole loop, also between the measured widths', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const box = (o: Text) => { const w = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x; return { x1: x, x2: x + w, y1: o.y - o.size * 0.8, y2: o.y + o.size * 0.22 }; };
    const issues: string[] = [];
    // 실측 지면 폭 6개는 100 ms마다, 창 크기에 따라 생기는 그 사이 폭(259~650, 13px 간격)은 200 ms마다 본다
    // 560은 넓은 배치가 시작되는 폭이자 JS 없는 정적 장면을 그리는 폭이다
    const sweep = [...Array.from({ length: 31 }, (_, i) => 259 + i * 13), 560].filter(w => !ARTICLE_WIDTHS.includes(w));
    const plan = [...ARTICLE_WIDTHS.map(w => [w, 100] as const), ...sweep.map(w => [w, 200] as const)];
    for (const item of dataInfo) for (const [w, step] of plan) for (let t = 0; t <= item.duration; t += step) {
      const f = dataRenderers[item.id](w, t);
      const bs = texts(f).filter(o => o.text.trim() && (o.alpha ?? 1) > 0.5).map(o => ({ o, ...box(o) }));
      for (const b of bs) if (b.x1 < -1 || b.x2 > w + 1 || b.y2 > f.height + 2) issues.push(`${item.id} ${w} ${t} outside ${b.o.text}`);
      for (const o of f.ops) if (o.type === 'rect' && (o.x < -1 || o.x + o.w > w + 1)) issues.push(`${item.id} ${w} ${t} rect`);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (a.o.text === b.o.text && Math.abs(a.o.x - b.o.x) < 3 && Math.abs(a.o.y - b.o.y) < 3) continue;
        if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2) issues.push(`${item.id} ${w} ${t} ${a.o.text} / ${b.o.text}`);
      }
    }
    expect([issues.length, ...new Set(issues.map(i => i.split(' ').slice(0, 2).join(' ')))]).toEqual([0]);
  });

  it('draws settled scenes at every static step: nothing moves or fades 60 ms later', () => {
    const issues: string[] = [];
    for (const item of dataInfo) for (const w of [...ARTICLE_WIDTHS, 560]) for (const t of [...item.steps, item.final]) {
      if (JSON.stringify(dataRenderers[item.id](w, t)) !== JSON.stringify(dataRenderers[item.id](w, t + 60))) issues.push(`${item.id} ${w} ${t}`);
    }
    expect(issues).toEqual([]);
  });

  it('keeps the frame height fixed through the loop so the article does not jump', () => {
    for (const item of dataInfo) for (const w of [...ARTICLE_WIDTHS, 560]) {
      const heights = new Set(loop(item.id, 100).map(t => dataRenderers[item.id](w, t).height));
      expect([...heights], `${item.id} ${w}`).toHaveLength(1);
    }
  });
});

describe('B05 review fixes keep the source meaning and the event timing', () => {
  const textOp = (f: LessonFrame, s: string) => texts(f).find(o => o.text === s);
  const stepStatus = (id: DataFigureId, i: number) => dataRenderers[id](650, info(id).steps[i]).status;

  it('D02 reads with findLines() on master and changes the value only by a separate illustrative write', () => {
    expect(d02(D02.lines[2]).masterValue).toBe('A');
    expect(d02(D02.write[2]).masterValue).toBe('B');
    const f = dataRenderers.D02(650, info('D02').final);
    expect(textOp(f, 'readOnly 아님')).toBeTruthy();
    expect(textOp(f, '쓰기')).toBeTruthy();
    const ts = texts(f).map(o => o.text);
    expect(ts[ts.indexOf('findLines()') + 1]).toBe('readOnly 아님');
  });

  it('D06 colours a table row only when its dot arrives', () => {
    const t = D06.read + D06.hop / 2;
    expect([d06(t).read, d06(t).arrived]).toEqual([1, 0]);
    expect(textOp(dataRenderers.D06(650, t), '1 · 100')!.color).not.toBe(C.greenText);
    expect(textOp(dataRenderers.D06(650, D06.read + D06.hop), '1 · 100')!.color).toBe(C.greenText);
  });

  it('D06 counts the index lookup only after reaching the first entry', () => {
    for (const w of [650, 331, 259]) {
      for (const t of [0, D06.seek[0], D06.seek[1] - 1]) {
        expect(said(dataRenderers.D06(w, t)), `${w} ${t}`).toContain('탐색 0회 + 연속 0항목');
      }
      expect(said(dataRenderers.D06(w, D06.seek[1]))).toContain('탐색 1회 + 연속 0항목');
    }
  });

  it('D09 fades between the mobile quantity and amount tables instead of replacing their identities in one frame', () => {
    const mid = (D09.q3[0] + D09.q3[1]) / 2;
    for (const w of [331, 259]) {
      const quantity = (t: number) => textOp(dataRenderers.D09(w, t), '4958');
      const amount = (t: number) => textOp(dataRenderers.D09(w, t), '122199.74');
      expect(quantity(D09.q3[0])!.alpha).toBe(1);
      expect(quantity(D09.q3[0] + 300)!.alpha).toBeLessThan(1);
      expect(quantity(mid - 1)!.alpha).toBeLessThan(0.001);
      expect(amount(mid)!.alpha).toBe(0);
      expect(amount(mid + 300)!.alpha).toBeGreaterThan(0);
      expect(amount(D09.q3[1] - 1)!.alpha).toBeGreaterThan(0.999);
      expect(amount(D09.q3[1])!.alpha).toBe(1);
      expect(texts(dataRenderers.D09(w, mid)).filter(o => o.y === amount(mid)!.y && (o.alpha ?? 1) > 0)).toHaveLength(0);
    }
  });

  it('D09 separates mobile customer names from values and leaves the rank note its own space', () => {
    for (const w of [259, 261, 284, 306, 331, 346]) for (const [t, rows] of [[D09.q2 + 300, D09_Q2], [info('D09').final, D09_Q3]] as const) {
      const f = dataRenderers.D09(w, t), labels = texts(f);
      rows.forEach(([id, name, value], i) => {
        const customer = labels.find(o => o.text === `${i + 1}. ${id} ${name}`)!;
        const amount = labels.find(o => o.text === String(value) && o.align === 'right')!;
        expect(customer, `${w} ${t} complete customer name`).toBeDefined();
        expect(amount.y - customer.y, `${w} ${name} value on the next line`).toBe(16);
        const note = labels.find(o => o.y === amount.y && o.text.startsWith('수량 '));
        if (note) expect(w - textW(amount.text, amount.size, true) - textW(note.text, note.size), `${w} ${name} rank/value gap`).toBeGreaterThanOrEqual(16);
      });
    }
  });

  it('D05 counts SELECT * results only after the lookup dot arrives at the table', () => {
    const inRange = D05_INDEX.filter(([age]) => age >= 30 && age <= 39);
    for (const w of [650, 284]) for (let i = 0; i < inRange.length; i++) {
      const readAt = D05.read + i * D05.gap, arriveAt = readAt + D05.hop;
      for (const t of [readAt, arriveAt - 1, arriveAt]) {
        const s = d05(t), labels = texts(dataRenderers.D05(w, t)).filter(o => o.text.startsWith('반환 id '));
        expect(labels.map(o => o.text), `${w} ${t}`).toEqual([
          `반환 id ${s.coveringRows} · 테이블 접근 0회`,
          `반환 id ${s.tableRows} · 테이블 접근 ${s.tableAccess}회`,
        ]);
        expect(s.tableRows).toBe(t < arriveAt ? i : i + 1);
      }
    }
  });

  it('D08 keeps active buffers in their slots when sort ends', () => {
    for (const w of ARTICLE_WIDTHS) {
      const before = texts(dataRenderers.D08(w, D08.sort[1] - 1)), after = texts(dataRenderers.D08(w, D08.sort[1]));
      expect(before.find(o => o.text === 'sort')).toBeTruthy();
      expect(after.find(o => o.text === 'sort')).toBeUndefined();
      for (const name of ['Global Buffer', 'C1', 'C2', 'C3', 'C4', 'join']) {
        const a = before.find(o => o.text === name)!, b = after.find(o => o.text === name)!;
        expect([a.x, a.y], `${w} ${name}`).toEqual([b.x, b.y]);
      }
      expect(d08(D08.sort[1])).toMatchObject({ sort: false, join: true, conns: 4 });
    }
  });

  it('S06 increments original reads on arrival and keeps partition recomputation separate', () => {
    for (const w of [650, 284]) {
      for (const t of [0, S06.read[0], S06.read[1] - 1]) expect(said(dataRenderers.S06(w, t))).toContain('원본 읽기 0회');
      expect(said(dataRenderers.S06(w, S06.read[1]))).toContain('원본 읽기 1회');
      expect(said(dataRenderers.S06(w, S06.recompute[1] - 1))).not.toContain('P2 재계산 1회');
      expect(said(dataRenderers.S06(w, S06.recompute[1]))).toContain('원본 읽기 1회 + P2 재계산 1회');
    }
  });

  it('S05 counts a row as moved only when its token reaches Spark', () => {
    const one = (S05.transfer[1] - S05.transfer[0]) / 8;
    expect(s05(S05.transfer[0] + one / 2).moved).toBe(0);
    expect(s05(S05.transfer[0] + one).moved).toBe(1);
    const one2 = (S05.transfer2[1] - S05.transfer2[0]) / 5;
    expect(s05(S05.transfer2[0] + one2 / 2).moved2).toBe(0);
  });

  it('S05 keeps each moving row token on its network path', () => {
    for (const w of [650, 331, 259]) for (const [a, b] of [S05.transfer, S05.transfer2]) {
      for (let t = a; t < b; t += 40) {
        const f = dataRenderers.S05(w, t);
        const row = texts(f).find(o => o.size === 12 && o.mono && /^\d+$/.test(o.text))!;
        const paths = f.ops.filter((o): o is Extract<DrawOp, { type: 'path' }> => o.type === 'path' && o.dash?.join(',') === '3,4');
        const ys = paths.map(o => Number(o.d.match(/^M[\d.-]+ ([\d.-]+)L/)![1]));
        expect(Math.min(...ys.map(y => Math.abs(y - (row.y - 4.3)))), `${w} ${t}`).toBeLessThan(0.01);
      }
    }
  });

  it('D04 lights a row of the function lane only after the cursor passes it', () => {
    // 그리기 도구는 사각형도 path로 내보낸다: 커서는 주황 삼각형, 켜진 칸은 주황 바탕의 작은 path
    const xs = (d: string) => [...d.matchAll(/[MLH]([\d.-]+)/g)].map(m => Number(m[1]));
    for (const t of loop('D04', 50)) {
      const f = dataRenderers.D04(650, t), paths = f.ops.filter((o): o is Extract<DrawOp, { type: 'path' }> => o.type === 'path');
      const cursor = paths.find(o => o.fill === C.orange && /^M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+Z$/.test(o.d));
      const lit = paths.filter(o => o.fill === C.orangeTint && Math.max(...xs(o.d)) - Math.min(...xs(o.d)) < 40);
      if (!cursor) { expect(lit, `${t}`).toHaveLength(0); continue; }
      const tip = xs(cursor.d)[1];
      for (const r of lit) expect((Math.max(...xs(r.d)) + Math.min(...xs(r.d))) / 2, `${t}`).toBeLessThanOrEqual(tip + 0.5);
    }
  });

  it('D04 keeps the moving lookup halo visible without covering the root and branch labels', () => {
    const bounds = (d: string) => {
      let x = 0, y = 0; const xs: number[] = [], ys: number[] = [];
      for (const [, cmd, args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) {
        const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (cmd === 'H') x = n[n.length - 1];
        else if (cmd === 'V') y = n[n.length - 1];
        else if (cmd !== 'Z') { x = n[n.length - 2]; y = n[n.length - 1]; }
        if (cmd !== 'Z') { xs.push(x); ys.push(y); }
      }
      return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
    };
    for (const w of [650, 331, 259]) {
      const visited = new Set<string>();
      let previous: { x: number; y: number } | null = null;
      for (let t = D04.descend[0]; t < D04.descend[1]; t += 10) {
        const f = dataRenderers.D04(w, t);
        const cursor = f.ops.findIndex(o => o.type === 'circle' && o.stroke === C.blue);
        const dot = f.ops[cursor];
        if (dot.type !== 'circle') throw new Error('lookup cursor missing');
        expect(dot.color, `${w} ${t} leaves the label readable`).toBe('none');
        if (previous) expect(Math.hypot(dot.x - previous.x, dot.y - previous.y), `${w} ${t} continuous position`).toBeLessThan(12);
        previous = dot;
        const fills = f.ops.slice(cursor + 1).flatMap(o => o.type === 'path' && o.fill !== 'none' && o.alpha > 0.5 ? [bounds(o.d)] : []);
        const visibleRim = Array.from({ length: 72 }, (_, k) => {
          const angle = k * Math.PI / 36, x = dot.x + dot.r * Math.cos(angle), y = dot.y + dot.r * Math.sin(angle);
          return !fills.some(b => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2);
        });
        expect(visibleRim.some(Boolean), `${w} ${t} halo remains visible`).toBe(true);
        f.ops.forEach((o, i) => {
          if (o.type !== 'text' || !['루트', '브랜치'].includes(o.text)) return;
          if (Math.abs(dot.x - o.x) < 15 && Math.abs(dot.y - (o.y - 3.96)) < 12) {
            visited.add(o.text);
            expect(cursor, `${w} ${t} ${o.text}`).toBeLessThan(i);
          }
        });
      }
      expect([...visited].sort()).toEqual(['루트', '브랜치']);
    }
  });

  it('S02 assigns partitions to executors only at the action', () => {
    for (const t of loop('S02')) if (s02(t).assigned) expect(s02(t).action, `${t}`).toBe(true);
    expect(said(dataRenderers.S02(650, info('S02').steps[1]))).toContain('논리');
    expect(S02.action).toBeLessThanOrEqual(S02.assign);
  });

  it('keeps each static step status and note in line with what the scene draws', () => {
    expect(stepStatus('D06', 0)).not.toContain('읽고');
    expect(textOp(dataRenderers.D07(650, info('D07').steps[1]), '10 id ⋈ employee')!.color).toBe(C.muted);
    expect(textOp(dataRenderers.D09(650, info('D09').steps[0]), '수량 내림차순')!.color).toBe(C.blueText);
    expect(stepStatus('D09', 1)).not.toContain('3번');
    expect(stepStatus('S01', 0)).not.toContain('Structured');
    expect(stepStatus('S04', 1)).not.toContain('Physical');
  });

  it('keeps every dot inside the figure', () => {
    const issues = new Set<string>();
    for (const item of dataInfo) for (const w of ARTICLE_WIDTHS) for (let t = 0; t <= item.duration; t += 100) for (const o of dataRenderers[item.id](w, t).ops) {
      if (o.type === 'circle' && (o.x - o.r < -1 || o.x + o.r > w + 1)) issues.add(`${item.id} ${w}`);
    }
    expect([...issues]).toEqual([]);
  });

  it('labels illustrative values and abbreviated source output as such', () => {
    const all = (id: DataFigureId) => said(dataRenderers[id](650, info(id).final)) + ' ' + info(id).caption;
    expect(all('D05')).not.toMatch(/\(EXPLAIN Extra: Using index\)/);
    expect(all('D04') + all('D06') + all('D08')).toBeTruthy();
    expect(all('S04')).not.toContain('ID→id');
    expect(info('S04').caption).toContain('줄여');
    expect(info('D06').caption).toContain('드라이빙');
    expect(info('D08').caption).toContain('back_log');
    expect(all('S06')).toContain('P2 재계산');
  });
});
