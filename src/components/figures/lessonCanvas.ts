import { arrivalTimes, queueState, flowState, flowEvents, cacheState, lockState, indexState, sparkState, progress, type FigureId } from './lesson-models';

export type DrawOp =
 | {type:'rect';x:number;y:number;w:number;h:number;fill:string;stroke:string}
 | {type:'text';x:number;y:number;text:string;color:string;size:number;align:CanvasTextAlign;bold:boolean;mono?:boolean;alpha?:number;weight?:number}
 | {type:'line';x1:number;y1:number;x2:number;y2:number;color:string;dash:boolean}
 | {type:'circle';x:number;y:number;r:number;color:string;stroke?:string;strokeWidth?:number;alpha?:number}
 /** Rounded shapes, curves, arrowheads and icons share one SVG path string in Canvas and SVG. */
 | {type:'path';d:string;fill:string;stroke:string;width:number;dash:number[]|null;alpha:number};
export interface LessonFrame {ops:DrawOp[];height:number;status:string}
/** One palette for Canvas, static SVG and the --color-figure-* CSS tokens. */
export const FIGURE_COLORS: Readonly<Record<'bg'|'plot'|'slab'|'grid'|'line'|'border'|'faint'|'blue'|'green'|'orange'|'red'|'text'|'muted'|'blueText'|'greenText'|'orangeText'|'redText'|'blueTint'|'blueSoft'|'greenTint'|'orangeTint'|'redTint',string>>={bg:'#ffffff',plot:'#f8f9fa',slab:'#f1f3f5',grid:'#e9ecef',line:'#ced4da',border:'#dee2e6',faint:'#adb5bd',blue:'#228be6',green:'#12b886',orange:'#fd7e14',red:'#fa5252',text:'#343a40',muted:'#586b80',blueText:'#1864ab',greenText:'#087f5b',orangeText:'#9c4b00',redText:'#c92a2a',blueTint:'#e7f5ff',blueSoft:'#a5d8ff',greenTint:'#e6fcf5',orangeTint:'#fff4e6',redTint:'#fff5f5'};
const F=FIGURE_COLORS;
const C={ink:F.text,muted:F.muted,line:F.line,grid:F.grid,bg:F.plot,blue:F.blue,green:F.green,orange:F.orange,red:F.red,blueText:F.blueText,greenText:F.greenText,orangeText:F.orangeText,redText:F.redText};
/** Linear display progress of one span: 0 and 1 at its ends, clamped outside, invalid when the span has no length. */
export function span(t:number,start:number,end:number){if(!(end>start))throw new Error(`invalid span ${start}..${end}`);return Math.max(0,Math.min(1,(t-start)/(end-start)));}
/** CSS-compatible cubic-bezier: find the curve parameter for x first, then read y. */
export function cubicBezier(x1:number,y1:number,x2:number,y2:number){
 if(x1<0||x1>1||x2<0||x2>1)throw new Error('cubic-bezier x control points must be within 0..1');
 const bx=(s:number)=>3*x1*s*(1-s)*(1-s)+3*x2*s*s*(1-s)+s*s*s,by=(s:number)=>3*y1*s*(1-s)*(1-s)+3*y2*s*s*(1-s)+s*s*s;
 return (x:number)=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<26;i++){const m=(lo+hi)/2;if(bx(m)<x)lo=m;else hi=m;}return by((lo+hi)/2);};
}
const r2=(n:number)=>Math.round(n*100)/100;
/** Closed rounded rectangle; the radius never exceeds half of the shorter side. */
export function roundedRectPath(x:number,y:number,w:number,h:number,r:number){
 const k=r2(Math.max(0,Math.min(r,w/2,h/2)));
 if(!k)return `M${r2(x)} ${r2(y)}H${r2(x+w)}V${r2(y+h)}H${r2(x)}Z`;
 return `M${r2(x+k)} ${r2(y)}H${r2(x+w-k)}A${k} ${k} 0 0 1 ${r2(x+w)} ${r2(y+k)}V${r2(y+h-k)}A${k} ${k} 0 0 1 ${r2(x+w-k)} ${r2(y+h)}H${r2(x+k)}A${k} ${k} 0 0 1 ${r2(x)} ${r2(y+h-k)}V${r2(y+k)}A${k} ${k} 0 0 1 ${r2(x+k)} ${r2(y)}Z`;
}
function drawing(){const ops: DrawOp[]=[];return {ops,rect:(x:number,y:number,w:number,h:number,fill:string=C.bg,stroke:string=C.line)=>ops.push({type:'rect',x,y,w,h,fill,stroke}),text:(x:number,y:number,text:string|number,color:string=C.ink,size:number=12,align:CanvasTextAlign='left',bold:boolean=false)=>ops.push({type:'text',x,y,text:String(text),color,size,align,bold}),line:(x1:number,y1:number,x2:number,y2:number,color:string=C.line,dash:boolean=false)=>ops.push({type:'line',x1,y1,x2,y2,color,dash}),circle:(x:number,y:number,r:number,color:string)=>ops.push({type:'circle',x,y,r,color})};}
function arrow(g:ReturnType<typeof drawing>,x1:number,y1:number,x2:number,y2:number,color:string,dash=false){g.line(x1,y1,x2,y2,color,dash);const a=Math.atan2(y2-y1,x2-x1);g.line(x2,y2,x2-6*Math.cos(a-.45),y2-6*Math.sin(a-.45),color);g.line(x2,y2,x2-6*Math.cos(a+.45),y2-6*Math.sin(a+.45),color);}
function moving(g:ReturnType<typeof drawing>,t:number,start:number,end:number,x1:number,y1:number,x2:number,y2:number,color:string){if(t<start||t>=end)return;const p=progress(t,start,end);g.circle(x1+(x2-x1)*p,y1+(y2-y1)*p,4.5,color);}
function panels(w:number,h:number){return w>=560?[{x:0,y:0,w:(w-24)/2},{x:(w+24)/2,y:0,w:(w-24)/2}]:[{x:0,y:0,w},{x:0,y:h+28,w}];}
function queueDrawing(w:number,t:number): LessonFrame{const g=drawing(),ps=panels(w,300);for(let n=0;n<2;n++){
 const p=ps[n],cap=n===0?2:6,s=queueState(t,cap),x=p.x,y=p.y,pw=p.w;
 g.text(x,y+12,cap===2?'작은 버퍼 · 2개':'큰 버퍼 · 6개',C.ink,12,'left',true);
 g.rect(x,y+28,pw,236);g.text(x+16,y+52,'송신 → FIFO 큐 → 수신',C.muted,11);
 for(let i=0;i<6;i++){const target=arrivalTimes[i];if(t>=target-400&&t<target){const ap=progress(t,target-400,target),destX=i<cap?x+29+(i%Math.min(cap,Math.max(1,Math.floor((pw-32)/32))))*32:x+pw-18,destY=i<cap?y+86+Math.floor(i/Math.min(cap,Math.max(1,Math.floor((pw-32)/32))))*38:y+116;g.circle(x+pw-18+(destX-x-pw+18)*ap,y+52+(destY-y-52)*ap,4,i===5?C.orange:C.blue);}}
 const cell=26,gap=6,cols=Math.min(cap,Math.max(1,Math.floor((pw-32)/(cell+gap))));
 for(let i=0;i<cap;i++){const bx=x+16+(i%cols)*(cell+gap),by=y+72+Math.floor(i/cols)*38;const id=s.queued[i];g.rect(bx,by,cell,28,id===6?'#fff4e6':id?'#e7f5ff':'#fff',id===6?C.orange:C.line);if(id)g.text(bx+13,by+18,id,id===6?C.orangeText:C.blueText,12,'center',true);}
 const ay=y+170;arrow(g,x+16,ay,x+pw-18,ay,C.line);g.text(x+16,ay+23,'출력',C.muted,11);g.text(x+pw-16,ay+23,'수신',C.muted,11,'right');
 if(s.output>0&&s.output<1)g.circle(x+16+(pw-34)*s.output,ay,5,s.queued[0]===6?C.orange:C.blue);
 g.text(x+16,y+233,`유입 ${s.arrived}   대기 ${s.queued.length}`,C.ink,12);g.text(x,y+285,`처리 ${s.processed.length}   손실 ${s.dropped.length}`,s.dropped.length?C.redText:C.greenText,12);
 if(s.dropped.length)g.text(x+pw,y+285,`× ${s.dropped.join(', ')}`,C.redText,11,'right');
 }
 const s=queueState(t,6);return {ops:g.ops,height:ps[1].y+300,status:t<3200?'같은 패킷이 같은 시점에 두 큐로 들어갑니다.':t<9600?`큰 큐의 6번 요청: ${s.processed.includes(6)?'처리 완료':'앞선 패킷이 나가기를 기다리는 중'}. 작은 큐에서는 이미 손실됐습니다.`:'작은 큐는 4개를 잃고, 큰 큐는 6번 요청까지 순서대로 전달합니다.'};}
