/** B04 컨테이너·Linux·스레드·객체 도해의 사건 모델. 시각은 설명용 연출 ms이며 실제 측정값이 아니다. */
export const systemInfo = [
  {
    "id": "C01",
    "title": "VM과 공유 커널",
    "short": "공유 커널",
    "final": 7000,
    "duration": 10000,
    "steps": [
      2600,
      5200,
      7000
    ],
    "caption": "Linux host, 앱 3개. VM별 guest kernel과 Linux 컨테이너의 host kernel을 비교하며 속도·메모리 배수를 추정하지 않습니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [
      "6c414539-eeb5-402c-a18e-3eb02209e487/d5686ba0-2435-4d37-bae6-16be2d38774d.webp"
    ],
    "notes": [
      "App·Bins/Lib를 각 실행 환경에 둡니다.",
      "VM의 guest kernel과 Linux host kernel의 위치를 분리합니다.",
      "Container engine·공유 Linux kernel·기반 장비를 표시합니다. Docker Desktop은 Linux VM을 거칠 수 있습니다."
    ]
  },
  {
    "id": "C02",
    "title": "CLI부터 컨테이너 시작까지",
    "short": "Docker API",
    "final": 7000,
    "duration": 10000,
    "steps": [
      2900,
      5300,
      7000
    ],
    "caption": "Linux Docker API 흐름. 로컬 이미지가 없는 run 사례와 원본 명령어 관계를 함께 유지합니다. 실제 부모 PID 트리의 재현은 아닙니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [
      "6c414539-eeb5-402c-a18e-3eb02209e487/7f1bf63f-1281-4066-8973-4c185d8ccfa5.webp",
      "6c414539-eeb5-402c-a18e-3eb02209e487/0999e034-1688-44fe-8155-616b2e1ec3e7.webp"
    ],
    "notes": [
      "CLI는 Unix socket을 통해 dockerd에 요청합니다.",
      "registry의 이미지 수신 후 로컬 이미지가 준비됩니다.",
      "create와 start 이후 컨테이너가 실행됩니다."
    ]
  },
  {
    "id": "C03",
    "title": "같은 프로세스의 두 PID와 root",
    "short": "PID와 root",
    "final": 6500,
    "duration": 9500,
    "steps": [
      2000,
      3800,
      6500
    ],
    "caption": "host PID 4453 / container PID 1은 nginx 원본 실습 값, /home/joe는 별도의 chroot 개념 예입니다. 실제 nginx의 root 경로를 측정한 그림으로 합치지 않습니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [
      "6c414539-eeb5-402c-a18e-3eb02209e487/aeeb0b89-15cb-4947-b679-28443204701c.webp"
    ],
    "notes": [
      "nginx는 host에서 하나의 프로세스입니다.",
      "PID namespace마다 같은 프로세스의 PID 표기가 다릅니다.",
      "별도의 chroot 예에서 root 안의 usr/bin, usr/local, bin을 표시합니다. PID 실습의 실제 파일시스템 경로와 동일하다고 단정하지 않습니다."
    ]
  },
  {
    "id": "C04",
    "title": "읽기 전용 이미지와 쓰기 계층",
    "short": "이미지 레이어",
    "final": 8000,
    "duration": 11000,
    "steps": [
      3300,
      5800,
      8000
    ],
    "caption": "설명용 newfile/newfile2로 파일 변경과 commit의 새 이미지 ID를 비교합니다. 저장 드라이버의 실제 디스크 레이아웃은 원본 코드로 유지합니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [],
    "notes": [
      "newfile은 컨테이너 쓰기 계층에 생깁니다.",
      "commit은 새 이미지 B를 만듭니다. 원래 이미지 A는 그대로입니다.",
      "이후 newfile2를 써도 이미지 A/B는 자동으로 바뀌지 않습니다."
    ]
  },
  {
    "id": "C05",
    "title": "공개 포트에서 bridge와 veth까지",
    "short": "bridge와 포트",
    "final": 9000,
    "duration": 12000,
    "steps": [
      3600,
      6000,
      9000
    ],
    "caption": "Linux rootful 기본 bridge 개념과 「도커 컨테이너 실행해보기」의 9000:8080 예를 결합합니다. 원본 nginx/veth1과 Spring/veth2, docker0 연결은 보존합니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [
      "6c414539-eeb5-402c-a18e-3eb02209e487/865f6a09-fc58-488c-b1cf-6cf13918cb42.webp"
    ],
    "notes": [
      "client가 host의 9000 포트로 요청합니다.",
      "docker0와 veth2/eth0를 거쳐 8080에서 앱이 받습니다.",
      "도착 후 응답이 돌아옵니다. 같은 bridge의 nginx/veth1 연결은 별도 경로로 남습니다."
    ]
  },
  {
    "id": "C06",
    "title": "컨테이너 교체 뒤에도 남는 데이터",
    "short": "영속 데이터",
    "final": 8500,
    "duration": 11500,
    "steps": [
      3500,
      5800,
      8500
    ],
    "caption": "named volume과 bind mount를 각각 비교합니다. 저장소 삭제 없이 container rm만 수행하는 조건이며, record A는 설명용 데이터입니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [],
    "notes": [
      "A가 연결된 저장소에 record A를 씁니다.",
      "컨테이너 A를 제거해도 named volume과 host 경로는 남습니다.",
      "B에 같은 저장소를 연결해 읽습니다. mount는 기존 이미지 파일을 지우는 동작이 아닙니다."
    ]
  },
  {
    "id": "C07",
    "title": "빌드와 시작·중지·재시작·제거",
    "short": "컨테이너 생명주기",
    "final": 10000,
    "duration": 13000,
    "steps": [
      3300,
      6500,
      10000
    ],
    "caption": "RUN은 이미지를 빌드할 때, CMD는 컨테이너를 시작할 때 실행됩니다. RUN 1회·CMD 2회인 설명용 정상 경로. 원본 nginx Dockerfile은 COPY와 베이스 이미지의 CMD를 사용합니다. RUN 추가 예시와 원래 실습을 구분합니다.",
    "source": "9fcd92ce-d741-48a9-a0f5-4951c8400bd7",
    "assets": [],
    "notes": [
      "RUN은 build 때 실행되고 CMD는 시작 명령으로 저장됩니다.",
      "run 뒤 쓴 데이터는 stop만으로 삭제되지 않습니다.",
      "restart에서 CMD를 다시 실행하고, rm에서 컨테이너 쓰기 계층이 사라집니다. 이미지는 남습니다."
    ]
  },
  {
    "id": "C08",
    "title": "개별 변경과 같은 이미지로 교체",
    "short": "immutable 배포",
    "final": 9000,
    "duration": 12000,
    "steps": [
      2600,
      6200,
      9000
    ],
    "caption": "원본 Mutable/Immutable Server GIF의 메시지. 세 서버와 v1/v2는 설명용이며 배포 시간·성능 향상률·무중단을 주장하지 않습니다.",
    "source": "6c414539-eeb5-402c-a18e-3eb02209e487",
    "assets": [
      "6c414539-eeb5-402c-a18e-3eb02209e487/4ee9dce3-0c0c-450c-abe5-fde207d6ef68.gif"
    ],
    "notes": [
      "서버별 변경은 서로 다른 상태를 만들 수 있습니다.",
      "새 v2 이미지가 준비된 뒤 각 서버를 교체합니다.",
      "rolling 중의 혼합 버전과 전체 교체 뒤의 동일 버전을 구분합니다."
    ]
  },
  {
    "id": "C09",
    "title": "쉘·프로세스·로그와 SIGHUP",
    "short": "쉘과 로그",
    "final": 8500,
    "duration": 11500,
    "steps": [
      2500,
      6800,
      8500
    ],
    "caption": "SIGHUP이 전달되는 조건의 비교. 본문 nohup·1> log·2>&1·&의 역할을 분리합니다. 모든 로그아웃 정책을 같은 동작으로 단정하지 않습니다.",
    "source": "b47f2941-5949-4368-890b-ca7825b419b9",
    "assets": [],
    "notes": [
      "&는 백그라운드 실행이며 nohup 자체가 아닙니다.",
      "세션 종료 후 SIGHUP이 전달되는 경우 일반 실행은 종료될 수 있습니다.",
      "nohup은 SIGHUP을 무시하게 할 뿐이고, 로그 파일로 보내는 것은 1>·2>&1 리다이렉션입니다. 자동 재시작이나 SIGKILL 보호는 아닙니다."
    ]
  },
  {
    "id": "C10",
    "title": "원본 10개 명령과 관찰 지표",
    "short": "Linux 진단",
    "final": 12000,
    "duration": 15000,
    "steps": [
      4400,
      8400,
      12000
    ],
    "caption": "원본의 진단 명령 10개와 관찰 열을 순서대로 강조합니다. 실제 샘플 출력은 보존하며 그래프 수치나 가상의 서버 측정값을 만들지 않습니다.",
    "source": "b47f2941-5949-4368-890b-ca7825b419b9",
    "assets": [
      "b47f2941-5949-4368-890b-ca7825b419b9/7b793821-364d-4e4c-b99d-c372263dabbf.webp"
    ],
    "notes": [
      "uptime/dmesg/vmstat로 전체 부하와 오류·추이를 봅니다.",
      "CPU·프로세스·디스크·메모리를 관련 열과 연결합니다.",
      "DEV·TCP/ETCP·top을 함께 확인합니다. 한 지표만으로 장애를 단정하지 않습니다."
    ]
  },
  {
    "id": "T02",
    "title": "Thread 상태와 monitor 소유권",
    "short": "스레드 상태",
    "final": 10500,
    "duration": 13500,
    "steps": [
      3000,
      5000,
      10500
    ],
    "caption": "Java SE 21 Thread.State의 설명용 한 worker 경로. 원본 Arthas의 46개 스레드 목록은 별도 근거로 남기며 캡처의 시간 변화를 발명하지 않습니다.",
    "source": "f78dedef-13f8-4ac2-b216-51600ce03d07",
    "assets": [
      "f78dedef-13f8-4ac2-b216-51600ce03d07/9d73754b-6ff7-4c68-a8cb-39630bdd2ca1.webp"
    ],
    "notes": [
      "monitor를 기다리는 worker는 BLOCKED입니다.",
      "wait 뒤 notify가 와도 monitor를 재획득하기 전에는 BLOCKED일 수 있습니다.",
      "sleep은 monitor를 놓지 않습니다. NEW부터 TERMINATED까지와 대기 이유를 구분합니다."
    ]
  },
  {
    "id": "T03",
    "title": "한 Servlet 인스턴스의 생명주기",
    "short": "Servlet 생명주기",
    "final": 8000,
    "duration": 11000,
    "steps": [
      2000,
      4000,
      8000
    ],
    "caption": "같은 정상 인스턴스, 요청 A/B 두 개. init/service/destroy와 본문의 공개 실습 코드가 기준이며 강제 종료·timeout 경로는 이 예에 포함하지 않습니다.",
    "source": "8e230e0d-431c-4ffe-becd-c60c1bea4615",
    "assets": [],
    "notes": [
      "init을 한 번 마친 뒤 요청을 처리합니다.",
      "같은 Servlet 인스턴스에서 service가 겹칠 수 있습니다.",
      "정상 종료에서 두 service가 끝난 뒤 destroy를 한 번 실행합니다."
    ]
  },
  {
    "id": "T04",
    "title": "공유 counter의 lost update",
    "short": "공유 카운터",
    "final": 5000,
    "duration": 8000,
    "steps": [
      2700,
      3400,
      5000
    ],
    "caption": "공유 counter 초기 0, 같은 두 요청. 오른쪽은 증가 전체를 monitor로 직렬화한 비교 예이며 원본 LocalCounter는 매 요청 독립 0→1입니다.",
    "source": "8e230e0d-431c-4ffe-becd-c60c1bea4615",
    "assets": [],
    "notes": [
      "경쟁 경로는 두 요청 모두 0을 읽습니다.",
      "공유 read/increment/write를 직렬화하면 B가 1을 읽습니다.",
      "경쟁 1과 직렬화 2를 비교합니다. 지역 counter의 1·1을 공유 합계 2로 바꾸지 않습니다."
    ]
  },
  {
    "id": "T05",
    "title": "실행 슬롯과 대기·완료 작업",
    "short": "풀과 대기 큐",
    "final": 10500,
    "duration": 13500,
    "steps": [
      3800,
      6500,
      10500
    ],
    "caption": "네 작업, 동일 도착과 실행 시간. fixed(2)와 cached의 worker 생성 차이만 설명하며 실제 요청 TPS나 Tomcat 기본값의 측정은 아닙니다.",
    "source": "8e230e0d-431c-4ffe-becd-c60c1bea4615",
    "assets": [],
    "notes": [
      "fixed는 두 작업을 실행하고 후속 작업을 기다리게 합니다.",
      "완료 후 다음 작업이 슬롯을 사용합니다. cached는 이 네 작업에 필요한 worker를 만듭니다.",
      "유입=대기+실행+완료를 유지합니다. cached의 네 worker는 설정 상한이 아닙니다."
    ]
  },
  {
    "id": "T06",
    "title": "carrier 재사용과 DB connection 상한",
    "short": "Virtual Thread",
    "final": 9000,
    "duration": 12000,
    "steps": [
      2300,
      3800,
      9000
    ],
    "caption": "JDK21 / JDK24의 synchronized 안 지원되는 I/O. 설명용 carrier 1개·DB 1개. JEP491은 JDK24이며 native/foreign 경로의 잔여 pinning은 별도입니다.",
    "source": "springcamp-2026",
    "assets": [
      "38190d37-083f-8033-a7e8-f3996e11cf55/38190d37-083f-8049-9802-e85b45daa4ad.webp"
    ],
    "notes": [
      "NIO 수락·polling, 실행기, Filter/Servlet 경계를 구분합니다.",
      "JDK21은 pinning, JDK24는 carrier를 반납합니다. monitor와 DB connection은 VT1이 계속 가질 수 있습니다.",
      "대기가 없어지는 것이 아니라 실행 자원을 재사용합니다. 원본 8192/200 설정값과 설명용 1/1을 구분합니다."
    ]
  },
  {
    "id": "T07",
    "title": "Virtual Thread와 Coroutine의 대기·재개",
    "short": "Coroutine 비교",
    "final": 8500,
    "duration": 11500,
    "steps": [
      1800,
      3500,
      8500
    ],
    "caption": "Java Virtual Thread의 지원되는 blocking I/O와 Kotlin/kotlinx의 실제 suspend 지점. 재개 worker B는 예시 선택이며 coroutine 일반 blocking 함수는 자동 suspend되지 않습니다.",
    "source": "2024-retrospect",
    "assets": [
      "16b90d37-083f-8025-acc7-e77b4a9e2b32/16c90d37-083f-80a9-b5ef-e777f3c111ef.webp"
    ],
    "notes": [
      "Java thread identity와 coroutine continuation을 구분합니다.",
      "대기 상태에서 JVM stack 상태와 continuation 상태를 각각 보존합니다.",
      "JVM scheduler와 coroutine dispatcher가 각각 재개합니다."
    ]
  },
  {
    "id": "T08",
    "title": "뷰·List 복사·Item 복사",
    "short": "컬렉션과 복사",
    "final": 8500,
    "duration": 11500,
    "steps": [
      2600,
      5900,
      8500
    ],
    "caption": "원문 ImmutableCart의 constructor view와 getter new ArrayList, 별도의 constructor copy·요소 copy를 비교합니다. name 하나를 가진 가변 Item 예이며 불변 VO 전제와 구분합니다.",
    "source": "95248237-c6a4-4489-a51e-6c548c0c103c",
    "assets": [],
    "notes": [
      "외부 L0, view, getter G1, constructor copy L1, 요소 copy L2를 구분합니다.",
      "외부 List의 B 추가와 A0.name 변경이 전파되는 범위가 다릅니다.",
      "view 변경은 예외, getter의 C 추가는 내부 List를 바꾸지 않습니다. 요소 A1을 새로 만들 때만 가변 Item 상태도 분리됩니다."
    ]
  }
] as const;
export type SystemFigureId = (typeof systemInfo)[number]["id"];

