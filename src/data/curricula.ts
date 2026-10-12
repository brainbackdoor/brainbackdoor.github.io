/** 커리큘럼 목록. 개별 커리큘럼의 페이지와 학습 자료는 독립적으로 관리한다. */
export interface Curriculum {
  id: string;
  title: string;
  category: string;
  topics: string[];
  href: string;
}

export const curricula: Curriculum[] = [
  {
    id: 'infra',
    title: '인프라공방',
    category: '개발 · 인프라',
    topics: ['서버', '네트워크', '데이터베이스'],
    href: '/tech/infra',
  },
];
