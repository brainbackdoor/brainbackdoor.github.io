import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, test } from 'vitest';
import TcpRecoveryFigure from './TcpRecoveryFigure';
import LessonFigure from './LessonFigure';
import registry from '../../../docs/migration-figures.json';
import type { SystemFigureId } from './system-models';
import type { DataFigureId } from './data-models';
import type { InfraFigureId } from './infra-models';
import type { ProcessFigureId } from './process-models';

describe('TCP static rendering', () => {
  it('renders complete, readable figures without browser APIs or hydration', () => {
    const html = renderToString(createElement(TcpRecoveryFigure));
    expect((html.match(/<svg /g) ?? []).length).toBe(2);
    expect(html).toContain('RTO 만료');
    expect(html).toContain('ACK 1100');
    expect(html).toContain('재전송 타이머를 정지합니다.');
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(5); // Two decorative dots, two inactive canvases and the title read once as the figure name.
    expect(html).not.toContain('<button');
  });

  it('renders a single loss panel for the home preview while keeping the static recovery explanation', () => {
    const html = renderToString(createElement(TcpRecoveryFigure, { variant: 'preview' }));
    expect((html.match(/<svg /g) ?? []).length).toBe(1);
    expect((html.match(/<canvas /g) ?? []).length).toBe(1);
    expect(html).toContain('data-scenario="loss"');
    expect(html).not.toContain('data-scenario="normal"');
    expect(html).not.toContain('tcp-figure__panel-title');
    expect(html).not.toContain('tcp-figure__description');
    expect(html).toContain('RTO 만료');
    expect(html).toContain('ACK 1100');
    expect(html).toContain('실제 RTT·RTO 측정값이 아닌 설명용 시간축');
  });

  it('uses separate accessibility and SVG identifiers for multiple instances', () => {
    const html = renderToString(createElement('main', {},
      createElement(TcpRecoveryFigure, { lang: 'ko' }),
      createElement(TcpRecoveryFigure, { lang: 'en' }),
      createElement(TcpRecoveryFigure, { variant: 'preview' }),
    ));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('Normal delivery and retransmission');
    expect(html).toContain('The retransmission timer stops.');
  });
});


describe('lesson figures without hydration', () => {
  it('preserves the complete six scenarios, source references and static stages', () => {
    const html=renderToString(createElement('main',{}, ...(['N01','N03','W03','T01','D03','S03'] as const).map(figureId=>createElement(LessonFigure,{figureId,sourceBlockId:'source-'+figureId,key:figureId}))));
    for(const text of ['FIFO','손실 4','Zero Window Probe','Window Update','8,760','X-Proxy-Cache: HIT','BLOCKED','0x00000005c0c4b1e8','0x00000005c0c4b1f8','2021-01-13','2021-10-04','읽은 행 5','Parent RDD','Driver 결과','collect'])expect(html).toContain(text);
    expect((html.match(/data-figure-id=/g)??[]).length).toBe(6);
    expect((html.match(/data-source-block-id=/g)??[]).length).toBe(6);
    expect((html.match(/<canvas /g)??[]).length).toBe(6);
    expect((html.match(/<details\b/g)??[]).length).toBe(6);
    expect(html).not.toContain('<button');
  });

  it('keeps SVG descriptions and title identifiers unique across repeated instances', () => {
    const html=renderToString(createElement('main',{},createElement(LessonFigure,{figureId:'T01'}),createElement(LessonFigure,{figureId:'T01'})));
    const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
    expect(ids.length).toBeGreaterThan(4);expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('순환 대기');expect(html).toContain('http-nio-8080-exec-5/6');
  });
});


