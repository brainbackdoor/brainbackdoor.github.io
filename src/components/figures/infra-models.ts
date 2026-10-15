/** B06 인프라·운영 16종의 사건 모델과 정보. 시각은 설명용 연출 ms이며 측정값이 아니다. 값은 원문(SOURCES-A·B·C)에서만 가져오고, 원문에 없는 값은 '설명용'으로 표시한다. */
const p = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* A01 망 구성(G04): SG 규칙 5개가 허용하는 경로와, 규칙이 없어 막히는 직접 접근 */
export const A01 = { web: [800, 1600], admin: [2200, 3000], toWeb22: [3400, 4000], toDb22: [4200, 4800], db: [5200, 5800], block: [6400, 7000, 7600], end: 8200 } as const;
export const A01_RULES = [['외부망', '전체 대역', 443], ['외부망', '관리망', 22], ['내부망', '외부망', 3306], ['내부망', '관리망', 22], ['관리망', '로컬 PC 공인 IP', 22]] as const;
export const A01_BLOCKED = [['인터넷', '외부망', 22], ['인터넷', '내부망', 3306], ['로컬 PC', '외부망', 22]] as const;
export function a01(t: number) {
  const ruleAt = [A01.web[1], A01.toWeb22[1], A01.db[1], A01.toDb22[1], A01.admin[1]];
  return {
    allowed: ruleAt.map(at => t >= at), blocked: A01.block.map(at => t >= at + 600),
    phase: t < A01.web[1] ? '사용자 요청은 인터넷에서 외부망 443으로 들어옵니다.' : t < A01.admin[1] ? '외부망 443은 전체 대역에 열려 있습니다.' : t < A01.db[1] ? '관리망(Bastion)은 로컬 PC 공인 IP의 22만 받고, 외부망·내부망 22로 들어갑니다.' : t < A01.block[0] ? '내부망 3306은 외부망에서 오는 요청만 받습니다.' : t < A01.end ? '규칙에 없는 인바운드는 보안 그룹에서 막힙니다.' : '허용 경로 5개만 열려 있습니다. 직접 접근은 막힙니다.',
  };
}

/* A02 TLS 종료(G01 nginx): :80은 301, :443에서 TLS가 끝나고 WAS로는 평문 */
export const A02 = { http: [600, 1200, 1800], hand: [2200, 3000], req: [3200, 3800], plain: [3800, 4400], db: [4600, 5200], back: [5200, 5800, 6400, 7000] } as const;
export function a02(t: number) {
  return {
    redirected: t >= A02.http[2], tls: t >= A02.hand[1], decrypted: t >= A02.req[1], answered: t >= A02.back[3],
    phase: t < A02.http[2] ? ':80 요청은 https로 301 리다이렉트됩니다.' : t < A02.hand[1] ? ':443에서 TLS 핸드셰이크(fullchain·privkey)를 합니다.' : t < A02.plain[1] ? 'nginx가 복호화한 뒤 proxy_pass로 WAS에 평문 HTTP를 보냅니다.' : t < A02.back[3] ? 'WAS가 DB에 질의하고 응답은 nginx에서 다시 암호화됩니다.' : '암호화 구간은 클라이언트 ↔ nginx 하나입니다. TLS는 nginx에서 끝납니다.',
  };
}

/* A03 DNS-01(G01 certbot manual): TXT 게시 → 확인 → CA 조회 → 발급 → 수동 적용 뒤에야 443 */
export const A03 = { order: [600, 1200], ask: [1200, 1800], txt: [2200, 2800], dig: 3400, verify: [3800, 4600], issued: 5000, apply: [5600, 6200, 6800, 7400], end: 8000 } as const;
export function a03(t: number) {
  const applied = A03.apply.filter(at => t >= at).length;
  return {
    asked: t >= A03.ask[1], txt: t >= A03.txt[1], dug: t >= A03.dig, verified: t >= A03.verify[1], issued: t >= A03.issued, applied, served: applied === 4,
    phase: t < A03.ask[1] ? 'certbot(manual, dns-01)이 인증서를 주문합니다.' : t < A03.txt[1] ? 'CA가 _acme-challenge TXT 값을 요구합니다. 아직 발급 전입니다.' : t < A03.verify[0] ? 'TXT를 DNS에 넣고 dig로 반영을 확인한 뒤 Enter를 누릅니다.' : t < A03.issued ? 'CA가 DNS에서 TXT를 조회해 도메인 제어권을 검증합니다.' : t < A03.apply[3] ? '발급된 fullchain·privkey를 손으로 옮겨 nginx에 적용합니다.' : '적용한 뒤에야 :443이 이 인증서로 응답합니다.',
  };
}

