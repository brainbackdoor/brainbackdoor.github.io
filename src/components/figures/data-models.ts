/** B05 DB·SQL·Spark 도해의 사건 모델과 정보. 시각은 설명용 연출 ms이며 측정값이 아니다. 의미 값은 원문(글·이미지·실행 출력)에서만 가져오고, 원문에 없는 값은 '설명용'으로 표시한다. */
const p = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* D01 복제: App 쓰기 → master 반영·binlog → 커밋 응답(복제를 기다리지 않음) → relay log 수신 → applier 적용 */
export const D01 = { write: [1000, 1500], ack: [1900, 2300], ship: [2800, 3600], apply: [4400, 5000] } as const;
export function d01(t: number) {
  return {
    masterValue: t >= D01.write[1] ? 'B' : 'A', binlogEvent: t >= D01.write[1], committed: t >= D01.ack[1],
    relayEvent: t >= D01.ship[1], replicaValue: t >= D01.apply[1] ? 'B' : 'A',
    phase: t < D01.write[1] ? '앱이 master에 쓰기를 보냅니다.' : t < D01.ack[1] ? 'master가 값을 바꾸고 binlog에 행 변경 이벤트를 남깁니다.' : t < D01.ship[1] ? '커밋 응답은 replica를 기다리지 않습니다(비동기 복제).' : t < D01.apply[1] ? 'relay log에는 도착했지만 replica 값은 아직 A입니다.' : 'applier가 적용한 뒤에야 replica 값이 B가 됩니다.',
  };
}

/* D02 라우팅: readOnly=false → master, readOnly=true → slave. 적용 전 읽기는 이전 값 */
export const D02 = { write: [1000, 1500, 2000], read1: [2400, 2900, 3400], apply: 4200, read2: [5000, 5500, 6000] } as const;
export function d02(t: number) {
  const read1 = t >= D02.read1[2] ? 'A' : null, read2 = t >= D02.read2[2] ? 'B' : null;
  return {
    route: t >= D02.read2[1] ? 'slave' : t >= D02.read2[0] ? null : t >= D02.read1[1] ? 'slave' : t >= D02.read1[0] ? null : t >= D02.write[1] ? 'master' : null,
    masterValue: t >= D02.write[2] ? 'B' : 'A', replicaValue: t >= D02.apply ? 'B' : 'A', read1, read2,
    phase: t < D02.read1[0] ? 'readOnly=false 트랜잭션은 master로 갑니다.' : t < D02.read1[2] ? 'readOnly=true 조회는 slave로 갑니다.' : t < D02.apply ? '복제 적용 전이라 slave는 이전 값 A를 돌려줍니다.' : t < D02.read2[2] ? 'replica에 적용된 뒤 다시 조회합니다.' : '같은 조회가 이제 B를 돌려줍니다. 장애 시 자동 전환은 없습니다.',
  };
}

/* D04 범위 조건(시작점에서 시작해 범위 밖에서 멈춤) 뒤 함수 조건(모든 행 평가). id 11000~11009 10건. 정적 단계가 멈춘 장면이 되도록 두 줄을 차례로 진행 */
export const D04 = { descend: [800, 1800], scan: [2200, 4200], stop: 4400, sweep: [5200, 8200] } as const;
export const D04_IDS = Array.from({ length: 10 }, (_, i) => 11000 + i);
export function d04(t: number) {
  const right = t < D04.scan[0] ? 0 : Math.min(10, Math.floor((t - D04.scan[0]) / 200) + 1);
  const q = p(t, D04.sweep[0], D04.sweep[1]), left = Math.max(0, Math.min(10, Math.floor((q - 0.45) / 0.01) + 1));
  return {
    rightFound: right, rightStopped: t >= D04.stop, leftProgress: q, leftFound: q >= 0.45 ? left : 0, leftDone: t >= D04.sweep[1],
    phase: t < D04.scan[0] ? '범위 조건은 루트·브랜치를 거쳐 11000의 리프로 내려갑니다.' : t < D04.stop ? '정렬된 리프를 11009까지 읽습니다.' : t < D04.sweep[0] ? '범위 조건은 11010(범위 밖)에서 멈춥니다.' : t < D04.sweep[1] ? '가공한 조건은 처음부터 끝까지 모든 행에서 함수를 계산합니다.' : '두 결과는 같은 10행입니다. 읽는 범위만 다릅니다.',
  };
}

