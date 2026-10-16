/** B07 과정 5종의 사건 모델과 정보. 시각은 설명용 연출 ms이며 측정값이 아니다. 값은 원문(SOURCES-A·B·C)에서만 가져오고, 원문에 없는 값은 '설명용'으로 표시한다. */
const p = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* E01 ATDD 과정(R10 원본 그림): 노드 9개, 실선 8개, 점선 3개, Develop 말풍선 5칸. 되돌아가는 화살표는 원본에 없다. */
export const E01_NODES = [
  ['User Story', 'artifact'], ['Discuss', 'activity'], ['Acceptance Criteria', 'artifact'], ['Distill', 'activity'], ['Acceptance Test', 'artifact'],
  ['Develop', 'activity'], ['Software', 'artifact'], ['Demo', 'activity'], ['Business Value', 'artifact'],
] as const;
export const E01_BUBBLE = [['Acceptance', 'Criteria'], ['Acceptance', 'Test'], ['Mock 서버', 'DTO 정의'], ['문서화'], ['개발', '(TDD)']] as const;
// 실선 i는 노드 i → i+1. 점선은 활동끼리(Discuss ⇢ Distill ⇢ Develop ⇢ Demo)이고, 다음 활동에 도착할 때 켜진다
export const E01 = { start: 200, legs: [[500, 1000], [1200, 1700], [2200, 2700], [2900, 3400], [3900, 4400], [6100, 6600], [6800, 7300], [7500, 8000]], chips: [4600, 4850, 5100, 5350, 5600], end: 8400 } as const;
export const E01_DASHES = [[1, 3], [3, 5], [5, 7]] as const;
export function e01(t: number) {
  // 노드 i가 켜지는 시각: 0은 시작, 나머지는 들어오는 실선의 도착
  const on = E01_NODES.map((_, i) => i === 0 ? E01.start : E01.legs[i - 1][1]);
  return {
    on, lit: on.map(at => t >= at), chips: E01.chips.map(at => t >= at), dashes: E01_DASHES.map(([, to]) => t >= on[to]),
    phase: t < E01.legs[1][0] ? 'User Story를 두고 Discuss(논의)합니다.' : t < E01.legs[2][0] ? 'Discuss에서 Acceptance Criteria(인수조건)가 나옵니다.' : t < E01.legs[4][0] ? 'Distill에서 인수조건을 Acceptance Test(인수테스트)로 옮깁니다.' : t < E01.legs[5][0] ? 'Develop에 붙은 말풍선: 인수조건 → 인수테스트 → Mock 서버 DTO 정의 → 문서화 → 개발 (TDD)' : t < E01.legs[7][0] ? 'Develop이 Software를 만들고 Demo에서 보여 줍니다.' : t < E01.end ? 'Demo로 Business Value를 확인합니다.' : 'User Story에서 Business Value까지 한 방향으로 이어지는 ATDD 과정입니다.',
  };
}

/* E02 테스트 범위·격리(R10 본문 코드): 테스트 종류별로 실제 실행하는 칸, @MockBean 대역, 범위 밖.
   칸 순서는 Controller · Service · Repository · DB, 그리고 단위 테스트만 판정하는 도메인 열(na = 판정하지 않음).
   점은 path의 칸을 차례로 지나고(fromLabel이면 행 이름에서 출발, 직접 호출이면 첫 칸에서), 칸은 점이 닿을 때 켜진다.
   @MockBean 대역은 테스트 컨텍스트가 뜰 때(행 시작) 켜진다. 인수테스트는 다음 테스트의 @BeforeEach에서 모든 테이블을 TRUNCATE한다. */