/* A04 프로필(G01 파일·account, G04 DB): 실행 방법이 프로필을, 프로필이 파일과 DB를 고른다 */
export const A04 = { test: [800, 2200], local: [2800, 4200], prod: [4800, 6200], end: 6800 } as const;
export const A04_ROWS = [['test', 'JUnit 실행', 'testuser', 'H2'], ['local', 'IntelliJ Multirun local', 'localuser', 'docker MySQL'], ['prod', 'java -jar -Dspring.profiles.active=prod', 'produser', '운영 DB']] as const;
export function a04(t: number) {
  const on = [A04.test, A04.local, A04.prod].map(([a]) => t >= a), active = [A04.test, A04.local, A04.prod].findIndex(([a, b]) => t >= a && t < b);
  return {
    on, active, done: [A04.test, A04.local, A04.prod].map(([, b]) => t >= b),
    phase: t < A04.test[0] ? '실행 방법에 따라 활성 프로필이 정해집니다.' : t < A04.local[0] ? 'JUnit은 test 프로필 → application-test.properties → H2.' : t < A04.prod[0] ? 'Multirun local(db·dev·SubwayApplication) → application-local.properties → docker MySQL.' : t < A04.end ? '-Dspring.profiles.active=prod → application-prod.properties → 운영 DB.' : '세 프로필이 각자 다른 파일과 DB를 씁니다.',
  };
}

/* A05 배포 스크립트(G01, 명령은 G02): 변경 감지 → pull → 빌드 → 종료 → 기동. 종료와 기동 사이가 비어 있다 */
export const A05 = { cron1: 800, same: 1400, cron2: 2400, diff: 3000, pull: 3600, build: [4000, 4800], kill: 5200, start: 6600, curl: 7200, end: 7800 } as const;
export function a05(t: number) {
  return {
    run: t >= A05.cron2 ? 2 : t >= A05.cron1 ? 1 : 0, nothing: t >= A05.same && t < A05.cron2, changed: t >= A05.diff, pulled: t >= A05.pull, built: t >= A05.build[1],
    oldUp: t < A05.kill, newUp: t >= A05.start, down: t >= A05.kill && t < A05.start, checked: t >= A05.curl,
    phase: t < A05.same ? 'cron이 스크립트를 실행하면 check_df가 원격 브랜치와 비교합니다.' : t < A05.cron2 ? '같으면 "Nothing to do"로 끝냅니다.' : t < A05.build[1] ? '다르면 pull하고 빌드합니다(빌드·종료·기동은 스크립트에 주석으로만 있음).' : t < A05.start ? '기존 프로세스를 종료하면 새 프로세스가 뜰 때까지 응답할 프로세스가 없습니다.' : t < A05.end ? '새 프로세스가 뜨고 curl로 확인합니다.' : '종료 후 기동이라 중단 구간이 있습니다. 무중단 배포가 아닙니다.',
  };
}

/* A06 ASG(G12): CPU 목표 50% 대상 추적, healthy 전에는 트래픽 없음, 축소는 종료 정책 순서 */
export const A06 = { rise: 1200, scaleOut: 2000, boot: [2000, 3200], registered: 3200, healthy: 4600, fall: 6000, scaleIn: 6600, drain: [6600, 7400], end: 8000 } as const;
export function a06(t: number) {
  return {
    cpu: t < A06.rise ? 40 : t < A06.fall ? 70 : 30, desired: t >= A06.scaleIn ? 2 : t >= A06.scaleOut ? 3 : 2,
    third: t < A06.scaleOut ? 'none' : t < A06.registered ? 'booting' : t < A06.healthy ? 'initial' : 'healthy',
    oldest: t < A06.scaleIn ? 'healthy' : t < A06.drain[1] ? 'draining' : 'gone',
    phase: t < A06.rise ? '원하는 용량 2대가 healthy이고 ALB가 두 대에 나눕니다.' : t < A06.scaleOut ? '평균 CPU가 목표 50%를 넘습니다(값은 설명용).' : t < A06.registered ? '원하는 용량이 3이 되고 새 인스턴스가 사용자 데이터를 실행합니다.' : t < A06.healthy ? '대상 그룹에 등록됐지만 헬스 체크 통과 전이라 트래픽이 가지 않습니다.' : t < A06.fall ? 'healthy가 된 뒤에야 ALB가 요청을 보냅니다.' : t < A06.drain[1] ? '부하가 줄면 종료 정책 순서대로 한 대를 줄입니다.' : '2대로 돌아옵니다(최소 1 · 최대 4 · 휴지 300초).',
  };
}

