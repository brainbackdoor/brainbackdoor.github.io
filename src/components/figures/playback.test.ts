import { describe, expect, it } from 'vitest';
import { advanceFigureTime, figureShouldRun } from './playback';

describe('figure playback clock', () => {
  it('keeps the remainder at a repeat boundary and discards suspension gaps', () => {
    expect(advanceFigureTime(8040, 16, 8050)).toBe(6);
    expect(advanceFigureTime(1000, 249, 8050)).toBe(1249);
    for (const gap of [250, 20000, -16, Number.NaN]) expect(advanceFigureTime(1750, gap, 8050)).toBe(1750);
  });

  it('requires visibility, a visible document, motion permission and user permission together', () => {
    const state = { enabled: true, visible: true, hidden: false, userPaused: false, reducedMotion: false };
    expect(figureShouldRun(state)).toBe(true);
    expect(figureShouldRun({ ...state, visible: false })).toBe(false);
    expect(figureShouldRun({ ...state, hidden: true })).toBe(false);
    expect(figureShouldRun({ ...state, userPaused: true })).toBe(false);
    expect(figureShouldRun({ ...state, reducedMotion: true })).toBe(false);
    expect(figureShouldRun({ ...state, enabled: false })).toBe(false);
    // Returning to the viewport does not undo a reader's pause.
    expect(figureShouldRun({ ...state, visible: true, userPaused: true })).toBe(false);
  });
});
