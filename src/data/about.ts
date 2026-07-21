/**
 * 소개·홈이 공유하는 정적 데이터. infra.ts 패턴. 홈 사이드바 "지금 하는 일"이
 * current를 쓴다. 풀 이력서(career·values·activities 등)는 Phase B에서 확장한다.
 */
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

export const profile = {
  name: '이동규',
  subtitle: '그란데클립 프로덕트 엔지니어 · brainbackdoor',
  quoteHeading: '그대는 전율이어라',
  closingHeading: '나는 오늘도 한 방울의 맑은 물이 되리라',
  closingBody: '오늘 행한 작은 실천이 주위에 긍정적인 영향을 주길 바라며 여러 활동을 하고 있어요.',
};

export interface CareerItem {
  org: string;
  role: string;
}

export const career: CareerItem[] = [
  { org: '그란데클립', role: '프로덕트 엔지니어 · AX Partner' },
  { org: '우아한형제들', role: '주문접수채널팀 백엔드 엔지니어' },
  { org: '우아한형제들', role: '배민 셀프서비스팀 백엔드 엔지니어' },
  { org: '우아한형제들', role: '우아한테크코스 코치' },
  { org: '에코마케팅', role: '데이터 엔지니어' },
  { org: '이스트소프트', role: '시스템 엔지니어' },
];

export const education: string[] = ['코드스쿼드', '공군사관학교'];

export const contact: string = 'brainbackdoor@gmail.com';

export interface SnsLink {
  label: string;
  href: string;
}

export const sns: SnsLink[] = [
  { label: 'GitHub', href: 'https://github.com/brainbackdoor' },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/%EB%8F%99%EA%B7%9C-%EC%9D%B4-0606b415a/',
  },
  { label: 'Facebook', href: 'https://www.facebook.com/brainbackdoor' },
  { label: 'Instagram', href: 'https://www.instagram.com/dongguulee/' },
  {
    label: 'Rallit',
    href: 'https://www.rallit.com/hub/resumes/40455/%EC%9D%B4%EB%8F%99%EA%B7%9C',
  },
];

export interface ValueCard {
  name: string;
  tagline: string;
  body: string[];
}

export const values: ValueCard[] = [
  {
    name: 'Core Value',
    tagline:
      '서비스의 핵심가치를 모두 인지하고 있으며, 도메인 지식을 서로 공유하고 그 근간이 되는 기술 개발에 대해 능동적인 문화',
    body: [
      '핵심가치를 설계하고 실현한 경험이 있으며, 고객 창출과 고객 만족을 위한 전략을 세우는데 필요한 것을 잘 파악합니다.',
      '도메인 지식을 공유하기 위한 여러 방법론을 알고 실천해왔으며, 가치를 서비스로 구현하는데 필요한 프로그래밍, 시스템 디자인 역량이 있습니다.',
    ],
  },
  {
    name: 'DevOps',
    tagline: '짧은 개발 주기와 장애 내성, 고품질의 코드를 위한 리뷰/테스트 등의 필요성을 공감하는 문화',
    body: [
      '스크럼, 칸반 등 애자일 프로세스에 익숙하며, 디자이너/PO/PM/프론트엔드 등 다양한 챕터와 원팀으로 일해본 경험이 다수 있습니다.',
      '시스템 엔지니어, 데이터엔지니어, 백엔드엔지니어 등으로 업무를 종사하여 장애내성있는 인프라 구성에 필요한 것을 알며, 서비스 규모에 맞는 시스템 디자인이 가능합니다.',
      'TDD/ATDD/DDD 등 강의를 하거나 리뷰어로 참여했고 팀 문화를 구성해본 경험이 다수 있어 코드리뷰/테스트 코드 등에 능숙하며, 성능테스트에도 익숙하여 견고한 아키텍쳐를 구성할 역량이 있습니다.',
    ],
  },
  {
    name: 'Professional',
    tagline: '결과물에 대한 책임감과 일에 대한 자부심, 전문성 등을 서로 고취시킬 수 있는 문화',
    body: [
      'ESTsoft(서비스통합관리시스템), 에코마케팅(광고매체자동입찰서비스), 우아한형제들(우아한테크코스, 우리가게클릭, 일반셀러 등)에 업무하는 기간 내 사내/외 유의미한 제품을 꾸준히 만들어왔습니다.',
      '결과물은 측정 가능한 상태를 지향하며, 직접적인 수익창출 외에도 비용 개선/생산성향상/시장형성 등 다양한 측면에서 성과를 도출해왔습니다.',
      '함께 일하는 사람들의 욕망을 잘 파악하며, 이들의 합이 최대가 되는 방향과 실천방안을 잘 모색합니다.',
    ],
  },
];

