/**
 * 소개·홈이 공유하는 정적 데이터. 단일 출처는 이력서(이동규-이력서-2026.pdf).
 * 홈 사이드바 "지금 하는 일"은 `current`를 쓴다(그 export는 유지).
 * /about 구조: 소개 → 경력 → 프로젝트 → 지향하는 개발 문화 → 대외활동(카드).
 */

// ── 홈 사이드바 "지금 하는 일" (홈 전용, 유지) ──
export interface CurrentItem {
  title: string;
  subtitle: string;
}

export const current: CurrentItem[] = [
  { title: '그란데클립', subtitle: '프로덕트 엔지니어 · AX' },
  { title: 'NEXTSTEP', subtitle: '교육자 · 사업/운영' },
  { title: '인프라공방', subtitle: '강사' },
  { title: '하린이 육아', subtitle: '가장 중요한 프로젝트' },
];

// ── 소개 ──
export const profile = {
  name: '이동규',
  role: '소프트웨어 엔지니어',
  intro:
    '안녕하세요. 저는 좋은 울림을 주는 엔지니어를 지향하고 있어요. 좋은 개발문화를 위한 Agile, DevOps 등의 실천 전략에 관심이 많으며, Web Architecture를 이루는 구성 요소들에 흥미를 가지고 있습니다.',
};

export const contact = 'brainbackdoor@gmail.com';

export interface SnsLink {
  label: string;
  href: string;
}