/* D05 covering: 같은 보조 인덱스 범위(age 30~39)에서 id만 반환하면 테이블 접근 0회, * 반환이면 일치 행마다 왕복 */
export const D05 = { seek: [800, 1300], read: 1500, gap: 800, hop: 500, end: 5900 } as const;
export const D05_INDEX: readonly (readonly [number, number])[] = [[28, 512], [30, 1021], [31, 307], [34, 1450], [36, 88], [39, 902], [41, 64]];
export function d05(t: number) {
  const inRange = D05_INDEX.filter(([age]) => age >= 30 && age <= 39), at = (i: number) => D05.read + i * D05.gap;
  const read = inRange.filter((_, i) => t >= at(i)).length, hops = inRange.filter((_, i) => t >= at(i) + D05.hop).length;
  return {
    read, coveringRows: read, tableRows: hops, tableAccess: hops, stopped: t >= at(inRange.length),
    phase: t < D05.read ? '보조 인덱스에서 age 30의 시작점을 찾습니다.' : t < at(inRange.length) ? '인덱스 항목에는 age와 PK id가 있습니다. *는 테이블까지 다녀옵니다.' : '같은 id 5개. id만 반환하면 테이블 접근 0회, *는 5회입니다.',
  };
}

/* D06 인덱스 조인: 드라이빙 ProductID=1 → 드리븐 인덱스 탐색 → 연속 5항목 → 테이블 / 인덱스 없음은 전체 비교 */
export const D06 = { pick: 800, seek: [1200, 1700], read: 1900, gap: 500, hop: 400, stop: 4500, sweep: [5000, 8000] } as const;
export const D06_MATCH = [100, 124, 185, 270, 283] as const;
export function d06(t: number) {
  const read = D06_MATCH.filter((_, i) => t >= D06.read + i * D06.gap).length, q = p(t, D06.sweep[0], D06.sweep[1]);
  const pos = [0.08, 0.27, 0.46, 0.63, 0.86], scanFound = pos.filter(x => q >= x).length;
  return {
    picked: t >= D06.pick, read, indexStopped: t >= D06.stop, scanProgress: q, scanFound,
    phase: t < D06.seek[1] ? '드라이빙 행 ProductID=1을 고르고 드리븐 인덱스에서 1을 찾습니다.' : t < D06.stop ? '인덱스에서 연속된 1 항목 5개를 읽고 각 테이블 행으로 갑니다.' : t < D06.sweep[1] ? '다음 키 2에서 멈춥니다. 인덱스가 없으면 드리븐 행 전체와 비교합니다.' : '두 경우 결과는 같은 5행입니다.',
  };
}

/* D07 모수 줄이기: A는 조인 뒤 집계·정렬·LIMIT, B는 salary만 줄인 뒤 10개와 조인 */
export const D07 = { a: [1000, 2400, 3200, 4000, 4800, 5400], b: [1000, 1800, 2600, 3400, 4200, 5000, 5600] } as const;
export function d07(t: number) {
  return {
    aStage: D07.a.filter(x => t >= x).length, bStage: D07.b.filter(x => t >= x).length,
    phase: t < D07.b[4] ? 'A는 범위 전체를 먼저 조인하고, B는 salary만 집계·정렬·LIMIT 합니다.' : t < D07.b[6] ? 'B는 10개 id만 employee와 조인합니다.' : '같은 10개 id. 조인에 참여한 행 수가 다릅니다.',
  };
}

/* D08 메모리·연결: 전역 버퍼는 고정, 연결마다 스레드·연결 버퍼, 연산 중에만 정렬·조인 버퍼. max_connections(설명용 4) 초과는 오류 */
export const D08 = { conns: [1000, 1800, 2600, 3400], sort: [4200, 5600], join: [4800, 6000], reject: [6800, 7400] } as const;
export function d08(t: number) {
  const conns = D08.conns.filter(x => t >= x).length;
  return {
    conns, sort: t >= D08.sort[0] && t < D08.sort[1], join: t >= D08.join[0] && t < D08.join[1], rejected: t >= D08.reject[1],
    phase: t < D08.conns[3] ? '연결마다 스레드와 연결 버퍼가 붙습니다.' : t < D08.join[1] ? '정렬·조인 버퍼는 그 연산이 실행되는 동안만 잡힙니다.' : t < D08.reject[1] ? '연결 한도에 닿았습니다.' : '한도를 넘은 연결은 대기열이 아니라 Too many connections 오류를 받습니다.',
  };
}

