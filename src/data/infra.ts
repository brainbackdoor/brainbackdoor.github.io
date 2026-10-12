/** 인프라공방의 실습 미션과 참고자료. 기존 공개 자료의 주소를 유지한다. */
export interface MissionLink { label: string; href: string; }
export interface Mission {
  id: string;
  title: string;
  steps: MissionLink[];
  links: MissionLink[];
}
export interface TopicSection {
  id: string;
  title: string;
  items: { label: string; href: string }[];
}

export const missions: Mission[] = [
  {
    id: 'subway',
    title: '지하철 노선도',
    steps: [
      { label: '서버 구성하기', href: 'https://www.brainbackdoor.com/0af0d94d-8533-4416-b444-d5850f745a91' },
      { label: '3 tier 구성하기', href: 'https://www.brainbackdoor.com/0798ec80-70e7-441d-a238-2dc640122bce' },
      { label: '화면 응답 개선하기', href: 'https://www.brainbackdoor.com/80dbc9d7-ba32-4220-9b39-b536172264f2' },
    ],
    links: [
      { label: '미션 안내', href: 'https://www.brainbackdoor.com/infra' },
      { label: '실습 저장소', href: 'https://github.com/brainbackdoor/subway-map' },
    ],
  },
  {
    id: 'conference',
    title: '컨퍼런스 신청 플랫폼',
    steps: [
      { label: '서비스 운영하기', href: 'https://www.brainbackdoor.com/6660b3f1-de92-4053-b3e0-08a84ea34432' },
      { label: '성능 테스트하기', href: 'https://www.brainbackdoor.com/ad9d2017-f854-4a97-bddb-6a8981dc14c1' },
      { label: '조회 성능 개선하기', href: 'https://www.brainbackdoor.com/7b4ef2a7-32e3-4b8e-b243-ec88a5e38708' },
    ],
    links: [
      { label: '미션 안내', href: 'https://www.brainbackdoor.com/infra' },
      { label: '실습 저장소', href: 'https://github.com/brainbackdoor/infra-workshop' },
    ],
  },
];

export const sections: TopicSection[] = [
  {
    id: 'aws', title: 'AWS · Linux',
    items: [
      { label: '리눅스 명령어 zip', href: 'https://www.brainbackdoor.com/b47f2941-5949-4368-890b-ca7825b419b9' },
      { label: '도커 컨테이너 살펴보기', href: 'https://www.brainbackdoor.com/6c414539-eeb5-402c-a18e-3eb02209e487' },
    ],
  },
  {
    id: 'was', title: 'WAS',
    items: [
      { label: 'HTTP Cache · gzip · Servlet · Thread 학습 테스트', href: 'https://www.brainbackdoor.com/8e230e0d-431c-4ffe-becd-c60c1bea4615' },
      { label: 'Thread 상태 분석하기', href: 'https://www.brainbackdoor.com/f78dedef-13f8-4ac2-b216-51600ce03d07' },
    ],
  },
  {
    id: 'db', title: 'DB',
    items: [
      { label: 'SQL, 이 정도는 알아야지 😎', href: 'https://www.brainbackdoor.com/6ad28373-149c-4d45-b835-8dfb853db638' },
      { label: 'MySQL Replication 구성해보기', href: 'https://www.brainbackdoor.com/1101a2b0-66bf-4b74-a95d-c2c98492093b' },
    ],
  },
  {
    id: 'tcp', title: '네트워크 · TCP',
    items: [
      { label: 'TCP 에러 복구 살펴보기', href: '/posts/tcp-error-recovery' },
      { label: 'TCP 성능', href: 'https://www.brainbackdoor.com/02773af9-5c93-43b5-89b4-bbab94536195' },
      { label: 'TCP keep-alive', href: 'https://www.brainbackdoor.com/beae0ed2-e020-4681-abac-fdb9e5f12c5f' },
    ],
  },
  {
    id: 'etc', title: '그 외 주제',
    items: [
      { label: 'bufferbloat과 buffer overflow', href: 'https://www.brainbackdoor.com/95400228-c9fb-4397-ac45-281f2a6c7446' },
      { label: '200 vs 404', href: 'https://www.brainbackdoor.com/14b691d7-7fd7-4e95-8787-49e06111755f' },
    ],
  },
];