/* A07 모듈·DB·배포본(G14 관계, G12 사용자 데이터) */
export const A07 = { steps: [800, 1400, 2000, 2600, 3200, 3800], up: 4200, db: [4600, 5000, 5400], calls: [6400, 7000, 7600], end: 8200 } as const;
export const A07_USERDATA = ['yum install amazon-cloudwatch-agent', 's3 cp config.json', 'agent fetch-config', 'yum install java-17-amazon-corretto', 's3 cp conference-0.0.1-SNAPSHOT.jar', 'java -jar -Dspring.profiles.active=prod'] as const;
export function a07(t: number) {
  return {
    ran: A07.steps.filter(at => t >= at).length, up: t >= A07.up, db: A07.db.filter(at => t >= at).length, calls: A07.calls.filter(at => t >= at).length,
    phase: t < A07.steps[5] ? 'EC2 사용자 데이터가 S3에서 설정과 jar를 받아 실행합니다.' : t < A07.db[0] ? '모듈 4개가 뜹니다(conference 외 jar 이름은 원문에 없음).' : t < A07.calls[0] ? 'conference·member·analysis는 각자 DB에 연결합니다. front는 DB가 없습니다.' : t < A07.end ? '사용자는 front·member로, front는 conference·analysis를 호출합니다.' : '원본 구조도의 모듈·DB 관계 그대로입니다.',
  };
}

/* O01 로그·메트릭(G06): 설정된 수집과 설정되지 않은 것, 레인 분리 */
export const O01 = { metrics: [800, 1800], logs: [2200, 3200], micrometer: [3600, 4400], ec2: 4800, dash: 5400, missing: 6000, end: 6800 } as const;
export function o01(t: number) {
  return {
    metrics: t >= O01.metrics[1], logs: t >= O01.logs[1], micrometer: t >= O01.micrometer[1], ec2: t >= O01.ec2, dash: t >= O01.dash, missing: t >= O01.missing,
    phase: t < O01.metrics[1] ? 'agent가 60초마다 disk·mem_available·netstat 메트릭을 보냅니다.' : t < O01.logs[1] ? 'agent가 /var/log/syslog를 로그 그룹 syslog로 보냅니다.' : t < O01.micrometer[1] ? '앱 메트릭은 Micrometer가 namespace brainbackdoor로 직접 보냅니다.' : t < O01.dash ? 'CPU·네트워크는 EC2 기본 지표(AWS/EC2)로 들어옵니다.' : t < O01.end ? '대시보드에 위젯을 만듭니다. 앱 로그·nginx 로그는 수집 설정이 없습니다.' : '로그와 메트릭은 다른 레인입니다. 알람은 원문에 없습니다.',
  };
}

/* O02 동시 관찰(G11 smoke 한 번): 같은 실행의 지표를 한 시간 커서로 */
export const O02 = { sweep: [1200, 5200], stats: 5800, gaps: 6400, end: 7000 } as const;
export const O02_LATENCY = { min: 5.41, med: 6.92, mean: 7.52, p90: 8.44, p95: 9.25, max: 14.61 } as const;
export function o02(t: number) {
  return {
    cursor: 10 * p(t, O02.sweep[0], O02.sweep[1]), stats: t >= O02.stats, gaps: t >= O02.gaps,
    phase: t < O02.sweep[0] ? 'smoke.js: VU 1, 10초, 반복마다 요청 2개 + sleep(1).' : t < O02.sweep[1] ? '같은 실행의 VU·RPS를 한 시간 커서로 봅니다.' : t < O02.gaps ? 'Grafana 통계: RPS 2.000, checks 10/10, 지연 mean 7.52 ms · p95 9.25 ms.' : t < O02.end ? '오류는 "No data", 자원 지표는 이 실행에 없습니다.' : '함께 보이는 것과 원인은 다릅니다. 원인은 따로 확인합니다.',
  };
}

/* O03 Pinpoint(G05): 요청 경로와 모니터링 경로 분리 */
export const O03 = { user: [800, 1500], call: [1500, 2200], reply: [2200, 2900], span: [1600, 2800], store: [3200, 3800], web: 4200, end: 5400 } as const;
export function o03(t: number) {
  return {
    served: t >= O03.reply[1], sent: t >= O03.span[1], stored: t >= O03.store[1], shown: t >= O03.web,
    phase: t < O03.call[1] ? 'USER 요청이 front-api를 거쳐 member-api로 갑니다.' : t < O03.span[1] ? 'agent(-javaagent)는 요청과 별도로 span을 gRPC로 collector에 보냅니다.' : t < O03.web ? 'collector가 저장소(HBase)에 씁니다.' : t < O03.end ? 'web(8080)이 Servermap·Callstack·Inspector로 보여 줍니다.' : '요청 경로와 모니터링 경로는 따로입니다(sampling-rate=1 → 100%).',
  };
}

