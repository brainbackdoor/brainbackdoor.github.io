import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TcpRecoveryFigure from './TcpRecoveryFigure';

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
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('Normal delivery and retransmission');
    expect(html).toContain('The retransmission timer stops.');
  });
});