export interface SubProject {
  title: string;
  period?: string;
  bullets: string[];
}

export interface Activity {
  title: string;
  org: string;
  period: string;
  current: boolean;
  bullets: string[];
  subProjects?: SubProject[];
  image?: string;
}

export const activities: Activity[] = [
  {
    title: 'NEXTSTEP 교육 사업',
    org: 'NEXTSTEP',
    period: '2019.01 ~ 현재',
    current: true,
    bullets: [
      '법인 설립 멤버이며 장/단기/세미나, B2B/B2C, 인프라/개발/멘토링 등 여러 형태의 교육을 설계하고 진행해온 경험과 데이터에 근거해, 사업의 장/단기적 전략을 검토',
      '플랫폼 개발, 운영 및 고객 대응해왔으며, 신규 강사의 과정 설계시 매니저 활동을 하는 등 교육 도메인에 대한 이해도가 높음',
    ],
  },
  {
    title: 'GVC',
    org: '그란데클립',
    period: '2025.10 ~ 현재',
    current: true,
    bullets: [
      '회사 내 계열사 기술부채 청산 및 AI 내재화, 운영 효율화',
      '소셜 마케팅 AX (스테이폴리오 콘텐츠 팀 쓰레드/릴스/뉴스레터 제작 프로세스 개선, 글로우비스트팀 틱톡 시딩 그룹 컨택 여정 개선 등)',
      'Company OS R&D',
    ],
  },
  {
    title: 'EIR',
    org: '그란데클립 사내 벤처',
    period: '2025.04 ~ 현재',
    current: true,
    bullets: [
      '2~3 주 단위로 시장 검증 (아이템 선정, 데스크 리서치, 레벨 스크리닝, 린 캔버스 작성, 잠재 고객 인터뷰, 페인 포인트 도출, MVP 개발, 영업)',
      '랜딩 페이지 개발, 가설 검증을 위한 컨셉 페이지 개발, MVP 개발 등 팀 내 제품 개발 (FE, BE, UI/UX)',
      '현재 서비스를 개발, 가설 검증 및 운영, 9월 BEP 달성, 26년 3월 1000곳 파트너십 달성',
    ],
  },
  {
    title: '스테이폴리오 개발',
    org: '그란데클립',
    period: '2025.02, 2025.10',
    current: false,
    bullets: [
      '탐색 여정 개선',
      '키워드 자동완성 기능 구현',
      '알고리즘(루빈슈타인), 검색엔진(OpenSearch), Vertex AI 등 리서치 및 스펙 비교',
      '루빈슈타인을 활용하여 한국어(초성,자모), 영어, 일본어 유사도 판단, 한/영 키보드 오입력, 지명 등 대응',
      '관리자가 등록한 규칙 기반 매칭 기능 및 어드민 기능 개발, 외래어 등 유사 키워드 규칙 리서치',
      'Ruby 2.5.7, 테스트코드 미비, 트랜잭션 스크립트 패턴의 레거시 코드를 점진적으로 리팩토링 (스트랭글러 패턴, 전략 패턴 등 적용 및 메서드 체이닝 활용)',
      '성능 개선 작업 (Rails.cache 성능 개선(히트율, 캐시 키 관리) 및 동시성 대응, N+1 쿼리 문제 해결, 객체 재사용을 통해 메모리 누수 방지, 전략 수행 로직 개선 및 얼리 리턴, 인덱싱 등)',
      '추천 카테고리, 특정 스테이 기준 거리기반 검색, 필터 조건 등 추가',
      '배포 후 1주일 트래킹 결과, 기존 사용자들의 검색 기능 사용량 2배 증가, 탐색 유저 중 75% 이상 상세 지면 진입',
    ],
  },
  {
    title: 'CHAAK 개발',
    org: '그란데클립',
    period: '2024.11 ~ 2024.12',
    current: false,
    bullets: [
      '키워드를 임베딩하여 스티커 검색 기능 개선',
      '스티커셋 등록, CRM 발송 등 기존 기능을 리팩토링하고 어드민 API로 도출하여 운영 비용 개선 (건당 30분가량 소요)',
      '핸들(ID), 별칭 등 SNS 기본기에 해당하는 기능 개발',
    ],
    subProjects: [
      {
        title: '친구비 프로모션',
        period: '2024.12',
        bullets: [
          '마케팅, PM, 디자인, FE, BE가 10일간 여러 가설을 세우고 실험하며 목표 KPI를 175% 달성',
          '기존 기능(카드생성/리액션등록/CRM발송 등)을 파악하며 변경지점을 파악하고, 이벤트 프로모션, 경품 할당 및 발송 등의 도메인을 유연한 구조로 설계',
          '카톡선물하기 연동, 리포팅 및 어드민 API를 개발하여 운영 비용을 개선하고, 어뷰징 유저 관리 및 이벤트 참여자 친구 맺기 등 여러 이슈에 대응',
        ],
      },
    ],
  },
  {
    title: 'Reclispe 개발',
    org: '그란데클립',
    period: '2024.10',
    current: false,
    bullets: [
      'STT, LLM, Spring AI를 활용하여 필사본 수집, 전처리(사람정보 수집, 사건/에피소드 추출, 임베딩), 개요 작성 (주제/톤/작성목적 분석, ToC 구성, Outline 작성), 집필 (Manuscript 작성, 평가, 피드백 반영) 등 구성',
    ],
  },
  {
    title: '주문접수채널·배민사장님앱 백엔드 API 개발',
    org: '우아한형제들 / 주문접수채널팀',
    period: '2024.01 ~ 2024.10',
    current: false,
    bullets: [
      '배민사장님 앱 내 상담채널 진입점 확대 기능 개발 및 외부 IDC 서버와의 연결 수립 (사내 서버개발그룹 밋업 발표)',
      '푸드리뷰와 스토어리뷰간 상이한 요청방식 및 응답구조 공통화',
      '업주의 커머스 가게들 품절 재고유무 조회시 응답 지연을 고려하여 비동기 처리',
      '주문접수채널 내 인증/인가 개념 확립',
      'MongoDB 공통 데이터 저장공간 개선 (점진적 리팩토링, Adapter 의존성 관리 등)',
      '팀내 컨벤션 문서 작성 및 헥사고날 아키텍쳐 그라운드룰 정의',
      'WAS 메모리 사용률 75% 이슈 트래킹 및 대응',
    ],
    subProjects: [
      {
        title: '배민주문접수go(Flutter) 대응 - MQTT 서버 이관',
        period: '2024.04 ~ 2024.07',
        bullets: [
          'AWS IoT Core 리서치, 학습 테스트 구성, 업무분장 및 예상 비용 파악',
          'AWS IoT Core를 이용한 디바이스 인증 아키텍쳐, MQTT pub/sub api 구조 설계, IoT 도메인 모델 작성, 디바이스 강제로그아웃 등의 기능에 반영 및 성능테스트',
          '로그인 인증 아키텍쳐 이벤트 스토밍 및 이관 프로젝트를 위한 유관 부서 소통 주도, 업주향 BFF 대응',
        ],
      },
      {
        title: '배달의민족 앱 내 주문취소구간 확대 대응',
        period: '2024.04 ~ 2024.05',
        bullets: [
          '푸드주문고객의 취소경험을 개선하기 위해, 취소요청을 접수채널(PC, APP)으로 전달하고 업주가 주문취소를 승인/거절할 시 이를 전달하기 위한 프로젝트',
          '중계 시스템의 아키텍쳐 변경(이벤트소싱)에 대응하기 위한 기반 코드 작성(Listener, Actor, Factory, DLT, Config 등) 및 auto commit 설정에 따른 LAG 증가 이슈 대응',
          '배달의민족 앱과 챗봇을 통해 들어온 취소요청을 동일한 챗봇 UI에 대응하기 위해 응답구조 공통화 및 데이터 집계',
          '개인정보보호 대응으로 2차 인증필요여부 API 개발, 소프트랜딩을 위해 대상자 점진적 확대 대응',
        ],
      },
    ],
  },
  {
    title: '육아휴직',
    org: '우아한형제들',
    period: '2022.06 ~ 2022.11, 2023.05 ~ 2023.12',
    current: false,
    bullets: [],
  },
  {
    title: '셀프서비스·배민장부 개발',
    org: '우아한형제들 / 셀프서비스팀',
    period: '2022.01 ~ 2023.12',
    current: false,
    bullets: [],
    subProjects: [
      {
        title: '일반셀러 (프랜차이즈가 아닌 커머스 업주) 대응',
        period: '2023.01 ~ 2023.04',
        bullets: [
          '셀프서비스 Tech Leader로 일정/영향범위 파악, 아키텍쳐 설계 및 개발',
          '셀프서비스는 BFF 특성상 1~20개의 팀(플랫폼)과 협업해야 하며, 푸드와 커머스 등 다른 프로세스/문화를 가진 조직 간의 통합 프로젝트로 협업 방식을 맞추는 작업을 진행함',
          '프로젝트 중 가게시스템의 구조 개선 등이 병행되어 200여개의 API가 영향범위에 놓였으나 일정/영향범위 파악, 업무분장 및 QA 우선순위 안내 등을 통해 일정 내에 프로젝트를 마무리함',
          '푸드와 커머스 등 다양한 플랫폼의 응답을 조합(aggregation)하는 과정에서 보상트랜잭션, 비동기 처리, 응답구조 공통화, 예외처리 등 구조적 개선을 통해 서비스 안정성을 높임',
        ],
      },
      {
        title: '우리가게클릭(CPC)',
        period: '2022.01 ~ 2022.05',
        bullets: [
          '셀프서비스 Tech Leader로 일정/영향범위 파악, 아키텍쳐 설계 및 개발',
          '딜리버리히어로 본사와 처음 협업하는 프로젝트로 의사소통 비용이 컸음에도, WBS/슬랙/랩업미팅/API문서 등 다양한 채널을 활용하여 일정 내에 프로젝트 마무리',
          '사전 모집 등을 대비해 성능테스트를 진행하여 안정적으로 서비스 오픈',
          '외부 인증시스템과의 통신비용절감을 위해 캐시 구성',
          '회사 내 서버간 통신을 위한 내부 API 서버 구성',
          '우리가게NOW 등 타 팀의 기능을 점진적으로 마이그레이션',
        ],
      },
      {
        title: '팀내 백엔드 개발문화 빌딩',
        period: '2022.01 ~ 2022.05',
        bullets: [
          '신규 입사자 온보딩, 코드리뷰 문화, 배포 프로세스, 스크럼, 테스트 코드 구조, 성능 테스트, API 문서화 등',
          '배민장부 도메인 지식 전파를 위해 배민장부교실, 이벤트스토밍 등 진행',
          '점진적 리팩토링 진행 (500 line method를 가진 정산서(엑셀) 생성 기능 등)',
          '기술부채 개선 (소나큐브 기준 Major 이상 150 여건 개선, 테스트 커버리지 20% -> 70% 이상) 및 API Gateway Pattern 적용',
          'AWS 리소스 정리, RDS 부하 개선(slow query 제거, 배치 수행시간 50% 개선)',
        ],
      },
    ],
  },
  {
    title: '우아한테크코스 운영',
    org: '우아한형제들',
    period: '2019.01 ~ 2021.12',
    current: false,
    bullets: [
      '우아한테크코스 교육 사업 마케팅/선발/운영/평가 등 진행 및 교육 모델 설계',
      '커리큘럼 설계/강의/코드리뷰/멘토링 등 진행 및 로드맵 설계',
      '프로그래밍 외에도 배포, 네트워크, 데이터베이스 등의 인프라 강의를 진행',
      'AWS 실습 환경 관리 및 프로젝트 과정 전반을 설계 (데모 사이트, 유튜브)',
      '지속 가능한 교육을 위해 K-Digital Training 사업을 통해 정부 지원 확보 (연간 20억 내외, 3년)',
      'DR 서포터즈, SQL을 넘어 제플린으로 등 사내 활동을 통해 지식 공유',
    ],
  },
  {
    title: '강의 서비스 개발',
    org: '우아한형제들',
    period: '2019.01 ~ 2021.12',
    current: false,
    bullets: [
      '코드 리뷰, 리뷰어/팀 매칭, 초대링크 등의 기능을 페어 프로그래밍으로 개발하여 도메인 지식 공유',
      '유저 시나리오에 대한 인수테스트 작성 및 ATDD, DDD 기반으로 개발하여 견고한 애플리케이션 개발',
      '인증, 인가 정책 설계 및 로직 개선',
    ],
  },
  {
    title: '광고매체 자동입찰 서비스 개발',
    org: '에코마케팅',
    period: '2018.9 ~ 2018.12',
    current: false,
    bullets: [
      '기존에 사람이 직접 키워드 검색 입찰가를 조정하던 방식을 자동화하기 위해 자동 입찰 로직 등 기능 개발',
      '자사 스크립트를 활용하여 실시간성 사용자 데이터를 수집(vertx, kafka) 및 가공',
      'Naver, Google, Facebook 등 광고매체의 수억건의 데이터 수집 및 가공을 위한 배치 작업(spark, azkaban, hadoop)',
      '분산 데이터 애플리케이션 설계, 클린코드 등 사내 스터디 주도',
    ],
  },
  {
    title: '빅데이터 플랫폼 인프라 구축',
    org: '에코마케팅',
    period: '2018.8 ~ 2018.9',
    current: false,
    bullets: [
      '사용 기술 : aws, bash shell, ansible, hadoop, ambari, jenkins, nexus, docker 등',
      'kisa/정통부 가이드라인에 의거하여 전반적인 보안 세팅, 빅데이터 플랫폼 OS migration, 기반 시스템 구축/운영, 모니터링 시스템 구축 등을 통해 취약했던 기존 시스템 대체',
      '비용절감(월 1,000만원 이상)',
    ],
  },
  {
    title: '게임 서비스 운영',
    org: '이스트소프트',
    period: '2016.06 ~ 2017.07',
    current: false,
    bullets: [
      '게임 시스템엔지니어로 9개 국가(200여대 서버) 운영 및 장애 처리, On-Premise/Public Cloud(AWS, KT Cloud) 인프라 아키텍처 구성, 서버 튜닝 등 장애내성 있는 서비스 운영',
      '글로벌 서비스 런칭(견적 조사, 개발환경 구축, 방화벽 정책 수립, 망분리, DB 이관작업, 시스템 구축, CDN 배포 구성, WSUS/YUM/Samba/FTP 등 구축)',
      '사내 기술교육(네트워크, 시스템 구축/운영 등)',
    ],
  },
  {
    title: '서비스 통합 관리 시스템 개발',
    org: '이스트소프트',
    period: '2016.02 ~ 2017.02',
    current: false,
    bullets: [
      '서비스 통계 페이지 (서비스/자산/네트워크/모니터링/장애/이슈 등)를 개발하여 각 서비스별 ROI 확인 및 이슈 트래킹 도구와 연계',
      '인프라 관리 페이지 (Host/방화벽 정책/VPN/License/Rack 구성도 등)를 개발하여 매번 수동으로 확인하던 업무 개선',
      '서비스 관측 가능성을 높이기 위해 모니터링 시스템(nagios) 구성 및 자동화',
    ],
  },
  {
    title: '커뮤니티 사이트 리뉴얼',
    org: '멘사코리아',
    period: '2021.05 ~ 2022.12',
    current: false,
    bullets: [
      '이벤트 스토밍을 통해 유비쿼터스 언어를 정립하고 도메인 지식을 공유하였으며, 프로젝트 리딩/백엔드 개발/서버 관리 등 전반적인 부분을 관리',
    ],
  },
];