describe('approved network and HTTP figures without hydration',()=>{
  const cases=[
    ['N02','500,000','12.8'],['N04','SYN/ACK','2461'],['N05','ssthresh 5','SMSS'],['N06','중복 ACK 3','RTO'],
    ['N07','1,518','1,460'],['N08','BBRv1','pacing gain'],['N09','TCP_NODELAY=1','Nagle'],['N10','FIN 재전송','2MSL'],
    ['N11','1 → 2 → 3 → 4','TCP'],['N12','probe 3','SO_KEEPALIVE'],['N13','handshake 1','Connection: close'],
    ['W01','DNS','540 ms'],['W02','18,891','3,039'],['W04','304','no-store'],['W05','stream 5','바이트'],['W06','/stations?name=...','200 + []']
  ] as const;
  test.each(cases)('%s retains completed semantics, static steps and its source anchor',(figureId,a,b)=>{
    const html=renderToString(createElement(LessonFigure,{figureId,sourceBlockId:'source-'+figureId}));
    expect(html).toContain(a);expect(html).toContain(b);
    expect(html).toContain('data-source-block-id="source-'+figureId+'"');
    expect(html).toContain('data-ready="false"');
    expect((html.match(/<svg /g)??[]).length).toBe(8);
    expect((html.match(/<desc /g)??[]).length).toBe(8);
    expect(html).not.toContain('<button');
  });
});

describe('B04 container, Linux, thread and object figures without hydration', () => {
  const cases = [
    ['C01', 'Guest OS', 'Linux host kernel'], ['C02', '/var/run/docker.sock', 'nginx 실행 중'], ['C03', 'PID 4453', 'PID 1'],
    ['C04', 'Image B', 'newfile2'], ['C05', 'docker0', 'veth2'], ['C06', 'named volume', '읽음: record A'],
    ['C07', 'Dockerfile', 'build 때 1회'], ['C08', 'Mutable Server', '교체 완료 · 모두 같은 v2'], ['C09', 'SIGHUP으로 종료', 'SIGHUP 무시 · 계속 실행'],
    ['C10', 'sar TCP', '10 / 10'], ['T02', 'TIMED_WAITING', 'sleep() · monitor 유지'], ['T03', 'Servlet 인스턴스 1개', 'destroy 1회'],
    ['T04', 'sharedCounter', 'localCounter'], ['T05', 'fixed(2)', '설정 상한 아님'], ['T06', 'DB connection 1', 'JEP 491'],
    ['T07', 'continuation', 'JVM scheduler가 재개'], ['T08', 'UnsupportedOperationException', 'unmodifiableList'],
  ] as const;
  test.each(cases)('%s keeps its completed scene, static steps and source anchor', (figureId, a, b) => {
    const html = renderToString(createElement(LessonFigure, { figureId, sourceBlockId: 'source-' + figureId }));
    expect(html).toContain(a); expect(html).toContain(b);
    expect(html).toContain('data-source-block-id="source-' + figureId + '"');
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).not.toContain('<button');
  });
});

describe('registry requiredText stays in the static scenes', () => {
  // verify.py와 같은 기준: 글자만 남기고 NFKC 정규화 후 공백 제거
  const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").normalize('NFKC').replace(/\s+/g, '');
  const b04 = /^(C(0[1-9]|10)|T0[2-8])$/;
  it('renders every requiredText registered for the B04 figures', () => {
    const specs = registry.figures.filter(f => b04.test(f.figureId));
    expect(specs).toHaveLength(17);
    for (const spec of specs) {
      const text = plain(renderToString(createElement(LessonFigure, { figureId: spec.figureId as SystemFigureId })));
      for (const expected of spec.requiredText) expect(text, `${spec.figureId} ${expected}`).toContain(expected.normalize('NFKC').replace(/\s+/g, ''));
    }
  });
});