export const sns: SnsLink[] = [
  { label: 'GitHub', href: 'https://github.com/brainbackdoor' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/%EB%8F%99%EA%B7%9C-%EC%9D%B4-0606b415a/' },
  { label: 'Facebook', href: 'https://www.facebook.com/brainbackdoor' },
  { label: 'Instagram', href: 'https://www.instagram.com/dongguulee/' },
  { label: 'Rallit', href: 'https://www.rallit.com/hub/resumes/40455/%EC%9D%B4%EB%8F%99%EA%B7%9C' },
];

export interface EduItem {
  school: string;
  detail: string;
  period: string;
  status: string;
}

export const education: EduItem[] = [
  { school: '학점은행', detail: '컴퓨터공학과 · 학사', period: '2015.05 ~ 2016.06', status: '졸업' },
  { school: '공군사관학교', detail: '군사전략학과 · 학사', period: '2007.01 ~ 2010.05', status: '중퇴' },
];

export interface Certification {
  name: string;
  issuer: string;
  date: string;
}

export const certifications: Certification[] = [
  { name: '정보처리기사', issuer: '한국산업인력공단', date: '2015.05' },
  { name: 'CISCO (CCNP Switch, CCNA)', issuer: 'CISCO', date: '2015.05' },
];

// ── 경력 (회사 단위) ──
export interface CareerGroup {
  label: string;
  items: string[];
}

export interface CareerEntry {
  org: string;
  team: string;
  role: string;
  period: string;
  bullets: string[];
  groups?: CareerGroup[];
}

export const career: CareerEntry[] = [
  {
    org: '그란데클립',
    team: 'GVC',
    role: '수석 · 정규직',
    period: '2024.10 ~ 재직 중',
    bullets: [
      'AX Partner로서 AX 역량 모델 설계, AX 활동(온보딩, 핸즈온, 스터디 등) 주도',
      '스테이폴리오, 뉴믹스, 어메이징크리, Bowlsup 등 계열사의 사이트 개발, AI 내재화, 운영 효율화 및 기술부채 청산',
      '유/무가 시딩을 위한 인플루언서 관리, 캠페인 관리, 콘텐츠 성과 관리 등 운영 툴 제작',
      'CHAAK(스티커 기반 SNS), Reclispe(AI 자서전) 등 제품의 백엔드를 개발·운영 (AWS EKS)',
    ],
  },
  {
    org: '우아한형제들',
    team: '테크코스교육개발팀 · 셀프서비스팀 · 주문접수채널팀',
    role: '팀원 · 정규직',
    period: '2019.01 ~ 2024.10 (5년 10개월)',
    bullets: [
      '우아한테크코스(2019.01~2021.12), 셀프서비스 및 배민장부(2022.01~2023.12), 주문접수채널과 배민사장님앱(2024.01~2024.10) 등의 서비스를 위한 백엔드 API를 개발·운영 (육아휴직: 2022.06~2022.11, 2023.05~2023.12)',
    ],
    groups: [
      {
        label: '사내 지식 공유 활동',
        items: [
          'DR 서포터즈',
          'SQL을 넘어 제플린으로 (사내 오피스·우아한러닝에 등재)',
          '사내 기술블로그 (한 명의 개발자를 양성하기까지, 5월 테크세미나 후기)',
          '위키 문서 (그라운드룰, 컨벤션, 성능테스트, 서버 메모리 관찰하기, Retrofit 구조 등)',
          '사내 서버개발그룹 밋업 발표 (외부 IDC 연동 시 고려할 점 및 AWS VPC 구성)',
          '우아한테크코스 특강 (커리어, 유저스토리 등)',
        ],
      },
    ],
  },
  {
    org: '에코마케팅',
    team: '마케팅테크연구소',
    role: '선임 · 정규직',
    period: '2018.04 ~ 2018.12 (9개월)',
    bullets: [
      '광고매체 자동입찰 솔루션의 기반 플랫폼 구축/운영 및 개발, 보안세팅 및 인프라 관리',
    ],
  },
  {
    org: '이스트소프트',
    team: '시스템운영팀',
    role: '사원 · 정규직',
    period: '2015.09 ~ 2017.07 (1년 11개월)',
    bullets: [
      '게임 시스템 엔지니어로 9개 국가에서 200여 대의 서버 장비를 운영 및 장애 대응, On-premise / Public Cloud(AWS, KT Cloud) 인프라 아키텍처 구성, 시스템 튜닝, 구성 자동화, 모니터링 및 자산관리 시스템 구축, 서비스 런칭 경험 등',
    ],
  },
];

// ── 프로젝트 ──
export interface SubProject {
  title: string;
  period?: string;
  bullets: string[];
}

export interface Project {
  title: string;
  org: string;
  period: string;
  bullets: string[];
  subProjects?: SubProject[];
}

export const projects: Project[] = [
  {
    title: 'Company OS R&D',
    org: '그란데클립',
    period: '2026.04 ~ 2026.05',
    bullets: [
      'paperclip 기반으로 사내 에이전트 거버넌스를 구축하고, 에이전트 간 위계를 설계해 스테이폴리오 운영 코드를 대상으로 agentic workflow를 실험',
      '스킬·에이전트를 재사용 가능한 자산으로 관리(공식 스킬 운영)하고, 비개발자도 어드민 등 독립 환경의 개발·QA를 일정 품질 이상으로 수행할 수 있는 체계를 목표로 설계·검증',
    ],
  },
  {
    title: '스테이폴리오 콘텐츠 팀 AX',
    org: '그란데클립',
    period: '2025.11 ~ 2026.02',
    bullets: [
      '개인 역량에 의존하던 콘텐츠 운영을 AI·시스템 기반 프로세스로 전환하는 AX를 수행. Threads(소재 검증) → Reels·뉴스레터(확장) → 플랫폼 유입(전환)의 3-Track 운영 모델을 설계',
      '제작 프로세스를 내재화하기 위해 콘텐츠 공방 서비스를 직접 개발 — 리뷰 등의 데이터를 RAG로 구성하고, 성공 콘텐츠를 주기적으로 크롤링·수집·분석하여 재활용 가능한 자산으로 축적',
    ],
  },
  {
    title: 'EIR (사내 벤처)',
    org: '그란데클립',
    period: '2025.04 ~ 진행 중',
    bullets: [
      '2~3주 단위로 시장 검증 (아이템 선정, 데스크 리서치, 레벨 스크리닝, 린 캔버스 작성, 잠재 고객 인터뷰, 페인 포인트 도출, MVP 개발, 영업)',
      '랜딩 페이지 개발, 가설 검증을 위한 컨셉 페이지 개발, MVP 개발 등 팀 내 제품 개발 (FE, BE, UI/UX)',
      '현재 서비스를 개발, 가설 검증 및 운영, 2025년 9월 BEP 달성, 2026년 6월 2000곳 파트너십 달성',
    ],
  },
  {
    title: '스테이폴리오 탐색 여정 개선',
    org: '그란데클립',
    period: '2025.02, 2025.10',
    bullets: [
      '키워드 자동완성 기능 구현 — 루빈슈타인을 활용하여 한국어(초성/자모), 영어, 일본어 유사도 판단, 한/영 키보드 오입력, 지명 등 대응',
      'Ruby 2.5.7, 테스트 코드 미비, 트랜잭션 스크립트 패턴의 레거시 코드를 점진적으로 리팩토링 (스트랭글러 패턴, 전략 패턴 등 적용 및 메서드 체이닝 활용)',
      '성능 개선 작업 (Rails.cache 성능 개선(히트율, 캐시 키 관리) 및 동시성 대응, N+1 쿼리 문제 해결, 객체 재사용을 통해 메모리 누수 방지, 전략 수행 로직 개선 및 얼리 리턴, 인덱싱 등)',
      '배포 후 1주일 트래킹 결과, 기존 사용자들의 검색 기능 사용량 2배 증가, 탐색 유저 중 75% 이상 상세 지면 진입',
    ],
  },
  {
    title: 'CHAAK (스티커 기반 SNS) 개발',
    org: '그란데클립',
    period: '2024.11 ~ 2024.12',
    bullets: [
      '키워드를 임베딩하여 스티커 검색 기능 개선',
      '스티커셋 등록·CRM 발송 등 기존 기능을 리팩토링하고 어드민 API로 도출하여 운영 비용 개선 (건당 30분가량 소요)',
      '핸들(ID), 별칭 등 SNS 기본기에 해당하는 기능 개발',
    ],
    subProjects: [
      {
        title: '친구비 프로모션',
        period: '2024.12',
        bullets: [
          '기존 기능(카드생성/리액션등록/CRM발송 등)을 파악하며 변경지점을 파악하고, 이벤트 프로모션·경품 할당 및 발송 등의 도메인을 유연한 구조로 설계',
          '카톡선물하기 연동, 리포팅 및 어드민 API를 개발하여 운영 비용을 개선하고, 어뷰징 유저 관리 및 이벤트 참여자 친구 맺기 등 여러 이슈에 대응',
        ],
      },
    ],
  },
  {
    title: 'Reclispe (AI 자서전) 개발',
    org: '그란데클립',
    period: '2024.10',
    bullets: [
      'STT, LLM, Spring AI를 활용하여 필사본 수집, 전처리(사람정보 수집, 사건/에피소드 추출, 임베딩), 개요 작성(주제/톤/작성목적 분석, ToC 구성, Outline 작성), 집필(Manuscript 작성, 평가, 피드백 반영) 등 구성',
    ],
  },
  {
    title: '배민주문접수go(Flutter) 대응 — MQTT 서버 이관',
    org: '우아한형제들 / 주문접수채널팀',
    period: '2024.04 ~ 2024.10',
    bullets: [
      'AWS IoT Core 리서치, 학습 테스트 구성, 업무분장 및 예상 비용 파악',
      'AWS IoT Core를 이용한 디바이스 인증 아키텍처, MQTT pub/sub API 구조 설계, 도메인 모델 작성, 디바이스 강제로그아웃 등의 기능에 반영 및 성능테스트',
      '로그인 인증 아키텍처 이벤트 스토밍 및 이관 프로젝트를 위한 유관 부서 소통 주도, 업주향 BFF 대응',
    ],
  },
  {
    title: '배달의민족 앱 내 주문취소구간 확대 대응',
    org: '우아한형제들 / 주문접수채널팀',
    period: '2024.04 ~ 2024.05',
    bullets: [
      '푸드주문고객의 취소경험을 개선하기 위해, 취소요청을 접수채널(PC, APP)으로 전달하고 업주가 주문취소를 승인/거절할 시 이를 전달하기 위한 프로젝트',
      '중계 시스템의 아키텍처 변경(이벤트소싱)에 대응하기 위한 기반 코드 작성 및 auto commit 설정에 따른 LAG 증가 이슈 대응',
      '배달의민족 앱과 챗봇을 통해 들어온 취소요청을 동일한 챗봇 UI에 대응하기 위해 응답구조 공통화 및 데이터 집계',
      'MongoDB 공통 데이터 저장공간 개선 (점진적 리팩토링, Adapter 의존성 관리 등)',
    ],
  },
  {
    title: '일반셀러(프랜차이즈가 아닌 커머스 업주) 대응',
    org: '우아한형제들 / 셀프서비스팀',
    period: '2023.01 ~ 2023.04',
    bullets: [
      '셀프서비스는 BFF 특성상 1~20개의 팀(플랫폼)과 협업해야 하며, 푸드와 커머스 등 다른 프로세스/문화를 가진 조직 간의 통합 프로젝트로 협업 방식을 맞추는 작업을 진행',
      '프로젝트 중 가게시스템의 구조 개선 등이 병행되어 200여 개의 API가 영향범위에 놓였으나, 일정/영향범위 파악·업무분장·QA 우선순위 안내 등을 통해 일정 내에 마무리',
      '푸드와 커머스 등 다양한 플랫폼의 응답을 조합(aggregation)하는 과정에서 보상트랜잭션, 비동기 처리, 응답구조 공통화, 예외처리 등 구조적 개선을 통해 서비스 안정성을 높임',
    ],
  },
  {
    title: '우리가게클릭(CPC)',
    org: '우아한형제들 / 셀프서비스팀',
    period: '2022.01 ~ 2022.05',
    bullets: [
      '셀프서비스 Tech Leader로 일정/영향범위 파악, 아키텍처 설계 및 개발',
      '딜리버리히어로 본사와 처음 협업하는 프로젝트로 의사소통 비용이 컸음에도, WBS/슬랙/랩업미팅/API문서 등 다양한 채널을 활용하여 일정 내에 마무리',
      '사전 모집 등을 대비해 성능테스트를 진행하여 안정적으로 서비스 오픈',
      '외부 인증시스템과의 통신비용 절감을 위해 캐시 구성',
    ],
  },
  {
    title: '팀내 백엔드 개발문화 빌딩',
    org: '우아한형제들 / 셀프서비스팀',
    period: '2022.01 ~ 2022.05',
    bullets: [
      '신규 입사자 온보딩, 코드리뷰 문화, 배포 프로세스, 스크럼, 테스트 코드 구조, 성능 테스트, API 문서화, 컨벤션 등 그라운드룰 위키 문서로 작성',
      '배민장부 도메인 지식 전파를 위해 배민장부교실, 이벤트스토밍 등 진행',
      '점진적 리팩토링 진행 (500 line method를 가진 정산서(엑셀) 생성 기능 등)',
      '기술부채 개선 (소나큐브 기준 Major 이상 150여 건 개선, 테스트 커버리지 20% → 70% 이상) 및 API Gateway Pattern 적용',
      'AWS 리소스 정리, RDS 부하 개선 (slow query 제거, 배치 수행시간 50% 개선)',
    ],
  },
  {
    title: '우아한테크코스',
    org: '우아한형제들 / 테크코스교육개발팀',
    period: '2019.01 ~ 2021.12',
    bullets: [
      '우아한테크코스 교육 사업 마케팅/선발/운영/평가 등 진행 및 교육 모델 설계',
      '커리큘럼 설계/강의/코드리뷰/멘토링 등 진행 및 로드맵 설계',
      '프로그래밍 외에도 배포, 네트워크, 데이터베이스 등의 인프라 강의를 진행',
      'AWS 실습 환경 관리 및 프로젝트 과정 전반을 설계',
      '지속 가능한 교육을 위해 K-Digital Training 사업을 통해 정부 지원 확보 (연간 20억 내외, 3년)',
    ],
    subProjects: [
      {
        title: '강의 서비스 개발',
        bullets: [
          '코드 리뷰, 리뷰어/팀 매칭, 초대링크 등의 기능을 페어 프로그래밍으로 개발하여 도메인 지식 공유',
          '유저 시나리오에 대한 인수테스트 작성 및 ATDD, DDD 기반으로 개발하여 견고한 애플리케이션 개발',
          '인증, 인가 정책 설계 및 로직 개선',
        ],
      },
    ],
  },
  {
    title: '광고매체 자동입찰 서비스',
    org: '에코마케팅 / 마케팅테크연구소',
    period: '2018.08 ~ 2018.12',
    bullets: [
      '기존에 사람이 직접 키워드 검색 입찰가를 조정하던 방식을 자동화하기 위해 자동 입찰 로직 등 기능 개발',
      '빅데이터 플랫폼 인프라 구축 (aws, bash shell, ansible, hadoop, ambari, jenkins, nexus, docker 등) — kisa/정통부 가이드라인에 의거한 보안 세팅, OS migration, 모니터링 시스템 구축으로 취약했던 기존 시스템 대체 (비용절감 월 1,000만 원 이상)',
      '자사 스크립트를 활용하여 실시간성 사용자 데이터를 수집(vertx, kafka) 및 가공',
      'Naver, Google, Facebook 등 광고매체의 수억 건 데이터 수집 및 가공을 위한 배치 작업 (spark, azkaban, hadoop)',
    ],
  },
  {
    title: '게임 서비스 운영',
    org: '이스트소프트 / 시스템운영팀',
    period: '2016.06 ~ 2017.07',
    bullets: [
      '게임 시스템엔지니어로 9개 국가(200여 대 서버) 운영 및 장애 처리, On-Premise/Public Cloud(AWS, KT Cloud) 인프라 아키텍처 구성, 서버 튜닝 등 장애내성 있는 서비스 운영',
      '글로벌 서비스 런칭 (견적 조사, 개발환경 구축, 방화벽 정책 수립, 망분리, DB 이관작업, 시스템 구축, CDN 배포 구성, WSUS/YUM/Samba/FTP 등 구축)',
      '사내 기술교육 (네트워크, 시스템 구축/운영 등)',
    ],
  },
  {
    title: '서비스 통합 관리 시스템 개발',
    org: '이스트소프트 / 시스템운영팀',
    period: '2016.02 ~ 2017.02',
    bullets: [
      '서비스 통계 페이지(서비스/자산/네트워크/모니터링/장애/이슈 등)를 개발하여 각 서비스별 ROI 확인 및 이슈 트래킹 도구와 연계',
      '인프라 관리 페이지(Host/방화벽 정책/VPN/License/Rack 구성도 등)를 개발하여 매번 수동으로 확인하던 업무 개선',
      '서비스 관측 가능성을 높이기 위해 모니터링 시스템(nagios) 구성 및 자동화',
    ],
  },
];

// ── 지향하는 개발 문화 ──
export interface ValueCard {
  name: string;
  tagline: string;
  body: string[];
}

export const values: ValueCard[] = [
  {
    name: 'Core Value',
    tagline: '서비스의 핵심가치를 모두 인지하고 있으며, 도메인 지식을 서로 공유하고 그 근간이 되는 기술 개발에 대해 능동적인 문화',
    body: [
      '핵심가치를 설계하고 실현한 경험이 있으며, 고객 창출과 고객 만족을 위한 전략을 세우는 데 필요한 것을 잘 파악합니다.',
      '도메인 지식을 공유하기 위한 여러 방법론을 알고 실천해왔으며, 가치를 서비스로 구현하는 데 필요한 프로그래밍, 시스템 디자인 역량이 있습니다.',
    ],
  },
  {
    name: 'DevOps',
    tagline: '짧은 개발 주기와 장애 내성, 고품질의 코드를 위한 리뷰/테스트 등의 필요성을 공감하는 문화',
    body: [
      '스크럼, 칸반 등 애자일 프로세스에 익숙하며, 디자이너/PO/PM/프론트엔드 등 다양한 챕터와 원팀으로 일해본 경험이 다수 있습니다.',
      '시스템 엔지니어, 데이터엔지니어, 백엔드엔지니어 등으로 업무에 종사하여 장애내성 있는 인프라 구성에 필요한 것을 알며, 서비스 규모에 맞는 시스템 디자인이 가능합니다.',
      'TDD/ATDD/DDD 등 강의를 하거나 리뷰어로 참여했고 팀 문화를 구성해본 경험이 다수 있어 코드리뷰/테스트 코드 등에 능숙하며, 성능테스트에도 익숙하여 견고한 아키텍처를 구성할 역량이 있습니다.',
    ],
  },
  {
    name: 'Professional',
    tagline: '결과물에 대한 책임감과 일에 대한 자부심, 전문성 등을 서로 고취시킬 수 있는 문화',
    body: [
      '이스트소프트(서비스통합관리시스템), 에코마케팅(광고매체자동입찰서비스), 우아한형제들(우아한테크코스, 우리가게클릭, 일반셀러 등)에 업무하는 기간 내 사내/외 유의미한 제품을 꾸준히 만들어왔습니다.',
      '결과물은 측정 가능한 상태를 지향하며, 직접적인 수익창출 외에도 비용 개선/생산성향상/시장형성 등 다양한 측면에서 성과를 도출해왔습니다.',
      '함께 일하는 사람들의 욕망을 잘 파악하며, 이들의 합이 최대가 되는 방향과 실천방안을 잘 모색합니다.',
    ],
  },
];

// ── 대외활동 (카드) — brainbackdoor.com/profile 갤러리에서 수집 ──
export interface ActivityCard {
  title: string;
  href?: string;
  /** public/ 기준 경로. 카드 썸네일. */
  image?: string;
}

export const externalActivities: ActivityCard[] = [
  { title: 'NEXTSTEP 교육자, 사업 및 운영', href: 'https://www.nextstep.camp/', image: '/activities/nextstep.webp' },
  { title: '인프라공방 강사', href: 'https://www.inflearn.com/course/%EC%9D%B8%ED%94%84%EB%9D%BC-%EA%B3%B5%EB%B0%A9-%EC%84%9C%EB%B9%84%EC%8A%A4-%EB%A7%8C%EB%93%A4%EA%B8%B0', image: '/activities/inflabang-instructor.webp' },
  { title: '카카오 신입사원 교육', href: 'https://tech.kakao.com/posts/576', image: '/activities/kakao-newcomer.webp' },
  { title: '카카오테크캠퍼스 백엔드 코치', href: 'https://www.kakaocorp.com/page/detail/11470', image: '/activities/kakao-techcampus.webp' },
  { title: '현대차 소프티어 부트캠프 멘토', href: 'https://www.hyundaimotorgroup.com/ko/news/CONT0000000000190131', image: '/activities/hyundai-softeer.webp' },
  { title: '스테이폴리오 서비스 개발', href: 'https://www.stayfolio.com/', image: '/activities/stayfolio.webp' },
  { title: '팀스파르타 항해 플러스 코치 및 교육 자문위원', href: 'https://hanghae99.spartacodingclub.kr/plus/be', image: '/activities/spartacoding-hanghae.webp' },
  { title: '우아한형제들 사장님서비스실', href: 'https://b2bservice.notion.site/2290acf3eacf49fdb730042b1d60316d', image: '/activities/woowa-ceoservice.webp' },
  { title: '우아한테크코스 코치', href: 'https://techblog.woowahan.com/5977/', image: '/activities/woowa-techcourse.webp' },
  { title: '우아한테크캠프 Pro', href: 'https://edu.nextstep.camp/c/lqsBs7x0', image: '/activities/woowa-techcamp-pro.webp' },
  { title: '인프라공방', href: 'https://edu.nextstep.camp/c/VI4PhjPA', image: '/activities/inflabang.webp' },
  { title: '우아한형제들 DR 서포터즈', href: 'https://techblog.woowahan.com/2666/', image: '/activities/woowa-dr.webp' },
  { title: 'F-lab 플러그인 정기 세미나', href: 'https://festa.io/events/6003', image: '/activities/flab.webp' },
  { title: 'Salarable 모의면접 멘토', href: 'https://www.salarable.site/', image: '/activities/salarable.webp' },
  { title: '부트캠프 운영자 워크숍', href: 'https://www.wanted.co.kr/events/learning_workshop_2408', image: '/activities/bootcamp-workshop.webp' },
  { title: '인프런 퇴근길 밋업 #05 AWS & 인프라', href: 'https://www.youtube.com/watch?v=QGUdBUXwNho', image: '/activities/inflearn-meetup.webp' },
  { title: '커리어 NEXTSTEP', href: 'https://edu.nextstep.camp/c/K9ZeidlI', image: '/activities/career-nextstep.webp' },
  { title: '챌린지 코스', href: 'https://edu.nextstep.camp/c/9micYRuD', image: '/activities/challenge-course.webp' },
  { title: '마이크로소프트웨어 기고', href: 'https://www.imaso.co.kr/archives/5256', image: '/activities/imaso.webp' },
  { title: 'SSAFY 채용박람회', href: 'https://youtu.be/JIr85DWNDDI', image: '/activities/ssafy.webp' },
  { title: 'SQL을 넘어 제플린으로', href: 'https://edu.nextstep.camp/c/VulQIb2a/', image: '/activities/sql-zeppelin.webp' },
  { title: '인프런 멘토링', href: 'https://www.inflearn.com/users/@brainbackdoor', image: '/activities/inflearn-mentoring.webp' },
  { title: '프로젝트 공방', href: 'https://edu.nextstep.camp/c/9micYRuD', image: '/activities/project-gongbang.webp' },
  { title: '데이터야놀자 운영진', href: 'https://www.facebook.com/datayanolja/', image: '/activities/datayanolja.webp' },
  { title: '자바카페 운영진', href: 'https://www.facebook.com/groups/javacafe', image: '/activities/javacafe.webp' },
  { title: '글또 운영진', href: 'https://www.facebook.com/groups/geultto/', image: '/activities/geultto.webp' },
  { title: 'AWS DNA', href: 'https://brainbackdoor.tistory.com/147', image: '/activities/aws-dna.webp' },
];
