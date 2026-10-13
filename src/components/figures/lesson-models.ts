const clamp=(v: number)=>Math.max(0,Math.min(1,v));
export const progress=(t: number,start: number,end: number)=>clamp((t-start)/(end-start));
export const arrivalTimes=[1200,1600,2000,2400,2800,3200];
export function queueState(t: number,capacity: number){
 const arrived=arrivalTimes.filter(x=>t>=x).length;
 const accepted=Array.from({length:Math.min(arrived,capacity)},(_,i)=>i+1);
 const processed=accepted.filter((_,i)=>t>=3600+i*1200);
 const queued=accepted.filter(x=>!processed.includes(x));
 const dropped=Array.from({length:Math.max(0,arrived-capacity)},(_,i)=>capacity+i+1);
 return {arrived,queued,processed,dropped,output:queued.length?progress(t,3000+processed.length*1200,3600+processed.length*1200):0};
}
export const flowEvents=[
 {start:1100,end:1700,from:'sender',label:'DATA · 2,920 B',kind:'data',tone:'blue' as const},
 {start:1700,end:2300,from:'receiver',label:'ACK · rwnd 5,840 B',kind:'ack',tone:'green' as const},
 {start:2300,end:2900,from:'sender',label:'DATA · 2,920 B',kind:'data',tone:'blue' as const},
 {start:2900,end:3500,from:'receiver',label:'ACK · rwnd 2,920 B',kind:'ack',tone:'green' as const},
 {start:3500,end:4100,from:'sender',label:'DATA · 2,920 B',kind:'data',tone:'blue' as const},
 {start:4100,end:4700,from:'receiver',label:'ACK · rwnd 0 B',kind:'ack',tone:'red' as const},
 {start:5300,end:5900,from:'sender',label:'Zero Window Probe',kind:'probe',tone:'orange' as const},
 {start:5900,end:6500,from:'receiver',label:'ACK · rwnd 0 B',kind:'ack',tone:'red' as const},
 {start:7600,end:8200,from:'receiver',label:'Window Update · 8,760 B',kind:'update',tone:'green' as const},
 {start:8800,end:9400,from:'sender',label:'DATA · 2,920 B',kind:'data',tone:'blue' as const}
];
export function flowState(t: number){
 let buffer=flowEvents.filter(e=>e.kind==='data'&&t>=e.end).length*2920;
 if(t>=7000)buffer-=8760;
 let advertised=8760;
 for(const e of flowEvents){if(t>=e.end&&e.from==='receiver')advertised=e.kind==='update'?8760:e.end>=4700?0:e.end===2300?5840:2920;}
 let phase=t<1700?'수신 버퍼에 빈 공간이 있습니다.':t<4100?'데이터가 도착하면 수신 가능한 공간이 줄어듭니다.':t<4700?'rwnd 0을 송신 측에 알리는 중입니다.':t<5900?'일반 데이터 전송은 멈추고 윈도를 확인합니다.':t<7000?'probe에 대한 응답도 rwnd 0입니다.':t<8200?'앱이 데이터를 읽었지만 송신 측은 아직 통지를 받지 못했습니다.':t<8800?'Window Update가 송신 측에 도착했습니다.':'열린 윈도를 확인한 뒤 데이터 전송을 재개합니다.';
 return {buffer,advertised,resumed:t>=8800,phase};
}
export function cacheState(t: number){return {stored:t>=3800,hit:t>=6400,originRequests:t>=1800?1:0,clientRequests:t>=5600?2:t>=1100?1:0,phase:t<1800?'첫 요청은 저장된 응답이 없어 MISS입니다.':t<3800?'원본 서버의 응답 본문을 받는 중입니다.':t<5600?'응답을 모두 받은 뒤 캐시에 저장합니다.':t<6400?'같은 키의 두 번째 요청을 조회합니다.':'신선한 캐시에서 응답합니다. 원본 서버 요청은 한 번입니다.'};}
export function lockState(t: number){const owners: Partial<Record<'L1'|'L2','exec-5'|'exec-6'>>={},waits: Partial<Record<'exec-5'|'exec-6','L1'|'L2'>>={};if(t>=1200)owners.L1='exec-5';if(t>=2600)owners.L2='exec-6';if(t>=3600)waits['exec-5']='L2';if(t>=4600)waits['exec-6']='L1';return {owners,waits,deadlock:t>=4600,phase:t<1200?'두 스레드가 서로 다른 락을 요청합니다.':t<2600?'exec-5가 L1을 점유합니다.':t<3600?'exec-6가 L2를 점유합니다.':t<4600?'exec-5는 L1을 보유한 채 L2를 기다립니다.':'서로 점유한 락을 기다립니다. 어느 쪽도 자동으로 풀리지 않습니다.'};}
const employeeRows: [number,string][]=[[1,'2021-08-01'],[2,'2021-01-13'],[2,'2021-10-04'],[3,'2021-04-05'],[4,'2021-09-28']];
const timeRows=[employeeRows[1],employeeRows[3],employeeRows[0],employeeRows[4],employeeRows[2]];
export function indexState(t: number,order: 'employee' | 'time'){const rows=order==='employee'?employeeRows:timeRows;const scan=order==='employee'?[1,2]:[0,1,2,3,4];const read=Math.max(0,Math.min(scan.length,Math.floor((t-1400)/1100)+1));const visited=scan.slice(0,read);return {rows,visited,read,matches:visited.filter(i=>rows[i][0]===2).map(i=>rows[i][1]),active:scan[read],phase:read===scan.length?'스캔 완료':read===0?'탐색 시작':'행 확인 중'};}
export function sparkState(t: number){const input=[[1,2,3],[4,5,6]];const executed=t>=4200;const mapped=t>=5600?input.map(p=>p.map(x=>x*2)):null;const filtered=t>=7000?mapped!.map(p=>p.filter(x=>x>=8)):null;const result=t>=8400?filtered!.reduce((n,p)=>n+p.length,0):null;return {input,executed,mapped,filtered,result,phase:t<2800?'map과 filter는 연산 관계만 등록합니다.':t<4200?'아직 action이 없어 데이터 처리는 시작하지 않습니다.':t<5600?'count()가 호출되어 RDD 계산을 시작합니다.':t<7000?'각 partition에서 map(x × 2)을 계산합니다.':t<8400?'filter(x ≥ 8) 결과를 partition별로 셉니다.':'0 + 3 = 3. count 결과를 driver에 반환합니다.'};}
export const lessonInfo=[
 {id:'N01',title:'버퍼 크기와 대기',short:'버퍼',duration:13000,final:10000,steps:[2600,3400,10000],caption:'같은 6개 패킷 · FIFO 용량 2 / 6개 · 동일 출력 간격. 6번은 짧은 요청입니다. 설명용 사건이며 재전송은 생략합니다.',source:'95400228-c9fb-4397-ac45-281f2a6c7446',assets:['95400228-c9fb-4397-ac45-281f2a6c7446/eb937029-c447-4631-ac6c-ead0fd1d874c.png'],notes:['용량 안의 패킷을 순서대로 받습니다.','작은 큐는 초과 패킷을 버립니다. 큰 큐의 6번 요청은 앞선 5개를 기다립니다.','작은 큐: 처리 2 · 손실 4. 큰 큐: 처리 6 · 손실 0. 같은 입력에서 손실과 대기를 구분합니다.']},
 {id:'N03',title:'수신 윈도와 전송 재개',short:'수신 윈도',duration:13000,final:10000,steps:[3500,6500,10000],caption:'수신 버퍼 8,760 B · 데이터 2,920 B씩. 시간과 버퍼 크기를 단순화한 개념 모델이며 원본 패킷 캡처의 재현은 아닙니다. 윈도 확인용 probe와 유휴 연결의 keepalive는 구분합니다.',source:'tcp-error-recovery',assets:['5df70731-ea29-47b1-bff3-9f18e8ff955f/2d7c4d52-3e13-4436-9c6b-9bc532cce38b.png','5df70731-ea29-47b1-bff3-9f18e8ff955f/079ea1c3-ea90-44f9-af87-ccfe47f9954a.png','5df70731-ea29-47b1-bff3-9f18e8ff955f/b460478a-8aa1-4152-8850-4d9414defdec.png'],notes:['데이터 도착으로 버퍼가 차고 ACK로 윈도를 알립니다.','rwnd 0에서는 새 일반 전송을 멈춥니다. probe를 받아도 공간이 없으면 0을 응답합니다.','앱의 읽기 → Window Update 도착 → 전송 재개. 실제 캡처의 Win=64,240과 도해의 8,760은 서로 다른 값입니다.']},
 {id:'W03',title:'Proxy cache · MISS → HIT',short:'캐시',duration:10600,final:7600,steps:[2300,4200,7600],caption:'공유 proxy cache · GET /app.css · 동일 키 · public, max-age=600인 200 응답. 두 번째 조회는 유효 기간 안입니다. 설명용 응답입니다.',source:'80dbc9d7-ba32-4220-9b39-b536172264f2',assets:['80dbc9d7-ba32-4220-9b39-b536172264f2/485a6b15-2857-4a31-98ab-0c24494f7c9b.webp'],notes:['첫 요청 → MISS → 원본 서버.','완전한 응답을 받은 뒤 저장합니다. 헤더 수신만으로 HIT가 되지 않습니다.','두 번째 요청 → HIT → 저장 응답. 원본의 전체 HTTP 헤더는 아래 이미지로 보존합니다.']},
 {id:'T01',title:'두 스레드의 교착',short:'교착',duration:8800,final:5800,steps:[2600,3900,5800],caption:'원본 thread dump의 소유·대기 관계입니다. 락을 획득한 순서는 최종 관계를 설명하기 위한 연출입니다.',source:'f78dedef-13f8-4ac2-b216-51600ce03d07',assets:[],notes:['exec-5가 L1, exec-6가 L2를 점유합니다.','exec-5는 L1을 보유한 채 L2를 기다립니다.','exec-6도 L1을 기다리면 순환 대기가 닫힙니다. L1=0x00000005c0c4b1e8 / L2=0x00000005c0c4b1f8. 원문 dump는 그대로 둡니다.']},
 {id:'D03',title:'복합 인덱스의 열 순서',short:'인덱스',duration:9900,final:6900,steps:[1400,3600,6900],caption:'원본 5행 · WHERE employee_id = 2 · 단순 연속 범위 / 전체 스캔 비교. 실제 실행계획·skip scan·시간 성능은 표현하지 않습니다.',source:'7b4ef2a7-32e3-4b8e-b243-ec88a5e38708',assets:['7b4ef2a7-32e3-4b8e-b243-ec88a5e38708/842a3914-5191-4916-9ab9-2502141b1dc2.png'],notes:['employee_id가 선두인 순서는 값 2의 연속 범위에서 시작합니다.','시간 선두 순서는 같은 결과를 찾기 위해 이 예제의 5행을 확인합니다.','두 결과 모두 2021-01-13 / 2021-10-04. 원문 SQL의 employee_id=110183, 2020년 조건과 구분한 그림 예제입니다.']},
 {id:'S03',title:'Spark · 지연 실행',short:'Spark',duration:12100,final:9100,steps:[3200,6300,9100],caption:'RDD [1, 2, 3] / [4, 5, 6] · map(x × 2) → filter(x ≥ 8) → count(). 논리 연산을 순서대로 보여주는 예제이며 실제 물리 stage는 아닙니다.',source:'c9edaff4-1f8b-48aa-a092-730b932155fb',assets:['c9edaff4-1f8b-48aa-a092-730b932155fb/4b8dbb7f-b227-4a7f-a6ec-fc4b95093468.webp'],notes:['Parent RDD → map → filter의 lineage를 등록합니다. 데이터 처리는 아직 없습니다.','count action이 계산을 요구한 뒤 각 partition의 연산을 보여줍니다.','partition 결과 [] / [8, 10, 12] → count 0 + 3 → driver 결과 3. collect는 원본의 다른 action 예시로 유지합니다.']}
] as const;
export type FigureId = (typeof lessonInfo)[number]["id"];
