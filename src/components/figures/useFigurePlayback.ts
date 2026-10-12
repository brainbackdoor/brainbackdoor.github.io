import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { advanceFigureTime, figureShouldRun } from './playback';

interface PlaybackOptions {
  containerRef: RefObject<HTMLElement | null>;
  durationMs: number;
  finalElapsedMs: number;
  enabled: boolean;
  onFrame: (elapsedMs: number) => void;
}

/** Owns time only; individual figures calculate their own events and geometry. */
export function useFigurePlayback({ containerRef, durationMs, finalElapsedMs, enabled, onFrame }: PlaybackOptions) {
  const elapsed = useRef(0);
  const paused = useRef(false);
  const previousMotion = useRef<boolean | null>(null);
  const render = useRef(onFrame);
  const syncRef = useRef<() => void>(() => {});
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => { render.current = onFrame; }, [onFrame]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = !('IntersectionObserver' in window);
    let frameId = 0;
    let lastTime: number | null = null;
    let active = false;
    let disposed = false;
    setRunning(false);

    function draw() { render.current(elapsed.current); }
    function tick(now: number) {
      if (!active || disposed) return;
      if (lastTime !== null) elapsed.current = advanceFigureTime(elapsed.current, now - lastTime, durationMs);
      lastTime = now;
      draw();
      if (active && !disposed) frameId = requestAnimationFrame(tick);
    }
    function sync() {
      if (disposed) return;
      const next = figureShouldRun({ visible, hidden: document.hidden, userPaused: paused.current, reducedMotion: motion.matches, enabled });
      if (active !== next) {
        active = next;
        lastTime = null;
        if (active) frameId = requestAnimationFrame(tick);
        else cancelAnimationFrame(frameId);
        setRunning(active);
      }
      draw();
    }
    function changeMotion() {
      if (motion.matches) elapsed.current = finalElapsedMs;
      else if (previousMotion.current === true) elapsed.current = 0;
      previousMotion.current = motion.matches;
      setReducedMotion(motion.matches);
      sync();
    }
    syncRef.current = sync;
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0 })
      : null;
    observer?.observe(container);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', changeMotion);
    changeMotion();
    return () => {
      disposed = true;
      active = false;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', changeMotion);
      syncRef.current = () => {};
    };
  }, [containerRef, durationMs, finalElapsedMs, enabled]);

  const toggle = useCallback(() => {
    paused.current = !paused.current;
    setUserPaused(paused.current);
    syncRef.current();
  }, []);
  const redraw = useCallback(() => render.current(elapsed.current), []);
  return { userPaused, reducedMotion, running, toggle, redraw };
}