export type Cell = 'run' | 'mock' | 'out' | 'web' | 'db' | 'h2' | 'na';
export const E02_COLS = ['Controller', 'Service', 'Repository', 'DB', '도메인'] as const;
export const E02_ROWS = [
  { name: '인수테스트', driver: 'RestAssured', cells: ['run', 'run', 'run', 'db', 'na'], path: [0, 1, 2, 3], fromLabel: true },
  { name: 'Controller Test', driver: 'MockMvc', cells: ['web', 'out', 'mock', 'out', 'na'], path: [0], fromLabel: true },
  { name: 'Service Test', driver: '직접 호출 ×10', cells: ['out', 'run', 'mock', 'out', 'na'], path: [1, 2], fromLabel: false },
  { name: 'Repository Test', driver: '@DataJpaTest', cells: ['out', 'out', 'run', 'h2', 'na'], path: [2, 3], fromLabel: false },
  { name: '단위 테스트', driver: '직접 호출', cells: ['out', 'out', 'out', 'out', 'run'], path: [4], fromLabel: false },
] as const satisfies readonly { name: string; driver: string; cells: readonly Cell[]; path: readonly number[]; fromLabel: boolean }[];
export const E02_CLEAN = ['entityManager.flush()', 'SET foreign_key_checks = 0', 'TRUNCATE TABLE (테이블마다)', 'SET foreign_key_checks = 1'] as const;
// 행마다 [시작, 끝]. acc2는 TRUNCATE 뒤 다음 인수테스트(설명용)
export const E02 = { acc1: [600, 1800], clean: [2600, 2900, 3200, 3500], acc2: [4100, 5100], rows: [[5300, 5700], [6000, 6400], [6900, 7300], [7600, 8000]], end: 8400 } as const;
// 점이 지나는 지점: -1은 행 이름(요청 주체), 나머지는 칸 번호
export const e02Points = (r: number): number[] => E02_ROWS[r].fromLabel ? [-1, ...E02_ROWS[r].path] : [...E02_ROWS[r].path];
// 행 r의 칸 c가 켜지는 시각(범위 밖·미판정 칸은 켜지지 않음)
export function e02CellAt(r: number, c: number): number | null {
  const kind: Cell = E02_ROWS[r].cells[c];
  if (kind === 'out' || kind === 'na') return null;
  const [a, b] = r === 0 ? E02.acc1 : E02.rows[r - 1];
  if (kind === 'mock') return a;
  const pts = e02Points(r), n = pts.length - 1;
  return n < 1 ? a : a + (b - a) * pts.indexOf(c) / n;
}
export function e02(t: number) {
  // DB 행 수(설명용): 시나리오 1이 DB에 닿으면 1, TRUNCATE 칩에서 0, 다음 시나리오가 닿으면 다시 1(2가 되지 않음)
  const dbAt = e02CellAt(0, 3)!, dbAt2 = E02.acc2[1];
  const rows = t >= dbAt2 ? 1 : t >= E02.clean[2] ? 0 : t >= dbAt ? 1 : 0;
  return {
    rows, clean: E02.clean.map(at => t >= at),
    phase: t < E02.acc1[0] ? '인수테스트는 RestAssured로 테스트 서버(RANDOM_PORT)에 요청합니다.' : t < E02.acc1[1] ? '시나리오 1이 Controller부터 DB까지 실제로 실행됩니다.' : t < E02.clean[0] ? '시나리오 1이 끝났고 DB에 행이 남았습니다.' : t < E02.acc2[0] ? '다음 테스트의 @BeforeEach에서 모든 테이블을 TRUNCATE합니다.' : t < E02.rows[0][0] ? '다음 시나리오는 빈 DB에서 시작합니다. 이전 시나리오의 행이 없습니다.' : t < E02.rows[1][0] ? 'Controller Test: MockMvc로 웹 계층을 실행하고, BusinessController·BusinessRepository는 @MockBean입니다.' : t < E02.rows[2][0] ? 'Service Test: BusinessService와 CacheConfig만 띄우고 BusinessRepository는 @MockBean입니다.' : t < E02.rows[3][0] ? 'Repository Test: @DataJpaTest로 h2에 저장·조회합니다.' : t < E02.end ? '단위 테스트: Business 도메인만 실행합니다.' : '테스트마다 실제로 실행하는 범위와 @MockBean 대역이 다릅니다. 순위가 아니라 목적의 차이입니다.',
  };
}

/* E03 이벤트스토밍(R14 보드 9): 회원가입 확인부터 완료 메일까지 한 경로와, 회원·인증 경계를 넘는 화살표 3개.
   카드 라벨과 색 종류는 보드 그대로. 흩어진 배치·중복 카드 1장·놓이는 순서·흐르는 점은 설명용. */
