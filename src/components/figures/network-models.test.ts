import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as zlib from 'node:zlib';
import { networkModels, networkState, networkInfo, gzipFixture, type NetworkFigureId } from './network-models';
import { networkRenderers } from './networkCanvas';
function state<I extends NetworkFigureId>(id:I,t:number){const model=networkModels[id];assert.equal(typeof model,'function',id+' event model is not implemented');return networkState(id,t);}
test('N02 keeps BDP separate from window limit and converts bits to bytes',()=>{const a=state('N02',0);assert.equal(a.bdpBytes,500000);assert.equal(a.smallMbps,12.8);assert.equal(a.largeMbps,100);assert.equal(a.acknowledged,0);assert.equal(state('N02',5000).acknowledged,500000)});
test('N04 does not establish passive peer or deliver DATA before packets arrive',()=>{assert.equal(state('N04',2899).client,'SYN-SENT');assert.equal(state('N04',2900).client,'ESTABLISHED');assert.equal(state('N04',4099).server,'SYN-RECEIVED');assert.equal(state('N04',4100).server,'ESTABLISHED');assert.equal(state('N04',4999).receivedBytes,0);assert.equal(state('N04',5000).receivedBytes,1460);assert.equal(state('N04',5800).ackNumber,2461)});
test('N05 RTO reduces to one SMSS and half-flight threshold before restarting',()=>{assert.equal(state('N05',3999).cwnd,4);assert.equal(state('N05',4000).cwnd,8);assert.equal(state('N05',7000).cwnd,1);assert.equal(state('N05',7000).threshold,5);assert.equal(state('N05',9700).cwnd,5);assert.equal(state('N05',10600).cwnd,6)});
test('N06 fast retransmit needs three received dupacks and RTO case never invents them',()=>{assert.equal(state('N06',4299).fast.dupacks,2);assert.equal(state('N06',4300).fast.dupacks,3);assert.equal(state('N06',4299).fast.retransmitted,false);assert.equal(state('N06',4900).fast.retransmitted,true);assert.equal(state('N06',7000).rto.dupacks,0);assert.equal(state('N06',6299).rto.retransmitted,false);assert.equal(state('N06',6300).rto.retransmitted,true)});
test('N07 payload/headers/FCS sum to the full frame without counting L2 as IP MTU',()=>{const s=state('N07',5000);assert.equal(s.mss,1460);assert.equal(s.ipBytes,1500);assert.equal(s.frameBytes,1518);assert.equal(s.parts.reduce((n,p)=>n+p.bytes,0),1518)});
test('N08 pinned ProbeBW gains build then drain the illustrative queue without fake throughput',()=>{assert.equal(state('N08',2100).gain,1.25);assert.equal(state('N08',3000).queueBytes,125000);assert.equal(state('N08',3100).gain,.75);assert.equal(state('N08',4000).queueBytes,0);assert.equal(state('N08',5000).gain,1);assert.equal(state('N08',10000).bbrBdp,500000)});
test('N09 enabled TCP_NODELAY sends second small write before delayed ACK arrives',()=>{assert.equal(state('N09',3000).nagle.secondSent,false);assert.equal(state('N09',3000).nodelay.secondSent,true);assert.equal(state('N09',4599).nagle.secondSent,false);assert.equal(state('N09',4600).nagle.secondSent,true)});
test('N10 passive peer retransmits FIN and waits for final ACK while active remains TIME_WAIT',()=>{assert.equal(state('N10',6400).passive,'LAST-ACK');assert.equal(state('N10',6600).finSender,'수동 종료');assert.equal(state('N10',7200).active,'TIME_WAIT');assert.equal(state('N10',8499).passive,'LAST-ACK');assert.equal(state('N10',8500).passive,'CLOSED');assert.equal(state('N10',8500).active,'TIME_WAIT');assert.equal(state('N10',10000).tupleHeld,false)});
test('N11 app cannot receive later segments while a preceding byte range is missing',()=>{assert.deepEqual(state('N11',4300).buffer,[3,4]);assert.deepEqual(state('N11',4300).delivered,[1]);assert.deepEqual(state('N11',6699).delivered,[1]);assert.deepEqual(state('N11',6700).delivered,[1,2,3,4])});
test('N12 failed connection waits full three-probe budget; answered connection resets idle timer',()=>{assert.equal(state('N12',7999).failed,false);assert.equal(state('N12',8000).failed,true);assert.equal(state('N12',6900).unanswered,3);assert.equal(state('N12',4500).alive,true);assert.equal(state('N12',4500).idleReset,true)});
test('N13 reuse compares three identical requests with one connection and no TCP probes',()=>{const s=state('N13',9500);assert.equal(s.fresh.requests,3);assert.equal(s.fresh.handshakes,3);assert.equal(s.reuse.requests,3);assert.equal(s.reuse.handshakes,1);assert.equal(s.reuse.probes,0);assert.equal(s.reuse.closed,true)});
test('W01 first byte precedes complete body and dependent resource requests',()=>{assert.equal(state('W01',3899).firstByte,false);assert.equal(state('W01',3900).firstByte,true);assert.equal(state('W01',4899).htmlComplete,false);assert.equal(state('W01',4900).htmlComplete,true);assert.equal(state('W01',4999).cssStarted,false);assert.equal(state('W01',5000).cssStarted,true)});
test('W02 gzip fixture restores identical bytes and decode occurs after arrival',()=>{const s=state('W02',0);const fixture=Buffer.from(gzipFixture());const compressed=zlib.gzipSync(fixture);assert.equal(s.rawBytes,fixture.length);assert.equal(s.gzipBytes,compressed.length);assert.deepEqual(zlib.gunzipSync(compressed),fixture);assert.equal(state('W02',3399).gzipReceived,false);assert.equal(state('W02',3400).gzipReceived,true);assert.equal(state('W02',3899).decoded,false);assert.equal(state('W02',3900).decoded,true)});
test('W04 304 supplies no new body and changed ETag stores v2 only on body completion',()=>{assert.equal(state('W04',3500).unchanged.bodyBytes,0);assert.equal(state('W04',3500).unchanged.tag,'v1');assert.equal(state('W04',7799).changed.tag,'v1');assert.equal(state('W04',7800).changed.tag,'v2');assert.equal(state('W04',9000).policies.noStore,false);assert.equal(state('W04',9000).policies.noCache,true)});
test('W05 HTTP/2 stream frames remain blocked above TCP until missing bytes recovered',()=>{assert.deepEqual(state('W05',4900).bufferedStreams,[3,5]);assert.deepEqual(state('W05',4900).deliveredStreams,[]);assert.deepEqual(state('W05',7199).deliveredStreams,[]);assert.deepEqual(state('W05',7200).deliveredStreams,[1,3,5])});
test('W06 retains two stated resource assumptions for both path and query cases',()=>{const s=state('W06',5000);assert.equal(s.endpoint.single,'/stations/{id}');assert.equal(s.endpoint.collection,'/stations?name=...');assert.deepEqual(s.codes.endpointPolicy,[200,200]);assert.deepEqual(s.codes.missingRepresentation,[404,404]);assert.equal(s.isRecommendation,false)});
test('N06 empty follow-up lane does not animate an invented packet while RTO is pending',()=>{state('N06',0);const f=networkRenderers.N06(680,3000);assert.equal(f.ops.filter(o=>o.type==='circle'&&o.x<328).length,0)});
test('sixteen figures keep finite shapes inside the responsive scene',()=>{state('N02',0);for(const item of networkInfo)for(const w of [200,227,297,678])for(const t of [0,...item.steps,item.final]){const f=networkRenderers[item.id](w,t);assert.ok(f.height>0,item.id);for(const op of f.ops){for(const [k,v] of Object.entries(op))if(['x','y','x1','y1','x2','y2','w','h','r','size'].includes(k))assert.ok(typeof v==='number'&&Number.isFinite(v),item.id+' nonfinite '+k);if(op.type==='rect'){assert.ok(op.x>=0&&op.y>=0&&op.w>=0&&op.h>=0,item.id+' negative rectangle');assert.ok(op.x+op.w<=w+.01,item.id+' horizontal rectangle overflow');assert.ok(op.y+op.h<=f.height+.01,item.id+' vertical rectangle overflow');}}}});
test('W02 compression precedes gzip send and both wire paths use the same byte rate',()=>{const a=state('W02',2000);assert.ok(a.rawSentBytes>0);assert.equal(a.gzipSentBytes,0);const b=state('W02',3000),c=state('W02',3100);assert.ok(Math.abs((c.rawSentBytes-b.rawSentBytes)-(c.gzipSentBytes-b.gzipSentBytes))<.001)});

