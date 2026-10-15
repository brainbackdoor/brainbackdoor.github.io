import { describe, expect, it } from 'vitest';
import { A03, A04, A05, A06, A07_USERDATA, O04_ROWS, O08, a01, a03, a04, a05, a06, o02, o07, o08, o09, infraInfo, type InfraFigureId } from './infra-models';
import { infraRenderers } from './infraCanvas';
import type { DrawOp, LessonFrame } from './lessonCanvas';

const ids = infraInfo.map(item => item.id) as InfraFigureId[];
const info = (id: InfraFigureId) => infraInfo.find(i => i.id === id)!;
const loop = (id: InfraFigureId, step = 50) => Array.from({ length: Math.floor(info(id).duration / step) + 1 }, (_, i) => i * step);
type Text = Extract<DrawOp, { type: 'text' }>;
const texts = (f: LessonFrame) => f.ops.filter((o): o is Text => o.type === 'text');
const said = (f: LessonFrame) => texts(f).filter(o => (o.alpha ?? 1) > 0).map(o => o.text).join(' ') + ' ' + f.status;
const final = (id: InfraFigureId, w = 650) => infraRenderers[id](w, info(id).final);
// 본문 650/346/284, 목록 안 625/321/259, 체크리스트(to_do) 안 647/343/281(O08·O09 실측)
const ARTICLE_WIDTHS = [650, 647, 625, 346, 343, 321, 284, 281, 259];