/* O04 호출 트리(G05 mixed view): 시작 오프셋(ms, .372 기준), 실행, self, 앱 */
export const O04_ROWS = [
  [0, 'Servlet Process /api/conferences', 0, 766, 10, 'front'], [1, 'invoke (StandardHostValve)', 8, 756, 27, 'front'], [2, 'doPost (FrameworkServlet)', 33, 729, 217, 'front'],
  [3, 'getInputStream → :8084/api/auth/me', 151, 510, 507, 'front'], [4, '[member-api] /api/auth/me', 218, 448, 13, 'member'], [5, 'invoke (StandardHostValve)', 228, 435, 61, 'member'],
  [6, 'doGet (FrameworkServlet)', 287, 374, 101, 'member'], [7, 'invokeWithinTransaction', 311, 273, 253, 'member'],
] as const;
export const O04 = { scale: 3.6, base: 600, err: [4400, 5000, 5600], end: 6600 } as const;
export function o04(t: number) {
  const ms = (t - O04.base) / O04.scale;
  return {
    ms, shown: O04_ROWS.filter(r => ms >= r[2]).length, err: O04.err.filter(at => t >= at).length,
    phase: t < O04.err[0] ? '호출 순서대로 구간이 펼쳐집니다. member-api span이 getInputStream 안에서 열립니다.' : t < O04.err[2] ? '토큰 만료 → member-api 403 → front IOException → /api/conferences 500.' : t < O04.end ? '병목이 아니라 오류 trace입니다. getInputStream self 507에는 원격 대기가 들어 있습니다.' : '보이는 행 기준(원본 표 아래는 잘림). 실행 = self + 자식.',
  };
}

/* O05 부하 발생(G11): 발생기와 대상 분리, nGrinder와 k6 */
export const O05 = { register: [800, 1600], approve: 1800, script: [2200, 2800], load: [3200, 4000], result: [4200, 4800], k6: [5200, 6000], view: [6000, 6600], end: 7200 } as const;
export function o05(t: number) {
  return {
    approved: t >= O05.approve, scripted: t >= O05.script[1], loaded: t >= O05.load[1], reported: t >= O05.result[1], k6: t >= O05.k6[1], viewed: t >= O05.view[1],
    phase: t < O05.approve ? 'agent가 controller:16001에 등록되고 승인됩니다(agent 1대).' : t < O05.script[1] ? 'controller가 Groovy 스크립트를 agent에 내립니다.' : t < O05.result[1] ? 'agent가 대상 서버에 요청을 보내고 결과를 controller에 올립니다.' : t < O05.view[1] ? 'k6는 대상에 로그인·조회를 보내고 InfluxDB(8086)에 기록, Grafana(3000)가 읽습니다.' : '부하 발생기와 대상 서버는 다른 서버입니다.',
  };
}

/* O06 부하 모양(G14 그래프 근사): smoke · load · stress */
export const O06 = { smoke: [600, 1800], load: [2000, 4200], stress: [4400, 6800], end: 7400 } as const;
export function o06(t: number) {
  return {
    smoke: p(t, O06.smoke[0], O06.smoke[1]), load: p(t, O06.load[0], O06.load[1]), stress: p(t, O06.stress[0], O06.stress[1]),
    phase: t < O06.load[0] ? 'Smoke: VU 1로 짧게 동작을 확인합니다.' : t < O06.stress[0] ? 'Load: 목표 부하(100 VU)까지 올려 유지합니다.' : t < O06.end ? 'Stress: 100씩 계단으로 올려 한계와 오류를 봅니다.' : '세 테스트는 목적이 다릅니다. 결과 곡선은 원문에 없습니다.',
  };
}

/* O07 목푯값(G11): DAU → rps, 한 VU의 반복 → VU 수 */
export const O07 = { chain: [600, 1200, 1800, 2400], r1: [2800, 3300], r2: [3300, 3800], think: [3800, 4800], perVu: 5000, vu: 5600, real: 6400, end: 7200 } as const;
export function o07(t: number) {
  const T = 2 * 0.5 + 1, vu = (300 * T) / 2;
  return {
    chain: O07.chain.filter(at => t >= at).length, T, vu, perVu: 2 / T, iter: p(t, O07.r1[0], O07.think[1]), real: t >= O07.real,
    phase: t < O07.chain[3] ? 'DAU × 1인당 요청 수 ÷ 86,400 × (최대/평소) = 최대 rps.' : t < O07.perVu ? '한 반복: 요청 2개 × 0.5 s + 대기 1 s = T 2 s.' : t < O07.vu ? 'VU 하나는 2요청 / 2초 = 1 rps.' : t < O07.real ? 'VU = (300 × 2) / 2 = 300. R/T = 1이라 VU와 rps가 같은 숫자가 됐습니다.' : '실측 smoke: VU 1이 약 2 rps(요청이 7.52 ms라 T ≈ 1.015 s).',
  };
}

