import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import AnimatedFigure from './AnimatedFigure';
import { useFigurePlayback } from './useFigurePlayback';
import { lessonInfo, type FigureId } from './lesson-models';
import { lessonRenderers, paintLesson, type LessonFrame } from './lessonCanvas';

/** Canvas and accessible SVG read the same commands and event state. */
function StaticLesson({ frame, width, title }: {frame:LessonFrame;width:number;title:string}) {
  const id=useId();
  return <svg viewBox={`0 0 ${width} ${frame.height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{frame.ops.filter(op=>op.type==='text').map(op=>op.text).join(' · ')}. {frame.status}</desc>
    {frame.ops.map((op,i)=>{
      switch(op.type) {
        case 'rect': return <rect key={i} x={op.x} y={op.y} width={op.w} height={op.h} rx="3" fill={op.fill} stroke={op.stroke}/>;
        case 'circle': return <circle key={i} cx={op.x} cy={op.y} r={op.r} fill={op.color}/>;
        case 'line': return <line key={i} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.color} strokeWidth="1.5" strokeDasharray={op.dash?'4 4':undefined}/>;
        case 'text': return <text key={i} x={op.x} y={op.y} fill={op.color} fontSize={op.size} fontWeight={op.bold?600:400} textAnchor={op.align==='center'?'middle':op.align==='right'?'end':'start'}>{op.text}</text>;
      }
    })}
  </svg>;
}

export default function LessonFigure({ figureId, sourceBlockId }: {figureId:FigureId;sourceBlockId?:string}) {
  const info=lessonInfo.find(item=>item.id===figureId)!;
  const renderer=lessonRenderers[figureId];
  const wideWidth=figureId==='W03'?480:560;
  const containerRef=useRef<HTMLElement>(null);
  const plotRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const surface=useRef<{context:CanvasRenderingContext2D;width:number;dpr:number;font:string}|null>(null);
  const failed=useRef(false);
  const [ready,setReady]=useState(false);
  const [width,setWidth]=useState(0);
  const finalStatus=renderer(wideWidth,info.final).status;
  const [status,setStatus]=useState(finalStatus);
  const lastStatus=useRef(finalStatus);
  const staticFrames=useMemo(()=>({wide:renderer(width||wideWidth,info.final),narrow:renderer(width||227,info.final)}),[renderer,width,wideWidth,info.final]);

  const frame=useCallback((elapsed:number)=>{
    const current=surface.current,canvas=canvasRef.current;
    if(failed.current||!current||!canvas||current.width<=0)return;
    try {
      const scene=renderer(current.width,Math.min(elapsed,info.final));
      paintLesson(current.context,scene,current.width,current.dpr,current.font);
      canvas.dataset.elapsed=String(Math.round(elapsed));
      if(lastStatus.current!==scene.status){lastStatus.current=scene.status;setStatus(scene.status);}
    } catch {
      failed.current=true;setReady(false);setStatus(finalStatus);lastStatus.current=finalStatus;
    }
  },[renderer,info.final,finalStatus]);
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
      if(disposed||failed.current||!canvas||!plot||!container)return;
      const measuredWidth=plot.getBoundingClientRect().width;
      if(measuredWidth<=0){surface.current=null;setReady(false);return;}
      const dpr=Math.max(1,window.devicePixelRatio||1);
      const height=renderer(measuredWidth,info.final).height;
      const pixelsWidth=Math.round(measuredWidth*dpr),pixelsHeight=Math.round(height*dpr);
      if(canvas.width!==pixelsWidth||canvas.height!==pixelsHeight){canvas.width=pixelsWidth;canvas.height=pixelsHeight;}
      surface.current={context:measuredContext,width:measuredWidth,dpr,font:getComputedStyle(container).fontFamily};
      setWidth(measuredWidth);
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
    <div className="lesson-static lesson-static--wide"><StaticLesson frame={renderer(width||wideWidth,elapsed)} width={width||wideWidth} title={title}/></div>
    <div className="lesson-static lesson-static--narrow"><StaticLesson frame={renderer(width||227,elapsed)} width={width||227} title={title}/></div>
  </>;
  const style={'--lesson-wide-height':`${staticFrames.wide.height}px`,'--lesson-narrow-height':`${staticFrames.narrow.height}px`} as CSSProperties;
  return <AnimatedFigure containerRef={containerRef} title={info.title} caption={info.caption} running={playback.running} figureId={figureId} sourceBlockId={sourceBlockId}>
    <div className={`lesson-plot lesson-layout--${figureId}`} ref={plotRef} data-ready={ready&&!playback.reducedMotion} style={style}>
      {staticPair(info.final,info.title)}
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
    <p className="sr-only" hidden={!ready||playback.reducedMotion}>완료 장면 설명. {info.notes[2]}</p>
    <p className="lesson-status">{ready?status:finalStatus}</p>
    {figureId==='T01'&&<p className="lesson-lock-ids">L1: 0x00000005c0c4b1e8<br/>L2: 0x00000005c0c4b1f8<br/>exec-5/6: http-nio-8080-exec-5/6</p>}
    <details className={`lesson-steps lesson-layout--${figureId}`}>
      <summary>단계별 장면</summary>
      {info.steps.map((elapsed,i)=><div className="lesson-step" key={elapsed}>
        <p>{i+1}. {info.notes[i]}</p>
        <div className="lesson-step-plot" style={{'--lesson-wide-height':`${renderer(width||wideWidth,elapsed).height}px`,'--lesson-narrow-height':`${renderer(width||227,elapsed).height}px`} as CSSProperties}>{staticPair(elapsed,`${info.title} · ${i+1}`)}</div>
      </div>)}
    </details>
  </AnimatedFigure>;
}