describe('B06 infrastructure and operations models keep the source meaning', () => {
  it('covers the 16 infrastructure, operations and load figures', () => {
    expect(ids).toEqual(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09']);
    for (const item of infraInfo) { expect(item.final).toBeLessThan(item.duration); expect(item.steps).toHaveLength(3); expect(item.notes).toHaveLength(3); }
  });

  it('A01 opens only the five security group rules and blocks the direct accesses', () => {
    expect(a01(info('A01').final)).toMatchObject({ allowed: [true, true, true, true, true], blocked: [true, true, true] });
    const f = said(final('A01'));
    for (const s of ['외부망 ← 전체 대역 : 443', '관리망 ← 로컬 PC 공인 IP : 22', '내부망 ← 외부망 : 3306', '인터넷 → 내부망 : 3306', 'VPC 192.168.0.0/24']) expect(f).toContain(s);
  });

  it('A02 ends TLS at nginx and sends plain HTTP to the WAS', () => {
    const f = said(final('A02'));
    for (const s of ['TLS 종료 지점', 'HTTP 평문', '172.17.0.1:8080', '암호화 원문 없음']) expect(f).toContain(s);
    expect(f).not.toContain('TLS 1.3');
  });

  it('A03 issues only after the TXT check and serves 443 only after the manual steps', () => {
    for (const t of loop('A03')) {
      const s = a03(t);
      if (s.verified) expect(s.dug).toBe(true);
      if (s.issued) expect(s.verified).toBe(true);
      if (s.served) expect([s.issued, s.applied]).toEqual([true, 4]);
    }
    expect(said(infraRenderers.A03(650, A03.issued + 300))).toContain(':443 아직 아님');
  });

  it('A05 leaves an empty window between stopping the old process and starting the new one', () => {
    for (const t of loop('A05')) { const s = a05(t); expect(s.down).toBe(!s.oldUp && !s.newUp); }
    expect(a05(A05.kill + 100).down).toBe(true);
    expect(said(final('A05'))).toContain('무중단 배포가 아닙니다');
  });

  it('A06 sends traffic only to healthy instances', () => {
    for (const t of loop('A06', 100)) {
      const s = a06(t), healthy = [s.oldest, 'healthy', s.third].filter(x => x === 'healthy').length;
      expect(texts(infraRenderers.A06(650, t)).filter(o => o.text === '● 트래픽 받음'), `${t}`).toHaveLength(healthy);
    }
    expect(a06(A06.registered + 100).third).toBe('initial');
  });

  it('A07 keeps front without a database and the three module databases', () => {
    const f = said(final('A07'));
    for (const s of ['DB 없음', 'conference-0.0.1-SNAPSHOT.jar', 'java -jar -Dspring.profiles.active=prod']) expect(f).toContain(s);
    expect(texts(final('A07')).filter(o => o.text === 'DB :3306')).toHaveLength(3);
  });

  it('O01 separates collected metrics and logs from the logs without a collection setting', () => {
    const f = final('O01'), t = texts(f).map(o => o.text);
    expect(t.filter(x => x === '수집 설정 없음')).toHaveLength(2);
    for (const s of ['namespace brainbackdoor', '로그 그룹 syslog / {instance_id}', 'mem_available']) expect(t).toContain(s);
    expect(t).not.toContain('mem_used_percent');
  });

  it('O02 shows the statistics of the single smoke run as read from the capture', () => {
    expect(o02(info('O02').final).cursor).toBe(10);
    const f = said(final('O02'));
    for (const s of ['avg·max 2.000', 'mean 7.52 · p95 9.25 · p90 8.44 ms', 'min 5.41 · med 6.92 · max 14.61 ms', 'logged in successfully 10/10', 'No data']) expect(f).toContain(s);
  });

  it('O04 keeps the visible rows of the call tree and their nesting arithmetic', () => {
    const by = Object.fromEntries(O04_ROWS.map(r => [r[0], r]));
    expect([by[0][3], by[0][4] + by[1][3]]).toEqual([766, 766]);
    expect(by[1][3]).toBe(by[1][4] + by[2][3]);
    expect([by[3][3], by[3][4], by[4][3], by[7][4]]).toEqual([510, 507, 448, 253]);
    expect(by[4][2] + by[4][3] - (by[3][2] + by[3][3])).toBe(5);
  });

  it('O07 recomputes the VU example exactly', () => {
    expect(o07(0)).toMatchObject({ T: 2, vu: 300, perVu: 1 });
    expect(said(final('O07'))).toContain('VU ≠ rps ≠ 사용자 수');
  });

  it('O08 moves CLOSED → OPEN → HALF-OPEN → CLOSED and calls nothing while open', () => {
    const order = loop('O08').map(t => o08(t).state).filter((s, i, a) => i === 0 || s !== a[i - 1]);
    expect(order).toEqual(['CLOSED', 'OPEN', 'HALF-OPEN', 'CLOSED']);
    for (let t = O08.open; t < O08.half; t += 50) expect(infraRenderers.O08(650, t).ops.some(o => o.type === 'circle'), `${t}`).toBe(false);
  });

  it('O09 answers "accepted" before the work completes', () => {
    for (const t of loop('O09')) { const s = o09(t); if (s.done) expect(s.accepted).toBe(true); if (s.syncDone) expect(s.accepted).toBe(true); }
    expect(said(final('O09'))).toContain('개념 예시');
  });

  it('keeps secrets and host identifiers out of every scene and caption', () => {
    for (const item of infraInfo) for (const w of [650, 259]) for (const t of [...item.steps, item.final]) {
      const f = said(infraRenderers[item.id](w, t)) + ' ' + item.caption + ' ' + item.notes.join(' ');
      for (const bad of [/\b\d{12}\b/, /admin\s*\/\s*admin/, /192\.168\.0\.(110|118)/, /ec2-54/, /cuui-MacBook/, /arn:aws/, /_acme-challenge\.[a-z]+\.[a-z]+/i]) expect(f, `${item.id} ${bad}`).not.toMatch(bad);
    }
  });
});

describe('B06 scenes stay readable at every article width', () => {
  it('keeps visible labels apart and inside the figure through the whole loop, also between the measured widths', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const box = (o: Text) => { const w = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x; return { x1: x, x2: x + w, y1: o.y - o.size * 0.8, y2: o.y + o.size * 0.22 }; };
    const sweep = [...Array.from({ length: 31 }, (_, i) => 259 + i * 13), 560].filter(w => !ARTICLE_WIDTHS.includes(w));
    const plan = [...ARTICLE_WIDTHS.map(w => [w, 100] as const), ...sweep.map(w => [w, 200] as const)];
    const issues: string[] = [];
    for (const item of infraInfo) for (const [w, step] of plan) for (let t = 0; t <= item.duration; t += step) {
      const f = infraRenderers[item.id](w, t);
      const bs = texts(f).filter(o => o.text.trim() && (o.alpha ?? 1) > 0.5).map(o => ({ o, ...box(o) }));
      for (const b of bs) if (b.x1 < -1 || b.x2 > w + 1 || b.y2 > f.height + 2) issues.push(`${item.id} ${w} ${t} outside ${b.o.text}`);
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
    for (const item of infraInfo) for (const w of [...ARTICLE_WIDTHS, 560]) for (const t of [...item.steps, item.final]) {
      if (JSON.stringify(infraRenderers[item.id](w, t)) !== JSON.stringify(infraRenderers[item.id](w, t + 60))) issues.push(`${item.id} ${w} ${t}`);
    }
    expect(issues).toEqual([]);
  });

  it('keeps the frame height fixed through the loop so the article does not jump', () => {
    for (const item of infraInfo) for (const w of [...ARTICLE_WIDTHS, 560]) {
      const heights = new Set(loop(item.id, 100).map(t => infraRenderers[item.id](w, t).height));
      expect([...heights], `${item.id} ${w}`).toHaveLength(1);
    }
  });

  it('keeps every dot inside the figure', () => {
    const issues = new Set<string>();
    for (const item of infraInfo) for (const w of ARTICLE_WIDTHS) for (let t = 0; t <= item.duration; t += 100) for (const o of infraRenderers[item.id](w, t).ops) {
      if (o.type === 'circle' && (o.x - o.r < -1 || o.x + o.r > w + 1)) issues.add(`${item.id} ${w}`);
    }
    expect([...issues]).toEqual([]);
  });
});

describe('B06 review fixes keep each static step and source text honest', () => {
  // 단계마다 상태 문구가 그 장면에 그려진 것만 말한다(다음 사건을 먼저 말하지 않음)
  const STEP_STATUS: Record<InfraFigureId, [string, string, string]> = {
    A01: ['443', '3306', '허용 경로 5개'], A02: ['301', '평문', '암호화 구간'], A03: ['TXT 값을 요구', '아직 적용 전', '응답'],
    A04: ['test', 'local', '세 프로필'], A05: ['Nothing to do', '종료하면', '무중단 배포가 아닙니다'], A06: ['헬스 체크 통과 전', 'healthy가 된 뒤', '2대로'],
    A07: ['사용자 데이터', '각자 DB', '원본 구조도'], O01: ['disk·mem_available·netstat', 'EC2 기본 지표', '알람'], O02: ['smoke.js', 'VU·RPS', '원인'],
    O03: ['member-api로', 'HBase', '따로'], O04: ['펼쳐집니다', '오류 trace', '보이는 행'], O05: ['승인', '결과를 controller', '나눠'],
    O06: ['Smoke', 'Load', '목적'], O07: ['86,400', '1 rps', '실측'], O08: ['OPEN', '증설', '측정'], O09: ['접수됨', '완료', '개념 예시'],
  };
  it('describes only what each static step has drawn', () => {
    for (const item of infraInfo) item.steps.forEach((t, i) => expect(infraRenderers[item.id](650, t).status, `${item.id} ${i + 1}`).toContain(STEP_STATUS[item.id][i]));
    expect(infraRenderers.A02(650, info('A02').steps[0]).status).not.toContain('핸드셰이크');
    expect(infraRenderers.A03(650, A03.issued + 300).status).not.toContain('nginx에 적용합니다');
  });

  it('A07 marks the user data as a summary and keeps the jar path in the start command', () => {
    expect(info('A07').caption).toContain('요약');
    expect(A07_USERDATA[5]).toContain('conference-0.0.1-SNAPSHOT.jar');
    expect(A07_USERDATA.filter(l => l.includes('aws s3 cp'))).toHaveLength(2);
    expect(said(final('A07'))).toContain('명령 요약');
  });

  it('A01 follows the NAT clue of the original drawing: 192.168.0.160/27 is the internal network', () => {
    const t = texts(final('A01')).map(o => o.text).join(' | ');
    expect(t).toMatch(/AZ2 · 내부망[^|]*\| 192\.168\.0\.160/);
    expect(t).toContain('내부망 → 인터넷 : NAT 경유 아웃바운드만');
  });

  it('A04 switches each chip on at a model time without hiding its text first', () => {
    for (let t = 0; t <= info('A04').duration; t += 20) for (const o of texts(infraRenderers.A04(650, t))) expect(o.alpha ?? 1, `${t} ${o.text}`).toBe(1);
    expect(a04(A04.local[0] + A04.chips[1]).chipsOn[1]).toEqual([true, true, false]);
  });

  it('A06 balances the AZs before the termination policy and ends with EC2 2 and EC2 3', () => {
    expect(a06(info('A06').final)).toMatchObject({ oldest: 'gone', third: 'healthy', desired: 2 });
    expect(said(final('A06'))).toContain('AZ 균형');
  });

  it('keeps unsupported claims as possibilities or recommendations', () => {
    expect(said(final('O08')) + info('O08').notes.join(' ')).toContain('그대로 늘지 않을 수 있습니다');
    expect(said(final('O09'))).toContain('원문에 구현 없음');
    expect(said(final('O05')) + info('O05').notes.join(' ')).not.toContain('다른 서버입니다');
    expect(said(final('O06'))).not.toContain('한계?');
    expect(texts(final('A05')).filter(o => o.text.includes('(설명용)')).length).toBeGreaterThanOrEqual(3);
  });

  it('O02 keeps the same statistics at every width', () => {
    for (const w of [650, 259]) { const f = said(infraRenderers.O02(w, info('O02').final)); for (const s of ['med 6.92', 'p90 8.44', 'logged in successfully', 'retrieved member']) expect(f, `${w} ${s}`).toContain(s); }
  });
});