export type Sticky = 'event' | 'command' | 'policy' | 'system' | 'actor' | 'read' | 'hotspot' | 'aggregate';
export const E03 = { drop: 200, align: [700, 1700], dup: [1900, 2300], command: 2600, system: 3000, policy: 3400, extra: 3800, pulse: [4400, 6200], bound: 6600, a1: [7200, 7600], a11: [7700, 8000], login: [8000, 8100], a12: [8200, 8600], end: 9000 } as const;
// 칸: 경계(m = 회원, a = 인증) · 줄 · 칸. 2줄 이벤트는 위아래로 쌓인 평행 이벤트(stack)
export const E03_CARDS = [
  { id: 'c1', text: '회원가입 확인', kind: 'command', area: 'm', row: 1, col: 0 },
  { id: 'e1', text: '회원가입 여부를 확인했다', kind: 'event', area: 'm', row: 1, col: 1 },
  { id: 'p1', text: '회원여부 정책', kind: 'policy', area: 'm', row: 1, col: 2 },
  { id: 'c2', text: '회원가입', kind: 'command', area: 'm', row: 2, col: 0 },
  { id: 'e2', text: '개인정보 처리방침을 확인했다', kind: 'event', area: 'm', row: 2, col: 1 },
  { id: 'e2b', text: '회원가입 약관을 동의했다', kind: 'event', area: 'm', row: 2, col: 1, stack: true },
  { id: 'p2', text: '회원가입 등록 정책', kind: 'policy', area: 'm', row: 2, col: 2 },
  { id: 'c3', text: '메일 발송', kind: 'command', area: 'm', row: 3, col: 0 },
  { id: 's1', text: '메일', kind: 'system', area: 'm', row: 3, col: 1 },
  { id: 'e3', text: '회원 가입 완료 메일을 발송했다', kind: 'event', area: 'm', row: 3, col: 2 },
  { id: 'y2', text: '로그인 회원', kind: 'actor', area: 'm', row: 4, col: 1 },
  { id: 'c5', text: '개인 상세정보 수정', kind: 'command', area: 'm', row: 4, col: 2 },
  { id: 'y1', text: '회원', kind: 'actor', area: 'a', row: 1, col: 0 },
  { id: 'r1', text: '메일 주소', kind: 'read', area: 'a', row: 1, col: 1 },
  { id: 'c0', text: '메일 주소로 로그인 시도', kind: 'command', area: 'a', row: 1, col: 2 },
  { id: 'c4', text: '로그인', kind: 'command', area: 'a', row: 2, col: 0 },
  { id: 'e4', text: '로그인했다', kind: 'event', area: 'a', row: 2, col: 1 },
  { id: 'p3', text: '로그인 정책', kind: 'policy', area: 'a', row: 2, col: 2 },
] as const;
export const E03_HOTSPOTS = [{ text: '메일 주소로 로그인 시도했는지 여부는 어떻게?', area: 'm', row: 1 }, { text: 'referer가 있을경우는?', area: 'a', row: 2 }] as const;
export const E03_PATH = ['c1', 'e1', 'p1', 'c2', 'e2', 'p2', 'c3', 's1', 'e3'] as const;
// 탐험 단계의 중복 카드(설명용): 보드에 한 번만 나오는 라벨로(여러 번 나오는 라벨은 서로 다른 흐름이라 지워진 중복처럼 보이면 안 된다)
export const E03_DUP = '회원가입 여부를 확인했다';
// 그리지 않은 보드의 나머지(보드 라벨 그대로): 최종 장면 아래 목록으로 남긴다
export const E03_REST = [
  '회원가입 확인으로 들어오는 화살표 4개: 메일 주소로 로그인 시도 · 인증 번호를 인증했다 · 카카오 로그인 · 구글 로그인',
  '회원여부 정책에서 갈라지는 3개(조건 표기 없음): 회원가입 · 인증코드 생성 · 로그인',
  '회원 경계의 다른 줄: 비밀번호 재설정 · 인증코드 생성 · 개인 상세정보 확인 · 사진 등록 · 본인 인증 (액터: 비로그인 회원)',
  '인증 경계의 다른 줄: 휴대폰 번호로 로그인 시도 · 카카오 로그인 시도 · 구글 로그인 시도',
  '보드 오른쪽이 잘려 있어, 화면 밖으로 이어지는 연결 3개는 그리지 않았습니다.',
] as const;
export const E03_LEGEND: [Sticky, string][] = [['event', '이벤트'], ['command', '커맨드'], ['policy', '정책'], ['system', '시스템'], ['actor', '액터'], ['read', '리드 모델'], ['hotspot', '핫스팟'], ['aggregate', '애그리거트']];
// 카드가 놓이는 시각: 이벤트는 탐험(흩어짐) → 정렬, 나머지는 종류별로, 경계 넘는 화살표가 닿는 카드는 그 도착 시각
export function e03At(id: string): number {
  const c = E03_CARDS.find(x => x.id === id)!;
  if (id === 'c5' || id === 'y2') return E03.a12[1];
  return c.kind === 'event' ? E03.drop : c.kind === 'command' ? E03.command : c.kind === 'system' ? E03.system : c.kind === 'policy' ? E03.policy : E03.extra;
}
export const e03Leg = (k: number) => { const [a, b] = E03.pulse, d = (b - a) / (E03_PATH.length - 1); return [a + k * d, a + (k + 1) * d] as const; };
export function e03(t: number) {
  return {
    aligned: p(t, E03.align[0], E03.align[1]), dupGone: t >= E03.dup[1], dupCrossed: t >= E03.dup[0], bound: t >= E03.bound, login: [t >= E03.login[0], t >= E03.login[1]],
    phase: t < E03.align[0] ? '알고 있는 도메인 이벤트를 각자 씁니다.' : t < E03.dup[0] ? '이벤트를 시간 순서(왼쪽 → 오른쪽)로 정렬합니다. 위아래로 쌓인 카드는 평행한 시간입니다.' : t < E03.command ? '실제로 중복되는 이벤트를 지웁니다.' : t < E03.pulse[0] ? '커맨드·시스템·정책·액터·리드 모델·핫스팟을 붙입니다.' : t < E03.bound ? '커맨드가 이벤트를 만들고, 정책이 이벤트와 다음 커맨드를 잇습니다.' : t < E03.end ? '경계를 나눕니다: 회원과 인증. 경계를 넘는 화살표가 이어집니다.' : '회원·인증 두 경계와 한 경로입니다. 보드의 나머지 연결과 줄은 아래 목록에, 원본 보드는 접어 둡니다.',
  };
}

