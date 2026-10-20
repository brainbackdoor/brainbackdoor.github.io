/** Approved B03 event models; times are presentation milliseconds. */
const p = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const cwndPoints = [[1300, 1], [2200, 2], [3100, 4], [4000, 8], [4900, 9], [5800, 10], [7000, 1], [7900, 2], [8800, 4], [9700, 5], [10600, 6]];
export const probeGains = [1.25, .75, 1, 1, 1, 1, 1, 1];
const wireRate = 18891 / 5300, gzipSendAt = 3400 - 3039 / wireRate;
export function gzipFixture() { return JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ id: i, line: i % 9, travel_ms: 60000 + i * 37 }))); }
export const networkInfo = [
    {
        "id": "N02",
        "title": "RTT와 전송 윈도",
        "short": "BDP",
        "final": 7000,
        "duration": 10000,
        "steps": [
            1000,
            3500,
            7000
        ],
        "caption": "100 Mbps × 40 ms = 4,000,000 bit = 500,000 B. 윈도 64,000 / 500,000 B의 단순 상한 비교이며 큐 용량을 뜻하지 않습니다.",
        "source": "95400228-c9fb-4397-ac45-281f2a6c7446",
        "assets": [],
        "notes": [
            "BDP의 단위와 경로 용량을 계산합니다.",
            "송신 윈도 안의 데이터만 ACK를 기다립니다.",
            "64 kB 윈도는 12.8 Mbps, 500 kB는 링크 상한 100 Mbps. 손실·헤더·혼잡 제어는 생략합니다."
        ]
    },
    {
        "id": "N04",
        "title": "연결 수립과 윈도 통지",
        "short": "handshake",
        "final": 6500,
        "duration": 9500,
        "steps": [
            2500,
            4300,
            6500
        ],
        "caption": "ISN 1,000 / 5,000 · DATA 1,460 B · rwnd 8,192 B. 서버 앱은 수신 데이터를 처리합니다. 연출 시간은 원본의 28/56/84 ms와 구분합니다.",
        "source": "tcp-error-recovery",
        "assets": [
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/2d7c4d52-3e13-4436-9c6b-9bc532cce38b.png"
        ],
        "notes": [
            "SYN에는 초기 순번이 있고 한 순번을 사용합니다.",
            "클라이언트는 SYN/ACK 수신, 서버는 최종 ACK 수신 후 ESTABLISHED입니다.",
            "DATA 1,460 B 뒤 다음 기대 순번은 ACK 2,461. 수신 윈도 rwnd 8,192 B."
        ]
    },
    {
        "id": "N05",
        "title": "Slow start와 혼잡 회피",
        "short": "cwnd",
        "final": 11000,
        "duration": 14000,
        "steps": [
            3100,
            5800,
            11000
        ],
        "caption": "Reno 계열의 RTO 경로 · SMSS 1,460 B · 초기 cwnd 1 SMSS, ssthresh 8 SMSS. RTT마다 모든 데이터가 ACK되는 단순 예제이며 현재 OS 기본값이 아닙니다.",
        "source": "tcp-error-recovery",
        "assets": [
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/02812a18-830d-4bca-90d2-ab6b7cac9371.png",
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/f641d6a9-c9fd-4cf4-877c-6048569c63f8.png"
        ],
        "notes": [
            "새 데이터를 확인하는 ACK마다 최대 1 SMSS 증가를 RTT 단위로 묶어 보여줍니다.",
            "ssthresh 8에 도달한 뒤 9→10으로 혼잡 회피합니다.",
            "FlightSize 10에서 RTO: ssthresh 5, cwnd 1. 다시 1→2→4→5 후 혼잡 회피합니다."
        ]
    },
    {
        "id": "N06",
        "title": "RTO와 빠른 재전송",
        "short": "재전송",
        "final": 7500,
        "duration": 10500,
        "steps": [
            3000,
            5100,
            7500
        ],
        "caption": "SACK·RACK을 생략한 고전 Reno 예제. 빠른 재전송 쪽에만 후속 segment 2·3·4가 있습니다. 타이머는 연출용입니다.",
        "source": "tcp-error-recovery",
        "assets": [
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/69e0c456-eaf3-49b8-a85a-434fb5e82337.png",
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/9fcf3b56-ff1b-42f2-bc21-22233a93bb88.png"
        ],
        "notes": [
            "1번이 손실됩니다. 후속 데이터 없는 쪽은 중복 ACK가 없습니다.",
            "후속 2·3·4의 도착마다 같은 ACK가 오고 세 번째 수신 뒤 재전송합니다.",
            "빠른 쪽은 먼저 복구. 다른 쪽은 RTO 후 재전송합니다. 실제 복구 시간의 비교 측정은 아닙니다."
        ]
    },
    {
        "id": "N07",
        "title": "프레임·MTU·MSS",
        "short": "패킷 계층",
        "final": 5500,
        "duration": 8500,
        "steps": [
            1200,
            3500,
            5500
        ],
        "caption": "Ethernet II · IPv4/TCP 옵션 없음 · VLAN 없음 · IP MTU 1,500 B. preamble·IFG 제외. 박스 너비는 바이트 비례가 아닙니다.",
        "source": "tcp-error-recovery",
        "assets": [
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/eb046534-d87b-4462-88ad-53418c157682.png"
        ],
        "notes": [
            "TCP payload 1,460 B.",
            "TCP header 20 B + IPv4 header 20 B = IP packet 1,500 B.",
            "L2 header 14 B + IP packet + FCS 4 B = frame 1,518 B."
        ]
    },
    {
        "id": "N08",
        "title": "혼잡 제어의 관측값",
        "short": "BBRv1",
        "final": 10500,
        "duration": 13500,
        "steps": [
            1500,
            2900,
            10500
        ],
        "caption": "Linux v6.1 BBRv1의 PROBE_BW 한 주기 · 추정 BtlBw 100 Mbps / RTprop 40 ms. ProbeRTT·STARTUP·손실 회복은 생략한 유체 모델이며 성능 측정이 아닙니다.",
        "source": "tcp-error-recovery",
        "assets": [
            "5df70731-ea29-47b1-bff3-9f18e8ff955f/03a6fb40-125b-4b51-9a15-8102ec97f078.gif"
        ],
        "notes": [
            "Reno의 손실 신호와 BBR의 delivery rate·최소 RTT 관측을 구분합니다.",
            "gain 1.25 구간의 초과 유입이 큐를 늘리고 0.75 구간은 줄입니다.",
            "1.25→0.75→1.0 6회. 이 고정 경로 모델의 큐는 125 kB까지 늘었다가 0으로 돌아갑니다."
        ]
    },
    {
        "id": "N09",
        "title": "작은 쓰기와 ACK 대기",
        "short": "Nagle",
        "final": 6500,
        "duration": 9500,
        "steps": [
            2000,
            3200,
            6500
        ],
        "caption": "미확인 데이터가 남은 작은 두 쓰기. 비교는 Nagle on / TCP_NODELAY=1이며 delayed ACK 만료는 설명용 사건입니다.",
        "source": "02773af9-5c93-43b5-89b4-bbab94536195",
        "assets": [],
        "notes": [
            "첫 작은 쓰기는 두 패널 모두 바로 전송할 수 있습니다.",
            "두 번째 작은 쓰기: Nagle은 ACK 또는 충분한 데이터까지 대기, NODELAY 쪽은 전송합니다.",
            "TCP_NODELAY를 켜면 Nagle을 비활성화합니다. delayed ACK 자체를 끄는 설정은 아닙니다."
        ]
    },
    {
        "id": "N10",
        "title": "마지막 ACK 유실과 TIME_WAIT",
        "short": "연결 종료",
        "final": 10500,
        "duration": 13500,
        "steps": [
            4000,
            6800,
            10500
        ],
        "caption": "정상 FIN 종료에서 마지막 ACK만 손실. 능동 종료 측 TIME_WAIT, 수동 종료 측 FIN 재전송. 2MSL은 화면에서 압축하며 OS의 초 단위 기본값을 단정하지 않습니다.",
        "source": "beae0ed2-e020-4681-abac-fdb9e5f12c5f",
        "assets": [
            "beae0ed2-e020-4681-abac-fdb9e5f12c5f/6e7daef2-df79-41a4-86a6-505e570686a4.png"
        ],
        "notes": [
            "능동 종료 측 FIN→ACK, 수동 종료 측 FIN을 수신합니다.",
            "마지막 ACK가 유실되어 수동 측은 LAST-ACK. 수동 측 타이머가 FIN을 재전송합니다.",
            "TIME_WAIT 측은 ACK를 다시 보내고 2MSL을 재시작합니다."
        ]
    },
    {
        "id": "N11",
        "title": "TCP의 순서 보장과 HOL",
        "short": "HOL",
        "final": 7300,
        "duration": 10300,
        "steps": [
            2000,
            4300,
            7300
        ],
        "caption": "동일 TCP 바이트 스트림의 segment 1·2·3·4. 2번 손실·후속 수신·복구. 각 번호는 같은 길이 바이트 범위의 약칭입니다.",
        "source": "02773af9-5c93-43b5-89b4-bbab94536195",
        "assets": [],
        "notes": [
            "1번을 앱에 전달합니다.",
            "3·4번은 수신 버퍼에 도착해도 누락된 2번 뒤에서 기다립니다.",
            "2번 재전송 도착 후 2·3·4 순서로 앱에 전달합니다. HTTP 요청 순서가 아니라 TCP 계층의 대기입니다."
        ]
    },
    {
        "id": "N12",
        "title": "TCP keepalive의 응답과 실패",
        "short": "keepalive",
        "final": 8500,
        "duration": 11500,
        "steps": [
            2000,
            5500,
            8500
        ],
        "caption": "SO_KEEPALIVE=on · 설명용 idle 30 s / interval 10 s / probes 3. Linux 기본값이 아니며 화면 시간과 실제 초를 분리합니다.",
        "source": "beae0ed2-e020-4681-abac-fdb9e5f12c5f",
        "assets": [],
        "notes": [
            "HTTP 요청이 없는 유휴 연결. idle 만료 뒤 첫 TCP probe를 보냅니다.",
            "응답하는 연결은 idle 타이머 재시작. 무응답 연결은 interval마다 3회 보냅니다.",
            "마지막 probe의 응답 대기까지 끝난 무응답 연결만 실패 처리합니다. TCP probe는 HTTP 요청이 아닙니다."
        ]
    },
    {
        "id": "N13",
        "title": "HTTP 연결 재사용",
        "short": "연결 재사용",
        "final": 9800,
        "duration": 12800,
        "steps": [
            2400,
            6500,
            9800
        ],
        "caption": "HTTP/1.1 · 같은 3개 GET 요청, 같은 응답. 매번 새 연결 / 하나의 persistent connection. pipelining·TLS·혼잡 윈도 차이는 생략합니다.",
        "source": "beae0ed2-e020-4681-abac-fdb9e5f12c5f",
        "assets": [],
        "notes": [
            "두 패널이 첫 TCP handshake를 완료합니다.",
            "새 연결 쪽은 매번 handshake. 재사용 쪽은 기존 연결에서 다음 요청합니다.",
            "handshake 3회 / 1회. 마지막 응답은 Connection: close. TCP keepalive probe와 별개입니다."
        ]
    },
    {
        "id": "W01",
        "title": "첫 바이트와 리소스 요청",
        "short": "waterfall",
        "final": 7600,
        "duration": 10600,
        "steps": [
            2300,
            4300,
            7600
        ],
        "caption": "DNS 40 / TCP 80 / TLS 80 / 서버 대기 120 / HTML 수신 60 ms의 설명용 예제. CSS·JS 요청은 HTML 완료 뒤로 단순화했습니다. 실제 캡처의 기록은 보존합니다.",
        "source": "80dbc9d7-ba32-4220-9b39-b536172264f2",
        "assets": [
            "80dbc9d7-ba32-4220-9b39-b536172264f2/79a78b75-ca51-4cf9-8ec0-029370b43364.webp"
        ],
        "notes": [
            "DNS→TCP→TLS 연결 준비.",
            "TTFB 뒤에도 HTML 수신 구간이 남습니다.",
            "CSS·JS 요청과 응답이 겹칠 수 있습니다. 막대의 상대 길이는 이 예제의 실제 ms 값입니다."
        ]
    },
    {
        "id": "W02",
        "title": "gzip 전송과 복원",
        "short": "gzip",
        "final": 7400,
        "duration": 10400,
        "steps": [
            1200,
            3600,
            7400
        ],
        "caption": "직접 생성한 동일 500행 JSON: 원본 18,891 B / gzip 3,039 B. 같은 전송률과 별도의 처리 구간이며 일반 압축률·속도 개선율을 뜻하지 않습니다.",
        "source": "80dbc9d7-ba32-4220-9b39-b536172264f2",
        "assets": [],
        "notes": [
            "같은 원문을 identity와 gzip 표현으로 준비합니다.",
            "수신이 끝난 gzip에 대해서만 압축 해제를 시작합니다.",
            "18,891 B의 같은 내용으로 복원됩니다. 헤더·압축 CPU 비용을 포함한 전체 성능 비교는 아닙니다."
        ]
    },
    {
        "id": "W04",
        "title": "ETag 재검증과 표현 변경",
        "short": "ETag",
        "final": 8500,
        "duration": 11500,
        "steps": [
            2300,
            3900,
            8500
        ],
        "caption": "브라우저 private cache · GET /app.css · ETag v1→v2. 304는 응답 헤더만 갱신하며 새 본문은 없습니다.",
        "source": "8e230e0d-431c-4ffe-becd-c60c1bea4615",
        "assets": [],
        "notes": [
            "If-None-Match: v1로 조건부 GET.",
            "변경 없으면 304 후 저장한 v1 본문 재사용.",
            "표현 변경 후 200과 v2 본문 전체 수신→재저장. no-cache는 재검증, no-store는 저장 금지, must-revalidate는 stale 재사용 금지입니다."
        ]
    },
    {
        "id": "W05",
        "title": "HTTP/2 스트림과 TCP 손실",
        "short": "HTTP/2",
        "final": 8000,
        "duration": 11000,
        "steps": [
            1800,
            4900,
            8000
        ],
        "caption": "동일 TCP 연결의 stream 1·3·5. DATA frame을 서로 다른 TCP 바이트 범위로 단순화했습니다. HTTP/2 multiplexing은 TCP HOL을 없애지 않습니다.",
        "source": "80dbc9d7-ba32-4220-9b39-b536172264f2",
        "assets": [],
        "notes": [
            "서로 다른 stream의 프레임이 한 연결에 섞여 나갑니다.",
            "앞의 TCP 범위가 손실되면 뒤의 stream 3·5 프레임도 수신 TCP 버퍼에 대기합니다.",
            "TCP HOL 복구 뒤 연속 바이트를 각 stream으로 분배합니다."
        ]
    },
    {
        "id": "W06",
        "title": "조회 결과 없음의 두 전제",
        "short": "200 / 404",
        "final": 5500,
        "duration": 8500,
        "steps": [
            1200,
            3200,
            5500
        ],
        "caption": "원문의 두 주장 비교. endpoint/데이터 정책과 URI 대상 representation 해석을 구분하며 정답 추천으로 쓰지 않습니다. DELETE·주문 실패 논의는 본문에 남깁니다.",
        "source": "14b691d7-7fd7-4e95-8787-49e06111755f",
        "assets": [
            "14b691d7-7fd7-4e95-8787-49e06111755f/e377decb-702b-4971-a424-e4ee83344fde.png"
        ],
        "notes": [
            "path ID 요청과 query 조회를 동일 빈 결과로 시작합니다.",
            "대상이 정상 endpoint라는 해석과 representation을 찾지 못했다는 해석을 각각 전개합니다.",
            "컬렉션이 존재하고 결과만 비었다는 별도 전제는 200 + []로 구분합니다."
        ]
    }
] as const;
export type NetworkFigureId = (typeof networkInfo)[number]["id"];
export const nagleAckTiming = {sentAt:4000,receivedAt:4600} as const;
export const networkModels = {
    N02: (t: number) => { return { bdpBytes: 100000000 * .04 / 8, smallMbps: 64000 * 8 / .04 / 1e6, largeMbps: Math.min(500000 * 8 / .04 / 1e6, 100), acknowledged: t >= 5000 ? 500000 : 0, inflight: t >= 1400 && t < 5000 ? 500000 : 0, phase: t < 1400 ? 'RTT 동안 미확인 데이터가 경로에 머뭅니다.' : t < 5000 ? '송신 윈도에 따라 링크에 넣을 수 있는 데이터량이 달라집니다.' : 'BDP는 경로를 채우는 양입니다. 라우터 큐 용량과는 다른 값입니다.' }; },
    N04: (t: number) => { return { client: t >= 2900 ? 'ESTABLISHED' : t >= 1100 ? 'SYN-SENT' : 'CLOSED', server: t >= 4100 ? 'ESTABLISHED' : t >= 1700 ? 'SYN-RECEIVED' : 'LISTEN', receivedBytes: t >= 5000 ? 1460 : 0, ackNumber: t >= 5800 ? 2461 : t >= 2900 ? 1001 : null, window: t >= 2900 ? 8192 : null, phase: t < 2900 ? 'SYN과 SYN/ACK에서 초기 순번을 교환합니다.' : t < 4100 ? '클라이언트는 연결됐지만 서버는 마지막 ACK를 기다립니다.' : t < 5000 ? '알려진 수신 윈도 안에서 DATA를 전송합니다.' : '1,460 B를 받으면 다음 기대 순번은 2,461입니다.' }; },
    N05: (t: number) => { const pts = cwndPoints.filter(a => t >= a[0]); return { points: pts, cwnd: pts.length ? pts.at(-1)![1] : 1, threshold: t >= 7000 ? 5 : 8, phase: t < 4000 ? '새 데이터를 확인한 ACK가 cwnd를 늘립니다.' : t < 7000 ? 'ssthresh에 도달하면 혼잡 회피로 전환합니다.' : t < 9700 ? 'RTO 뒤 cwnd는 1 SMSS, ssthresh는 FlightSize의 절반입니다.' : '새 ssthresh에 도달한 뒤 RTT당 약 1 SMSS 증가합니다.' }; },
    N06: (t: number) => { const dup = [2700, 3500, 4300].filter(x => t >= x).length; return { rto: { dupacks: 0, retransmitted: t >= 6300, delivered: t >= 7000 }, fast: { dupacks: dup, retransmitted: t >= 4900, delivered: t >= 5500 }, phase: t < 4300 ? '후속 세그먼트가 있어야 같은 ACK가 반복됩니다.' : t < 6300 ? '세 번째 중복 ACK를 받은 쪽은 RTO 전에 재전송합니다.' : '후속 데이터가 없는 쪽은 RTO로 복구합니다.' }; },
    N07: (t: number) => { return { mss: 1460, ipBytes: 1500, frameBytes: 1518, parts: [{ label: 'L2 header', bytes: 14 }, { label: 'IPv4 header', bytes: 20 }, { label: 'TCP header', bytes: 20 }, { label: 'payload', bytes: 1460 }, { label: 'FCS', bytes: 4 }], level: t < 1700 ? 0 : t < 3000 ? 1 : t < 4300 ? 2 : 3, phase: t < 1700 ? '애플리케이션 데이터가 TCP payload가 됩니다.' : t < 3000 ? 'TCP header를 붙이면 TCP segment입니다.' : t < 4300 ? 'IPv4 header를 포함한 IP packet이 MTU 대상입니다.' : 'L2 header와 FCS는 IP MTU에 포함하지 않습니다.' }; },
    N08: (t: number) => { const step = Math.max(-1, Math.min(7, Math.floor((t - 2000) / 1000))), gain = step < 0 ? 1 : probeGains[step]; const queue = t < 2000 ? 0 : t < 3000 ? 125000 * p(t, 2000, 3000) : t < 4000 ? 125000 * (1 - p(t, 3000, 4000)) : 0; return { gain, step, queueBytes: Math.round(queue), bbrBdp: 500000, rateMbps: 100 * gain, renoThreshold: t >= 4200 ? 10 : 20, phase: t < 2000 ? '손실 기반 제어와 BBR은 서로 다른 관측값을 사용합니다.' : t < 3000 ? 'BBRv1은 대역폭 탐색 구간에서 pacing gain을 1.25로 둡니다.' : t < 4000 ? '0.75 구간은 쌓인 큐를 줄이는 방향으로 전송합니다.' : '이어지는 6개 구간은 gain 1.0입니다. 실제 성능 비교는 아닙니다.' }; },
    N09: (t: number) => { return { nagle: { secondSent: t >= nagleAckTiming.receivedAt, acked: t >= nagleAckTiming.receivedAt }, nodelay: { secondSent: t >= 2500, acked: t >= nagleAckTiming.receivedAt }, phase: t < 2500 ? '첫 작은 쓰기는 미확인 데이터가 없어 전송할 수 있습니다.' : t < 4600 ? 'Nagle은 미확인 데이터가 있는 동안 다음 작은 쓰기를 모읍니다.' : 'TCP_NODELAY=1이면 Nagle을 끕니다. 혼잡·수신 윈도 제한은 남습니다.' }; },
    N10: (t: number) => { return { active: t >= 10000 ? 'CLOSED' : t >= 4200 ? 'TIME_WAIT' : t >= 2900 ? 'FIN_WAIT_2' : t >= 1100 ? 'FIN_WAIT_1' : 'ESTABLISHED', passive: t >= 8500 ? 'CLOSED' : t >= 3500 ? 'LAST-ACK' : t >= 1700 ? 'CLOSE_WAIT' : 'ESTABLISHED', finSender: t >= 6500 ? '수동 종료' : null, tupleHeld: t >= 1100 && t < 10000, phase: t < 4200 ? '능동 종료 측이 FIN을 먼저 보냅니다.' : t < 6500 ? '마지막 ACK가 사라져 수동 종료 측은 LAST-ACK에 남습니다.' : t < 8500 ? '수동 종료 측이 FIN을 재전송하면 TIME_WAIT 측이 ACK로 답합니다.' : '재전송 FIN을 받으면 2MSL 타이머를 다시 시작합니다. 이후 만료를 압축 표시합니다.' }; },
    N11: (t: number) => { const done = t >= 6700; return { buffer: done ? [] : t >= 4200 ? [3, 4] : t >= 3300 ? [3] : [], delivered: done ? [1, 2, 3, 4] : t >= 1700 ? [1] : [], phase: t < 2400 ? '바이트 순서가 이어지면 앱으로 전달합니다.' : t < 6700 ? '뒤의 세그먼트가 도착해도 앞의 빈 구간이 먼저 채워져야 합니다.' : '2번 복구 후 버퍼의 3·4번도 순서대로 앱에 전달합니다.' }; },
    N12: (t: number) => { return { unanswered: [3500, 5000, 6500].filter(x => t >= x).length, failed: t >= 8000, alive: t >= 4500, idleReset: t >= 4500, phase: t < 3500 ? 'SO_KEEPALIVE를 켠 유휴 연결을 확인합니다.' : t < 6500 ? '응답한 연결은 유휴 타이머를 다시 시작합니다.' : '응답 없는 연결은 3회 probe와 마지막 응답 대기를 거친 뒤 실패 처리합니다.' }; },
    N13: (t: number) => { return { fresh: { requests: [2500, 5000, 7500].filter(x => t >= x).length, handshakes: [1100, 3600, 6100].filter(x => t >= x).length }, reuse: { requests: [2500, 4300, 6100].filter(x => t >= x).length, handshakes: t >= 1100 ? 1 : 0, probes: 0, closed: t >= 9000 }, phase: t < 2500 ? 'HTTP 요청 전에 TCP 연결을 준비합니다.' : t < 7500 ? '같은 연결에서 다음 HTTP 요청을 보낼 수 있습니다.' : '같은 3개 요청을 비교합니다. HTTP/1.1 마지막 응답은 Connection: close입니다.' }; },
    W01: (t: number) => { return { firstByte: t >= 3900, htmlComplete: t >= 4900, cssStarted: t >= 5000, jsStarted: t >= 5300, phase: t < 3900 ? 'DNS·TCP·TLS와 서버 응답 대기를 구분합니다.' : t < 4900 ? '첫 바이트가 왔어도 HTML 전체 수신은 아직 끝나지 않았습니다.' : '이 예제에서는 HTML 완료 후 의존 리소스를 요청합니다. 브라우저는 더 일찍 발견할 수도 있습니다.' }; },
    W02: (t: number) => { return { rawBytes: 18891, gzipBytes: 3039, gzipSendAt, rawSentBytes: 18891 * p(t, 1600, 6900), gzipSentBytes: 3039 * p(t, gzipSendAt, 3400), gzipReceived: t >= 3400, decoded: t >= 3900, rawReceived: t >= 6900, phase: t < 1600 ? '같은 500행 JSON을 두 가지 표현으로 준비합니다.' : t < 3900 ? 'gzip으로 전송한 바이트는 수신 후 압축을 풉니다.' : '복원된 내용은 같습니다. 전송량과 압축·해제 비용은 별개입니다.' }; },
    W04: (t: number) => { return { unchanged: { code: t >= 3500 ? 304 : null, bodyBytes: 0, tag: 'v1' }, changed: { code: t >= 7200 ? 200 : null, tag: t >= 7800 ? 'v2' : 'v1', bodyComplete: t >= 7800 }, policies: { noStore: false, noCache: true }, phase: t < 3500 ? '저장한 ETag v1을 If-None-Match에 넣어 재검증합니다.' : t < 5700 ? '304는 새 본문이 없습니다. 저장된 v1 본문을 재사용합니다.' : t < 7800 ? '서버의 표현이 v2로 바뀌면 200과 새 본문을 받습니다.' : '새 본문을 모두 받은 뒤 v2를 저장합니다. no-cache는 저장 금지가 아닙니다.' }; },
    W05: (t: number) => { return { bufferedStreams: t >= 7200 ? [] : t >= 4300 ? [3, 5] : t >= 3300 ? [3] : [], deliveredStreams: t >= 7200 ? [1, 3, 5] : [], phase: t < 2200 ? '서로 다른 stream 프레임이 하나의 TCP 연결에 섞여 전송됩니다.' : t < 7200 ? '앞의 TCP 바이트 손실로 후속 stream 프레임도 HTTP/2에 아직 전달되지 않습니다.' : '빈 바이트 구간을 복구한 뒤 각 stream에 프레임을 분배합니다.' }; },
    W06: (t: number) => { return { endpoint: { single: '/stations/{id}', collection: '/stations?name=...' }, codes: { endpointPolicy: [200, 200], missingRepresentation: [404, 404] }, isRecommendation: false, ready: t >= 4000, phase: t < 4000 ? '같은 ‘조회 결과 없음’도 무엇을 대상 리소스로 정의하는지 다릅니다.' : '원문의 두 주장을 각각 보존합니다. 컬렉션 자체가 존재하면 빈 목록을 200으로 응답하는 전제도 구분합니다.' }; },
};
export function networkState<I extends NetworkFigureId>(id: I, t: number): ReturnType<(typeof networkModels)[I]> { return networkModels[id](t) as ReturnType<(typeof networkModels)[I]>; }
