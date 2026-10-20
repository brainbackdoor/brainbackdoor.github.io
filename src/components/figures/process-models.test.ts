import { describe, expect, it } from 'vitest';
import { E01, E01_DASHES, E01_NODES, E02, E02_COLS, E02_ROWS, E03_CARDS, E03_PATH, E04_ARROWS, E04_MANAGEMENT, E05, E05_HISTORY, X05, e01, e02, e02CellAt, e05, processInfo, type ProcessFigureId } from './process-models';
import { processRenderers } from './processCanvas';
import { C, type DrawOp, type LessonFrame } from './lessonCanvas';

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
  it('covers the five B07 process figures and the adopted B08 figure', () => {
    expect(ids).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'X05']);
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
    expect(E02_ROWS.map(r => r.cells.join(' '))).toEqual(['run run run db na', 'web out mock out na', 'out run mock out na', 'out out run h2 na', 'out out out out run']);
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
    const joined = s.replace(/\s+/g, '');
    for (const c of E03_CARDS) expect(joined, c.text).toContain(c.text.replace(/\s+/g, ''));
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
    E01: ['Acceptance Criteria', '개발 (TDD)', 'Business Value'], E02: ['남았', 'TRUNCATE', 'MockBean'], E03: ['중복', '정책이', '경계'],
    E04: ['적재', 'HDFS에서 읽어', '관리 도구'], E05: ['죽었', '기록된 결과', '기록값을 쓰고'], X05: ['그룹', '투표', '칸반보드'],
  };
  it('describes only what each static step has drawn', () => {
    for (const item of processInfo) item.steps.forEach((t, i) => expect(processRenderers[item.id](650, t).status, `${item.id} ${i + 1}`).toContain(STEP_STATUS[item.id][i]));
  });
});

describe('B07 review fixes keep events, steps and source claims honest', () => {
  const header = (f: LessonFrame, name: string) => texts(f).find(o => o.text === name && o.y < 20)!;
  it('E02 lights each cell when the request dot reaches it, and the dot never crosses an out-of-scope cell', () => {
    const issues: string[] = [];
    for (const w of [650, 284]) {
      const names = w >= 560 ? E02_COLS : ['Ctrl', 'Svc', 'Repo', 'DB', '도메인'];
      const cx = names.map(n => header(processRenderers.E02(w, 0), n).x), half = (cx[1] - cx[0]) / 2;
      E02_ROWS.forEach((row, r) => {
        const win = r === 0 ? [E02.acc1] : [E02.rows[r - 1]];
        row.cells.forEach((kind, c) => {
          const at = e02CellAt(r, c);
          if (at === null || kind === 'mock' || at === win[0][0]) return;
          const dots = processRenderers.E02(w, at - 1).ops.filter(o => o.type === 'circle');
          if (!dots.some(d => d.type === 'circle' && Math.abs(d.x - cx[c]) < 3)) issues.push(`${w} ${row.name} ${c} dot not at the cell when it lights`);
        });
        const [a, b] = win[0];
        for (let t = a; t < b; t += 20) for (const d of processRenderers.E02(w, t).ops) {
          if (d.type !== 'circle') continue;
          row.cells.forEach((kind, c) => { if ((kind === 'out' || kind === 'na') && Math.abs(d.x - cx[c]) < half - 4) issues.push(`${w} ${row.name} ${t} dot over ${c}`); });
        }
      });
    }
    expect([...new Set(issues)]).toEqual([]);
  });

  it('E02 judges the domain column only for the unit test and says so', () => {
    expect(E02_COLS).toEqual(['Controller', 'Service', 'Repository', 'DB', '도메인']);
    expect(E02_ROWS.map(r => r.cells[4])).toEqual(['na', 'na', 'na', 'na', 'run']);
    expect(info('E02').caption).toContain('판정하지 않았습니다');
    expect(info('E02').notes.join(' ')).not.toContain('나머지는 @MockBean');
    expect(processRenderers.E02(650, info('E02').steps[1]).status + info('E02').notes[1]).not.toContain('빈 DB에서 시작');
  });

  it('ends every figure with its final scene as the last static step', () => {
    for (const item of processInfo) expect(item.steps.at(-1), item.id).toBe(item.final);
  });

  it('E01 does not interpret the bubble as the inside of Develop', () => {
    for (const w of [650, 284]) for (const t of [...info('E01').steps]) expect(said(processRenderers.E01(w, t)) + info('E01').notes.join(' ')).not.toContain('Develop 안에');
  });

  it('E03 keeps the supplemental board details in the folded notes and leaves them out of the animation', () => {
    for (const w of [650, 284]) {
      const s = said(final('E03', w)).replace(/\s+/g, '');
      const notes = info('E03').notes.join(' ').replace(/\s+/g, '');
      for (const v of ['인증 번호를 인증했다', '카카오 로그인', '구글 로그인', '인증코드 생성', '비밀번호 재설정', '사진 등록', '본인 인증', '비로그인 회원', '휴대폰 번호로 로그인 시도', '조건 표기 없음']) {
        expect(notes, `${w} ${v}`).toContain(v.replace(/\s+/g, ''));
        expect(s, `${w} ${v}`).not.toContain(v.replace(/\s+/g, ''));
      }
    }
    expect(info('E03').notes[2]).toContain('중');
  });

  it('E04 names Netty and gRPC separately and never splits a management tool across lines', () => {
    expect(info('E04').notes.join(' ')).not.toContain('Netty(gRPC)');
    const tools = E04_MANAGEMENT.flatMap(m => m[1].split(' · '));
    for (const w of [650, 560, 284, 259]) {
      const lines = texts(final('E04', w)).map(o => o.text);
      expect(lines.filter(l => l.startsWith('·')), `${w}`).toEqual([]);
      for (const tool of tools) expect(lines.some(l => l.includes(tool)), `${w} ${tool}`).toBe(true);
    }
  });

  it('E05 uses dashed boxes only for recorded results and keeps the retry visible after it happened', () => {
    for (const w of [650, 284]) for (const t of [...info('E05').steps]) for (const o of processRenderers.E05(w, t).ops) {
      if (o.type === 'path' && o.dash) expect(o.stroke, `${w} ${t}`).toBe('#12b886');
    }
    for (const t of info('E05').steps.slice(1)) expect(said(processRenderers.E05(650, t))).toContain('재시도로 완료');
    expect(said(processRenderers.E05(650, E05.replay[1] - 1))).not.toContain('Event History로 Replay');
    expect(said(processRenderers.E05(650, E05.replay[1]))).toContain('Event History로 Replay');
    // 데이터 수집도 Server가 Worker A에 내보낸다(점)
    expect(processRenderers.E05(650, (E05.started + E05.collect[0]) / 2).ops.some(o => o.type === 'circle')).toBe(true);
  });

  it('E05 brings the approval signal down the history card edge on its visible path', () => {
    const distance = (x: number, y: number, a: number[], b: number[]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const q = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a[0] - q * dx, y - a[1] - q * dy);
    };
    for (const w of [650, 331, 259]) for (let t = E05.signal[0]; t < E05.signal[1]; t += 10) {
      const f = processRenderers.E05(w, t);
      const dot = f.ops.find(o => o.type === 'circle' && o.color === C.orange)!;
      if (dot.type !== 'circle') throw new Error('approval signal missing');
      const paths = f.ops.filter((o): o is Extract<DrawOp, { type: 'path' }> => o.type === 'path' && o.fill === 'none' && /^M[^A-Z]*L[^A-Z]*(L[^A-Z]*)*$/.test(o.d));
      const distances = paths.flatMap(o => {
        const pts = [...o.d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
        return pts.slice(1).map((p, i) => distance(dot.x, dot.y, pts[i], p));
      });
      expect(Math.min(...distances), `${w} ${t} off path`).toBeLessThan(0.02);
      const serverW = w >= 560 ? Math.round(w * 0.54) : w;
      if (dot.y >= 62) expect(dot.x, `${w} ${t} crossed history`).toBeGreaterThan(serverW - 12);
    }
  });
});