/* E04 데이터 플랫폼(R13 원본 그림): 영역 7개, 노드 15개, 화살표 10개. 관리 영역에는 선이 없다.
   흐름은 원본 화살표 순서(bus → stream 적재 → store ↔ batch → service). 데이터 점과 시각은 설명용. */
export const E04_NODES = {
  collector: ['COLLECTION', 'Collector', 'Vert.x'], kafka: ['DATA BUS', 'Unified Log', 'Kafka'],
  workflow: ['BATCH', 'Data Workflow', 'Hive · Tez · Spark · Spark MLlib'], hdfs: ['DATA STORE', 'HDFS', 'Parquet'], es: ['DATA STORE', 'Elasticsearch', ''],
  sink: ['STREAM', 'Sink', 'Kafka Connect'], streaming: ['STREAM', 'Streaming', 'Kafka Streams'],
  drill: ['SERVICE', 'Interactive Query', 'Drill'], api: ['SERVICE', 'Service API', 'Netty'], app: ['SERVICE', 'Service Application', ''],
} as const;
export type E04Node = keyof typeof E04_NODES;
export const E04_MANAGEMENT = [['Platform Monitoring', 'InfluxDB · JMXTrans · Grafana · Coda Hale Metrics · Kibana'], ['Resource Management', 'Nomad · YARN'], ['Configuration Management', 'Ansible'], ['Service Discovery', 'Consul'], ['Scheduler', 'Azkaban']] as const;
// 화살표 [출발, 도착, 양방향, 이동 시각들]. A3·A6은 왕복(양방향)
export const E04 = { a1: [400, 1200], a2: [1400, 2200], a3: [1400, 2000, 2600], a4: [2600, 3300], a5: [2600, 3300], a6: [3900, 4500, 5200, 5700], work: [4500, 5100], a7: [5200, 5700], a8: [6200, 7000], a9: [6200, 6800], a10: [7000, 7600], end: 8000 } as const;
export const E04_ARROWS = [['collector', 'kafka', 'a1'], ['kafka', 'sink', 'a2'], ['kafka', 'streaming', 'a3'], ['sink', 'hdfs', 'a4'], ['sink', 'es', 'a5'], ['workflow', 'hdfs', 'a6'], ['workflow', 'es', 'a7'], ['hdfs', 'drill', 'a8'], ['es', 'api', 'a9'], ['api', 'app', 'a10']] as const;
export const e04ArrowDone = (k: keyof typeof E04) => { const v = E04[k] as readonly number[]; return v[v.length - 1]; };
// 노드가 켜지는 시각: 데이터가 처음 닿을 때
export const E04_LIT: Record<E04Node, number> = { collector: E04.a1[0], kafka: E04.a1[1], streaming: E04.a3[1], sink: E04.a2[1], hdfs: E04.a4[1], es: E04.a5[1], workflow: E04.a6[1], drill: E04.a8[1], api: E04.a9[1], app: E04.a10[1] };
export function e04(t: number) {
  return {
    working: t >= E04.work[0] && t < E04.work[1],
    phase: t < E04.a2[0] ? 'Collector(Vert.x)가 받은 데이터를 Unified Log(Kafka)에 씁니다.' : t < E04.a4[0] ? 'Kafka에서 Sink(Kafka Connect)로 보내고, Streaming(Kafka Streams)은 Kafka와 주고받습니다.' : t < E04.a6[0] ? 'Sink가 HDFS(Parquet)와 Elasticsearch에 적재합니다.' : t < E04.a8[0] ? '배치(Data Workflow)는 HDFS에서 읽어 HDFS와 Elasticsearch에 씁니다.' : t < E04.end ? 'HDFS는 Interactive Query(Drill)로, Elasticsearch는 Service API(Netty) → gRPC → Service Application으로 갑니다.' : '관리 도구(MANAGEMENT)는 원본처럼 데이터 경로와 선으로 잇지 않았습니다.',
  };
}