export const systemModels = {
  C01: (t: number) =>({vmGuestKernels:3,containerKernels:1,apps:3,nativeMacKernel:false,level:Math.min(5,Math.floor(t/1200)),phase:t<3800?'앱과 라이브러리는 각 환경 안에 둡니다.':t<6400?'VM마다 guest kernel이 있고 Linux 컨테이너는 host kernel을 공유합니다.':'Docker Desktop의 Linux VM은 이 Linux host 비교와 별도로 구분합니다.'}),
  C02: (t: number) =>({socket:t>=2000,daemon:t>=2800,imageAvailable:t>=4400,containerCreated:t>=5200,running:t>=6300,phase:t<4400?'로컬에 없는 이미지를 registry에서 받은 뒤 사용합니다.':t<6300?'이미지를 바탕으로 컨테이너를 생성하고 시작합니다.':'CLI가 socket으로 API를 호출합니다. 관리 흐름과 실제 부모 PID 트리는 다릅니다.'}),
  C03: (t: number) =>({hostPid:4453,containerPid:1,processes:1,chrootChangesPid:false,hostPath:'/home/joe',containerRoot:'/',pidVisible:t>=2500,rootVisible:t>=4200,phase:t<2500?'원본 예제의 nginx는 host PID 4453인 한 프로세스입니다.':t<4200?'PID namespace 안에서는 같은 프로세스를 PID 1로 볼 수 있습니다.':'root 경로 제한과 PID namespace는 다른 기능입니다. chroot만으로 PID가 바뀌지 않습니다.'}),
  C04: (t: number) =>({imageHasFile:false,containerHasFile:t>=2800,newImageHasFile:t>=5200,secondWrite:t>=6500,phase:t<2800?'기존 이미지 계층은 읽기 전용입니다.':t<5200?'새 파일은 컨테이너의 쓰기 계층에 생깁니다.':'commit은 새로운 이미지입니다. 이후의 쓰기도 이전 이미지 ID를 바꾸지 않습니다.'}),
  C05: (t: number) =>({hostPort:9000,containerPort:8080,requestReceived:t>=5700,replyStarted:t>=6300,replyReceived:t>=8900,phase:t<5700?'host의 공개 포트에서 bridge와 veth를 거쳐 컨테이너의 수신 포트로 전달합니다.':t<8900?'애플리케이션에 요청이 도착한 뒤 응답이 돌아옵니다.':'9000은 host 포트, 8080은 컨테이너 포트입니다. 같은 bridge의 nginx 연결도 유지합니다.'}),
  C06: (t: number) =>({volumeData:t>=3000?'record A':null,bindData:t>=3000?'record A':null,firstContainer:t>=1200&&t<5000,firstContainerRemoved:t>=5000,replacement:t>=6500,replacementRead:t>=7500?'record A':null,imageDataOverwritten:false,phase:t<3000?'named volume 또는 host 경로를 컨테이너에 연결합니다.':t<6500?'컨테이너를 제거해도 저장소를 지우지 않으면 데이터가 남습니다.':'같은 저장소를 새 컨테이너에 연결해 record A를 읽습니다. mount는 이미지 파일을 삭제하지 않습니다.'}),
  C07: (t: number) =>({runCalls:t>=2000?1:0,cmdCalls:t>=7000?2:t>=4800?1:0,state:t>=8800?'removed':t>=7000?'running':t>=6200?'exited':t>=4800?'running':t>=4000?'created':t>=3200?'image ready':'building',writableData:t>=5400&&t<8800,imageExists:t>=3200,phase:t<3200?'RUN은 빌드 때, CMD는 시작 명령으로 저장됩니다.':t<7000?'stop은 프로세스를 끝내지만 컨테이너 쓰기 계층은 남깁니다.':'restart는 시작 명령을 다시 실행합니다. rm은 해당 컨테이너와 쓰기 계층을 제거합니다.'}),
  C08: (t: number) =>({artifact:t>=2200?'v2':'v1',mutable:[t>=2000?'v2':'v1',t>=3800?'v1+':'v1','v1'],immutable:[4000,6000,8000].map(a=>t>=a?'v2':'v1'),phase:t<2200?'서버별 수동 변경과 공통 이미지 배포를 같은 세 서버로 비교합니다.':t<8000?'immutable 방식은 새 v2 이미지로 실행 환경을 차례로 교체합니다.':'롤링 교체 중에는 버전이 섞일 수 있습니다. 완료 뒤의 세 서버는 같은 v2입니다.'}),
  C09: (t: number) =>({started:t>=1400,sessionClosed:t>=6200,backgroundAlive:t>=1400&&t<6500,nohupAlive:t>=1400,nohupFd1:'app.log',nohupFd2:'app.log',backgroundByNohup:false,phase:t<6500?'본문의 &는 백그라운드 실행, 1>와 2>&1은 로그 목적지를 정합니다.':'SIGHUP이 전달되는 조건에서 비교합니다. nohup은 이를 무시하며 자동 재시작 기능은 없습니다.'}),
  C10: (t: number) =>({commands:['uptime','dmesg | tail','vmstat 1','mpstat -P ALL 1','pidstat 1','iostat -xz 1','free -m','sar -n DEV 1','sar -n TCP,ETCP 1','top'],visited:Math.max(0,Math.min(10,Math.floor((t-1200)/1000)+1)),measuredValues:false,phase:t<6500?'원본의 명령과 관찰 영역을 순서대로 연결합니다.':'명령별 관찰 값을 함께 해석합니다. load나 iowait 하나만으로 원인을 확정하지 않습니다.'}),
  T02: (t: number) =>({state:t>=9600?'TERMINATED':t>=8600?'RUNNABLE':t>=7600?'TIMED_WAITING':t>=6600?'RUNNABLE':t>=5900?'BLOCKED':t>=4500?'WAITING':t>=3400?'RUNNABLE':t>=2400?'BLOCKED':t>=1200?'RUNNABLE':'NEW',monitor:t>=9600?null:t>=6600?'worker':t>=5900?'peer':t>=4500?null:t>=3400?'worker':t>=2400?'peer':null,phase:t<4500?'BLOCKED는 monitor 획득을 기다리는 상태입니다.':t<7600?'wait()는 monitor를 놓습니다. notify()만으로 즉시 monitor를 얻지는 못합니다.':'sleep()은 monitor를 놓지 않습니다. WAITING 수만으로 장애를 판정하지 않습니다.'}),
  T03: (t: number) =>({initialized:t>=1800,initCalls:t>=1200?1:0,activeServices:(t>=2400&&t<5000?1:0)+(t>=3000&&t<5800?1:0),completed:(t>=5000?1:0)+(t>=5800?1:0),destroyCalls:t>=6900?1:0,destroyed:t>=7500,phase:t<1800?'한 servlet 인스턴스의 init이 먼저 완료됩니다.':t<6900?'두 service 호출은 같은 인스턴스에서 동시에 실행될 수 있습니다.':'이 정상 종료 예에서는 두 service가 끝난 뒤 destroy를 한 번 호출합니다.'}),
  T04: (t: number) =>({race:{value:t>=3100?1:0,reads:[t>=1700?0:null,t>=2400?0:null]},synchronized:{value:t>=3500?2:t>=2300?1:0,reads:[t>=1700?0:null,t>=2800?1:null]},locals:[t>=3100?1:0,t>=3800?1:0],localsAreSharedTotal:false,phase:t<3100?'두 요청이 같은 0을 읽은 뒤 각각 증가시킬 수 있습니다.':t<3800?'한 번의 read-modify-write를 monitor로 묶으면 다음 요청은 갱신된 값을 읽습니다.':'공유 경쟁은 1, 직렬화한 공유 값은 2. 지역 변수의 1·1은 공유 합계가 아닙니다.'}),
  T05: (t: number) =>{const arrivals=[1700,2300,2900,3500],fixedStarts=[1700,2300,5200,5800];const make=(starts: readonly number[])=>{const arrived=arrivals.map((a,i)=>t>=a?i+1:null).filter(x=>x!==null);return{arrived,active:arrived.filter(i=>t>=starts[i-1]&&t<starts[i-1]+3500),pending:arrived.filter(i=>t<starts[i-1]),done:arrived.filter(i=>t>=starts[i-1]+3500)}};return{fixed:make(fixedStarts),cached:make(arrivals),phase:t<5200?'같은 네 작업을 fixed(2)와 cached 실행 방식으로 보냅니다.':'fixed는 두 실행 슬롯을 유지합니다. cached는 이 네 작업을 위해 필요할 때 worker를 만듭니다.'}},
  T06: (t: number) =>{const active=t>=1100&&t<2600||t>=5100&&t<5400;const dbOwner=t>=1700&&t<5400?'VT1':t>=5600&&t<8300?'VT2':null;const make=(v: 21 | 24)=>({pinned:v===21&&t>=2600&&t<5100,carrier:active?'VT1':v===21&&t>=2600&&t<5100?'VT1':v===24&&t>=3000&&t<3400?'VT2':t>=5400&&t<5800||t>=7800&&t<8300?'VT2':null,dbOwner,monitorOwner:t>=2000&&t<5300?'VT1':null,vt2:t<3000?'준비':t<5400?(v===21?'carrier 대기':'DB 획득 대기'):t<5800?'DB 획득':t<7800?'I/O 대기':t<8300?'결과 처리':'완료'});return{jdk21:make(21),jdk24:make(24),dbCapacity:1,phase:t<2600?'설명용 carrier 1개, DB connection 1개로 비교합니다.':t<5100?'JDK24는 synchronized 안의 지원되는 I/O에서도 carrier를 반납할 수 있습니다. DB connection과 monitor는 별개입니다.':'대기 시간이 사라지는 것이 아닙니다. carrier 재사용과 DB 동시성 상한을 분리합니다.'}},
  T07: (t: number) =>{const waiting=t>=2500&&t<5600,done=t>=8300;return{finished:done,virtual:{identity:'VT1',carrier:waiting||done?null:t>=5600?'carrier B':'carrier A',savedStack:waiting},coroutine:{identity:'continuation C1',worker:waiting||done?null:t>=5600?'dispatcher B':'dispatcher A',savedContinuation:waiting},blockingCallAutomaticallySuspends:false,phase:t<2500?'Virtual Thread의 Java thread 정체성과 Coroutine의 continuation을 구분합니다.':t<5600?'지원되는 블로킹 I/O와 실제 suspending 함수에서 각각 대기 상태를 보존합니다.':'이 예의 재개는 B worker를 선택했습니다. Coroutine의 일반 블로킹 호출이 자동 suspend되는 것은 아닙니다.'}},
  T08: (t: number) =>{const append=t>=3600,changed=t>=5400,addGetter=t>=7000;return{view:{listId:'L0',itemIds:append?['A0','B0']:['A0'],names:append?[changed?'changed':'A','B']:[changed?'changed':'A']},getter:{listId:'G1',itemIds:addGetter?['A0','C0']:['A0'],names:addGetter?[changed?'changed':'A','C']:[changed?'changed':'A']},shallow:{listId:'L1',itemIds:['A0'],names:[changed?'changed':'A']},deep:{listId:'L2',itemIds:['A1'],names:['A']},viewMutation:t>=6200?'UnsupportedOperationException':null,phase:t<3600?'원문 생성자는 기존 List의 수정 불가 뷰입니다. getter 복사본은 별도 List이며 Item은 공유합니다.':t<6200?'외부 List의 추가와 가변 Item 변경을 구분합니다. List 복사만으로 Item까지 복사되지 않습니다.':'이 예의 요소 복사는 name만 가진 Item을 새로 만듭니다. 실제 불변 Value Object 조건은 별도로 유지합니다.'}}
};

export type SystemModels = typeof systemModels;
export function systemState<K extends SystemFigureId>(id: K, t: number): ReturnType<SystemModels[K]> {
  return systemModels[id](t) as ReturnType<SystemModels[K]>;
}