function flowDrawing(w:number,t:number): LessonFrame{const g=drawing(),s=flowState(t),a=24,b=w-24;
 g.text(a,15,'송신',C.ink,12,'left',true);g.text(b,15,'수신',C.ink,12,'right',true);g.line(a,32,a,444);g.line(b,32,b,444);
 flowEvents.forEach((e,i)=>{const y=51+i*39,x1=e.from==='sender'?a:b,x2=e.from==='sender'?b:a,visible=t>=e.start;
 g.text(w/2,y-9,e.label,visible?C[`${e.tone}Text` as keyof typeof C]:C.muted,w<280?10.5:11,'center');
 if(visible){const end=x1+(x2-x1)*progress(t,e.start,e.end);if(t>=e.end)arrow(g,x1,y,x2,y,C[e.tone]);else g.line(x1,y,end,y,C[e.tone]);moving(g,t,e.start,e.end,x1,y,x2,y,C[e.tone]);}else g.line(x1,y,x2,y,C.grid,true);
 });
 g.rect(0,467,w,104);g.text(14,490,`수신 버퍼   ${s.buffer.toLocaleString()} / 8,760 B`,C.ink,11);
 g.rect(14,506,w-28,12,'#fff');if(s.buffer)g.rect(14,506,(w-28)*s.buffer/8760,12,s.buffer===8760?C.red:C.blue,'none');g.text(14,546,`송신 측이 받은 rwnd   ${s.advertised.toLocaleString()} B`,s.advertised===0?C.redText:C.greenText,11);
 return {ops:g.ops,height:578,status:s.phase};}
