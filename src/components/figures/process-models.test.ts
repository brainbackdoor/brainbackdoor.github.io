import { describe, expect, it } from 'vitest';
import { E01, E01_DASHES, E01_NODES, E02, E02_ROWS, E03_CARDS, E03_PATH, E04_ARROWS, E04_MANAGEMENT, E05, E05_HISTORY, e01, e02, e05, processInfo, type ProcessFigureId } from './process-models';
import { processRenderers } from './processCanvas';
import type { DrawOp, LessonFrame } from './lessonCanvas';

const ids = processInfo.map(item => item.id) as ProcessFigureId[];
const info = (id: ProcessFigureId) => processInfo.find(i => i.id === id)!;
const loop = (id: ProcessFigureId, step = 50) => Array.from({ length: Math.floor(info(id).duration / step) + 1 }, (_, i) => i * step);
type Text = Extract<DrawOp, { type: 'text' }>;
const texts = (f: LessonFrame) => f.ops.filter((o): o is Text => o.type === 'text');
const said = (f: LessonFrame) => texts(f).filter(o => (o.alpha ?? 1) > 0).map(o => o.text).join(' ') + ' ' + f.status;
const final = (id: ProcessFigureId, w = 650) => processRenderers[id](w, info(id).final);
// 본문 650/346/284, 목록 안 625/321/259, 체크리스트 안 647/343/281
const ARTICLE_WIDTHS = [650, 647, 625, 346, 343, 321, 284, 281, 259];

describe('B07 process models keep the source meaning', () => {
  it('covers the five process figures', () => {
    expect(ids).toEqual(['E01', 'E02', 'E03', 'E04', 'E05']);
    for (const item of processInfo) expect(item.steps.every(t => t <= item.final) && item.final < item.duration, item.id).toBe(true);
  });

  it('E01 keeps the nine nodes, eight forward arrows, three dashed links and the five bubble steps, without a loop back', () => {
    expect(E01_NODES).toHaveLength(9);
    expect(E01.legs).toHaveLength(8);
    expect(E01_DASHES).toEqual([[1, 3], [3, 5], [5, 7]]);
    for (const w of [650, 259]) {
      const s = said(final('E01', w));
      for (const [label] of E01_NODES) expect(s, `${w} ${label}`).toContain(label);
      for (const chip of ['Mock 서버', 'DTO 정의', '문서화', '(TDD)']) expect(s).toContain(chip);
    }
    // 각 산출물은 들어오는 실선이 닿을 때 켜진다
    const s = e01(0);
    E01_NODES.forEach((_, i) => { if (i > 0) expect(s.on[i]).toBe(E01.legs[i - 1][1]); });
    expect(info('E01').caption).toContain('되돌아가는 화살표가 없어');
  });

  it('E02 follows the test code: what runs, what is a @MockBean and what is out of scope', () => {
    expect(E02_ROWS.map(r => r.cells.join(' '))).toEqual(['run run run run db', 'web out out mock out', 'out run out mock out', 'out out out run h2', 'out out run out out']);
    expect(E02_ROWS.map(r => r.driver)).toEqual(['RestAssured', 'MockMvc', '직접 호출 ×10', '@DataJpaTest', '직접 호출']);
    const s = said(final('E02')) + ' ' + info('E02').caption;
    for (const v of ['@BeforeEach', 'databaseCleanup.execute()', 'SET foreign_key_checks = 0', 'SET foreign_key_checks = 1', 'entityManager.flush()', 'h2', 'MockBean']) expect(s).toContain(v);
    expect(s).not.toMatch(/우수|더 낫|MySQL/);
  });

  it('E02 never lets a scenario see the rows of the previous one', () => {
    for (const t of loop('E02')) expect(e02(t).rows, `${t}`).toBeLessThanOrEqual(1);
    expect(e02(E02.clean[3]).rows).toBe(0);
    expect(e02(E02.acc2[0]).rows).toBe(0);
    expect(e02(E02.acc2[1]).rows).toBe(1);
  });

  it('E03 runs command → event → policy → command and command → system → event with the board labels', () => {
    const kind = (id: string) => E03_CARDS.find(c => c.id === id)!.kind;
    expect(E03_PATH.map(kind)).toEqual(['command', 'event', 'policy', 'command', 'event', 'policy', 'command', 'system', 'event']);
    const s = said(final('E03', 650));
    for (const c of E03_CARDS) expect(s, c.text).toContain(c.text.split(' ')[0]);
    for (const b of ['회원', '인증', 'referer가']) expect(s).toContain(b);
    // 탐험 단계의 중복 카드는 첫 정지 장면에서 이미 지워져 있다
    const step1 = texts(processRenderers.E03(650, info('E03').steps[0])).filter(o => o.text.includes('약관을')).length;
    expect(step1).toBe(1);
  });

  it('E04 keeps the original arrows: no line from Kafka to BATCH, none into MANAGEMENT', () => {
    expect(E04_ARROWS).toHaveLength(10);
    expect(E04_ARROWS.map(([a, b]) => `${a}→${b}`)).not.toContain('kafka→workflow');
    expect(E04_ARROWS.flat().some(n => String(n).toLowerCase().includes('management'))).toBe(false);
    const s = said(final('E04', 259)) + ' ' + said(final('E04', 650));
    for (const tool of ['Vert.x', 'Kafka', 'Hive', 'Tez', 'Spark MLlib', 'Parquet', 'Elasticsearch', 'Kafka Connect', 'Kafka Streams', 'Drill', 'Netty', 'gRPC', 'Service Application', ...E04_MANAGEMENT.map(m => m[0])]) expect(s, tool).toContain(tool);
    for (const tool of ['InfluxDB', 'JMXTrans', 'Grafana', 'Coda', 'Kibana', 'Nomad', 'YARN', 'Ansible', 'Consul', 'Azkaban']) expect(s, tool).toContain(tool);
  });

  it('E05 retries the unfinished Activity and replays the finished ones from the history', () => {
    expect(E05_HISTORY).toHaveLength(6);
    // 금액 계산은 예약된 카드 하나에 결과가 채워진다(시도마다 카드를 늘리지 않음)
    expect(e05(E05.crash + 100).calcResult).toBe(false);
    expect(e05(E05.calcRep[1]).calcResult).toBe(true);
    // 재시도 결과가 기록된 뒤에야 Replay가 시작되고, Replay 중 완료된 Activity는 실행 막대 없이 기록값을 쓴다
    expect(E05.calcRep[1]).toBeLessThan(E05.replay[0]);
    expect(e05(E05.replayLines[1]).bLines.slice(0, 2)).toEqual([true, true]);
    const s = said(final('E05', 650)) + ' ' + info('E05').caption;
    for (const v of ['WorkflowStarted', 'Activity: 데이터 수집', '50,000', 'TimerStarted', 'Signal: 승인', 'Worker A', 'Worker B', 'Event History로 Replay', '프로세스 죽음', '재시도']) expect(s, v).toContain(v);
    expect(s).not.toMatch(/1회만 실제 실행|1회차에만/);
  });

  it('keeps secrets and host identifiers out of every scene and caption', () => {
    for (const item of processInfo) for (const w of [650, 259]) for (const t of [...item.steps, item.final]) {
      const f = said(processRenderers[item.id](w, t)) + ' ' + item.caption + ' ' + item.notes.join(' ');
      for (const bad of [/\b\d{1,3}(\.\d{1,3}){3}\b/, /withPassword|withUsername|password|pw:/i, /Bearer\s+\S+/, /project-key/i]) expect(f, `${item.id} ${bad}`).not.toMatch(bad);
    }
  });
});