test('N09 changes only sending policy and keeps the receiver ACK timer identical',()=>{
  for(const t of [0,1700,3000,3600,4599]){
    const s=state('N09',t);
    assert.equal(s.nagle.acked,false);assert.equal(s.nodelay.acked,false);
  }
  const s=state('N09',4600);
  assert.equal(s.nagle.acked,true);assert.equal(s.nodelay.acked,true);
});
test('N10 expiry explanation appears only after TIME_WAIT ends',()=>{
  const text=(t:number)=>networkRenderers.N10(560,t).ops.filter(o=>o.type==='text').map(o=>o.text).join(' ');
  for(const t of [0,1000,1100,2900,4200,7200,9999])assert.equal(text(t).includes('2MSL 만료'),false);
  assert.ok(text(10000).includes('2MSL 만료'));
});

test('N10 shows tuple retention only while TIME_WAIT is active',()=>{
  for(const width of [650,346,259]){
    const text=(t:number)=>networkRenderers.N10(width,t).ops.filter(o=>o.type==='text').map(o=>o.text).join(' ');
    for(const t of [0,1100,2900,4199,10000])assert.equal(text(t).includes('TIME_WAIT: 같은 4-tuple 유지'),false);
    for(const t of [4200,7200,9999])assert.equal(text(t).includes('TIME_WAIT: 같은 4-tuple 유지'),true);
    const height=networkRenderers.N10(width,0).height;
    for(const t of [4199,4200,9999,10000])assert.equal(networkRenderers.N10(width,t).height,height);
  }
});