describe('B05 DB, SQL and Spark figures without hydration', () => {
  const cases = [
    ['D01', 'binlog.000002', '비동기 복제(기본)'], ['D02', 'RoutingDataSource', '2회차: B · 적용 후'], ['D04', 'WHERE id BETWEEN 11000 AND 11009', '두 결과 모두 10행'],
    ['D05', '보조 인덱스 (age, id)', '테이블 접근 0회'], ['D06', 'Chef Anton\'s Gumbo Mix', '키 2에서 멈춤'], ['D07', 'LIMIT 150,10', '바깥 ORDER BY'],
    ['D08', 'Global Buffer', 'Too many connections'], ['D09', 'Camembert Pierrot', '122199.74'], ['S01', 'Low-level APIs', 'Kubernetes'],
    ['S02', 'Partition 2', '3 + 3 = 6'], ['S04', 'Education#18 AS education#238', '원문 출력 없음'], ['S05', '건넌 행 8', '건넌 행 5'],
    ['S06', 'executor 메모리', 'lineage'],
  ] as const;
  test.each(cases)('%s keeps its completed scene, static steps and source anchor', (figureId, a, b) => {
    const html = renderToString(createElement(LessonFigure, { figureId, sourceBlockId: 'source-' + figureId }));
    expect(html).toContain(a.replace(/'/g, '&#x27;')); expect(html).toContain(b);
    expect(html).toContain('data-source-block-id="source-' + figureId + '"');
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).not.toContain('<button');
  });

  it('renders every requiredText registered for the B05 figures', () => {
    const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").normalize('NFKC').replace(/\s+/g, '');
    const specs = registry.figures.filter(f => /^(D0[1-9]|S0[1-6])$/.test(f.figureId) && f.figureId !== 'D03' && f.figureId !== 'S03');
    expect(specs.map(s => s.figureId)).toEqual(['D01', 'D02', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'S01', 'S02', 'S04', 'S05', 'S06']);
    for (const spec of specs) {
      const text = plain(renderToString(createElement(LessonFigure, { figureId: spec.figureId as DataFigureId })));
      for (const expected of spec.requiredText) expect(text, `${spec.figureId} ${expected}`).toContain(expected.normalize('NFKC').replace(/\s+/g, ''));
    }
  });
});

describe('B06 infrastructure, operations and load figures without hydration', () => {
  const cases = [
    ['A01', 'VPC 192.168.0.0/24', '관리망 ← 로컬 PC 공인 IP : 22'], ['A02', 'TLS 종료 지점', 'HTTP 평문'], ['A03', 'fullchain.pem', ':443이 이 인증서로 응답'],
    ['A04', 'application-prod.properties', '운영 DB'], ['A05', 'git pull origin master', '빈 구간'], ['A06', 'conference-lt Latest(1)', '종료 정책 순서'],
    ['A07', 'conference-0.0.1-SNAPSHOT.jar', 'DB 없음'], ['O01', 'namespace brainbackdoor', '수집 설정 없음'], ['O02', 'avg·max 2.000', 'No data'],
    ['O03', 'gRPC [Collector IP]', 'web :8080'], ['O04', 'getInputStream', 'IOException'], ['O05', 'nGrinder controller 3.5.8', 'k6 run smoke.js'],
    ['O06', 'Smoke', '하강 잘림'], ['O07', 'T = 2 × 0.5 + 1 = 2 s', 'VU ≠ rps ≠ 사용자 수'], ['O08', 'HALF-OPEN', '서킷 브레이커'], ['O09', '접수됨', '처리 완료'],
  ] as const;
  test.each(cases)('%s keeps its completed scene, static steps and source anchor', (figureId, a, b) => {
    const html = renderToString(createElement(LessonFigure, { figureId, sourceBlockId: 'source-' + figureId }));
    const plainHtml = html.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
    expect(plainHtml).toContain(a); expect(plainHtml).toContain(b);
    expect(html).toContain('data-source-block-id="source-' + figureId + '"');
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).not.toContain('<button');
  });

  it('renders every requiredText registered for the B06 figures', () => {
    const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").normalize('NFKC').replace(/\s+/g, '');
    const specs = registry.figures.filter(f => /^(A0[1-7]|O0[1-9])$/.test(f.figureId));
    expect(specs.map(s => s.figureId)).toEqual(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09']);
    for (const spec of specs) {
      const text = plain(renderToString(createElement(LessonFigure, { figureId: spec.figureId as InfraFigureId })));
      for (const expected of spec.requiredText) expect(text, `${spec.figureId} ${expected}`).toContain(expected.normalize('NFKC').replace(/\s+/g, ''));
    }
  });
});

describe('B07 process figures without hydration', () => {
  const cases = [
    ['E01', 'Business Value', '문서화'], ['E02', 'RestAssured', 'TRUNCATE TABLE (테이블마다)'], ['E03', '로그인했다', '애그리거트'],
    ['E04', 'Service Application', 'MANAGEMENT'], ['E05', 'TimerStarted', '프로세스 죽음'],
  ] as const;
  test.each(cases)('%s keeps its completed scene, static steps and source anchor', (figureId, a, b) => {
    const html = renderToString(createElement(LessonFigure, { figureId, sourceBlockId: 'source-' + figureId }));
    const plainHtml = html.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
    expect(plainHtml).toContain(a); expect(plainHtml).toContain(b);
    expect(html).toContain('data-source-block-id="source-' + figureId + '"');
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).not.toContain('<button');
  });

  it('renders every requiredText registered for the B07 figures', () => {
    const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").normalize('NFKC').replace(/\s+/g, '');
    const specs = registry.figures.filter(f => /^E0[1-5]$/.test(f.figureId));
    expect(specs.map(s => s.figureId)).toEqual(['E01', 'E02', 'E03', 'E04', 'E05']);
    for (const spec of specs) {
      const text = plain(renderToString(createElement(LessonFigure, { figureId: spec.figureId as ProcessFigureId })));
      for (const expected of spec.requiredText) expect(text, `${spec.figureId} ${expected}`).toContain(expected.normalize('NFKC').replace(/\s+/g, ''));
    }
  });
});