/* E05 Temporal(R17 원본 도해 + 본문): 금액 계산 도중 Worker A가 죽는다 → 끝나지 않은 Activity는 Server가 다시 내보내 재시도 →
   결과가 기록되면 Worker B가 Event History를 입력으로 처음부터 Replay(완료된 Activity는 기록값 사용) → 승인 Signal → 크레딧 지급.
   Worker 사이 직접 인계는 없다(Server를 거친다). 카드 라벨은 원본 약칭, 크레딧 지급 카드·시간은 설명용. */
export const E05_HISTORY = [['WorkflowStarted', '보상 워크플로우 시작'], ['Activity: 데이터 수집', '✓ 결과 기록'], ['Activity: 금액 계산', '✓ 50,000 (영속화)'], ['TimerStarted', '7일 승인 대기'], ['Signal: 승인', '✓ 외부 신호 수신'], ['Activity: 크레딧 지급', '✓ 결과 기록']] as const;
export const E05_CODE = ['데이터 수집()', '금액 계산()', '승인 대기(7일)', '크레딧 지급()'] as const;
export const E05 = { started: 400, collect: [700, 1400], collectRep: [1400, 1700], calcSched: 1900, calc1: [2100, 2700], crash: 2700, timeout: [3400, 4200], retry: [4200, 4500], calc2: [4500, 5100], calcRep: [5100, 5400], replay: [5600, 5900], replayLines: [6100, 6400], timer: 6700, signal: [7300, 7700], wake: [7800, 8100], credit: [8100, 8700], creditRep: [8700, 9000], end: 9300 } as const;
// 카드가 Event History에 붙는 시각. 금액 계산은 예약(결과 없음)으로 먼저 붙고 결과는 재시도가 끝난 뒤 채워진다
export const E05_CARD_AT = [E05.started, E05.collectRep[1], E05.calcSched, E05.timer, E05.signal[1], E05.creditRep[1]] as const;
export function e05(t: number) {
  // Worker B 코드 줄: 0·1은 Replay 중 기록값으로 따라잡고, 2(승인 대기)는 타이머, 3은 실제 실행
  const lineAt = [E05.replayLines[0], E05.replayLines[1], E05.timer, E05.credit[1]];
  return {
    cards: E05_CARD_AT.map(at => t >= at), calcResult: t >= E05.calcRep[1], crashed: t >= E05.crash,
    calc1: t < E05.calc1[0] ? 0 : Math.min(0.6, p(t, E05.calc1[0], E05.calc1[1]) * 0.6), timeout: t >= E05.timeout[0] ? p(t, E05.timeout[0], E05.timeout[1]) : 0,
    calc2: p(t, E05.calc2[0], E05.calc2[1]), credit: p(t, E05.credit[0], E05.credit[1]), collect: p(t, E05.collect[0], E05.collect[1]),
    bLines: lineAt.map(at => t >= at),
    phase: t < E05.collect[0] ? 'Server가 보상 워크플로우 시작을 Event History에 기록합니다.' : t < E05.calcSched ? 'Worker A가 데이터 수집 Activity를 실행해 결과를 보고하고, Server가 기록합니다.' : t < E05.crash ? 'Worker A가 금액 계산을 실행하는 중입니다. 결과는 아직 기록되지 않았습니다.' : t < E05.timeout[0] ? 'Worker A 프로세스가 죽었습니다. Event History는 Server에 그대로 있습니다.' : t < E05.replay[0] ? '타임아웃이 지나면 Server가 끝나지 않은 금액 계산을 다시 내보내고(재시도), Worker B가 실행해 결과가 기록됩니다.' : t < E05.signal[0] ? 'Worker B가 Event History를 입력으로 코드를 처음부터 다시 실행(Replay)합니다. 완료된 Activity는 다시 부르지 않고 기록된 결과를 씁니다.' : t < E05.end ? '승인 신호를 Server가 기록하고, Worker B가 이어서 크레딧 지급을 실행합니다.' : '상태는 Worker가 아니라 Server의 Event History에 있습니다. 완료된 Activity는 기록값을 쓰고, 끝나지 않은 Activity는 재시도합니다.',
  };
}