function cacheDrawing(w:number,t:number): LessonFrame{const g=drawing(),s=cacheState(t),vertical=w<480;const nodes=vertical?[{x:(w-96)/2,y:0},{x:(w-96)/2,y:125},{x:(w-96)/2,y:250}]:[{x:0,y:24},{x:(w-96)/2,y:24},{x:w-96,y:24}];
 const centers=nodes.map(p=>({x:p.x+48,y:p.y+25}));
 for(let i=0;i<3;i++){const p=nodes[i];g.rect(p.x,p.y,96,50,'#fff');g.text(p.x+48,p.y+30,['Client','Proxy cache','Origin'][i],C.ink,12,'center',true);}
 const route=(from:number,to:number,start:number,end:number,color:string)=>{const a=centers[from],b=centers[to];const offset=from<to?12:-12;const x1=vertical?a.x-offset:a.x+48*Math.sign(b.x-a.x),y1=vertical?a.y+25*Math.sign(b.y-a.y):a.y-offset;const x2=vertical?b.x-offset:b.x-48*Math.sign(b.x-a.x),y2=vertical?b.y-25*Math.sign(b.y-a.y):b.y-offset;
 if(t>=5600&&((from===1&&to===2)||(from===2&&to===1)))color=C.grid;
 if(t>=start)arrow(g,x1,y1,x2,y2,t>=end?color:C.line);else g.line(x1,y1,x2,y2,C.grid,true);moving(g,t,start,end,x1,y1,x2,y2,color);};
 route(0,1,1100,1800,C.blue);route(1,2,1800,2500,C.blue);route(2,1,3000,3800,C.green);route(1,0,3800,4600,C.green);route(0,1,5600,6400,C.orange);route(1,0,6400,7200,C.green);
 const base=vertical?330:128;
 g.rect(0,base,w,150);g.text(14,base+24,'GET /app.css',C.ink,12,'left',true);g.text(14,base+50,'저장 응답'+'   '+(s.stored?'200 · public':'없음'),s.stored?C.greenText:C.muted,12);g.text(14,base+75,'max-age=600',C.muted,11);
 g.text(14,base+104,`X-Proxy-Cache: ${s.hit?'HIT':t>=1800?'MISS':'—'}`,s.hit?C.greenText:C.orangeText,12,'left',true);
 g.text(14,base+129,`클라이언트 요청 ${s.clientRequests}   원본 요청 ${s.originRequests}`,C.muted,11);
 g.text(w/2,vertical?110:108,t<5600?'① 첫 요청 · MISS':t<6400?'② 같은 키 · 조회':'② 같은 키 · HIT',C.ink,12,'center');
 return {ops:g.ops,height:base+166,status:s.phase};}
