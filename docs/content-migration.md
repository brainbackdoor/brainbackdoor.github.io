# 기존 블로그 전체 콘텐츠 이전

상태: 2026-10-12 공개 본문 58개 이전 및 로컬 검수 완료. 원본 수집 예외는 아래에 기록했으며 배포는 후속 단계다. 디자인 기준점은 `6d21f8a` 커밋이다.

## 작업 목록

- [x] 현재 디자인·홈/본문 애니메이션 커밋 (`6d21f8a`)
- [x] 홈 43개 항목과 카테고리·커리큘럼의 공개 링크 대조
- [x] 독립 본문과 부모 표의 항목 분류 (독립 본문 58개)
- [x] 육아일지 추가 로딩 34개까지 수집 완료 및 목록 확정
- [x] 대표 글 MDX 변환·빌드·원문 텍스트 대조
- [x] 전체 본문과 이미지·첨부파일 로컬 이전
- [x] 기존 UUID·별칭·본문 링크 및 커리큘럼 연결 검증
- [x] 원문 텍스트·코드·에셋 전수 자동 대조
- [x] 긴 글·표·접기·모바일 실제 화면 검수
- [x] 원본 수집 예외와 외부 자료 정리
- [ ] 배포 및 도메인 전환 (후속 단계)

상세 대상은 `migration-inventory.json`, 변환 기록은 `migration-conversion-report.json`, 빌드 결과의 원문 대조는 `migration-verification.json`에 기록한다. 원본 Notion 응답은 저장소 밖 임시 캐시에 두며, 공개 본문·필요 에셋만 저장소에 포함한다.

## 검수 결과와 원본 예외

- 공개 문서 109개: 독립 본문 58개, 부모 표의 항목 46개, 인덱스·소개·커리큘럼·별도 프로젝트 참조 5개.
- 원문 블록 3,233개를 추적했다. 글 본문·코드·표·접기·캡션·원본 도표를 보존했다.
- 이미지·첨부파일 392개(113,976,062바이트)를 로컬에 저장했고 SHA-256을 대조했다.
- 본문의 로컬 이미지 378개에 원본 크기를 지정해 지연 로딩 중에도 공간을 확보한다. 표의 미리보기 크기도 고정해 기존 주소의 본문 위치가 이미지 로딩 후 밀리지 않도록 했다. 원본 파일은 재인코딩하지 않았다.
- 원문 텍스트 필드 1,875개를 빌드된 HTML과 대조했다. 누락 0개, 내부 링크·앵커 오류 0개.
- 타입 검사 오류·경고·힌트 0개, Vitest 73개와 변환기 테스트 11개 통과, 정적 빌드 성공.
- 실제 화면에서 58개 목록, 분류 14개 → TCP 검색 3개, 전체 본문의 ‘혼잡제어’ 검색, 390px 본문 및 320px 코드·표의 가로 넘침과 코드 복사를 확인했다.
- 기존 주소 264개를 새 지면으로 연결한다. JavaScript가 활성화된 경우 기존 본문 해시를 보존하고, 비활성인 경우 meta 이동·일반 링크를 제공한다. 정적 HTML 이동이며 서버 HTTP 301을 보장하지 않는다. 이전 주소는 사이트맵과 검색 결과에서 제외한다.
- 원본 작성일이 있는 44편과 생성일만 있는 14편을 구분해 표시했다. 세부 근거는 아래 ‘날짜 근거’를 따른다.

원본에서 복구되지 않는 자료를 임의로 채우지 않았다.