/* D09 SQL 3문제: 1번 단계(예시 스키마 연결 → 합계 → 200 이상 → 내림차순) 뒤 원본 상위 8행, 2번 → 3번 순위 변화 */
export const D09 = { q1: [800, 2000, 2800, 3600], rows: [4000, 5000], q2: 5600, q3: [6600, 7800] } as const;
export const D09_Q1: readonly (readonly [number, string, number])[] = [[60, 'Camembert Pierrot', 1577], [59, 'Raclette Courdavault', 1496], [31, 'Gorgonzola Telino', 1397], [56, 'Gnocchi di nonna Alice', 1263], [16, 'Pavlova', 1158], [75, 'Rhönbräu Klosterbier', 1155], [24, 'Guaraná Fantástica', 1125], [40, 'Boston Crab Meat', 1103]];
export const D09_Q2: readonly (readonly [number, string, number])[] = [[71, 'Save-a-lot Markets', 4958], [20, 'Ernst Handel', 4543], [63, 'QUICK-Stop', 3961], [37, 'Hungry Owl All-Night Grocers', 1684], [25, 'Frankenversand', 1525], [65, 'Rattlesnake Canyon Grocery', 1383], [24, 'Folk och fä HB', 1234], [35, 'HILARIÓN-Abastos', 1096]];
export const D09_Q3: readonly (readonly [number, string, string])[] = [[63, 'QUICK-Stop', '122199.74'], [71, 'Save-a-lot Markets', '120718.85'], [20, 'Ernst Handel', '120390.09'], [37, 'Hungry Owl All-Night Grocers', '60397.91'], [65, 'Rattlesnake Canyon Grocery', '58562.42'], [51, 'Mère Paillarde', '36878.50'], [34, 'Hanari Carnes', '34916.60'], [62, 'Queen Cozinha', '34043.90']];
export function d09(t: number) {
  return {
    q1Stage: D09.q1.filter(x => t >= x).length, q1Rows: t < D09.rows[0] ? 0 : Math.min(8, Math.floor((t - D09.rows[0]) / 125) + 1),
    q2: t >= D09.q2, q3: t >= D09.q3[1],
    phase: t < D09.rows[0] ? '1번: 상품별 수량을 합하고 200개 이상만 남겨 내림차순으로 정렬합니다.' : t < D09.q2 ? '1번 결과 72행 중 원본 캡처의 상위 8행입니다.' : t < D09.q3[1] ? '2번(수량)과 3번(금액)은 같은 고객의 순위가 다릅니다.' : 'QUICK-Stop은 수량 3위에서 금액 1위가 됩니다.',
  };
}

/* S01 저장소 ⇄ Spark(API 층) → 작업 영역 */
export const S01 = { read: [1000, 1800], low: 1800, structured: 2800, langs: 3400, libs: 4400, areas: 5400, write: [6400, 7200], managers: 7400 } as const;
export function s01(t: number) {
  return {
    read: t >= S01.read[1], low: t >= S01.low, structured: t >= S01.structured, langs: t >= S01.langs, libs: t >= S01.libs, areas: t >= S01.areas, written: t >= S01.write[1], managers: t >= S01.managers,
    phase: t < S01.low ? 'connector로 여러 저장소의 데이터를 읽습니다.' : t < S01.libs ? 'Low-level API 위에 Structured API(Dataset·DataFrame·SQL)가 있습니다.' : t < S01.write[1] ? '스트리밍·분석·라이브러리가 같은 API 위에서 동작합니다.' : '결과를 다시 저장소에 씁니다. 한 프레임워크 안에서 처리합니다.',
  };
}

