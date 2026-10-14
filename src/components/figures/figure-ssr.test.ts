import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, test } from 'vitest';
import TcpRecoveryFigure from './TcpRecoveryFigure';
import LessonFigure from './LessonFigure';
import registry from '../../../docs/migration-figures.json';
import type { SystemFigureId } from './system-models';

describe('TCP static rendering', () => {
  it('renders complete, readable figures without browser APIs or hydration', () => {
    const html = renderToString(createElement(TcpRecoveryFigure));
    expect((html.match(/<svg /g) ?? []).length).toBe(2);
    expect(html).toContain('RTO 만료');
    expect(html).toContain('ACK 1100');
    expect(html).toContain('재전송 타이머를 정지합니다.');
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(4); // Two decorative dots and two inactive canvases.
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