- `migration-inventory.json`의 `failures` 6건: HTTP 404 2건과 홈으로 돌아가는 주소 변형 4건. 본문에서 해당 주소가 쓰인 경우 원본 링크를 유지한다. 이를 새 글의 정상 경로로 연결하지 않는다.
- 북마크 썸네일 6개: TCP 성능, TCP keep-alive, 2019년 회고, 200 vs 404, 2021년 회고, 2022~2023년 회고의 외부 미리보기 이미지. 제목·설명·링크는 모두 보존하고 깨진 이미지 출력만 생략했다. 본문 이미지나 첨부파일 누락은 없다.
- Chaak는 별도 프로젝트이므로 게시글로 중복 이전하지 않고 확인된 원본 주소로 연결한다.
- 원본에서 숨겨진 Oopy 표시 설정과 Darass 댓글 삽입 코드 55개는 독자 본문에서 제외했다. 정확한 블록 ID·해시·이유를 변환 보고서에 남겼다. 초대장의 실제 링크·방명록·갤러리 이미지는 보존한다.
- 외부 서비스의 로그인 필요 자료와 댓글 데이터 자체는 복제하지 않는다. 기존 링크와 공개 임베드를 통해 접근한다.

## 재검증

```sh
python3 -m unittest discover -s scripts/migration -p 'test_*.py'
pnpm test
pnpm check
pnpm build
python3 scripts/migration/verify.py
```

`verify.py`는 저장소 밖 원본 캐시(`/private/tmp/brainbackdoor-migration/pages`)와 변환 보고서가 필요하다. 캐시가 사라졌다면 `collect.py`로 공개 원문을 다시 수집한 뒤 검사한다. 원본이 바뀌었을 수 있으므로 재수집 결과를 이전 시점의 동일 스냅샷으로 취급하지 않는다. `convert.py --only <sourceId>`로 한 글만 다시 변환할 수 있다.

`convert.py --refresh-image-dimensions`는 네트워크 요청 없이 로컬 이미지의 크기 속성과 보고서만 갱신한다. `verify.py`는 빌드된 본문 이미지의 크기 지정 여부도 검사한다.

## 현재 상태

