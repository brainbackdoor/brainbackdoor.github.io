import { describe, expect, it } from 'vitest';
import { D04, D06, D09_Q1, D09_Q2, D09_Q3, S05_AGES, d01, d02, d04, d05, d06, d08, d09, dataInfo, s02, s05, s06, type DataFigureId } from './data-models';
import { dataRenderers } from './dataCanvas';
import type { DrawOp, LessonFrame } from './lessonCanvas';

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
    expect(said(dataRenderers.D01(650, info('D01').final))).toContain('비동기 복제(기본)');
  });

  it('D02 routes by readOnly and reads the old value before replication applies', () => {
    expect([d02(1400).route, d02(1600).route]).toEqual([null, 'master']);
    expect(d02(3000).route).toBe('slave');
    expect([d02(3400).read1, d02(3400).replicaValue]).toEqual(['A', 'A']);
    expect([d02(6000).read2, d02(6000).masterValue]).toEqual(['B', 'B']);
  });

  it('D04 stops the range scan at 11010 while the function condition reads every row', () => {
    const stop = d04(D04.stop);
    expect([stop.rightFound, stop.rightStopped, stop.leftDone]).toEqual([10, true, false]);
    expect(d04(D04.sweep[1])).toMatchObject({ leftFound: 10, leftDone: true });
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
    expect(said(dataRenderers.D06(650, info('D06').final))).toContain('두 경우 결과는 같은 5행: 100 · 124 · 185 · 270 · 283');
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
    for (const item of dataInfo) for (const w of [650, 284]) for (const t of [...item.steps, item.final]) {
      if (JSON.stringify(dataRenderers[item.id](w, t)) !== JSON.stringify(dataRenderers[item.id](w, t + 60))) issues.push(`${item.id} ${w} ${t}`);
    }
    expect(issues).toEqual([]);
  });

  it('keeps the frame height fixed through the loop so the article does not jump', () => {
    for (const item of dataInfo) for (const w of [650, 284]) {
      const heights = new Set(loop(item.id, 100).map(t => dataRenderers[item.id](w, t).height));
      expect([...heights], `${item.id} ${w}`).toHaveLength(1);
    }
  });
});