/* O08 서킷 브레이커(G14 시나리오 3): 실패 → open(즉시 실패) → half-open 시험 → closed. 임계·대기·대수는 설명용 */
export const O08 = { burst: [800, 2400], open: 2600, fallback: [2800, 3600], scale: [4000, 4600], half: 5000, trial: [5200, 5600], close: 5800, end: 7000 } as const;
export function o08(t: number) {
  const state = t < O08.open ? 'CLOSED' : t < O08.half ? 'OPEN' : t < O08.close ? 'HALF-OPEN' : 'CLOSED';
  return {
    state, failing: t >= O08.burst[0] && t < O08.open, scaled: t >= O08.scale[1], recovered: t >= O08.close,
    phase: t < O08.burst[0] ? 'front가 conference를 호출합니다.' : t < O08.open ? '추첨 홍보로 요청이 몰려 conference 응답 실패가 늘어납니다.' : t < O08.half ? '실패율이 임계(설명용)를 넘으면 OPEN: 호출하지 않고 바로 실패·대체 응답.' : t < O08.close ? '대기(설명용) 뒤 HALF-OPEN에서 시험 호출을 보냅니다. 그 사이 증설합니다.' : t < O08.end ? '시험 호출이 성공하면 CLOSED로 돌아옵니다.' : '증설한 대수만큼 처리량이 늘지는 않습니다. 한계는 측정으로 확인합니다.',
  };
}

/* O09 동기·비동기(G14 시나리오 4, 개념 예시): 접수 응답과 처리 완료를 나눈다.
   같은 시간축(시나리오 초, 설명용)을 커서가 지나며 사건에서 잠시 멈춘다(정적 단계가 멈춘 장면이 되도록). */
export const O09 = { move: [[600, 1400, 0, 0.6], [2000, 3600, 0.6, 3.0], [3600, 3800, 3.0, 3.2]], accepted: 0.6, syncDone: 3.0, asyncDone: 3.2, burst: [4400, 5600], end: 6800 } as const;
export function o09(t: number) {
  let sec = 0;
  for (const [a, b, s0, s1] of O09.move) { if (t >= b) sec = s1; else if (t >= a) { sec = s0 + (s1 - s0) * p(t, a, b); break; } else break; }
  return {
    sec, accepted: sec >= O09.accepted, syncDone: sec >= O09.syncDone, done: sec >= O09.asyncDone,
    queued: t < O09.burst[0] ? 0 : Math.min(4, Math.floor(p(t, O09.burst[0], O09.burst[1]) * 4 + 1e-9)),
    phase: sec < O09.accepted ? '동기: 처리가 끝날 때까지 기다립니다. 비동기: 요청을 큐에 넣습니다.' : sec < O09.syncDone ? '비동기는 바로 "접수됨"을 응답합니다. 동기는 아직 기다립니다.' : sec < O09.asyncDone ? '동기 응답은 처리가 끝난 뒤에야 옵니다.' : t < O09.burst[0] ? '비동기의 "처리 완료"는 접수와 따로, 워커가 끝낸 뒤 옵니다.' : t < O09.end ? '선착순에 요청이 몰리면 큐가 길어지고 완료가 늦어집니다.' : '접수 ≠ 완료. 큐·워커·재시도는 원문에 없는 개념 예시입니다.',
  };
}