function lockDrawing(w:number,t:number): LessonFrame{const g=drawing(),s=lockState(t),bw=Math.min(126,(w-42)/2),left=0,right=w-bw,ty=16,ly=264;
 const node=(x:number,y:number,label:string,sub:string,color:string)=>{g.rect(x,y,bw,65,'#fff',color);g.text(x+bw/2,y+25,label,C.ink,12,'center',true);g.text(x+bw/2,y+49,sub,color===C.red?C.redText:C.muted,11,'center');};
 node(left,ty,'exec-5',s.waits['exec-5']?'BLOCKED':s.owners.L1?'L1 점유':'RUNNABLE',s.waits['exec-5']?C.red:C.line);
 node(right,ty,'exec-6',s.waits['exec-6']?'BLOCKED':s.owners.L2?'L2 점유':'RUNNABLE',s.waits['exec-6']?C.red:C.line);
 node(left,ly,'L1 · …b1e8',s.owners.L1||'비어 있음',s.owners.L1?C.blue:C.line);node(right,ly,'L2 · …b1f8',s.owners.L2||'비어 있음',s.owners.L2?C.blue:C.line);
 if(s.owners.L1)arrow(g,left+bw*.25,ly,left+bw*.25,ty+65,C.blue);
 if(s.owners.L2)arrow(g,right+bw*.75,ly,right+bw*.75,ty+65,C.blue);
 if(s.waits['exec-5']){arrow(g,left+bw*.7,ty+65,right+bw*.3,ly,C.orange,true);moving(g,t%2000,0,2000,left+bw*.7,ty+65,right+bw*.3,ly,C.orange);}
 if(s.waits['exec-6']){arrow(g,right+bw*.3,ty+65,left+bw*.7,ly,C.red,true);moving(g,t%2000,0,2000,right+bw*.3,ty+65,left+bw*.7,ly,C.red);}
 g.rect(w/2-38,154,76,29,'#fff',s.deadlock?C.red:C.line);g.text(w/2,173,s.deadlock?'순환 대기':'락 요청',s.deadlock?C.redText:C.muted,11,'center',true);
 g.text(0,363,'실선: 락 → 점유자',C.blueText,11);g.text(0,387,'점선: 스레드 → 기다리는 락',C.orangeText,11);
 return {ops:g.ops,height:405,status:s.phase};}
function indexDrawing(w:number,t:number): LessonFrame{const g=drawing(),ps=panels(w,344);for(let n=0;n<2;n++){
 const p=ps[n],s=indexState(t,n?'time':'employee'),x=p.x,y=p.y,pw=p.w;
 g.text(x,y+13,n?'(time, employee_id)':'(employee_id, time)',C.ink,12,'left',true);
 g.rect(x,y+31,pw,214);g.text(x+12,y+55,n?'time':'employee_id',C.muted,11);g.text(x+pw-12,y+55,n?'id':'time',C.muted,11,'right');
 s.rows.forEach((row,i)=>{const yy=y+65+i*34,visited=s.visited.includes(i),match=visited&&row[0]===2;g.rect(x+1,yy,pw-2,33,match?'#e6fcf5':visited?'#f1f3f5':'#fff','none');g.text(x+12,yy+22,n?row[1]:row[0],match?C.greenText:C.ink,11);g.text(x+pw-12,yy+22,n?row[0]:row[1],match?C.greenText:C.ink,11,'right');
 if(visited&&i===s.visited.at(-1)){g.line(x+2,yy,x+2,yy+33,match?C.green:C.orange);}
 });g.text(x,y+271,`읽은 행 ${s.read}   결과 ${s.matches.length}`,C.ink,12);g.text(x,y+297,s.phase,C.muted,11);g.text(x,y+322,s.read===(n?5:2)?'결과: 01-13 · 10-04':'조건: employee_id = 2',s.read===(n?5:2)?C.greenText:C.muted,11);
 }
 return {ops:g.ops,height:ps[1].y+344,status:t<3500?'선두 열의 값 2는 연속된 범위에 모여 있습니다.':'찾는 행은 같습니다. 열 순서에 따라 확인하는 범위가 달라집니다.'};}
