import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import AnimatedFigure from './AnimatedFigure';
import { useFigurePlayback } from './useFigurePlayback';
import { lessonInfo, type FigureId } from './lesson-models';
import { networkInfo, type NetworkFigureId } from './network-models';
import { networkRenderers } from './networkCanvas';
import { lessonRenderers, paintLesson, type LessonFrame } from './lessonCanvas';
import { systemInfo, type SystemFigureId } from './system-models';
import { systemRenderers } from './systemCanvas';
import { dataInfo, type DataFigureId } from './data-models';
import { dataRenderers } from './dataCanvas';
import { infraInfo, type InfraFigureId } from './infra-models';
import { infraRenderers } from './infraCanvas';
import { processInfo, type ProcessFigureId } from './process-models';
import { processRenderers } from './processCanvas';

// Figures placed inside a list item (B04 C09·T03–T05, B05 D01·D02, B06 A02–A06·O07–O09): their smallest plot is the list width.
const LIST_EMBEDDED = new Set<string>(['C09', 'T03', 'T04', 'T05', 'D01', 'D02', 'A02', 'A03', 'A04', 'A05', 'A06', 'O07', 'O08', 'O09']);

// Screen readers hear visible words only, and a wrapped sentence as one piece.
function describe(frame:LessonFrame) {
  const parts:string[]=[];
  for(const op of frame.ops) if(op.type==='text'&&op.text.trim()&&(op.alpha??1)>0.05) {
    if(op.cont&&parts.length) parts[parts.length-1]+=' '+op.text; else parts.push(op.text);
  }
  return parts.join(' · ');
}

/** Canvas and accessible SVG read the same commands and event state. */
export function LessonSvg({ frame, width, title }: {frame:LessonFrame;width:number;title:string}) {
  const id=useId();
  // The figure already carries its title, so the scene is named by its description alone.
  return <svg viewBox={`0 0 ${width} ${frame.height}`} role="img" aria-labelledby={`${id}-description`}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{describe(frame)}. {frame.status}</desc>
    {frame.ops.map((op,i)=>{
      switch(op.type) {
        case 'rect': return <rect key={i} x={op.x} y={op.y} width={op.w} height={op.h} rx="3" fill={op.fill} stroke={op.stroke}/>;
        case 'circle': return <circle key={i} cx={op.x} cy={op.y} r={op.r} fill={op.color} stroke={op.stroke} strokeWidth={op.stroke&&op.stroke!=='none'?op.strokeWidth??1:undefined} opacity={op.alpha}/>;
        case 'path': return <path key={i} d={op.d} fill={op.fill} stroke={op.stroke} strokeWidth={op.stroke==='none'?undefined:op.width} strokeDasharray={op.dash?.join(' ')} strokeLinecap="round" strokeLinejoin="round" opacity={op.alpha<1?op.alpha:undefined}/>;
        case 'line': return <line key={i} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.color} strokeWidth="1.5" strokeDasharray={op.dash?'4 4':undefined}/>;
        case 'text': return <text key={i} x={op.x} y={op.y} fill={op.color} fontSize={op.size} fontWeight={op.weight??(op.bold?600:400)} textAnchor={op.align==='center'?'middle':op.align==='right'?'end':'start'} opacity={op.alpha} style={op.mono?{fontFamily:'var(--font-mono)'}:undefined} xmlSpace={/^\s|\s\s|\s$/.test(op.text)?'preserve':undefined}>{op.text}</text>;
      }
    })}
  </svg>;
}