/* X05 팀 회고(B08 선택 후보, R11 §2~§4와 글 머리 스프레드시트): 예시 카드 2장 → 그룹 → 투표로 한 그룹 선택 → 액션 플랜.
   카드·그룹·액션 플랜 문구는 원문 그대로(닉네임·이모지 제외). 득표수·1~3순위는 원문에 라벨·예시가 없어 그리지 않는다. */
export const X05_STAGES = ['자료 모으기', '그룹핑', '투표', '액션 플랜'] as const;
export const X05_LANES = [
  { kind: '좋았던 점', card: '블로그 포스팅을 할 수 있었음', group: '좋은 결과물' },
  { kind: '아쉬웠던 점', card: '일정이 계속 밀림', group: '시간 관리 못함' },
] as const;
export const X05_ACTION = '시간 관리를 위해 칸반보드를 활용한다.';
export const X05 = { stages: [0, 1900, 3700, 5500], cards: [300, 700], group: [2000, 2500], vote: [3800, 4300], action: [5600, 6100], end: 6400 } as const;
export function x05(t: number) {
  return {
    stage: X05.stages.filter(at => t >= at).length - 1, cards: X05.cards.map(at => t >= at), grouped: t >= X05.group[1], voted: t >= X05.vote[1], acted: t >= X05.action[1],
    phase: t < X05.stages[1] ? '좋았던 점·아쉬웠던 점을 카드로 모읍니다.' : t < X05.stages[2] ? '비슷한 카드끼리 그룹으로 묶습니다.' : t < X05.stages[3] ? '투표로 한 그룹을 고릅니다.' : t < X05.end ? '고른 그룹에서 내일 바로 실천할 액션 플랜을 씁니다.' : '카드 → 그룹 → 투표 → 액션 플랜: 시간 관리를 위해 칸반보드를 활용한다.',
  };
}

