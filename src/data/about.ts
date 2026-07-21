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