function sparkDrawing(w:number,t:number): LessonFrame{const g=drawing(),s=sparkState(t),vertical=w<560,labels=['Parent RDD','map(x × 2)','filter(x ≥ 8)','count()'];const nodeW=vertical?Math.min(w-24,200):(w-54)/4;
 const nodes=labels.map((_,i)=>({x:vertical?(w-nodeW)/2:i*(nodeW+18),y:vertical?i*70:24}));
 nodes.forEach((p,i)=>{const registered=i===0||i===1&&t>=1200||i===2&&t>=2600||i===3&&t>=4200,done=i===1&&s.mapped||i===2&&s.filtered||i===3&&s.result!==null;g.rect(p.x,p.y,nodeW,45,done?'#e6fcf5':'#fff',registered?(i===3?C.green:C.blue):C.line);g.text(p.x+nodeW/2,p.y+28,labels[i],registered?C.ink:C.muted,12,'center',true);if(i>0){const q=nodes[i-1];const x1=vertical?q.x+nodeW/2:q.x+nodeW,y1=vertical?q.y+45:q.y+22,x2=vertical?p.x+nodeW/2:p.x,y2=vertical?p.y:p.y+22;arrow(g,x1,y1,x2,y2,registered?C.blue:C.line,true);moving(g,t,i===1?4200:i===2?5600:7000,i===1?5600:i===2?7000:8400,x1,y1,x2,y2,C.green);}});
 const base=vertical?284:109;g.text(0,base,s.executed?'action 호출 · 계산 시작':'lineage 등록 · 처리 대기',s.executed?C.greenText:C.muted,12,'left',true);
 const ps=panels(w,144);for(let n=0;n<2;n++){const p=ps[n],x=p.x,y=base+20+p.y;g.rect(x,y,p.w,132);g.text(x+12,y+23,`Partition ${n+1}`,C.muted,11,'left',true);g.text(x+12,y+51,`입력   [${s.input[n].join(', ')}]`,C.ink,11);g.text(x+12,y+78,`map    ${s.mapped?'['+s.mapped[n].join(', ')+']':'계산 전'}`,s.mapped?C.blueText:C.muted,11);g.text(x+12,y+105,`filter   ${s.filtered?'['+s.filtered[n].join(', ')+']':'계산 전'}`,s.filtered?C.greenText:C.muted,11);}
 const end=base+20+ps[1].y+156;g.text(0,end,`Driver 결과   ${s.result===null?'—':s.result}`,s.result===null?C.muted:C.greenText,14,'left',true);
 return {ops:g.ops,height:end+22,status:s.phase};}
export const lessonRenderers: Record<FigureId,(width:number,elapsed:number)=>LessonFrame>={N01:queueDrawing,N03:flowDrawing,W03:cacheDrawing,T01:lockDrawing,D03:indexDrawing,S03:sparkDrawing};
export function paintLesson(ctx:CanvasRenderingContext2D,frame:LessonFrame,w:number,dpr:number,font:string,monoFont:string=font){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,frame.height);for(const o of frame.ops){
 // Commands with opacity, caps or a second font are isolated so the four original commands paint exactly as before.
 if(o.type==='path'){ctx.save();ctx.globalAlpha=o.alpha;const p=new Path2D(o.d);if(o.fill!=='none'){ctx.fillStyle=o.fill;ctx.fill(p);}if(o.stroke!=='none'){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(o.dash??[]);ctx.stroke(p);}ctx.restore();continue;}
 if(o.type==='text'&&(o.mono||o.alpha!==undefined||o.weight!==undefined)){ctx.save();ctx.globalAlpha=o.alpha??1;ctx.fillStyle=o.color;ctx.font=`${o.weight??(o.bold?600:400)} ${o.size}px ${o.mono?monoFont:font}`;ctx.textAlign=o.align;ctx.fillText(o.text,o.x,o.y);ctx.restore();continue;}
 if(o.type==='circle'&&(o.stroke!==undefined||o.alpha!==undefined)){ctx.save();ctx.globalAlpha=o.alpha??1;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle=o.color;ctx.fill();if(o.stroke){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth??1;ctx.stroke();}ctx.restore();continue;}
 if(o.type==='rect'){ctx.fillStyle=o.fill;ctx.fillRect(o.x,o.y,o.w,o.h);if(o.stroke!=='none'){ctx.strokeStyle=o.stroke;ctx.lineWidth=1;ctx.strokeRect(o.x+.5,o.y+.5,o.w-1,o.h-1);}}else if(o.type==='circle'){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle=o.color;ctx.fill();}else if(o.type==='line'){ctx.beginPath();ctx.strokeStyle=o.color;ctx.lineWidth=1.5;ctx.setLineDash(o.dash?[4,4]:[]);ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();ctx.setLineDash([]);}else{ctx.fillStyle=o.color;ctx.font=`${o.bold?600:400} ${o.size}px ${font}`;ctx.textAlign=o.align;ctx.fillText(o.text,o.x,o.y);}}}