export default function LessonFigure({ figureId, sourceBlockId }: {figureId:FigureId|NetworkFigureId|SystemFigureId|DataFigureId|InfraFigureId|ProcessFigureId;sourceBlockId?:string}) {
  const info=[...lessonInfo,...networkInfo,...systemInfo,...dataInfo,...infraInfo,...processInfo].find(item=>item.id===figureId)!;
  const renderer={...lessonRenderers,...networkRenderers,...systemRenderers,...dataRenderers,...infraRenderers,...processRenderers}[figureId];
  const wideWidth=figureId==='W03'?480:560;
  // Static scenes are drawn at the smallest plot of each layout and only scale up: 284px in the article
  // at a 320px viewport, 259px when a network figure sits inside a list. Wide scenes start at the layout switch.
  const narrowWidth=networkInfo.some(item=>item.id===figureId)||LIST_EMBEDDED.has(figureId)?259:284;
  const containerRef=useRef<HTMLElement>(null);
  const plotRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const surface=useRef<{context:CanvasRenderingContext2D;width:number;dpr:number;font:string;mono:string}|null>(null);
  const failed=useRef(false);
  const [ready,setReady]=useState(false);
  const [width,setWidth]=useState(0);
  const staticFrames=useMemo(()=>({wide:renderer(width||wideWidth,info.final),narrow:renderer(width||narrowWidth,info.final)}),[renderer,width,wideWidth,narrowWidth,info.final]);

  const frame=useCallback((elapsed:number)=>{
    const current=surface.current,canvas=canvasRef.current;
    if(failed.current||!current||!canvas||current.width<=0)return;
    try {
      const scene=renderer(current.width,Math.min(elapsed,info.final));
      paintLesson(current.context,scene,current.width,current.dpr,current.font,current.mono);
      canvas.dataset.elapsed=String(Math.round(elapsed));
    } catch {
      failed.current=true;setReady(false);
    }
  },[renderer,info.final]);
  const playback=useFigurePlayback({containerRef,durationMs:info.duration,finalElapsedMs:info.final,enabled:ready,onFrame:frame});

  useEffect(()=>{
    const canvas=canvasRef.current,plot=plotRef.current,container=containerRef.current;
    if(!canvas||!plot||!container)return;
    let disposed=false;
    failed.current=false;
    setReady(false);
    let context:CanvasRenderingContext2D|null=null;
    try {context=canvas.getContext('2d');} catch {failed.current=true;}
    if(!context){failed.current=true;surface.current=null;return;}
    const measuredContext=context;
    function measure() {
      if(disposed||!canvas||!plot||!container)return;
      const measuredWidth=plot.getBoundingClientRect().width;
      if(measuredWidth<=0){surface.current=null;setReady(false);return;}
      // Keep the SVG responsive even after Canvas rendering has failed.
      setWidth(measuredWidth);
      if(failed.current){surface.current=null;setReady(false);return;}
      const dpr=Math.max(1,window.devicePixelRatio||1);
      const height=renderer(measuredWidth,info.final).height;
      const pixelsWidth=Math.round(measuredWidth*dpr),pixelsHeight=Math.round(height*dpr);
      if(canvas.width!==pixelsWidth||canvas.height!==pixelsHeight){canvas.width=pixelsWidth;canvas.height=pixelsHeight;}
      const css=getComputedStyle(container);
      surface.current={context:measuredContext,width:measuredWidth,dpr,font:css.fontFamily,mono:css.getPropertyValue('--font-mono').trim()||'monospace'};
      playback.redraw();
      if(!failed.current)setReady(true);
    }
    const observer='ResizeObserver' in window?new ResizeObserver(measure):null;
    observer?.observe(plot);
    let resolution:MediaQueryList|null=null;
    function watchResolution(){resolution?.removeEventListener('change',changeResolution);resolution=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);resolution.addEventListener('change',changeResolution);}
    function changeResolution(){measure();watchResolution();}
    watchResolution();
    window.addEventListener('resize',measure,{passive:true});
    document.fonts?.ready.then(()=>{if(!disposed)measure();});
    document.fonts?.addEventListener('loadingdone',measure);
    measure();
    return ()=>{disposed=true;observer?.disconnect();resolution?.removeEventListener('change',changeResolution);window.removeEventListener('resize',measure);document.fonts?.removeEventListener('loadingdone',measure);surface.current=null;};
  },[renderer,info.final,playback.redraw]);

  const staticPair=(elapsed:number,title:string)=><>
    <div className="lesson-static lesson-static--wide"><LessonSvg frame={renderer(width||wideWidth,elapsed)} width={width||wideWidth} title={title}/></div>
    <div className="lesson-static lesson-static--narrow"><LessonSvg frame={renderer(width||narrowWidth,elapsed)} width={width||narrowWidth} title={title}/></div>
  </>;
  const style={'--lesson-wide-height':`${staticFrames.wide.height}px`,'--lesson-narrow-height':`${staticFrames.narrow.height}px`} as CSSProperties;
  return <AnimatedFigure containerRef={containerRef} title={info.title} running={playback.running} figureId={figureId} sourceBlockId={sourceBlockId}>
    <div className={`lesson-plot lesson-layout--${figureId}`} ref={plotRef} data-ready={ready&&!playback.reducedMotion} style={style}>
      {staticPair(info.final,info.title)}
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
    <p className="sr-only" hidden={!ready||playback.reducedMotion}>완료 장면 설명. {info.notes[2]}</p>
    <details className={`lesson-steps lesson-layout--${figureId}`}>
      <summary>과정 보기</summary>
      {info.steps.map((elapsed,i)=><div className="lesson-step" key={elapsed}>
        <p>{i+1}. {info.notes[i]}</p>
        <div className="lesson-step-plot" style={{'--lesson-wide-height':`${renderer(width||wideWidth,elapsed).height}px`,'--lesson-narrow-height':`${renderer(width||narrowWidth,elapsed).height}px`} as CSSProperties}>{staticPair(elapsed,`${info.title} · ${i+1}`)}</div>
      </div>)}
    </details>
  </AnimatedFigure>;
}