test('N09 does not put an unwritten B in ACK wait',()=>{
  for(const width of [259,331,650]){
    const labels=(t:number)=>networkRenderers.N09(width,t).ops.filter(o=>o.type==='text').map(o=>o.text);
    for(const t of [0,1100,1700,2499])assert.equal(labels(t).some(s=>s.startsWith('B:')),false);
    assert.equal(labels(2500).filter(s=>s==='B: ACK 대기').length,1);
    assert.equal(labels(2500).filter(s=>s==='B: 전송').length,1);
    assert.equal(labels(4600).filter(s=>s==='B: 전송').length,2);
  }
});

test('N12 waiting state follows idle expiry and ACK arrival',()=>{
  for(const width of [259,331,650]){
    const labels=(t:number)=>networkRenderers.N12(width,t).ops.filter(o=>o.type==='text').map(o=>o.text);
    assert.ok(labels(3499).includes('idle 만료 대기'));
    for(const t of [3500,4100,4499]){
      assert.ok(labels(t).includes('probe 응답 대기'));
      assert.equal(labels(t).includes('idle 만료 대기'),false);
      assert.equal(labels(t).includes('응답 도착 → idle 재시작'),false);
    }
    assert.ok(labels(4500).includes('응답 도착 → idle 재시작'));
  }
});

test('N13 reuses the returning response position before settling each completion marker',()=>{
  for(const width of [259,331,650])for(const at of [3500,5300,7100]){
    const n=String([3500,5300,7100].indexOf(at)+1);
    const marker=(t:number,text:string)=>{
      const op=networkRenderers.N13(width,t).ops.filter(o=>o.type==='text'&&o.text===text).at(-1);
      assert.ok(op&&op.type==='text');return op;
    };
    const returning=marker(at-1,'200'),arrived=marker(at,n),settled=marker(at+300,n);
    assert.ok(Math.hypot(returning.x-arrived.x,returning.y-arrived.y)<.1,`${width}/${at} jumped on arrival`);
    assert.ok(Math.abs(arrived.y-settled.y-30)<.01);
    for(let t=at;t<at+300;t++){
      const a=marker(t,n),b=marker(t+1,n);
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1,`${width}/${t} noncontinuous completion`);
    }
  }
});

test('N13 settles later completion markers without overlapping the stored history',()=>{
  for(const width of [259,331,650])for(const [at,n] of [[5300,2],[7100,3]]){
    for(let t=at;t<=at+300;t++){
      const markers=networkRenderers.N13(width,t).ops.filter(o=>o.type==='text'&&/^\d$/.test(o.text));
      const moving=markers.findLast(o=>o.type==='text'&&o.text===String(n))!;
      if(moving.type!=='text')throw new Error('moving completion marker missing');
      for(let previous=1;previous<n;previous++){
        const stored=markers.findLast(o=>o.type==='text'&&o.text===String(previous))!;
        if(stored.type!=='text')throw new Error('stored completion marker missing');
        // 번호 pill의 너비19.2px, 높이18px. 기록의 경계 상자가 겹치지 않아야 한다.
        const separated=Math.abs(moving.x-stored.x)>=19.2-0.01||Math.abs(moving.y-stored.y)>=18-0.01;
        assert.ok(separated,`${width}/${t}: completion ${n} overlaps history ${previous}`);
      }
    }
  }
});

test('N08 starts the gain probe at its highlighted interval, with baseline pacing before it',()=>{
  for(const t of [0,1000,1999]){
    const s=state('N08',t);assert.equal(s.gain,1);assert.equal(s.rateMbps,100);assert.equal(s.queueBytes,0);
  }
  assert.equal(state('N08',2000).gain,1.25);
  assert.equal(state('N08',2000).rateMbps,125);
  assert.equal(state('N08',3000).gain,.75);
  assert.equal(state('N08',4000).gain,1);
});

test('W02 distinguishes completed gzip arrival from decoding completion',()=>{
  for(const width of [259,331,650]){
    const labels=(t:number)=>networkRenderers.W02(width,t).ops.filter(o=>o.type==='text').map(o=>o.text);
    assert.ok(labels(3399).includes('3,039 B · 전송 중'));
    for(const t of [3400,3899]){
      assert.ok(labels(t).includes('3,039 B · 해제 중'));
      assert.equal(labels(t).includes('3,039 B · 수신 완료'),false);
    }
    assert.ok(labels(3900).includes('3,039 B · 수신 완료'));
  }
});