- 원본은 [brainbackdoor.com](https://www.brainbackdoor.com/)의 Notion/oopy 공개 페이지다.
- 홈 Posts에서 `Load more`가 없어질 때까지 펼치고 주소로 중복을 제거하면 43개 항목이 확인된다. 글과 실습자료가 섞여 있다.
- [회고·문화](https://www.brainbackdoor.com/retrospective)에는 홈 목록에 없는 `SpringCamp 2026 후기`도 있다. 홈 목록만으로 전체 범위를 확정하지 않는다. 인프라·라이프·커리큘럼과 하위 페이지를 대조해야 한다.
- 과거 계획의 28편은 현재 총량으로 사용하지 않는다.
- 이전 시작 시 한국어 MDX 4개 중 SpringCamp는 짧은 실데이터 시드였고 TCP·로드밸런서·2024년 회고는 디자인 검증용 샘플이었다. 원문이 있는 글은 전체 본문으로 교체하고, 원문이 확인되지 않은 로드밸런서 및 영어 TCP 샘플은 초안으로 제외한다.
- 원본 `TCP 오류복구`는 [2019년 원문](https://www.brainbackdoor.com/5df70731-ea29-47b1-bff3-9f18e8ff955f)이다. 실제 발행일·제목·본문으로 교체하며, 새 애니메이션은 원문 도표를 보존한 상태에서 보충 자료로 추가한다.

## 진행 순서

1. **대상 목록 확정**
   - 홈 전체 목록, 회고·문화, 인프라, 라이프, 인프라공방의 내부 페이지를 합친다.
   - 원본 URL/Notion ID 기준으로 중복을 제거한다.
   - 제목, 발행일·수정일, 글/커리큘럼 자료, 원본 주소, 새 경로, 수집·변환·검수 상태를 기록한다.
   - 외부 참고 링크는 링크로 보존하고 사용자 원문과 구분한다.
2. **대표 글로 변환 방식 확인**
   - 회고, 코드, 이미지, 표·중첩 목록이 있는 글을 실제 원문으로 옮긴다.
   - 제목 단계, 코드 언어, 콜아웃, 인용, 접기, 캡션, 첨부와 임베드의 표현을 확인한다.
   - 원문을 임의로 요약하거나 새 설명으로 대체하지 않는다. 공개 페이지에서 확보되지 않는 자료만 별도 확인 항목으로 남긴다.
3. **전체 본문·에셋 이전**
   - MDX와 로컬 에셋으로 옮기고 출처 URL을 기록한다.
   - 현재 샘플은 대응하는 원문으로 교체한다. 실제 원문이 없는 샘플은 사용자 글로 배포하지 않는다.
   - 기존 이미지·도표는 먼저 보존한다. 애니메이션 전환은 에셋별로 진행하며, 전량 이전을 그 작업에 종속시키지 않는다.
4. **주소와 탐색 연결**
   - 기존 UUID·별칭과 새 경로의 매핑을 만들고 글 사이 링크 및 커리큘럼 자료 링크를 연결한다.
   - 홈, 글 목록, 태그, 관련 글, RSS, 검색에 실제 콘텐츠가 반영되는지 확인한다.
   - 같은 도메인의 예전 경로 처리와 기존 도메인 전환은 구분해서 검증한다. 도메인 변경은 배포 단계에서 다룬다.
5. **원문 대조 후 배포 검토**
   - 글마다 본문, 코드, 이미지·첨부, 링크와 메타데이터의 누락 여부를 대조한다.
   - 전체 대상 수와 이전·검수 완료 수를 맞추고 미확인 항목을 남김없이 정리한다.
   - 실제 긴 글로 데스크톱·모바일을 확인하고 테스트·타입 검사·빌드를 통과한 뒤 배포한다.

## 완료 기준

목록에 포함한 모든 원문이 대조 검수를 통과하고, 샘플 본문이 남지 않으며, 이미지·코드·내부 링크와 기존 경로 처리가 확인되어야 전체 이전 완료로 보고한다. 페이지 디자인 및 빌드 성공만으로 콘텐츠 이전 완료라고 보고하지 않는다.

## 날짜 근거

원문 `작성일자`는 `dateSource: published`로, `생성일` 속성 또는 발행일 미기재 시 사용하는 Notion `created_time`은 `dateSource: created`로 기록한다. 실제 선택 근거는 인벤토리의 `pubDateEvidence`에 보존한다. 본문·목록·홈·관련 글은 생성일에 `생성일`을 표시하며, 날짜의 접근성 설명에도 `원문 생성일 (발행일 미기재)`를 제공한다. 정렬과 RSS의 `pubDate`는 이 날짜를 공통으로 사용한다. 따라서 RSS의 날짜가 생성일에서 온 경우 실제 발행일이 확인되었다는 뜻은 아니며, 원문에 명시된 날짜나 별도 발행일이 확인되면 해당 메타데이터를 갱신한다.

<!-- MIGRATION_TARGETS:START -->
## 이전 대상 목록

독립 본문 58개와 부모 페이지 안에 보존하는 표 항목 46개를 구분한다. 표 항목은 새 글 목록에 중복 게시하지 않는다. 아래 파일은 실제 원문으로 교체·생성한 결과이며, 상세 검수 상태와 원본 문제는 JSON 보고서에 기록한다.

| 원문 | 분류 | 이전 파일 |
| --- | --- | --- |
| [SpringCamp 2026 후기](https://www.brainbackdoor.com/38190d37-083f-8033-a7e8-f3996e11cf55) | 회고·문화 | [MDX](../src/content/posts/ko/springcamp-2026.mdx) |
| [일의 감각](https://www.brainbackdoor.com/1ac90d37-083f-8066-a151-e89a5a47a46b) | 회고·문화 | [MDX](../src/content/posts/ko/1ac90d37-083f-8066-a151-e89a5a47a46b.mdx) |
| [2024년 회고](https://www.brainbackdoor.com/16b90d37-083f-8025-acc7-e77b4a9e2b32) | 회고·문화 | [MDX](../src/content/posts/ko/2024-retrospect.mdx) |
| [끗과 시작, 그 사이 어딘가](https://www.brainbackdoor.com/11690d37-083f-80a9-b30b-c5def37b8e4f) | 회고·문화 | [MDX](../src/content/posts/ko/11690d37-083f-80a9-b30b-c5def37b8e4f.mdx) |
| [2022 ~ 2023년 회고](https://www.brainbackdoor.com/ae92f407-2d97-4dbe-99b1-3b972ca8d4a7) | 회고·문화 | [MDX](../src/content/posts/ko/ae92f407-2d97-4dbe-99b1-3b972ca8d4a7.mdx) |
| [컨퍼런스 신청 플랫폼 미션 실습환경 구성 가이드](https://www.brainbackdoor.com/b065c018-114e-4897-9a53-98115cd9b382) | 실습 가이드 | [MDX](../src/content/posts/ko/b065c018-114e-4897-9a53-98115cd9b382.mdx) |
| [Pinpoint 구성하기](https://www.brainbackdoor.com/1ca5dd49-2787-4f09-b88b-8e5881aa0b15) | 실습 가이드 | [MDX](../src/content/posts/ko/1ca5dd49-2787-4f09-b88b-8e5881aa0b15.mdx) |
| [서비스 운영하기 미션 가이드](https://www.brainbackdoor.com/6660b3f1-de92-4053-b3e0-08a84ea34432) | 실습 가이드 | [MDX](../src/content/posts/ko/6660b3f1-de92-4053-b3e0-08a84ea34432.mdx) |
| [성능테스트 미션 가이드](https://www.brainbackdoor.com/ad9d2017-f854-4a97-bddb-6a8981dc14c1) | 실습 가이드 | [MDX](../src/content/posts/ko/ad9d2017-f854-4a97-bddb-6a8981dc14c1.mdx) |
| [MySQL Replication 간단히 구성해보기](https://www.brainbackdoor.com/1101a2b0-66bf-4b74-a95d-c2c98492093b) | 인프라 | [MDX](../src/content/posts/ko/1101a2b0-66bf-4b74-a95d-c2c98492093b.mdx) |
| [SQL, 이 정도는 알아야지 😎](https://www.brainbackdoor.com/6ad28373-149c-4d45-b835-8dfb853db638) | 인프라 | [MDX](../src/content/posts/ko/6ad28373-149c-4d45-b835-8dfb853db638.mdx) |
| [조회 성능 개선하기 미션 가이드](https://www.brainbackdoor.com/7b4ef2a7-32e3-4b8e-b243-ec88a5e38708) | 실습 가이드 | [MDX](../src/content/posts/ko/7b4ef2a7-32e3-4b8e-b243-ec88a5e38708.mdx) |
| [HTTP Cache, gzip, Servlet, Thread 등 학습 테스트](https://www.brainbackdoor.com/8e230e0d-431c-4ffe-becd-c60c1bea4615) | 실습 가이드 | [MDX](../src/content/posts/ko/8e230e0d-431c-4ffe-becd-c60c1bea4615.mdx) |
| [테스트 작성 기준](https://www.brainbackdoor.com/9178ac06-ae33-4a96-a4cd-49c96ea28351) | 회고·문화 | [MDX](../src/content/posts/ko/9178ac06-ae33-4a96-a4cd-49c96ea28351.mdx) |
| [이벤트 스토밍](https://www.brainbackdoor.com/c78ba22a-b64d-4016-9f09-c9de5f94e612) | 회고·문화 | [MDX](../src/content/posts/ko/c78ba22a-b64d-4016-9f09-c9de5f94e612.mdx) |
| [컨벤션 문서](https://www.brainbackdoor.com/f67aa01c-218b-4ada-8dcd-82ab9cce4b9c) | 회고·문화 | [MDX](../src/content/posts/ko/f67aa01c-218b-4ada-8dcd-82ab9cce4b9c.mdx) |
| [리눅스 명령어 zip](https://www.brainbackdoor.com/b47f2941-5949-4368-890b-ca7825b419b9) | 인프라 | [MDX](../src/content/posts/ko/b47f2941-5949-4368-890b-ca7825b419b9.mdx) |
| [Thread 상태 분석하기](https://www.brainbackdoor.com/f78dedef-13f8-4ac2-b216-51600ce03d07) | 인프라 | [MDX](../src/content/posts/ko/f78dedef-13f8-4ac2-b216-51600ce03d07.mdx) |
| [도커 컨테이너 살펴보기](https://www.brainbackdoor.com/6c414539-eeb5-402c-a18e-3eb02209e487) | 인프라 | [MDX](../src/content/posts/ko/6c414539-eeb5-402c-a18e-3eb02209e487.mdx) |
| [도커 컨테이너 실행해보기](https://www.brainbackdoor.com/9fcd92ce-d741-48a9-a0f5-4951c8400bd7) | 실습 가이드 | [MDX](../src/content/posts/ko/9fcd92ce-d741-48a9-a0f5-4951c8400bd7.mdx) |
| [미션 진행방법](https://www.brainbackdoor.com/179d8510-f605-4420-9eaa-80410079e077) | 실습 가이드 | [MDX](../src/content/posts/ko/179d8510-f605-4420-9eaa-80410079e077.mdx) |
| [학습 목표](https://www.brainbackdoor.com/c9941281-9ebf-4a58-b295-3638c22117b1) | 실습 가이드 | [MDX](../src/content/posts/ko/c9941281-9ebf-4a58-b295-3638c22117b1.mdx) |
| [3 tier 구성하기 미션 가이드](https://www.brainbackdoor.com/0798ec80-70e7-441d-a238-2dc640122bce) | 실습 가이드 | [MDX](../src/content/posts/ko/0798ec80-70e7-441d-a238-2dc640122bce.mdx) |
| [서버 구성하기 미션 가이드](https://www.brainbackdoor.com/0af0d94d-8533-4416-b444-d5850f745a91) | 실습 가이드 | [MDX](../src/content/posts/ko/0af0d94d-8533-4416-b444-d5850f745a91.mdx) |
| [화면 응답 개선하기 미션 가이드](https://www.brainbackdoor.com/80dbc9d7-ba32-4220-9b39-b536172264f2) | 실습 가이드 | [MDX](../src/content/posts/ko/80dbc9d7-ba32-4220-9b39-b536172264f2.mdx) |
| [컨퍼런스 신청 플랫폼 미션 요구사항](https://www.brainbackdoor.com/dfe2e77f-066e-46e9-a575-ed1e65157321) | 실습 가이드 | [MDX](../src/content/posts/ko/dfe2e77f-066e-46e9-a575-ed1e65157321.mdx) |
| [지하철 노선도 미션 요구사항](https://www.brainbackdoor.com/1824fb4e-415b-4a61-8ec4-76e5102ee32f) | 실습 가이드 | [MDX](../src/content/posts/ko/1824fb4e-415b-4a61-8ec4-76e5102ee32f.mdx) |
| [돌잔치 초대장](https://www.brainbackdoor.com/456db3cc-c4e1-4028-a820-45eca7a00002) | 라이프 | [MDX](../src/content/posts/ko/456db3cc-c4e1-4028-a820-45eca7a00002.mdx) |
| [D+118 백일 한복 그림](https://www.brainbackdoor.com/510a4baf-f32e-4be7-94dd-b69b39b67963) | 라이프 | [MDX](../src/content/posts/ko/510a4baf-f32e-4be7-94dd-b69b39b67963.mdx) |
| [생후 3~4개월](https://www.brainbackdoor.com/182f7833-51f6-4a0a-9332-dee1745eb629) | 라이프 | [MDX](../src/content/posts/ko/182f7833-51f6-4a0a-9332-dee1745eb629.mdx) |
| [안젤라 갤러리](https://www.brainbackdoor.com/b0fcd797-d327-4708-835b-e64079b05d39) | 라이프 | [MDX](../src/content/posts/ko/b0fcd797-d327-4708-835b-e64079b05d39.mdx) |
| [D+117 첫 가족 그림](https://www.brainbackdoor.com/d913f5b7-bfb1-4294-8ea0-59ca4d849c22) | 라이프 | [MDX](../src/content/posts/ko/d913f5b7-bfb1-4294-8ea0-59ca4d849c22.mdx) |
| [D+116 스케치 시작](https://www.brainbackdoor.com/c2b1634c-9248-4dc9-804e-bea085b3f4b4) | 라이프 | [MDX](../src/content/posts/ko/c2b1634c-9248-4dc9-804e-bea085b3f4b4.mdx) |
| [D+100 백일 족자](https://www.brainbackdoor.com/0e0e57f6-8286-4aac-b32e-c9b28e5e6830) | 라이프 | [MDX](../src/content/posts/ko/0e0e57f6-8286-4aac-b32e-c9b28e5e6830.mdx) |
| [D+100 백일 기념](https://www.brainbackdoor.com/100baf78-adbc-4c10-8ad0-f497437a1984) | 라이프 | [MDX](../src/content/posts/ko/100baf78-adbc-4c10-8ad0-f497437a1984.mdx) |
| [육아일지](https://www.brainbackdoor.com/9a393b4d-ea51-45d2-8823-50eb9e522ff9) | 라이프 | [MDX](../src/content/posts/ko/9a393b4d-ea51-45d2-8823-50eb9e522ff9.mdx) |
| [육아](https://www.brainbackdoor.com/0a7765e4-92de-4182-bc0e-0d55dfb13ab0) | 라이프 | [MDX](../src/content/posts/ko/0a7765e4-92de-4182-bc0e-0d55dfb13ab0.mdx) |
| [Gender Reveal](https://www.brainbackdoor.com/142925bd-2a5a-4813-8d6b-c64ffc040535) | 라이프 | [MDX](../src/content/posts/ko/142925bd-2a5a-4813-8d6b-c64ffc040535.mdx) |
| [Gender Reveal](https://www.brainbackdoor.com/b36fad77-048a-4657-b8f9-21c73b6ff257) | 라이프 | [MDX](../src/content/posts/ko/b36fad77-048a-4657-b8f9-21c73b6ff257.mdx) |
| [2021년 회고](https://www.brainbackdoor.com/623ea5b7-3623-4843-9926-8b29e76b9b71) | 회고·문화 | [MDX](../src/content/posts/ko/623ea5b7-3623-4843-9926-8b29e76b9b71.mdx) |
| [왜 Spark를 써야할까](https://www.brainbackdoor.com/833771f4-d722-4c80-8967-2f0024885bff) | 인프라 | [MDX](../src/content/posts/ko/833771f4-d722-4c80-8967-2f0024885bff.mdx) |
| [Spark는 어떤 컨셉인가?](https://www.brainbackdoor.com/c9edaff4-1f8b-48aa-a092-730b932155fb) | 인프라 | [MDX](../src/content/posts/ko/c9edaff4-1f8b-48aa-a092-730b932155fb.mdx) |
| [2021년 상반기 회고](https://www.brainbackdoor.com/0f9f8b63-17c1-4475-bfa8-75f0ef0ebcad) | 회고·문화 | [MDX](../src/content/posts/ko/0f9f8b63-17c1-4475-bfa8-75f0ef0ebcad.mdx) |
| [팀 회고 템플릿](https://www.brainbackdoor.com/a1094dc5-8f5c-4725-be7c-8247fc273c44) | 회고·문화 | [MDX](../src/content/posts/ko/a1094dc5-8f5c-4725-be7c-8247fc273c44.mdx) |
| [웨딩](https://www.brainbackdoor.com/d1b5e57f-715e-433e-a5bb-a3ca8bd1f216) | 라이프 | [MDX](../src/content/posts/ko/d1b5e57f-715e-433e-a5bb-a3ca8bd1f216.mdx) |
| [2020년 회고](https://www.brainbackdoor.com/8c882a84-05d4-4058-8ebb-40b5dafe433f) | 회고·문화 | [MDX](../src/content/posts/ko/8c882a84-05d4-4058-8ebb-40b5dafe433f.mdx) |
| [2020년 상반기 회고](https://www.brainbackdoor.com/5d9c4e59-60bf-41d0-9d2a-b8125636a9c3) | 회고·문화 | [MDX](../src/content/posts/ko/5d9c4e59-60bf-41d0-9d2a-b8125636a9c3.mdx) |
| [불변객체에 관해서..](https://www.brainbackdoor.com/95248237-c6a4-4489-a51e-6c548c0c103c) | 인프라 | [MDX](../src/content/posts/ko/95248237-c6a4-4489-a51e-6c548c0c103c.mdx) |
| [일급컬렉션에 대해서..](https://www.brainbackdoor.com/1c3f7881-71c5-4855-85d1-a4c7e895a66b) | 인프라 | [MDX](../src/content/posts/ko/1c3f7881-71c5-4855-85d1-a4c7e895a66b.mdx) |
| [200 vs 404](https://www.brainbackdoor.com/14b691d7-7fd7-4e95-8787-49e06111755f) | 인프라 | [MDX](../src/content/posts/ko/14b691d7-7fd7-4e95-8787-49e06111755f.mdx) |
| [2019년 회고](https://www.brainbackdoor.com/04555c7c-eb81-4283-905e-b8f9c3f8b75c) | 회고·문화 | [MDX](../src/content/posts/ko/04555c7c-eb81-4283-905e-b8f9c3f8b75c.mdx) |
| [TCP keep-alive](https://www.brainbackdoor.com/beae0ed2-e020-4681-abac-fdb9e5f12c5f) | 인프라 | [MDX](../src/content/posts/ko/beae0ed2-e020-4681-abac-fdb9e5f12c5f.mdx) |
| [TCP 성능](https://www.brainbackdoor.com/02773af9-5c93-43b5-89b4-bbab94536195) | 인프라 | [MDX](../src/content/posts/ko/02773af9-5c93-43b5-89b4-bbab94536195.mdx) |
| [TCP 오류복구](https://www.brainbackdoor.com/5df70731-ea29-47b1-bff3-9f18e8ff955f) | 인프라 | [MDX](../src/content/posts/ko/tcp-error-recovery.mdx) |
| [2019년 상반기 회고](https://www.brainbackdoor.com/32fc3a46-6aed-4c92-9896-c40abd86ef06) | 회고·문화 | [MDX](../src/content/posts/ko/32fc3a46-6aed-4c92-9896-c40abd86ef06.mdx) |
| [좋은 개발문화란?](https://www.brainbackdoor.com/d6132043-4fd1-4960-974c-26946e0224ce) | 회고·문화 | [MDX](../src/content/posts/ko/d6132043-4fd1-4960-974c-26946e0224ce.mdx) |
| [bufferbloat과 buffer overflow](https://www.brainbackdoor.com/95400228-c9fb-4397-ac45-281f2a6c7446) | 인프라 | [MDX](../src/content/posts/ko/95400228-c9fb-4397-ac45-281f2a6c7446.mdx) |
| [2018년 회고](https://www.brainbackdoor.com/c6550c6d-0773-43bc-84a9-311a3de97b00) | 회고·문화 | [MDX](../src/content/posts/ko/c6550c6d-0773-43bc-84a9-311a3de97b00.mdx) |

<!-- MIGRATION_TARGETS:END -->