describe('B07 scenes stay readable at every article width', () => {
  it('keeps visible labels apart and inside the figure through the whole loop, also between the measured widths', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const box = (o: Text) => { const w = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x; return { x1: x, x2: x + w, y1: o.y - o.size * 0.8, y2: o.y + o.size * 0.22 }; };
    const sweep = [...Array.from({ length: 31 }, (_, i) => 259 + i * 13), 560].filter(w => !ARTICLE_WIDTHS.includes(w));
    const plan = [...ARTICLE_WIDTHS.map(w => [w, 100] as const), ...sweep.map(w => [w, 200] as const)];
    const issues: string[] = [];
    for (const item of processInfo) for (const [w, step] of plan) for (let t = 0; t <= item.duration; t += step) {
      const f = processRenderers[item.id](w, t);
      const bs = texts(f).filter(o => o.text.trim() && (o.alpha ?? 1) > 0.5).map(o => ({ o, ...box(o) }));
      for (const b of bs) if (b.x1 < -1 || b.x2 > w + 1 || b.y2 > f.height + 2) issues.push(`${item.id} ${w} ${t} outside ${b.o.text}`);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (a.o.text === b.o.text && Math.abs(a.o.x - b.o.x) < 3 && Math.abs(a.o.y - b.o.y) < 3) continue;
        if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2) issues.push(`${item.id} ${w} ${t} ${a.o.text} / ${b.o.text}`);
      }
    }
    expect([issues.length, ...new Set(issues.map(i => i.split(' ').slice(0, 2).join(' ')))], issues.slice(0, 8).join('\n')).toEqual([0]);
  });

  it('keeps lines and arrows off the labels (a line never runs through a visible word)', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const issues = new Set<string>();
    for (const item of processInfo) for (const w of [650, 560, 346, 284, 259]) for (const t of [...item.steps, item.final]) {
      const f = processRenderers[item.id](w, t);
      const boxes = texts(f).filter(o => o.text.trim() && o.text !== '—' && (o.alpha ?? 1) > 0.5).map(o => { const tw = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - tw / 2 : o.align === 'right' ? o.x - tw : o.x; return { t: o.text, x1: x + 1, x2: x + tw - 1, y1: o.y - o.size * 0.7, y2: o.y + o.size * 0.1 }; });
      for (const o of f.ops) {
        if (o.type !== 'path' || o.fill !== 'none' || !/^M[^A-Z]*L[^A-Z]*(L[^A-Z]*)*$/.test(o.d)) continue;
        const pts = [...o.d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
          for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; for (const b of boxes) if (x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2) issues.add(`${item.id} ${w} ${t} ${b.t}`); }
        }
      }
    }
    expect([...issues]).toEqual([]);
  });

  it('never paints a filled shape over a label drawn before it', () => {
    // 명령마다 끝점만 읽는다(호 A는 마지막 두 수, H/V는 한 좌표)
    const box = (d: string) => {
      let x = 0, y = 0; const xs: number[] = [], ys: number[] = [];
      for (const [, cmd, args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) { const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number); if (cmd === 'H') x = n[n.length - 1]; else if (cmd === 'V') y = n[n.length - 1]; else if (cmd !== 'Z') { x = n[n.length - 2]; y = n[n.length - 1]; } if (cmd !== 'Z') { xs.push(x); ys.push(y); } }
      return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
    };
    const issues = new Set<string>();
    for (const item of processInfo) for (const w of [650, 284]) for (const t of [...item.steps, item.final]) {
      const ops = processRenderers[item.id](w, t).ops;
      ops.forEach((o, i) => {
        if (o.type !== 'text' || !o.text.trim()) return;
        for (const q of ops.slice(i + 1)) if (q.type === 'path' && q.fill !== 'none' && q.alpha > 0.5) { const b = box(q.d); if (o.x > b.x1 && o.x < b.x2 && o.y - 3 > b.y1 && o.y - 3 < b.y2) issues.add(`${item.id} ${w} ${o.text}`); }
      });
    }
    expect([...issues]).toEqual([]);
  });

  it('draws settled scenes at every static step: nothing moves or fades 60 ms later', () => {
    const issues: string[] = [];
    for (const item of processInfo) for (const w of [...ARTICLE_WIDTHS, 560]) for (const t of [...item.steps, item.final]) {
      if (JSON.stringify(processRenderers[item.id](w, t)) !== JSON.stringify(processRenderers[item.id](w, t + 60))) issues.push(`${item.id} ${w} ${t}`);
    }
    expect(issues).toEqual([]);
  });

  it('keeps the frame height fixed through the loop so the article does not jump', () => {
    for (const item of processInfo) for (const w of [...ARTICLE_WIDTHS, 560]) {
      const heights = new Set(loop(item.id, 100).map(t => processRenderers[item.id](w, t).height));
      expect([...heights], `${item.id} ${w}`).toHaveLength(1);
    }
  });

  it('keeps every dot inside the figure', () => {
    const issues = new Set<string>();
    for (const item of processInfo) for (const w of ARTICLE_WIDTHS) for (let t = 0; t <= item.duration; t += 100) for (const o of processRenderers[item.id](w, t).ops) {
      if (o.type === 'circle' && (o.x - o.r < -1 || o.x + o.r > w + 1)) issues.add(`${item.id} ${w}`);
    }
    expect([...issues]).toEqual([]);
  });

  // 단계마다 상태 문구가 그 장면에 그려진 것만 말한다(다음 사건을 먼저 말하지 않음)
  const STEP_STATUS: Record<ProcessFigureId, [string, string, string]> = {
    E01: ['Acceptance Criteria', '인수테스트', '개발 (TDD)'], E02: ['남았', 'TRUNCATE', 'MockBean'], E03: ['중복', '정책이', '경계'],
    E04: ['적재', 'HDFS에서 읽어', '관리 도구'], E05: ['죽었', '기록된 결과', '기록값을 쓰고'],
  };
  it('describes only what each static step has drawn', () => {
    for (const item of processInfo) item.steps.forEach((t, i) => expect(processRenderers[item.id](650, t).status, `${item.id} ${i + 1}`).toContain(STEP_STATUS[item.id][i]));
  });
});