/* S02 논리 표 하나 → partition 2 → worker의 executor → action → driver 합계 */
export const S02 = { split: [1200, 2000], assign: [2400, 3000], action: 4000, count: [4400, 5000], driver: [5600, 6400] } as const;
export const S02_ROWS: readonly (readonly [number, number, string])[] = [[1, 5101, '2016-01-01'], [2, 5201, '2017-10-10'], [2, 5301, '2018-01-01'], [3, 5102, '2017-01-30'], [3, 5202, '2017-10-30'], [4, 5302, '2017-07-30']];
export function s02(t: number) {
  return {
    split: t >= S02.split[1], assigned: t >= S02.assign[1], action: t >= S02.action, counted: t >= S02.count[1], result: t >= S02.driver[1] ? 6 : null,
    phase: t < S02.split[1] ? '사용자는 DataFrame을 하나의 표처럼 다룹니다.' : t < S02.action ? 'Spark는 행을 partition으로 나눠 executor에 배정합니다. 아직 계산 전입니다.' : t < S02.driver[1] ? 'action에서 각 executor가 자기 partition만 처리합니다.' : 'driver가 3 + 3 = 6을 합칩니다. 논리 표의 6행과 같습니다.',
  };
}

/* S04 실행계획: Analyzed 트리 → 최적화(가지치기·Project 병합) → Optimized. Physical 출력은 원문에 없음 */
export const S04 = { analyzed: [1000, 2600], optimize: [3000, 4600], physical: 5600, rdd: 6400, result: 7000 } as const;
export function s04(t: number) {
  return {
    built: t < S04.analyzed[0] ? 0 : Math.min(6, Math.floor((t - S04.analyzed[0]) / 270) + 1), optimizing: t >= S04.optimize[0], optimized: t >= S04.optimize[1], physical: t >= S04.physical, result: t >= S04.result,
    phase: t < S04.optimize[0] ? 'Analyzed Logical Plan: 7개 컬럼 이름 바꾸기와 date_joined 계산이 있습니다.' : t < S04.optimize[1] ? '최적화: education으로 이어지는 경로만 남기고 Project를 합칩니다.' : t < S04.result ? 'Optimized Logical Plan: Project [Education#18 AS education#238] 하나. Physical Plan 출력은 원문에 없습니다.' : '결과 스키마 education: string, 최대 5행. 결과는 그대로입니다.',
  };
}

/* S05 predicate pushdown(JDBC 원문 그림): 같은 결과, 네트워크를 건너는 행 수만 다르다. 나이 값은 설명용 */
export const S05 = { transfer: [1000, 2600], filter: 2800, push: [3200, 3600], dbFilter: 3800, transfer2: [4400, 6000] } as const;
export const S05_AGES = [25, 34, 41, 29, 52, 31, 19, 38] as const;
export function s05(t: number) {
  return {
    moved: Math.round(8 * p(t, S05.transfer[0], S05.transfer[1])), filtered: t >= S05.filter, pushed: t >= S05.push[1], dbFiltered: t >= S05.dbFilter, moved2: Math.round(5 * p(t, S05.transfer2[0], S05.transfer2[1])),
    phase: t < S05.push[0] ? 'pushdown이 없으면 모든 행이 네트워크를 건넌 뒤 Spark에서 걸러집니다.' : t < S05.transfer2[0] ? 'pushdown: 조건이 저장소 쪽 조회(WHERE age > 30)로 내려갑니다.' : t < S05.transfer2[1] ? '조건을 만족한 행만 건너옵니다.' : '결과는 같은 5행. 건넌 행은 8 대 5입니다.',
  };
}

/* S06 반복: MapReduce는 잡마다 HDFS 읽기·쓰기, Spark는 첫 action에서 cache를 채우고 재사용. 잃은 partition은 lineage로 재계산 */
export const S06 = { mr: [[1000, 2600], [2800, 4400], [4600, 6200]], read: [1000, 1400], cacheMark: 1200, fill: [1600, 2600], it2: [2800, 3400], it3: [4600, 5200], lose: 5600, recompute: [6000, 7000] } as const;
export function s06(t: number) {
  const io = S06.mr.reduce((n, [a, b]) => n + (t >= a + 400 ? 1 : 0) + (t >= b ? 1 : 0), 0);
  return {
    mrIO: io, mrJobs: S06.mr.filter(([, b]) => t >= b).length, cacheFilled: t >= S06.fill[1], iterations: [S06.fill[1], S06.it2[1], S06.it3[1]].filter(x => t >= x).length,
    lost: t >= S06.lose && t < S06.recompute[1], recovered: t >= S06.recompute[1],
    phase: t < S06.fill[1] ? 'Spark는 첫 action에서 계산한 partition을 메모리에 둡니다(cache는 표시만으로 채워지지 않음).' : t < S06.lose ? 'MapReduce는 잡마다 HDFS에 쓰고 다시 읽습니다. Spark는 메모리의 partition을 재사용합니다.' : t < S06.recompute[1] ? '잃은 partition은 lineage로 그 부분만 다시 계산합니다.' : '두 줄의 결과는 같습니다. 디스크를 거친 횟수가 다릅니다.',
  };
}

