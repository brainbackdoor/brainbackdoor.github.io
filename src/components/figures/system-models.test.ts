import { describe, expect, it } from 'vitest';
import { systemInfo, systemState, type SystemFigureId } from './system-models';
import { systemRenderers, systemZones, systemZoneAt } from './systemCanvas';
import type { DrawOp, LessonFrame } from './lessonCanvas';

const ids = systemInfo.map(item => item.id) as SystemFigureId[];
const loop = (id: SystemFigureId, step = 50) => { const d = systemInfo.find(i => i.id === id)!.duration; return Array.from({ length: Math.floor(d / step) + 1 }, (_, i) => i * step); };
type Text = Extract<DrawOp, { type: 'text' }>;
const texts = (f: LessonFrame) => f.ops.filter((o): o is Text => o.type === 'text');
const visible = (f: LessonFrame, s: string) => texts(f).some(o => o.text === s && (o.alpha ?? 1) > 0);

describe('B04 event models keep the verified meaning', () => {
  it('covers the 17 container, Linux, thread and object figures', () => {
    expect(ids).toEqual(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08']);
    for (const item of systemInfo) { expect(item.final).toBeLessThan(item.duration); expect(item.steps).toHaveLength(3); expect(item.notes).toHaveLength(3); }
  });

  it('C01 keeps three guest kernels against one shared host kernel', () => {
    for (const t of loop('C01')) { const s = systemState('C01', t); expect([s.vmGuestKernels, s.containerKernels, s.apps, s.nativeMacKernel]).toEqual([3, 1, 3, false]); }
  });

  it('C02 reaches the socket, daemon, image, create and start in order', () => {
    const first = (k: 'socket' | 'daemon' | 'imageAvailable' | 'containerCreated' | 'running') => loop('C02', 10).find(t => systemState('C02', t)[k])!;
    expect([first('socket'), first('daemon'), first('imageAvailable'), first('containerCreated'), first('running')]).toEqual([2000, 2800, 4400, 5200, 6300]);
  });

  it('C03 shows one nginx process with two PID names and a separate chroot root', () => {
    for (const t of loop('C03')) { const s = systemState('C03', t); expect([s.processes, s.hostPid, s.containerPid, s.chrootChangesPid]).toEqual([1, 4453, 1, false]); }
  });

  it('C04 never changes Image A and writes later files only to the container layer', () => {
    for (const t of loop('C04')) {
      const s = systemState('C04', t);
      expect(s.imageHasFile).toBe(false);
      expect([s.containerHasFile, s.newImageHasFile, s.secondWrite]).toEqual([t >= 2800, t >= 5200, t >= 6500]);
    }
  });

  it('C05 keeps host 9000 to container 8080 and replies only after the request arrives', () => {
    for (const t of loop('C05')) { const s = systemState('C05', t); expect([s.hostPort, s.containerPort]).toEqual([9000, 8080]); if (s.replyStarted) expect(s.requestReceived).toBe(true); if (s.replyReceived) expect(s.replyStarted).toBe(true); }
  });

  it('C06 keeps record A after removing container A and reads it from the storage into B', () => {
    for (const t of loop('C06')) {
      const s = systemState('C06', t);
      expect(s.imageDataOverwritten).toBe(false);
      if (t >= 5000) { expect(s.volumeData).toBe('record A'); expect(s.bindData).toBe('record A'); expect(s.firstContainer).toBe(false); }
      if (s.replacementRead) expect(s.replacement && t >= 7500).toBe(true);
    }
  });

  it('C07 runs RUN once at build, CMD on each start, and removes only the container layer', () => {
    const end = systemState('C07', 10000);
    expect([end.runCalls, end.cmdCalls, end.state, end.writableData, end.imageExists]).toEqual([1, 2, 'removed', false, true]);
    expect(systemState('C07', 6500)).toMatchObject({ state: 'exited', writableData: true, cmdCalls: 1 });
  });

  it('C07 fades the last running container without changing it back to a waiting CMD', () => {
    for (const w of [259, 650, 900]) {
      for (let t = 8800; t < 9050; t += 10) {
        const f = systemRenderers.C07(w, t);
        expect(systemState('C07', t).state).toBe('removed');
        for (const label of ['CMD', 'running', '쓰기 계층 · 데이터 있음', 'CMD 실행 2회']) expect(visible(f, label), `${w} ${t} ${label}`).toBe(true);
        for (const label of ['CMD 대기', 'removed', '쓰기 계층']) expect(visible(f, label), `${w} ${t} ${label}`).toBe(false);
      }
      expect(texts(systemRenderers.C07(w, 9300)).map(o => o.text).join(' ')).toContain('이미지는 남음');
      expect(visible(systemRenderers.C07(w, 9050), 'CMD')).toBe(false);
    }
  });

  it('C08 drifts mutable servers and ends immutable servers on the same image', () => {
    expect(systemState('C08', 9000).mutable).toEqual(['v2', 'v1+', 'v1']);
    expect(systemState('C08', 6500).immutable).toEqual(['v2', 'v2', 'v1']);
    expect(systemState('C08', 9000).immutable).toEqual(['v2', 'v2', 'v2']);
  });

  it('C09 delivers SIGHUP after the session closes and only nohup keeps running', () => {
    expect(systemState('C09', 6400)).toMatchObject({ sessionClosed: true, backgroundAlive: true, nohupAlive: true });
    expect(systemState('C09', 6500)).toMatchObject({ backgroundAlive: false, nohupAlive: true, nohupFd1: 'app.log', nohupFd2: 'app.log' });
  });

  it('C10 visits the original ten commands in order without measured values', () => {
    let previous = 0;
    for (const t of loop('C10')) { const s = systemState('C10', t); expect(s.commands).toHaveLength(10); expect(s.measuredValues).toBe(false); expect(s.visited).toBeGreaterThanOrEqual(previous); previous = s.visited; }
    expect(previous).toBe(10);
  });

  it('T02 releases the monitor in WAITING and keeps it in TIMED_WAITING', () => {
    expect(systemState('T02', 5000)).toMatchObject({ state: 'WAITING', monitor: null });
    expect(systemState('T02', 8000)).toMatchObject({ state: 'TIMED_WAITING', monitor: 'worker' });
    expect(systemState('T02', 3000)).toMatchObject({ state: 'BLOCKED', monitor: 'peer' });
  });

  it('T03 initialises once and destroys after both services finish', () => {
    expect(systemState('T03', 4000)).toMatchObject({ initCalls: 1, activeServices: 2, destroyCalls: 0 });
    expect(systemState('T03', 8000)).toMatchObject({ initCalls: 1, activeServices: 0, completed: 2, destroyCalls: 1, destroyed: true });
  });

  it('T04 loses one shared increment, keeps two when serialized and never sums local counters', () => {
    const end = systemState('T04', 5000);
    expect([end.race.value, end.synchronized.value, end.locals, end.localsAreSharedTotal]).toEqual([1, 2, [1, 1], false]);
    expect(systemState('T04', 2500).race.reads).toEqual([0, 0]);
    expect(systemState('T04', 3000).synchronized.reads).toEqual([0, 1]);
  });

  it('T05 keeps arrivals equal to waiting, running and finished work', () => {
    for (const t of loop('T05')) for (const k of ['fixed', 'cached'] as const) {
      const s = systemState('T05', t)[k];
      expect(s.pending.length + s.active.length + s.done.length).toBe(s.arrived.length);
      if (k === 'fixed') expect(s.active.length).toBeLessThanOrEqual(2);
    }
  });

  it('T06 keeps DB and monitor with VT1 while JDK24 frees the carrier', () => {
    for (let t = 2600; t < 5100; t += 50) for (const v of ['jdk21', 'jdk24'] as const) {
      const s = systemState('T06', t)[v];
      expect([s.dbOwner, s.monitorOwner]).toEqual(['VT1', 'VT1']);
      if (v === 'jdk21') expect([s.pinned, s.carrier]).toEqual([true, 'VT1']); else expect(s.carrier).not.toBe('VT1');
    }
  });

  it('T07 resumes on worker B and never suspends a blocking call automatically', () => {
    expect(systemState('T07', 3000)).toMatchObject({ virtual: { carrier: null, savedStack: true }, coroutine: { worker: null, savedContinuation: true }, blockingCallAutomaticallySuspends: false });
    expect(systemState('T07', 6000)).toMatchObject({ virtual: { carrier: 'carrier B' }, coroutine: { worker: 'dispatcher B' } });
  });

  it('T08 shares A0 through view, getter and list copy but not the element copy', () => {
    const s = systemState('T08', 8500);
    expect([s.view.itemIds, s.getter.itemIds, s.shallow.itemIds, s.deep.itemIds]).toEqual([['A0', 'B0'], ['A0', 'C0'], ['A0'], ['A1']]);
    expect([s.view.names[0], s.getter.names[0], s.shallow.names[0], s.deep.names[0]]).toEqual(['changed', 'changed', 'changed', 'A']);
    expect(s.viewMutation).toBe('UnsupportedOperationException');
  });
});

// 지면 실측 폭: 데스크톱 본문 650·목록 625·2단 칼럼 313, 390px 본문 346·목록 321, 320px 본문 284·목록 259, 시안 720
const ARTICLE_WIDTHS = [720, 650, 625, 346, 321, 313, 284, 259];

describe('B04 drawings show the model values', () => {
  it('C02 keeps the request dot at the advancing socket connector tip', () => {
    for (const w of ARTICLE_WIDTHS) for (let t = 1600; t < 2000; t += 10) {
      const f = systemRenderers.C02(w, t);
      const dot = f.ops.find(o => o.type === 'circle' && o.r === 4.5 && o.x === 40);
      const connector = f.ops.find(o => o.type === 'path' && /^M40 60L40 [-\d.]+$/.test(o.d));
      expect(dot, `${w} ${t} request`).toBeDefined();
      expect(connector, `${w} ${t} connector`).toBeDefined();
      if (dot?.type !== 'circle' || connector?.type !== 'path') continue;
      const tipY = Number(connector.d.split('L40 ')[1]);
      expect(Math.abs(dot.y - tipY), `${w} ${t} dot stays on the line tip`).toBeLessThan(0.01);
    }
  });

  it('draws finite shapes for every figure across the loop at article widths', () => {
    for (const id of ids) for (const w of ARTICLE_WIDTHS) for (const t of loop(id, 100)) {
      const f = systemRenderers[id](w, t);
      expect(f.height).toBeGreaterThan(0);
      for (const o of f.ops) {
        if (o.type === 'path') expect(o.d).not.toMatch(/NaN|undefined|Infinity/);
        else if (o.type === 'text' || o.type === 'circle') expect([o.x, o.y].every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('T04 stores the model value and marks the overwritten increment', () => {
    for (const t of loop('T04')) {
      const f = systemRenderers.T04(720, t), s = systemState('T04', t);
      expect(texts(f).filter(o => o.size === 22).map(o => o.text)).toEqual([String(s.race.value), String(s.synchronized.value)]);
      // 사건 시각에는 투명도 0에서 나타나기 시작한다
      expect(visible(f, '덮어씀') || t <= 3800).toBe(true);
    }
  });

  it('T06 places tokens in the carrier exactly while the model says so', () => {
    for (const t of loop('T06')) for (const v of [21, 24] as const) {
      const m = systemState('T06', t)[`jdk${v}`];
      expect(systemZoneAt(systemZones.VT1[v], t) === 'carrier').toBe(m.carrier === 'VT1');
      expect(systemZoneAt(systemZones.VT2[v], t) === 'carrier').toBe(m.carrier === 'VT2');
    }
  });

  it('T08 draws one slot per list element and the shared A0 name', () => {
    for (const t of loop('T08')) {
      const f = systemRenderers.T08(720, t), s = systemState('T08', t);
      expect(texts(f).some(o => o.text === '"changed"')).toBe(s.view.names[0] === 'changed');
      expect(texts(f).filter(o => o.text === 'UnsupportedOperationException').length > 0).toBe(!!s.viewMutation);
    }
  });

  it('C04 shows Image B only after commit and C10 counts the visited commands', () => {
    for (const t of loop('C04')) expect(texts(systemRenderers.C04(720, t)).some(o => o.text === 'Image B')).toBe(systemState('C04', t).newImageHasFile);
    for (const t of loop('C10')) { const s = systemState('C10', t); if (s.visited) expect(visible(systemRenderers.C10(720, t), `${s.visited} / 10`)).toBe(true); }
  });

  it('C10 keeps every command list inside its region at every article width', () => {
    const labels = ['실행 대기열 (load)', 'CPU 코어', '프로세스', '메모리', '디스크', '네트워크 eth0', 'TCP 연결', '커널 로그'];
    for (const w of ARTICLE_WIDTHS) for (const t of loop('C10', 100)) {
      const ts = texts(systemRenderers.C10(w, t)), rh = w < 560 ? 84 : 78;
      for (const label of ts.filter(o => labels.some(l => l.startsWith(o.text)) && o.weight === 600)) {
        const bottom = label.y - 22 + rh;
        for (const cmd of ts.filter(o => o.mono && o.x === label.x && o.y > label.y && o.y < bottom + 20)) expect(cmd.y + cmd.size * 0.22, `${w} ${t} ${cmd.text}`).toBeLessThanOrEqual(bottom - 6);
      }
    }
  });

  it('names where illustrative values come from and which step runs RUN, CMD and the log redirect', () => {
    const caption = (id: SystemFigureId) => systemInfo.find(i => i.id === id)!.caption;
    expect(caption('C05')).not.toContain('가이드의');
    expect(caption('C05')).toContain('「도커 컨테이너 실행해보기」의 9000:8080');
    expect(caption('C07')).toMatch(/^RUN은 이미지를 빌드할 때, CMD는 컨테이너를 시작할 때 실행됩니다\./);
    // 단계 설명과 완료 장면 설명(sr-only)도 같은 주체를 말해야 한다
    const c09 = systemInfo.find(i => i.id === 'C09')!;
    expect(c09.notes.join(' ')).not.toMatch(/nohup은[^.]*로그로 보냅니다/);
    expect(c09.notes[2]).toContain('1>·2>&1 리다이렉션');
    for (const w of ARTICLE_WIDTHS) {
      const said = texts(systemRenderers.C09(w, systemInfo.find(i => i.id === 'C09')!.final)).map(o => o.text).join(' ');
      expect(said).not.toContain('출력을 파일로 보낼');
      expect(said).toContain('nohup: SIGHUP 무시');
      expect(said).toContain('1>·2>&1: 로그 리다이렉션');
    }
  });

  it('T05 shows a cached worker only from the arrival that creates it', () => {
    for (const w of ARTICLE_WIDTHS) for (const t of loop('T05', 50)) {
      const workers = systemRenderers.T05(w, t).ops.filter(o => o.type === 'path' && o.width === 1.3).length; // 사건 시각에는 투명도 0으로 그려지기 시작한다
      expect(workers, `${w} ${t}`).toBe(2 + systemState('T05', t).cached.arrived.length);
    }
  });

  it('T05 keeps the inflow equation visible for both pools', () => {
    for (const t of loop('T05')) for (const k of ['fixed', 'cached'] as const) {
      const s = systemState('T05', t)[k];
      expect(visible(systemRenderers.T05(720, t), `유입 ${s.arrived.length} = 대기 ${s.pending.length} + 실행 ${s.active.length} + 완료 ${s.done.length}`)).toBe(true);
    }
  });

  it('keeps visible labels apart and inside the figure at every width', () => {
    const SANS = (s: string) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c >= 0x1100 ? 0.94 : ' .,:;·|!il\'"()[]'.includes(ch) ? 0.3 : /[A-Z0-9mwMW+=→]/.test(ch) ? 0.64 : 0.52; } return n; };
    const box = (o: Text) => { const w = (o.mono ? [...o.text].reduce((n, ch) => n + (ch.codePointAt(0)! >= 0x1100 ? 1 : 0.6), 0) : SANS(o.text)) * o.size; const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x; return { x1: x, x2: x + w, y1: o.y - o.size * 0.8, y2: o.y + o.size * 0.22 }; };
    const issues: string[] = [];
    for (const item of systemInfo) for (const w of ARTICLE_WIDTHS) for (let t = 0; t <= item.final; t += 100) {
      const bs = texts(systemRenderers[item.id](w, t)).filter(o => (o.alpha ?? 1) > 0.5).map(o => ({ o, ...box(o) }));
      for (const b of bs) if (b.x1 < -1 || b.x2 > w + 1) issues.push(`${item.id} ${w} ${t} outside ${b.o.text}`);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2) issues.push(`${item.id} ${w} ${t} ${a.o.text} / ${b.o.text}`);
      }
    }
    expect([issues.length, ...new Set(issues.map(i => i.split(' ').slice(0, 2).join(' ')))]).toEqual([0]);
  });
});
