import { useCallback, useEffect, useId, useRef, useState } from 'react';
import AnimatedFigure from './AnimatedFigure';
import { useFigurePlayback } from './useFigurePlayback';
import { TCP_TIME, tcpDescription, tcpLabels, tcpStateAt, type FigureLanguage, type TcpScenario, type TcpPhase } from './tcp';
import { drawTcp, readFigureColors, TCP_HEIGHT, tcpY, type FigureColors } from './tcpCanvas';

interface Surface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  scenario: TcpScenario;
  width: number;
  dpr: number;
}

/** SSR, disabled-JavaScript, and Canvas-failure fallback, using the same event coordinates. */
function StaticTcp({ scenario, lang, height = TCP_HEIGHT }: { scenario: TcpScenario; lang: FigureLanguage; height?: number }) {
  const id = useId().replace(/:/g, '');
  const labels = tcpLabels[lang];
  const y = (time: number) => tcpY(time, height);
  const loss = scenario === 'loss';
  const left = 34, right = 286, center = 160;
  const path = (start: number, end: number, from: number, to: number, color: string, label: string, dashed = false) => <g>
    <line x1={from} y1={y(start)} x2={to} y2={y(end)} stroke={`var(--color-figure-${color})`} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} markerEnd={dashed ? undefined : `url(#${id}-${color})`} />
    <text x={(from + to) / 2} y={(y(start) + y(end)) / 2 - 9} fill={`var(--color-figure-${color}-text)`}>{label}</text>
  </g>;
  return <svg className="tcp-figure__fallback" viewBox={`0 0 320 ${height}`} role="img" aria-label={loss ? labels.lossAlt : labels.normalAlt}>
    <defs>{['blue', 'green'].map(color => <marker key={color} id={`${id}-${color}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 7 4 1 7" fill="none" stroke={`var(--color-figure-${color})`} strokeWidth="1.5" /></marker>)}</defs>
    <rect x="8" y="31" width="304" height={height - 43} fill="var(--color-figure-plot)" />
    {[0, 900, 1800, 2700, 3600, 4500, 5400].map(time => <line key={time} x1="27" x2="293" y1={y(time)} y2={y(time)} stroke="var(--color-figure-grid)" />)}
    <g stroke="var(--color-figure-line)" strokeDasharray="3 4"><line x1={left} x2={left} y1="37" y2={height - 15} /><line x1={right} x2={right} y1="37" y2={height - 15} /></g>
    <g fill="var(--color-figure-text)"><text x={left} y="19">{labels.sender}</text><text x={right} y="19">{labels.receiver}</text></g>
    <text x="318" y={height - 1} textAnchor="end" fill="var(--color-figure-muted)">{labels.time}</text>
    {loss ? <>
      {path(TCP_TIME.send, TCP_TIME.lost, left, center, 'blue', 'SEQ 1000', true)}
      <path d={`M156 ${y(TCP_TIME.lost) - 4} l8 8 m0 -8 l-8 8`} stroke="var(--color-figure-red)" strokeWidth="2" />
      <text x="174" y={y(TCP_TIME.lost) + 3} textAnchor="start" fill="var(--color-figure-red-text)">{labels.lost}</text>
      <line x1="19" x2="19" y1={y(TCP_TIME.send)} y2={y(TCP_TIME.timeout)} stroke="var(--color-figure-orange)" strokeWidth="3" />
      <line x1="19" x2="19" y1={y(TCP_TIME.timeout) + 6} y2={y(TCP_TIME.recovered)} stroke="var(--color-figure-line)" strokeWidth="2" />
      <text x="47" y={y(2300)} textAnchor="start" fill="var(--color-figure-orange-text)">{labels.timeout}</text>
      {path(TCP_TIME.timeout, TCP_TIME.retried, left, right, 'blue', `SEQ 1000 · ${labels.retry}`)}
      {path(TCP_TIME.retryAck, TCP_TIME.recovered, right, left, 'green', 'ACK 1100')}
      <text x={center} y={height - 14} fill="var(--color-figure-green-text)">{labels.complete}</text>
    </> : <>
      {path(TCP_TIME.send, TCP_TIME.received, left, right, 'blue', `SEQ 1000 · ${labels.bytes}`)}
      {path(TCP_TIME.ack, TCP_TIME.confirmed, right, left, 'green', 'ACK 1100')}
      <text x={center} y={y(TCP_TIME.confirmed) + 29} fill="var(--color-figure-green-text)">{labels.complete}</text>
    </>}
  </svg>;
}

export default function TcpRecoveryFigure({ lang = 'ko', variant = 'default' }: { lang?: FigureLanguage; variant?: 'default' | 'preview' }) {
  const preview = variant === 'preview';
  const height = preview ? 246 : TCP_HEIGHT;
  const containerRef = useRef<HTMLElement>(null);
  const normalRef = useRef<HTMLCanvasElement>(null);
  const lossRef = useRef<HTMLCanvasElement>(null);
  const surfaces = useRef<Surface[]>([]);
  const style = useRef<{ colors: FigureColors; font: string } | null>(null);
  const failed = useRef(false);
  const [ready, setReady] = useState(false);
  const lastPhases = useRef<Record<TcpScenario, TcpPhase>>({ normal: 'complete', loss: 'complete' });
  const [phases, setPhases] = useState(lastPhases.current);
  const labels = tcpLabels[lang];
  const caption = preview
    ? (lang === 'ko' ? '시간은 아래로 흐릅니다. 실제 RTT·RTO 측정값이 아닌 설명용 시간축이며, 뒤따르는 데이터가 없는 경우입니다.' : 'Time flows downward on an illustrative timeline, not measured RTT or RTO. No later data is sent.')
    : labels.caption;
  const frame = useCallback((elapsed: number) => {
    if (failed.current || !style.current || !surfaces.current.length) return;
    try {
      for (const surface of surfaces.current) {
        if (!surface.width) continue;
        drawTcp(surface.context, surface.width, surface.dpr, elapsed, surface.scenario, lang, style.current.colors, style.current.font, height);
        surface.canvas.dataset.phase = tcpStateAt(elapsed, surface.scenario).phase;
        surface.canvas.dataset.timer = tcpStateAt(elapsed, surface.scenario).timer;
      }
      const next = { normal: tcpStateAt(elapsed, 'normal').phase, loss: tcpStateAt(elapsed, 'loss').phase };
      if (lastPhases.current.normal !== next.normal || lastPhases.current.loss !== next.loss) {
        lastPhases.current = next;
        setPhases(next);
      }
    } catch {
      failed.current = true;
      setReady(false);
      setPhases({ normal: 'complete', loss: 'complete' });
    }
  }, [lang, height]);
  const playback = useFigurePlayback({ containerRef, durationMs: TCP_TIME.loop, finalElapsedMs: TCP_TIME.recovered + 500, enabled: ready, onFrame: frame });

  useEffect(() => {
    const container = containerRef.current;
    const canvases: { canvas: HTMLCanvasElement | null; scenario: TcpScenario }[] = preview
      ? [{ canvas: lossRef.current, scenario: 'loss' }]
      : [{ canvas: normalRef.current, scenario: 'normal' }, { canvas: lossRef.current, scenario: 'loss' }];
    if (!container || canvases.some(({ canvas }) => !canvas)) return;
    failed.current = false;
    let disposed = false;
    try {
      surfaces.current = canvases.map(({ canvas, scenario }) => {
        const context = canvas!.getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable');
        return { canvas: canvas!, context, scenario, width: 0, dpr: 0 };
      });
    } catch {
      failed.current = true;
      surfaces.current = [];
      return;
    }
    function measure() {
      if (disposed || failed.current) return;
      style.current = { colors: readFigureColors(container!), font: getComputedStyle(container!).fontFamily };
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      for (const surface of surfaces.current) {
        const width = surface.canvas.getBoundingClientRect().width;
        if (width <= 0) { surface.width = 0; continue; }
        if (width !== surface.width || dpr !== surface.dpr) {
          surface.width = width;
          surface.dpr = dpr;
          surface.canvas.width = Math.round(width * dpr);
          surface.canvas.height = Math.round(height * dpr);
        }
      }
      playback.redraw();
      if (!failed.current) setReady(surfaces.current.every(surface => surface.width > 0));
    }
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    surfaces.current.forEach(surface => resizeObserver?.observe(surface.canvas));
    let resolution: MediaQueryList | null = null;
    function watchResolution() {
      resolution?.removeEventListener('change', changeResolution);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution.addEventListener('change', changeResolution);
    }
    function changeResolution() { measure(); watchResolution(); }
    watchResolution();
    window.addEventListener('resize', measure, { passive: true });
    document.fonts?.ready.then(() => { if (!disposed) measure(); });
    document.fonts?.addEventListener('loadingdone', measure);
    measure();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resolution?.removeEventListener('change', changeResolution);
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
      surfaces.current = [];
      style.current = null;
    };
  }, [playback.redraw, preview, height]);

  return <AnimatedFigure containerRef={containerRef} title={preview ? labels.loss : labels.title} caption={caption} showControl={ready && !playback.reducedMotion} paused={playback.userPaused} running={playback.running} toggle={playback.toggle} lang={lang} variant={variant}>
    <div className="tcp-figure__panels">
      {(preview ? ['loss'] as const : ['normal', 'loss'] as const).map(scenario => <div className="tcp-figure__panel" key={scenario} data-scenario={scenario} data-ready={ready}>
        {!preview && <div className="tcp-figure__panel-title"><span aria-hidden="true" />{labels[scenario]}</div>}
        <div className="tcp-figure__plot">
          <StaticTcp scenario={scenario} lang={lang} height={height} />
          <canvas ref={scenario === 'normal' ? normalRef : lossRef} role="img" aria-label={scenario === 'normal' ? labels.normalAlt : labels.lossAlt} aria-hidden={!ready} />
        </div>
        {!preview && <p className="tcp-figure__description">{tcpDescription(lang, scenario, ready ? phases[scenario] : 'complete')}</p>}
      </div>)}
    </div>
  </AnimatedFigure>;
}