/* 16종 정보: 캡션은 원문 값과 설명용 값을 구분하고, 단계 시각은 멈춘 장면(사건 직후, 다음 사건 전)이다. */
const G01 = '0798ec80-70e7-441d-a238-2dc640122bce', G04 = '1824fb4e-415b-4a61-8ec4-76e5102ee32f', G05 = '1ca5dd49-2787-4f09-b88b-8e5881aa0b15', G06 = '6660b3f1-de92-4053-b3e0-08a84ea34432', G11 = 'ad9d2017-f854-4a97-bddb-6a8981dc14c1', G12 = 'b065c018-114e-4897-9a53-98115cd9b382', G14 = 'dfe2e77f-066e-46e9-a575-ed1e65157321';
export const infraInfo = [
  { id: 'A01', title: '망 구성과 접근 경로', short: '망·SG', duration: 10500, final: 8800, steps: [1950, 6200, 8800], source: G04, assets: [`${G04}/d36d232e-2274-4ee5-9a10-00421d4c1578.webp`],
    caption: '원본 그림과 체크리스트의 VPC 192.168.0.0/24, 외부망 /26 두 개(AZ 분리), /27 두 개와 보안 그룹 규칙 5개. /27 두 개 중 어느 쪽이 내부망·관리망인지는 원문에 없어 설명용으로 배정했습니다. 규칙에 없는 인바운드는 보안 그룹이 거부합니다.',
    notes: ['인터넷 사용자는 외부망 443으로만 들어옵니다.', '관리망(Bastion)은 로컬 PC 공인 IP의 22만 받고, 외부망·내부망 22로 들어갑니다. 내부망 3306은 외부망에서만 받습니다.', '규칙에 없는 직접 접근(인터넷 → 22·3306, 로컬 PC → 서비스 22)은 막힙니다.'] },
  { id: 'A02', title: 'Reverse Proxy와 TLS 종료', short: 'TLS 종료', duration: 9600, final: 7400, steps: [2120, 4500, 7400], source: G01, assets: [],
    caption: '원문 nginx 설정: :80은 301로 https 전환, :443에서 fullchain·privkey로 TLS를 끝내고 proxy_pass http://172.17.0.1:8080(도커 브리지 게이트웨이 = 호스트)로 평문 전달. WAS ↔ DB 암호화는 원문에 없어 그리지 않습니다. 설정의 ssl_protocols는 TLSv1·1.1·1.2입니다.',
    notes: [':80 요청은 https로 301 리다이렉트됩니다.', 'TLS는 nginx에서 끝나고, WAS로는 평문 HTTP(:8080)가 갑니다.', '응답은 nginx에서 다시 암호화됩니다. 자물쇠는 클라이언트 ↔ nginx 구간에만 있습니다.'] },
  { id: 'A03', title: 'DNS-01 챌린지와 인증서 적용', short: 'DNS-01', duration: 10500, final: 8400, steps: [2000, 5300, 8400], source: G01, assets: [],
    caption: "원문 certbot 명령(manual, --preferred-challenges dns)과 캡처의 _acme-challenge TXT. TXT를 게시해 검증을 통과해야 발급되고(본문의 '생성 후 TXT 추가'와 순서가 반대), 개인키는 서버에서 만들어 CA로 보내지 않습니다. 토큰 값과 도메인은 자리표시로 씁니다.",
    notes: ['certbot이 주문하면 CA가 _acme-challenge TXT 값을 요구합니다. 아직 발급 전입니다.', 'TXT를 DNS에 넣고 dig로 확인한 뒤, CA가 조회해 검증하고 발급합니다.', '발급된 fullchain·privkey를 cp → Dockerfile COPY → nginx ssl_certificate → :0.0.2 재실행(-p 443)한 뒤에야 443이 응답합니다.'] },
  { id: 'A04', title: '프로필별 설정 파일과 DB', short: '프로필', duration: 9000, final: 7000, steps: [2600, 4600, 7000], source: G01, assets: [],
    caption: '파일과 account.name 값은 원문 커밋 diff(application-local/prod/test.properties), DB 대응은 같은 미션 요구사항(JUnit: h2, Local: docker(mysql), Prod: 운영 DB) 기준입니다. DB URL은 원문에 없고 password 값은 가립니다. 기본 application.properties 위에 프로필 파일이 덮어씁니다.',
    notes: ['JUnit 실행 → test 프로필 → application-test.properties → H2.', 'IntelliJ Multirun local(db·dev·SubwayApplication) → application-local.properties → docker MySQL.', 'java -jar -Dspring.profiles.active=prod → application-prod.properties → 운영 DB.'] },
  { id: 'A05', title: '배포 스크립트의 흐름과 중단 구간', short: '배포', duration: 10000, final: 8200, steps: [1900, 5800, 8200], source: G01, assets: [],
    caption: '스크립트에 실제 코드가 있는 것은 check_df(fetch·rev-parse 비교)와 pull(origin master)까지이고, build·pid 종료·기동은 주석입니다. 그 단계는 G02의 명령(./gradlew clean build, kill -2, nohup java -jar, curl)으로 표시합니다. 종료 후 기동이라 중단 구간이 있습니다(그동안의 502는 설명용).',
    notes: ['cron이 실행할 때 변경이 없으면 "Nothing to do"로 끝냅니다.', '변경이 있으면 pull·빌드 뒤 기존 프로세스를 종료합니다. 새 프로세스가 뜰 때까지 응답할 프로세스가 없습니다.', '새 프로세스를 띄우고 curl localhost:8080으로 확인합니다. 무중단 배포가 아닙니다.'] },
  { id: 'A06', title: 'ASG 증설·대상 등록·축소', short: 'ASG', duration: 10500, final: 8400, steps: [4000, 5200, 8400], source: G12, assets: [],
    caption: '원문 설정: 시작 템플릿 conference-lt Latest(1), 원하는 2 · 최소 1 · 최대 4, 대상 추적(평균 CPU 50), 종료 정책 가장 오래된 시작 템플릿 → 가장 오래된 인스턴스 → 기본값, 휴지 300초, 대상 그룹 brainbackdoor-tg. CPU 값과 헬스 체크 경로·임계는 원문에 없어 설명용입니다.',
    notes: ['CPU가 목표를 넘어 원하는 용량이 3이 되면, 새 인스턴스는 등록돼도 헬스 체크 통과 전에는 트래픽을 받지 않습니다.', 'healthy가 된 뒤에야 ALB가 세 대에 나눕니다.', '부하가 줄면 종료 정책 순서대로 한 대를 줄여 2대로 돌아옵니다.'] },
  { id: 'A07', title: '모듈·DB·배포본 연결', short: '모듈·DB', duration: 10500, final: 8600, steps: [4500, 5800, 8600], source: G14, assets: [`${G14}/e1557ab1-f09c-495d-af93-1af4a591e5b0.webp`],
    caption: '원본 구조도의 관계: 사용자 → front·member, front → conference·analysis, DB는 conference·member·analysis(front는 DB 없음). 시작 명령은 실습환경 가이드의 사용자 데이터 6줄이며 jar 이름은 conference 예시만 원문에 있습니다. S3 버킷 경로는 원문도 자리표시입니다.',
    notes: ['EC2 사용자 데이터가 S3에서 config.json과 jar를 받아 CloudWatch agent·Java 17을 설치하고 prod 프로필로 실행합니다.', 'conference·member·analysis는 각자 DB에 연결합니다. front는 DB가 없습니다.', '사용자는 front·member로, front는 conference·analysis를 호출합니다.'] },
  { id: 'O01', title: '로그·메트릭 수집 경로', short: '로그·메트릭', duration: 9000, final: 7200, steps: [2200, 5200, 7200], source: G06, assets: [],
    caption: '원문 config.json(예시)이 모으는 것: /var/log/syslog(로그 그룹 syslog, 스트림 {instance_id}), disk·mem_available·netstat(60초). 앱 메트릭은 Micrometer가 namespace brainbackdoor로 직접 보냅니다. 앱 로그(log/file.log)·nginx 로그는 수집 설정이 없고, 알람도 원문에 없습니다.',
    notes: ['agent가 60초마다 disk·mem_available·netstat 메트릭을 보냅니다.', 'syslog는 로그 레인으로, 앱 메트릭은 Micrometer로, CPU·네트워크는 EC2 기본 지표로 따로 들어옵니다.', '대시보드는 이 지표들로 만듭니다. 앱·nginx 로그와 알람은 설정되지 않았습니다.'] },
  { id: 'O02', title: '한 실행의 지표를 함께 보기', short: '동시 관찰', duration: 9000, final: 7400, steps: [1000, 5500, 7400], source: G11, assets: [],
    caption: '원문 k6 smoke 실행 한 번(VU 1, 10초)의 Grafana 결과: RPS avg·max 2.000, checks 10/10, http_req_duration min 5.41 · med 6.92 · mean 7.52 · p90 8.44 · p95 9.25 · max 14.61 ms, 오류 "No data". 초 단위 곡선은 원문에 없어 그리지 않고, 자원 지표도 없습니다.',
    notes: ['smoke.js: VU 1, 10초, 반복마다 요청 2개(로그인·내 정보)와 sleep(1).', '같은 실행의 VU와 RPS를 한 시간축에서 봅니다.', '지연 분포와 checks는 실행 전체의 통계입니다. 오류 "No data"를 0으로 단정하지 않고, 원인도 단정하지 않습니다.'] },
  { id: 'O03', title: 'APM agent·collector·저장·web', short: 'Pinpoint', duration: 8000, final: 5800, steps: [3000, 4100, 5800], source: G05, assets: [],
    caption: '원문 설정: -javaagent(pinpoint-bootstrap-2.5.3), agentId·applicationName front-api, profiler.transport.grpc.collector.ip=[Collector IP], sampling-rate=1(100%), web 기본 포트 8080. 요청 경로는 Servermap(USER → front-api → member-api·conference-api) 기준이고, 저장소 HBase 읽기·쓰기 방향은 Pinpoint 구조 기준입니다.',
    notes: ['USER 요청은 front-api를 거쳐 member-api로 갑니다.', 'agent는 요청과 별도로 span을 gRPC로 collector에 보내고, collector가 HBase에 씁니다.', 'web(8080)이 저장된 데이터로 Servermap·Callstack·Inspector를 보여 줍니다.'] },
  { id: 'O04', title: '호출 트리와 구간 시간', short: '호출 트리', duration: 9000, final: 6800, steps: [4100, 6000, 6800], source: G05, assets: [],
    caption: '원문 mixed view(/api/conferences)의 보이는 행: 시작 오프셋·실행·self(ms). 표 아래가 잘려 있어 보이는 행으로 설명되지 않는 2 ms·20 ms가 남습니다. 병목이 아니라 토큰 만료로 인한 오류(403 → 500) trace입니다.',
    notes: ['호출 순서대로 구간이 펼쳐지고, member-api span(448 ms)이 getInputStream(510 ms) 안에서 열립니다.', '토큰 만료 → member-api 403 → front IOException → /api/conferences 500.', 'getInputStream self 507 ms에는 원격 응답 대기가 들어 있습니다. member-api 안에서 가장 큰 self는 253 ms입니다.'] },
  { id: 'O05', title: '부하 발생기와 대상 서버', short: '부하 발생', duration: 9200, final: 7400, steps: [2100, 5100, 7400], source: G11, assets: [],
    caption: '원문 구성: nGrinder 3.5.8 controller(웹 8080)와 다른 서버의 agent(controller_port 16001, region NONE, 캡처상 1대), Groovy 스크립트(GTest · GET). k6는 smoke.js를 실행하고 InfluxDB(8086, myk6db)에 기록, Grafana(3000, 대시보드 2587)가 읽습니다. nGrinder 결과 수치와 대상 서버 위치는 원문에 없습니다.',
    notes: ['agent가 controller:16001에 등록되고 승인됩니다.', 'controller가 스크립트를 내리면 agent가 대상 서버에 요청을 보내고 결과를 올립니다.', 'k6는 대상에 로그인·조회를 보내고 InfluxDB → Grafana로 결과를 봅니다. 발생기와 대상은 다른 서버입니다.'] },
  { id: 'O06', title: 'Smoke·Load·Stress 부하 모양', short: '부하 모양', duration: 9200, final: 7600, steps: [1900, 4300, 7600], source: G14, assets: [`${G14}/ecf4adbb-d6e8-4696-b5db-d509f0ef572e.webp`],
    caption: '원본 그래프(VU-시간)에서 읽은 근사 모양: Smoke 1 VU 약 1분, Load 0 → 100 VU 상승 뒤 유지, Stress 100 → 200 → 300 → 400 VU 계단 뒤 감소. 시간은 근사이고, 지연·오류 결과 곡선은 원문에 없습니다. 목표는 VUser별 iteration time 100ms 이하입니다.',
    notes: ['Smoke: VU 1로 짧게 동작을 확인합니다.', 'Load: 목표 부하까지 올려 일정 시간 유지합니다.', 'Stress: 계단으로 올려 한계와 오류가 나는 지점을 봅니다(결과는 원문에 없음).'] },
  { id: 'O07', title: 'DAU·RPS·VU 계산', short: 'VU 계산', duration: 9200, final: 7400, steps: [2700, 5300, 7400], source: G11, assets: [],
    caption: '원문 식: T = (R × http_req_duration) + a, VUser = (목표 rps × T) / R. 예시 R = 2, 0.5 s, a = 1 s → T = 2 s, VU = (300 × 2) / 2 = 300(산술 일치). VU 하나는 R/T = 1 rps라 VU와 rps가 같은 숫자일 뿐입니다. DAU·집중률·목표 300의 출처는 원문에 없습니다.',
    notes: ['DAU × 1인당 요청 수 ÷ 86,400 × (최대/평소)로 목표 rps를 구합니다(값은 원문에 없음).', '한 반복은 요청 2개(0.5 s씩)와 대기 1 s, T = 2 s. VU 하나는 1 rps.', 'VU = 300 × 2 / 2 = 300. 실측 smoke는 VU 1이 약 2 rps(요청 7.52 ms라 T ≈ 1.015 s)였습니다.'] },
  { id: 'O08', title: '증설과 서킷 브레이커', short: '서킷 브레이커', duration: 9000, final: 7200, steps: [3800, 4920, 7200], source: G14, assets: [],
    caption: '원문 시나리오 3: 추첨 홍보(lotteryBoundary = 0)로 신청자가 몰려 지연, 목표 VUser별 iteration time 100ms 이하, front scale out, conference 응답 실패가 늘면 서킷 브레이커 뒤 scale out. 차단기 위치(front의 conference 호출)·실패율 임계·대기 시간·대수는 원문에 없어 설명용입니다.',
    notes: ['요청이 몰려 conference 응답 실패가 늘면 차단기가 OPEN이 되어 호출하지 않고 바로 실패·대체 응답을 합니다.', '그 사이 증설합니다(대수는 설명용).', 'HALF-OPEN 시험 호출이 성공하면 CLOSED로 돌아옵니다. 증설한 만큼 처리량이 늘지는 않으며 한계는 측정으로 확인합니다.'] },
  { id: 'O09', title: '동기·비동기와 큐', short: '큐', duration: 9000, final: 6800, steps: [1700, 4100, 6800], source: G14, assets: [],
    caption: "원문 시나리오 4: 선착순(lotteryBoundary = xxx) 모집에 요청이 몰릴 때 'EDA 구조로 변경 및 큐를 활용하여 개선'(취소선 · 미완성). 큐 종류·워커 수·재시도·시간은 원문에 없는 개념 예시입니다.",
    notes: ['동기는 처리가 끝날 때까지 기다리고, 비동기는 큐에 넣은 뒤 바로 "접수됨"을 응답합니다.', '동기 응답은 처리 뒤에, 비동기의 "처리 완료"는 워커가 끝낸 뒤 따로 옵니다.', '요청이 몰리면 큐가 길어지고 완료가 늦어집니다. 접수와 완료는 다릅니다.'] },
] as const;
export type InfraFigureId = (typeof infraInfo)[number]["id"];