describe('B08 adopted figure without hydration', () => {
  it('X05 keeps its completed scene, static steps, source anchor and registered requiredText', () => {
    const html = renderToString(createElement(LessonFigure, { figureId: 'X05', sourceBlockId: 'source-X05' }));
    const plain = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").normalize('NFKC').replace(/\s+/g, '');
    expect(html).toContain('data-source-block-id="source-X05"');
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).not.toContain('<button');
    const specs = registry.figures.filter(f => /^X0[1-9]$/.test(f.figureId));
    expect(specs.map(s => s.figureId)).toEqual(['X05']);
    for (const expected of specs[0].requiredText) expect(plain, expected).toContain(expected.normalize('NFKC').replace(/\s+/g, ''));
  });
});

describe('figures stay out of the search index', () => {
  it('marks every registered figure root and both TCP figure variants so Pagefind indexes only the article text', () => {
    for (const { figureId } of registry.figures) {
      const html = renderToString(createElement(LessonFigure, { figureId: figureId as Parameters<typeof LessonFigure>[0]['figureId'], sourceBlockId: 'source-' + figureId }));
      expect(html, figureId).toMatch(/^<figure[^>]*data-pagefind-ignore/);
    }
    for (const variant of ['default', 'preview'] as const) expect(renderToString(createElement(TcpRecoveryFigure, { variant })), variant).toMatch(/^<figure[^>]*data-pagefind-ignore/);
  });
});

describe('figure names for assistive technology', () => {
  it('names each figure once: the figure takes its title, the static scenes take their descriptions', () => {
    for (const { figureId } of registry.figures) {
      const html = renderToString(createElement(LessonFigure, { figureId: figureId as Parameters<typeof LessonFigure>[0]['figureId'] }));
      expect(html, figureId).toMatch(/^<figure[^>]*aria-labelledby="([^"]+)"[^>]*>\s*<strong id="\1" class="sr-only" aria-hidden="true">/);
      for (const m of html.matchAll(/<svg[^>]*aria-labelledby="([^"]+)"/g)) expect(m[1].split(' '), figureId).toHaveLength(1);
    }
  });
});
