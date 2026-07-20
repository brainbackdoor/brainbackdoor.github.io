/**
 * 인프라 학습 대시보드의 콘텐츠.
 * 마크업과 분리해 둔다 — 자료가 늘어날 때 페이지를 건드리지 않아도 되게.
 * 2단계에서 글이 Content Collection으로 들어오면 이 파일 일부는 그쪽으로 옮겨간다.
 */

export interface Stat {
  value: string;
  label: string;
}

export interface Topic {
  label: string;
  anchor: string;
}

export interface MissionLink {
  label: string;
  href: string;
}

export interface Mission {
  title: string;
  desc: string;
  links: MissionLink[];
}

export interface TopicSection {
  id: string;
  title: string;
  count: string;
  items: { label: string; href: string }[];
}

export const stats: Stat[] = [
  { value: '2', label: '실습 미션' },
  { value: '12+', label: '학습 자료' },
  { value: '3', label: 'TCP 심화' },
  { value: '2', label: '특강 영상' },
];

export const topics: Topic[] = [
  { label: '인프라공방 미션', anchor: '#mission' },
  { label: 'AWS · Linux', anchor: '#aws' },
  { label: 'WAS', anchor: '#was' },
  { label: 'DB', anchor: '#db' },
  { label: '네트워크 · TCP', anchor: '#tcp' },
  { label: '그 외 주제', anchor: '#etc' },
];

export const missions: Mission[] = [
  {
    title: '지하철 노선도',
    desc: '서버 구성부터 3-tier, 화면 응답 개선까지 단계적으로.',
    links: [
      { label: '⛳️ 요구사항', href: '#' },
      { label: '저장소', href: 'https://github.com/brainbackdoor/subway-map' },
      { label: '서버 구성 가이드', href: '#' },
    ],
  },
  {
    title: '컨퍼런스 신청 플랫폼',
    desc: '서비스 운영·성능테스트·조회 성능 개선을 실습합니다.',
    links: [
      { label: '⛳️ 요구사항', href: '#' },
      { label: '저장소', href: 'https://github.com/brainbackdoor/infra-workshop' },
      { label: '실습환경 구성', href: '#' },
    ],
  },
];

export const sections: TopicSection[] = [
  {
    id: 'aws',
    title: 'AWS · Linux',
    count: '2편',
    items: [
      { label: '리눅스 명령어 zip', href: '#' },
      { label: '도커 컨테이너 살펴보기', href: '#' },
    ],
  },
  {
    id: 'was',
    title: 'WAS',
    count: '2편',
    items: [
      { label: 'HTTP Cache · gzip · Servlet · Thread 학습 테스트', href: '#' },
      { label: 'Thread 상태 분석하기', href: '#' },
    ],
  },
  {
    id: 'db',
    title: 'DB',
    count: '2편',
    items: [
      { label: 'SQL, 이 정도는 알아야지 😎', href: '#' },
      { label: 'MySQL Replication 구성해보기', href: '#' },
    ],
  },
  {
    id: 'tcp',
    title: '네트워크 · TCP',
    count: '3편',
    items: [
      { label: 'TCP 오류복구', href: '#' },
      { label: 'TCP 성능', href: '#' },
      { label: 'TCP keep-alive', href: '#' },
    ],
  },
  {
    id: 'etc',
    title: '그 외 주제',
    count: '2편',
    items: [
      { label: 'bufferbloat과 buffer overflow', href: '#' },
      { label: '200 vs 404', href: '#' },
    ],
  },
];
