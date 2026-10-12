import { describe, expect, it } from 'vitest';
import { tcpStateAt } from './tcp';

describe('TCP events on a shared timeline', () => {
  it('does not acknowledge data before arrival, and stops the normal timer only after ACK returns', () => {
    expect(tcpStateAt(1399, 'normal')).toMatchObject({ phase: 'sending', nextByte: 1000, acknowledged: false });
    expect(tcpStateAt(1400, 'normal')).toMatchObject({ phase: 'received', nextByte: 1100, timer: 'running' });
    expect(tcpStateAt(1649, 'normal').ackProgress).toBe(0);
    expect(tcpStateAt(2050, 'normal')).toMatchObject({ phase: 'acknowledging', ackProgress: 0.5, acknowledged: false });
    expect(tcpStateAt(2450, 'normal')).toMatchObject({ phase: 'complete', timer: 'stopped', acknowledged: true });
  });

  it('loses the first data without changing receive state or inventing a duplicate ACK', () => {
    expect(tcpStateAt(1049, 'loss').lost).toBe(false);
    expect(tcpStateAt(1050, 'loss')).toMatchObject({ phase: 'waiting', lost: true, nextByte: 1000, ackProgress: 0, timer: 'running' });
    expect(tcpStateAt(3199, 'loss')).toMatchObject({ phase: 'waiting', retryProgress: 0, nextByte: 1000, ackProgress: 0 });
  });

  it('restarts the timer at retransmission and leaves it running until the final ACK arrives', () => {
    expect(tcpStateAt(3200, 'loss')).toMatchObject({ phase: 'retransmitting', timer: 'restarted', retryProgress: 0 });
    expect(tcpStateAt(3600, 'loss')).toMatchObject({ retryProgress: 0.5, nextByte: 1000 });
    expect(tcpStateAt(4000, 'loss')).toMatchObject({ phase: 'received', nextByte: 1100, timer: 'restarted' });
    expect(tcpStateAt(5049, 'loss')).toMatchObject({ phase: 'acknowledging', acknowledged: false, timer: 'restarted' });
    expect(tcpStateAt(5050, 'loss')).toMatchObject({ phase: 'complete', acknowledged: true, timer: 'stopped' });
  });

  it('holds the complete comparison and has no residual event at the next loop start', () => {
    expect(tcpStateAt(8049, 'loss')).toEqual(tcpStateAt(5550, 'loss'));
    for (const scenario of ['normal', 'loss'] as const) {
      expect(tcpStateAt(0, scenario)).toMatchObject({ phase: 'ready', timer: 'idle', nextByte: 1000, originalProgress: 0, retryProgress: 0, ackProgress: 0, lost: false, acknowledged: false });
    }
  });
});