/* 5종 정보: 캡션은 원문 값과 설명용 값을 구분하고, 단계 시각은 멈춘 장면(사건 직후, 다음 사건 전)이다. */
const R11 = 'a1094dc5-8f5c-4725-be7c-8247fc273c44', R10 = '9178ac06-ae33-4a96-a4cd-49c96ea28351', R13 = 'c6550c6d-0773-43bc-84a9-311a3de97b00', R14 = 'c78ba22a-b64d-4016-9f09-c9de5f94e612', R17 = '38190d37-083f-8033-a7e8-f3996e11cf55';
export const processInfo = [
  { id: 'E01', title: 'ATDD 과정', short: 'ATDD', duration: 10000, final: 8400, steps: [2100, 6000, 8400], source: R10, assets: [`${R10}/9b4aaa68-872e-45ef-a101-d0c9f37a1401.webp`],
    caption: '원본 그림의 노드 9개, 실선 8개, 점선 3개(Discuss ⇢ Distill ⇢ Develop ⇢ Demo), Develop에 붙은 말풍선 5칸을 그대로 옮겼습니다. 사각형은 활동, 타원은 산출물로 읽었습니다(구분은 설명용). 원본에 되돌아가는 화살표가 없어 반복 연결은 그리지 않았습니다.',
    notes: ['Discuss에서 User Story를 논의해 Acceptance Criteria(인수조건)를 만듭니다.', 'Distill이 인수조건을 Acceptance Test(인수테스트)로 옮깁니다. Develop에 붙은 말풍선은 인수조건 → 인수테스트 → Mock 서버 DTO 정의 → 문서화 → 개발 (TDD) 순서입니다.', 'Develop이 Software를 만들고 Demo를 거쳐 Business Value에 닿습니다. 원본처럼 한 방향으로 끝납니다.'] },
  { id: 'E02', title: '테스트 범위와 격리', short: '테스트 범위', duration: 10000, final: 8400, steps: [2300, 3900, 8400], source: R10, assets: [],
    caption: '본문 코드의 구성: 인수(@SpringBootTest RANDOM_PORT + RestAssured, 각 테스트의 @BeforeEach에서 databaseCleanup.execute()), Controller(@WebMvcTest + MockMvc, BusinessController·BusinessRepository @MockBean), Service(classes = CacheConfig·BusinessService, BusinessRepository @MockBean), Repository(@DataJpaTest, h2), 단위(Business 도메인). 범위 밖(—) 칸은 각 테스트의 애너테이션과 코드에서 읽었습니다. 도메인 열은 단위 테스트만 표시하고, 다른 테스트의 도메인 실행 여부는 판정하지 않았습니다. DB 행 수와 두 번째 시나리오는 설명용이며, 인수테스트 DB 종류는 원문에 없어 "DB"로만 적었습니다.',
    notes: ['인수테스트 시나리오 1이 RestAssured로 Controller부터 DB까지 실제로 실행되고, DB에 행이 남았습니다.', '다음 테스트의 @BeforeEach에서 databaseCleanup이 모든 테이블을 TRUNCATE해 DB가 비었습니다.', '테스트마다 실제로 실행하는 범위가 다릅니다. Controller Test는 BusinessController·BusinessRepository를, Service Test는 BusinessRepository를 @MockBean으로 둡니다.'] },
  { id: 'E03', title: '이벤트스토밍 카드와 경계', short: '이벤트스토밍', duration: 11000, final: 9000, steps: [2400, 6400, 9000], source: R14, assets: [`${R14}/d04fba57-7d2b-406b-8d48-e8b8fababa6a.png`],
    caption: '원본 보드(회원·인증 두 경계)에서 회원가입 확인부터 완료 메일까지의 한 경로와, 경계를 넘는 화살표 8개 중 3개를 그렸습니다. 그리지 않은 연결과 줄은 그림 아래 목록에 보드 라벨 그대로 적었습니다. 카드 라벨과 색 종류는 보드 그대로이고, 흩어진 배치·중복 카드 1장·카드가 놓이는 순서·흐르는 점은 설명용입니다.',
    notes: ['알고 있는 도메인 이벤트를 쓰고, 시간 순서로 정렬해 실제로 중복되는 카드를 지웁니다. 위아래로 쌓인 카드는 평행한 시간입니다.', '커맨드가 이벤트를 만들고, 정책이 이벤트와 다음 커맨드를 잇습니다. 외부 시스템(메일)을 거치면 커맨드 → 시스템 → 이벤트 순서입니다.', '회원·인증 두 경계로 나눕니다. 경계를 넘는 화살표 8개 중 로그인 시도 → 회원가입 확인, 회원가입 등록 정책 → 로그인, 로그인 정책 → 개인 상세정보 수정을 그렸고, 나머지는 아래 목록에 있습니다.'] },
  { id: 'E04', title: '데이터 플랫폼의 데이터 경로', short: '데이터 플랫폼', duration: 10000, final: 8000, steps: [3700, 6000, 8000], source: R13, assets: [`${R13}/94b26cb3-0dfb-41b6-91d9-aea7e19e06a1.png`],
    caption: '원본 그림(Data Platform Architecture)의 영역 7개, 노드·도구 이름, 화살표 10개를 그대로 옮겼습니다. 관리 영역에는 원본처럼 선이 없습니다. 흐르는 데이터 점과 시각은 설명용이며 처리량 같은 수치는 넣지 않았습니다.',
    notes: ['Collector → Kafka → Sink를 거쳐 HDFS와 Elasticsearch에 적재합니다. Kafka Streams는 Kafka와만 주고받습니다.', '배치(Data Workflow)는 Kafka가 아니라 HDFS에서 읽고, 결과를 HDFS와 Elasticsearch에 씁니다.', 'HDFS는 Interactive Query(Drill)로, Elasticsearch는 Service API(Netty)를 거쳐 gRPC로 Service Application에 닿습니다. 관리 도구는 데이터 경로와 따로 있습니다.'] },
  { id: 'E05', title: 'Temporal Event History와 Replay', short: 'Temporal', duration: 11000, final: 9400, steps: [3100, 7100, 9400], source: R17, assets: [`${R17}/38190d37-083f-80d4-8e21-c2bc984cf496.webp`],
    caption: '원본 도해의 Server·Event History·Worker A/B와 카드 라벨(이벤트 이름은 약칭)을 옮겼습니다. 공식 문서에 맞춰 Worker 사이 직접 인계 대신 Server를 거치게 했고, 결과가 기록되기 전에 끊긴 Activity가 재시도되는 장면(본문의 at-least-once 설명)을 더했습니다. 크레딧 지급 카드, 타임아웃·재시도 시간, 7일의 압축은 설명용입니다.',
    notes: ['Worker A가 금액 계산 도중 죽어도 시작·데이터 수집 기록은 Server에 남습니다. 금액 계산은 아직 결과가 없습니다.', '끝나지 않은 금액 계산은 재시도로 완료되어 Server에 기록되고, Worker B는 코드를 처음부터 다시 실행하며 기록된 결과로 따라잡습니다.', '승인 신호를 받은 뒤 크레딧 지급을 실행합니다. Worker가 바뀌어도 워크플로우는 이어집니다.'] },
  { id: 'X05', title: '팀 회고: 카드에서 액션 플랜까지', short: '팀 회고', duration: 9000, final: 6800, steps: [3000, 4800, 6800], source: R11, assets: [],
    caption: '본문의 예시 카드 두 장과 그룹 이름(예시), 글 머리 스프레드시트에 적힌 액션 플랜을 옮겼습니다. 고른 그룹은 그 액션 플랜으로 확인한 것입니다. 득표수는 원문에 라벨이 없고 1~3순위·대화 단계는 예시가 없어 그리지 않았습니다. 강조와 화살표는 설명용이며, 입력 표는 아래에 그대로 있습니다.',
    notes: ['자료 모으기에서 쓴 카드 두 장을 그룹으로 묶습니다(좋은 결과물, 시간 관리 못함).', '투표로 한 그룹(시간 관리 못함)을 고릅니다.', '고른 그룹에서 내일 바로 실천할 액션 플랜을 씁니다: 시간 관리를 위해 칸반보드를 활용한다.'] },
] as const;
export type ProcessFigureId = (typeof processInfo)[number]['id'];
