import assert from 'node:assert/strict';
import { test } from 'vitest';
import * as a from './lesson-models';
// Catches vanished packets, queue overflow and different input in comparison.
test('burst overflow conserves packets; large FIFO delays the last request',()=>{
 assert.equal(a.queueState(3200,2).arrived,6);
 assert.deepEqual(a.queueState(3200,2).dropped,[3,4,5,6]);
 assert.deepEqual(a.queueState(3200,6).queued,[1,2,3,4,5,6]);
 assert.deepEqual(a.queueState(9599,6).processed,[1,2,3,4,5]);
 assert.deepEqual(a.queueState(9600,6).processed,[1,2,3,4,5,6]);
 for(let t=0;t<=12600;t+=50)for(const cap of [2,6]){const s=a.queueState(t,cap);assert.ok(s.queued.length<=cap);assert.equal(s.arrived,s.queued.length+s.processed.length+s.dropped.length);}
});
// Catches receive-before-arrival and resume-before-window-update-arrival.
test('zero-window sender waits for advertised space even after application reads',()=>{
 assert.equal(a.flowState(1699).buffer,0);assert.equal(a.flowState(1700).buffer,2920);
 assert.equal(a.flowState(4100).buffer,8760);assert.equal(a.flowState(4700).advertised,0);
 assert.equal(a.flowState(7000).buffer,0);assert.equal(a.flowState(8199).advertised,0);
 assert.equal(a.flowState(8199).resumed,false);assert.equal(a.flowState(8800).resumed,true);
 for(let t=0;t<13800;t+=50){const s=a.flowState(t);assert.ok(s.buffer>=0&&s.buffer<=8760);if(t>=4700&&t<8200)assert.equal(s.advertised,0);}
});
// Catches caching headers before a complete body, or contacting origin on HIT.
test('cache fills after complete response and fresh HIT does not contact origin',()=>{
 assert.equal(a.cacheState(3799).stored,false);assert.equal(a.cacheState(3800).stored,true);
 assert.equal(a.cacheState(6399).hit,false);assert.equal(a.cacheState(6400).hit,true);
 assert.equal(a.cacheState(6400).originRequests,1);assert.equal(a.cacheState(6400).clientRequests,2);
});
// Catches a falsely released lock or misassigned original dump IDs.
test('deadlock keeps both original lock owners while the wait cycle stays closed',()=>{
 assert.deepEqual(a.lockState(2600).owners,{L1:'exec-5',L2:'exec-6'});
 assert.equal(a.lockState(4599).deadlock,false);
 assert.deepEqual(a.lockState(4600).waits,{'exec-5':'L2','exec-6':'L1'});
 assert.equal(a.lockState(4600).deadlock,true);assert.equal(a.lockState(9000).deadlock,true);
});
// Catches wrong result/order or reading unrelated rows in the prefix scan.
test('two index orders return the same two original rows through different scans',()=>{
 assert.deepEqual(a.indexState(7500,'employee').matches,['2021-01-13','2021-10-04']);
 assert.deepEqual(a.indexState(7500,'time').matches,['2021-01-13','2021-10-04']);
 assert.equal(a.indexState(7500,'employee').read,2);assert.equal(a.indexState(7500,'time').read,5);
});
// Catches a transformation being presented as executed before an action.
test('RDD transformations stay unevaluated until action then yield count three',()=>{
 assert.equal(a.sparkState(4199).executed,false);assert.equal(a.sparkState(4199).result,null);
 assert.equal(a.sparkState(4200).executed,true);assert.equal(a.sparkState(8399).result,null);
 assert.equal(a.sparkState(8400).result,3);
 assert.deepEqual(a.sparkState(8400).filtered,[[],[8,10,12]]);
});


// Catches packet label colors that become unreadable on the white plot or on a filled shape.
import { lessonRenderers, type LessonFrame } from './lessonCanvas';
import { networkRenderers } from './networkCanvas';
import { systemRenderers } from './systemCanvas';
import { lessonInfo } from './lesson-models';
import { networkInfo } from './network-models';
import { systemInfo } from './system-models';
function luminance(hex: string) {
 if(hex.length===4)hex='#'+hex.slice(1).split('').map(c=>c+c).join('');
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
// 채운 path의 경계 상자: M/L/H/V/A의 끝점으로 계산한다
function pathBox(d: string) {
 let x=0,y=0;const xs: number[]=[],ys: number[]=[];
 for(const [,cmd,args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)){const n=args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if(cmd==='H')x=n[n.length-1];else if(cmd==='V')y=n[n.length-1];else if(cmd!=='Z'){x=n[n.length-2];y=n[n.length-1];}
  if(cmd!=='Z'){xs.push(x);ys.push(y);}}
 return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
test('small drawing labels maintain readable contrast throughout each scenario',()=>{
 const all=[...lessonInfo.map(i=>[lessonRenderers[i.id],i] as const),...networkInfo.map(i=>[networkRenderers[i.id],i] as const),...systemInfo.map(i=>[systemRenderers[i.id],i] as const)];
 const mix=(fg: string,bg: string,a: number)=>{const h=(c: string)=>c.length===4?'#'+c.slice(1).split('').map(x=>x+x).join(''):c;const f=h(fg),b=h(bg);return '#'+[1,3,5].map(i=>Math.round(parseInt(f.slice(i,i+2),16)*a+parseInt(b.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,'0')).join('');};
 for(const [draw,item] of all)for(const width of [650,284,259])for(const time of [0,...item.steps,item.final,1700,3500,4700,6500]) {
  // 정적 장면(단계·완료)에서는 흐린 글자도 투명도를 섞은 실제 색으로 읽는다. 재생 중 다른 시각은 페이드 중인 글자를 제외한다
  const still=(item.steps as readonly number[]).includes(time)||time===item.final;
  const shapes: {x:number;y:number;w:number;h:number;fill:string}[]=[];
  for(const op of (draw as (w:number,t:number)=>LessonFrame)(width,time).ops) {
   if(op.type==='rect')shapes.push(op);
   if(op.type==='path'&&op.fill!=='none'&&(op.alpha??1)>.5)shapes.push({...pathBox(op.d),fill:op.fill});
   if(op.type==='circle'&&op.color!=='none'&&(op.alpha??1)>.5)shapes.push({x:op.x-op.r,y:op.y-op.r,w:op.r*2,h:op.r*2,fill:op.color});
   if(op.type==='text'&&op.text.trim()&&(op.alpha??1)>(still?.05:.5)) {
    const bg=shapes.findLast(r=>op.x>=r.x&&op.x<=r.x+r.w&&op.y-2>=r.y&&op.y-2<=r.y+r.h)?.fill??'#ffffff';
    const l1=luminance(still?mix(op.color,bg,op.alpha??1):op.color),l2=luminance(bg);
    assert.ok((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)>=4.5,`Unreadable label in ${item.id} at ${width}/${time}: ${op.text} (${op.color} on ${bg})`);
   }
  }
 }
});
