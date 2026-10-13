/** Long gaps are suspension, not explanatory animation time. */
export function advanceFigureTime(elapsed: number, delta: number, duration: number): number {
  if (!Number.isFinite(delta) || delta < 0 || delta >= 250 || duration <= 0) return elapsed;
  return (elapsed + delta) % duration;
}

export function figureShouldRun(state: {
  visible: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  enabled: boolean;
}): boolean {
  return state.enabled && state.visible && !state.hidden && !state.reducedMotion;
}