describe('B08 X05 team retrospective keeps the example cards and the action plan', () => {
  it('shows the two cards, their groups, the chosen group and the action plan with the source wording', () => {
    for (const w of [650, 284]) {
      const s = said(final('X05', w)).replace(/\s+/g, '');
      for (const v of ['블로그 포스팅을 할 수 있었음', '일정이 계속 밀림', '좋은 결과물', '시간 관리 못함', '시간 관리를 위해 칸반보드를 활용한다.', '자료 모으기', '그룹핑', '투표', '액션 플랜']) expect(s, `${w} ${v}`).toContain(v.replace(/\s+/g, ''));
    }
  });

  it('leaves out the nickname, the unlabelled vote counts and priority numbers', () => {
    for (const w of [650, 284]) for (const t of [...info('X05').steps]) {
      const f = processRenderers.X05(w, t), s = said(f) + info('X05').caption + info('X05').notes.join(' ');
      expect(s).not.toContain('씨유');
      expect(texts(f).filter(o => /^[0-9]$/.test(o.text.trim()))).toEqual([]);
    }
  });

  it('chooses a group only at the vote and writes the action plan only after it', () => {
    const before = said(processRenderers.X05(650, info('X05').steps[0]));
    expect(before).not.toContain('칸반보드');
    expect(before).not.toContain('선택');
    const vote = said(processRenderers.X05(650, info('X05').steps[1]));
    expect(vote).toContain('선택');
    expect(vote).not.toContain('칸반보드를');
  });

  it('dims the unchosen group, and its arrow, exactly at the vote', () => {
    const color = (t: number) => texts(processRenderers.X05(650, t)).find(o => o.text === '좋은 결과물')!.color;
    expect(color(X05.vote[1] - 1)).not.toBe(color(X05.vote[1]));
    const arrowInto = (t: number) => processRenderers.X05(650, t).ops.filter(o => o.type === 'path' && o.fill === 'none' && /^M[^A-Z]*L[^A-Z]*$/.test(o.d) && o.stroke === '#ced4da').length;
    expect(arrowInto(X05.vote[1] - 1)).toBe(0);
    expect(arrowInto(X05.vote[1])).toBe(1);
  });

  it('puts the dot at the group box entrance just before the groups appear', () => {
    const f = processRenderers.X05(650, X05.group[1] - 1), dots = f.ops.filter(o => o.type === 'circle');
    const box = texts(processRenderers.X05(650, X05.group[1] + 400)).find(o => o.text === '좋은 결과물')!;
    expect(dots.some(d => d.type === 'circle' && Math.abs(d.x - (box.x - 8)) < 6)).toBe(true);
  });

  it('marks the current stage bold and the past stages regular, and keeps the caption true about the tables', () => {
    const f = processRenderers.X05(650, info('X05').steps[1]), w = (name: string) => texts(f).find(o => o.text === name)!.weight;
    expect([w('자료 모으기'), w('그룹핑'), w('투표')]).toEqual([400, 400, 700]);
    expect(info('X05').caption).not.toContain('아래에 그대로');
  });
});