/* 13종 정보: 캡션은 실측/설명용 구분과 원문 조건을 밝힌다. 단계 시각은 사건 직후(다음 사건 전)의 멈춘 장면이다. */
const I02 = '1101a2b0-66bf-4b74-a95d-c2c98492093b', I05 = '6ad28373-149c-4d45-b835-8dfb853db638', I07 = '833771f4-d722-4c80-8967-2f0024885bff', I12 = 'c9edaff4-1f8b-48aa-a092-730b932155fb', G07 = '7b4ef2a7-32e3-4b8e-b243-ec88a5e38708';
export const dataInfo = [
  { id: 'D01', title: '복제 로그 전달', short: '복제', duration: 9000, final: 6500, steps: [2700, 3900, 6500], source: I02, assets: [],
    caption: '원문 구성: 비동기(기본) 복제, binlog.000002 @ 683부터, source 1 : replica 1. 역 이름 A → B는 설명용 값이며 binlog에는 SQL 문장이 아니라 행 변경 이벤트가 기록됩니다(8.0 기본 ROW).',
    notes: ['master는 값을 바꾸고 binlog에 이벤트를 남긴 뒤 replica를 기다리지 않고 커밋 응답합니다.', 'replica는 이벤트를 relay log에 받았지만 아직 A입니다.', 'applier가 적용한 뒤 B. 커밋 응답 뒤 전송 전에 master가 멈추면 replica는 A로 남을 수 있습니다. Slave_IO_Running: Yes / Slave_SQL_Running: Yes.'] },
  { id: 'D02', title: '읽기/쓰기 라우팅과 복제 지연', short: '라우팅', duration: 9000, final: 6600, steps: [2200, 3800, 6600], source: I02, assets: [],
    caption: 'ReplicationRoutingDataSource는 트랜잭션 시작 시 readOnly 속성으로 master/slave를 고릅니다(LazyConnectionDataSourceProxy로 첫 SQL에서 결정). 값과 지연은 설명용이며 자동 failover는 없습니다.',
    notes: ['findLines()처럼 readOnly가 아닌 트랜잭션은 master에서 실행합니다.', '@Transactional(readOnly = true) 조회는 slave로 가며, 적용 전이면 이전 값을 읽습니다.', '적용 뒤 같은 조회는 새 값을 읽습니다. slave가 멈춰도 master로 자동 전환되지 않습니다.'] },
  { id: 'D04', title: '컬럼 가공과 인덱스 스캔', short: '컬럼 가공', duration: 11000, final: 8600, steps: [2000, 4800, 8600], source: G07, assets: [],
    caption: 'SUBSTRING(id, 1, 4) = 1100 AND LENGTH(id) = 5와 id BETWEEN 11000 AND 11009 비교. 행 배치와 길이는 설명용이며 실측 EXPLAIN(type 등)은 원문에 없습니다. 함수 인덱스(8.0.13+)·생성 컬럼 인덱스가 있으면 달라집니다.',
    notes: ['범위 조건은 루트 → 브랜치 → 리프로 내려가 11000에서 시작합니다.', '정렬된 리프를 11009까지 읽고 11010에서 멈춥니다.', '가공한 조건은 모든 행에서 함수를 계산합니다. 결과는 같은 10행입니다.'] },
  { id: 'D05', title: 'covering index와 테이블 왕복', short: 'covering', duration: 9000, final: 6400, steps: [1400, 3700, 6400], source: G07, assets: [],
    caption: '보조 인덱스 항목에는 키와 PK가 있어, 필요한 열이 모두 있으면 테이블에 가지 않습니다(EXPLAIN Extra: Using index). age·id 값과 항목 수는 설명용입니다.',
    notes: ['보조 인덱스(age)에서 30의 시작점을 찾습니다.', 'id만 필요하면 인덱스 항목에서 바로 반환하고, *가 필요하면 항목마다 테이블 행으로 갑니다.', '같은 id 5개. 테이블 접근은 0회와 5회입니다.'] },
  { id: 'D06', title: '조인 키 인덱스와 드리븐 탐색', short: '인덱스 조인', duration: 11000, final: 8400, steps: [1800, 4800, 8400], source: G07, assets: [`${G07}/24df4219-edca-4d7d-b064-aacdf65ca355.png`],
    caption: '원본 그림의 Products(드라이빙)와 OrderDetails(드리븐) 값. 드리븐 테이블의 조인 키에 인덱스가 있으면 탐색 1회와 연속 항목으로, 없으면 드리븐 전체 비교로 같은 행을 찾습니다. 조인 순서는 비용으로 정해집니다.',
    notes: ['드라이빙 행 ProductID=1을 고르고 드리븐 인덱스에서 1을 찾습니다.', '연속된 1 항목 5개(100·124·185·270·283)를 읽고 다음 키에서 멈춥니다.', '인덱스가 없으면 드리븐 행 전체와 비교합니다. 결과는 같은 5행입니다.'] },
  { id: 'D07', title: '모수 줄이기: 먼저 줄이고 조인', short: '선행 필터', duration: 11000, final: 8200, steps: [2600, 5200, 8200], source: G07, assets: [],
    caption: 'id BETWEEN 10001 AND 50000, GROUP BY id, ORDER BY SUM(annual_income) DESC, LIMIT 150,10. 행 수와 막대 길이는 설명용입니다. 두 결과가 같으려면 salary.id마다 employee 행이 있어야 하고, B는 바깥 ORDER BY가 없으면 출력 순서가 보장되지 않습니다.',
    notes: ['A는 범위의 employee와 salary를 먼저 모두 조인합니다.', 'B는 salary만 집계·정렬·LIMIT으로 10개 id를 정합니다.', 'B는 그 10개만 employee와 조인합니다. 같은 10개 id입니다.'] },
  { id: 'D08', title: 'MySQL 메모리와 연결 한도', short: '메모리·연결', duration: 12000, final: 9000, steps: [3000, 5200, 9000], source: G07, assets: [],
    caption: 'Global Buffer는 하나, Thread Buffer는 연결·연산마다 잡힙니다. max_connections 4와 크기는 설명용입니다(MySQL 기본 151 + 관리자용 1). 한도를 넘은 연결은 오류를 받으며, back_log는 수락 직전의 짧은 TCP 대기열입니다.',
    notes: ['연결마다 스레드와 연결 버퍼가 붙습니다. 전역 버퍼는 시작할 때 한 번 잡힙니다.', '정렬·조인 버퍼는 그 연산이 실행되는 동안만 잡힙니다. 연결 수 × 설정값은 최악 추정입니다.', '한도를 넘은 연결은 Too many connections 오류를 받습니다.'] },
  { id: 'D09', title: '집계·정렬 정답 읽기', short: 'SQL 정답', duration: 12000, final: 9000, steps: [3000, 6100, 9000], source: I05, assets: [`${I05}/4cfbe91d-7d30-4622-8eeb-8575b79b4ab5.png`, `${I05}/515e7ced-402e-4ad2-ad35-3ae801a58fe5.png`, `${I05}/fd612398-af00-4397-8442-89595827666d.png`],
    caption: 'W3Schools 실습 결과의 원본 캡처 상위 8행(1번 72행, 2·3번 91행 중). 테이블 이름은 예시 스키마이며 정답 SQL은 원문에 없습니다. 200 경계 근처의 행은 원본에 없습니다.',
    notes: ['1번: 상품별 수량 합계 → 200개 이상 → 수량 내림차순.', '결과 72행 중 상위 8행. 2번은 고객별 수량 합계 순위입니다.', '3번(지출 금액)은 같은 고객의 순위가 다릅니다. QUICK-Stop은 수량 3위, 금액 1위입니다.'] },
  { id: 'S01', title: 'Spark의 저장소·API·작업 영역', short: '구성', duration: 11000, final: 8000, steps: [2400, 4800, 8000], source: I07, assets: [`${I07}/42ec7618-5d7a-427e-bb72-8a1a0e736396.webp`],
    caption: '원문 그림의 저장소·API 층·작업 영역. Dataset은 Scala·Java, DataFrame은 Python·Scala·Java·R에서 쓸 수 있습니다. 작업 영역은 Spark가 한 프레임워크로 묶은 범위이며 데이터 소비처가 아닙니다. Mesos는 원문 표기로 Spark 4.0에서 제거됐습니다.',
    notes: ['connector로 여러 저장소의 데이터를 읽습니다.', 'Low-level API(RDD·분산 변수) 위에 Structured API(Dataset·DataFrame·SQL)가 있습니다.', '스트리밍·분석·라이브러리가 같은 API 위에서 동작하고 결과를 다시 저장소에 씁니다.'] },
  { id: 'S02', title: 'DataFrame과 partition', short: 'partition', duration: 11000, final: 8200, steps: [1100, 3500, 8200], source: I12, assets: [`${I12}/64e71090-1181-4464-80b0-9fee862e6ff1.webp`],
    caption: '원문 Invoice 6행을 원본 그림 기준으로 2개 partition에 나눈 예시입니다. Spark의 파일 읽기 partition은 바이트 크기 기준이며 키 범위 분할은 기본 동작이 아닙니다. partition은 계산 중이거나 cache할 때만 executor 메모리에 있습니다.',
    notes: ['사용자는 DataFrame을 하나의 표처럼 다룹니다.', 'Spark는 행을 partition으로 나눠 executor에 배정합니다. action 전에는 계산하지 않습니다.', 'count()에서 각 executor가 자기 partition을 세고 driver가 3 + 3 = 6을 합칩니다.'] },
  { id: 'S04', title: '실행계획 최적화', short: '실행계획', duration: 11000, final: 8000, steps: [2800, 5000, 8000], source: I12, assets: [`${I12}/afd6a78e-6c41-4085-8831-8521a14c2ba0.webp`],
    caption: '원문 explain("extended") 출력의 Analyzed / Optimized Logical Plan. Physical Plan 부분은 원문에 비어 있어 그리지 않습니다. 최적화 뒤에도 결과 스키마(education: string)와 LIMIT 5는 같습니다.',
    notes: ['Analyzed Logical Plan: 7개 이름 바꾸기, date_joined 계산, education 선택.', '최적화는 education으로 이어지는 경로만 남기고 세 Project를 합칩니다.', 'Optimized Logical Plan은 Project 하나. 실제로 읽는 열은 Physical Plan의 scan에서 확인합니다.'] },
  { id: 'S05', title: 'predicate pushdown', short: 'pushdown', duration: 10000, final: 7400, steps: [3100, 4200, 7400], source: I12, assets: [`${I12}/53246134-9042-4fa5-9aca-0f35c6fbd5aa.webp`],
    caption: '원문 그림의 JDBC 사례(people, age > 30). 나이 값 8개는 설명용입니다. 실제 Spark JDBC는 SELECT *가 아니라 필요한 열 목록으로 조회합니다. CSV는 열을 덜 파싱할 뿐 읽는 바이트가 줄지 않고, PushedFilters는 실행 뒤 physical plan에서 확인합니다.',
    notes: ['pushdown이 없으면 8행이 모두 건너온 뒤 Spark가 age > 30을 걸러냅니다.', 'pushdown은 조건을 저장소 쪽 조회(WHERE age > 30)로 내립니다.', '조건을 만족한 5행만 건너옵니다. 결과는 같습니다.'] },
  { id: 'S06', title: '반복 처리와 cache', short: 'cache', duration: 12000, final: 9000, steps: [2900, 5400, 9000], source: I07, assets: [],
    caption: '반복 3회와 partition 2개는 설명용입니다. cache는 첫 action에서 채워지고, RDD 기본 MEMORY_ONLY는 메모리에 못 들어간 partition을 필요할 때 다시 계산합니다(Dataset 기본 MEMORY_AND_DISK, LRU 축출 가능). shuffle 중간 파일은 디스크를 씁니다. 원문의 배수는 측정값이 아니라 표시하지 않습니다.',
    notes: ['MapReduce는 잡의 결과를 HDFS에 쓰고 다음 잡이 다시 읽습니다. Spark는 첫 action에서 partition을 메모리에 둡니다.', '반복할 때 Spark는 메모리의 partition을 재사용합니다.', '잃은 partition은 lineage로 그 부분만 다시 계산합니다. 결과는 같습니다.'] },
] as const;
export type DataFigureId = (typeof dataInfo)[number]["id"];
