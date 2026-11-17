/*
 * 정보처리기사 필기 5과목 퀴즈 문제 은행 (과목당 10문제, 총 50문제)
 * - answer: choices 배열에서 정답의 인덱스(0부터)
 * - difficulty: 난이도 1(초급) · 2(중급) · 3(상급)
 * - code: 코드 출력 문제의 소스 (선택)
 * - explanation: 정답 해설. 문제를 추가할 때는 CLAUDE.md의 검증 가이드라인을 따를 것
 */
const QUESTIONS = [
  // ───────── 1과목: 소프트웨어 설계 ─────────
  {
    id: "d01", category: "design", difficulty: 2,
    question: "럼바우(Rumbaugh)의 객체지향 분석에서, 시간에 따른 객체의 상태 변화를 상태도로 표현하는 모델은?",
    choices: ["객체 모델", "동적 모델", "기능 모델", "정적 모델"],
    answer: 1,
    explanation: "럼바우 방법은 객체 모델(클래스 다이어그램), 동적 모델(상태도), 기능 모델(자료 흐름도) 3가지로 분석합니다."
  },
  {
    id: "d02", category: "design", difficulty: 2,
    question: "GoF 디자인 패턴 중 '생성 패턴'에 속하지 않는 것은?",
    choices: ["Singleton", "Factory Method", "Builder", "Adapter"],
    answer: 3,
    explanation: "Adapter는 구조 패턴입니다. 생성 패턴에는 Singleton, Factory Method, Abstract Factory, Builder, Prototype이 있습니다."
  },
  {
    id: "d03", category: "design", difficulty: 1,
    question: "UML 다이어그램 중 객체들 사이에 시간 순서에 따라 주고받는 메시지를 표현하는 것은?",
    choices: ["클래스 다이어그램", "시퀀스 다이어그램", "유스케이스 다이어그램", "컴포넌트 다이어그램"],
    answer: 1,
    explanation: "시퀀스 다이어그램은 상호작용 다이어그램의 하나로, 객체 간 메시지를 시간 흐름에 따라 나타냅니다."
  },
  {
    id: "d04", category: "design", difficulty: 2,
    question: "모듈의 응집도(Cohesion) 중 가장 강한(가장 바람직한) 것은?",
    choices: ["우연적 응집도", "논리적 응집도", "시간적 응집도", "기능적 응집도"],
    answer: 3,
    explanation: "응집도 강도: 기능적 > 순차적 > 교환(통신)적 > 절차적 > 시간적 > 논리적 > 우연적 순입니다."
  },
  {
    id: "d05", category: "design", difficulty: 2,
    question: "모듈의 결합도(Coupling) 중 가장 약한(가장 바람직한) 것은?",
    choices: ["내용 결합도", "공통 결합도", "외부 결합도", "자료 결합도"],
    answer: 3,
    explanation: "결합도 강도: 내용 > 공통 > 외부 > 제어 > 스탬프 > 자료 순입니다. 자료 결합도가 가장 약합니다."
  },
  {
    id: "d06", category: "design", difficulty: 2,
    question: "요구사항 개발 프로세스를 올바른 순서로 나열한 것은?",
    choices: [
      "도출 → 분석 → 명세 → 확인",
      "분석 → 도출 → 명세 → 확인",
      "도출 → 명세 → 분석 → 확인",
      "명세 → 도출 → 분석 → 확인"
    ],
    answer: 0,
    explanation: "요구사항 개발은 도출(Elicitation) → 분석(Analysis) → 명세(Specification) → 확인(Validation) 순서로 진행합니다."
  },

  // ───────── 2과목: 소프트웨어 개발 ─────────
  {
    id: "v01", category: "develop", difficulty: 2,
    question: "다음 중 블랙박스 테스트 기법이 아닌 것은?",
    choices: ["동치 분할", "경계값 분석", "원인-결과 그래프", "기초 경로 검사"],
    answer: 3,
    explanation: "기초 경로 검사(Basis Path Testing)는 프로그램 내부 구조를 보는 화이트박스 테스트 기법입니다."
  },
  {
    id: "v02", category: "develop", difficulty: 2,
    question: "소프트웨어 개발 생명주기 모형 중 '위험 분석'을 반복 주기마다 포함하는 것은?",
    choices: ["폭포수 모형", "프로토타입 모형", "나선형 모형", "V 모형"],
    answer: 2,
    explanation: "보엠(Boehm)이 제안한 나선형 모형은 계획 수립 → 위험 분석 → 개발 → 고객 평가를 반복합니다."
  },
  {
    id: "v03", category: "develop", difficulty: 2,
    question: "최악의 경우에도 시간 복잡도가 O(n log n)인 정렬 알고리즘은?",
    choices: ["버블 정렬", "삽입 정렬", "선택 정렬", "합병(병합) 정렬"],
    answer: 3,
    explanation: "버블·삽입·선택 정렬은 최악 O(n²)입니다. 합병 정렬은 최선·평균·최악 모두 O(n log n)입니다."
  },
  {
    id: "v04", category: "develop", difficulty: 3,
    question: "루트 A의 왼쪽 자식이 B, 오른쪽 자식이 C이고, B의 왼쪽 자식이 D, 오른쪽 자식이 E인 이진 트리를 후위 순회(Postorder)한 결과는?",
    choices: ["A B D E C", "D B E A C", "D E B C A", "A B C D E"],
    answer: 2,
    explanation: "후위 순회는 왼쪽 → 오른쪽 → 루트 순입니다. 따라서 D E B C A입니다. (전위: A B D E C, 중위: D B E A C)"
  },
  {
    id: "v05", category: "develop", difficulty: 1,
    question: "개발자 없이 실제 사용자 환경에서 사용자가 직접 수행하는 시험 방식은?",
    choices: ["알파 테스트", "베타 테스트", "단위 테스트", "회귀 테스트"],
    answer: 1,
    explanation: "알파 테스트는 개발 환경에서 개발자 앞에서 진행하고, 베타 테스트는 사용자 환경에서 개발자 없이 진행합니다."
  },
  {
    id: "v06", category: "develop", difficulty: 1,
    question: "공백 스택에 A, B, C를 차례로 삽입(push)한 뒤 삭제(pop)를 한 번 수행하면 삭제되는 원소는?",
    choices: ["A", "B", "C", "모두 삭제된다"],
    answer: 2,
    explanation: "스택은 후입선출(LIFO) 구조라서 가장 나중에 넣은 C가 먼저 나옵니다."
  },

  // ───────── 3과목: 데이터베이스 구축 ─────────
  {
    id: "b01", category: "database", difficulty: 1,
    question: "정규화를 하지 않았을 때 발생하는 이상(Anomaly) 현상에 속하지 않는 것은?",
    choices: ["삽입 이상", "삭제 이상", "갱신 이상", "조회 이상"],
    answer: 3,
    explanation: "이상 현상은 삽입·삭제·갱신 이상 3가지입니다. '조회 이상'이라는 이상 현상은 없습니다."
  },
  {
    id: "b02", category: "database", difficulty: 2,
    question: "부분 함수 종속을 제거하여 만드는 정규형은?",
    choices: ["제1정규형", "제2정규형", "제3정규형", "BCNF"],
    answer: 1,
    explanation: "제1정규형은 원자값, 제2정규형은 부분 함수 종속 제거, 제3정규형은 이행 함수 종속 제거, BCNF는 결정자이면서 후보키가 아닌 것을 제거합니다."
  },
  {
    id: "b03", category: "database", difficulty: 1,
    question: "다음 SQL 명령 중 DCL(데이터 제어어)에 속하는 것은?",
    choices: ["CREATE", "INSERT", "GRANT", "UPDATE"],
    answer: 2,
    explanation: "DCL에는 GRANT, REVOKE(권한), COMMIT, ROLLBACK(트랜잭션 제어) 등이 있습니다. CREATE는 DDL, INSERT·UPDATE는 DML입니다."
  },
  {
    id: "b04", category: "database", difficulty: 1,
    question: "트랜잭션의 ACID 특성 중, 트랜잭션의 연산이 모두 완전히 수행되거나 전혀 수행되지 않아야 한다는 성질은?",
    choices: ["원자성(Atomicity)", "일관성(Consistency)", "격리성(Isolation)", "영속성(Durability)"],
    answer: 0,
    explanation: "원자성은 All or Nothing 성질입니다. 중간에 실패하면 이미 수행한 연산도 모두 취소(Rollback)됩니다."
  },
  {
    id: "b05", category: "database", difficulty: 2,
    question: "후보키 중에서 기본키로 선택되지 않은 나머지 키를 무엇이라 하는가?",
    choices: ["대체키", "외래키", "슈퍼키", "복합키"],
    answer: 0,
    explanation: "후보키 중 기본키가 되고 남은 키가 대체키(Alternate Key)입니다."
  },
  {
    id: "b06", category: "database", difficulty: 1,
    question: "SQL에서 GROUP BY로 그룹화한 결과에 조건을 지정할 때 사용하는 절은?",
    choices: ["WHERE", "HAVING", "ORDER BY", "DISTINCT"],
    answer: 1,
    explanation: "WHERE는 그룹화 전 행을 거르고, HAVING은 그룹화 후 그룹을 거릅니다."
  },

  // ───────── 4과목: 프로그래밍 언어 활용 ─────────
  {
    id: "p01", category: "language", difficulty: 1,
    question: "다음 C 프로그램의 출력 결과는?",
    code: "#include <stdio.h>\nint main(void) {\n    int a = 10, b = 3;\n    printf(\"%d %d\", a / b, a % b);\n    return 0;\n}",
    choices: ["3 1", "3.33 1", "1 3", "3 3"],
    answer: 0,
    explanation: "정수끼리의 나눗셈이므로 10 / 3 = 3(소수점 버림), 10 % 3 = 1(나머지)입니다."
  },
  {
    id: "p02", category: "language", difficulty: 1,
    question: "상위 클래스에 정의된 메서드를 하위 클래스에서 같은 이름·같은 매개변수로 다시 정의하는 것을 무엇이라 하는가?",
    choices: ["오버로딩(Overloading)", "오버라이딩(Overriding)", "캡슐화(Encapsulation)", "추상화(Abstraction)"],
    answer: 1,
    explanation: "재정의는 오버라이딩, 같은 이름에 매개변수만 다르게 여러 개 정의하는 것은 오버로딩입니다."
  },
  {
    id: "p03", category: "language", difficulty: 1,
    question: "다음 Python 코드의 출력 결과는?",
    code: "a = [1, 2, 3, 4, 5]\nprint(a[1:4])",
    choices: ["[1, 2, 3, 4]", "[2, 3, 4]", "[2, 3, 4, 5]", "[1, 2, 3]"],
    answer: 1,
    explanation: "슬라이싱 a[1:4]는 인덱스 1 이상 4 미만이므로 인덱스 1, 2, 3의 값인 [2, 3, 4]입니다."
  },
  {
    id: "p04", category: "language", difficulty: 2,
    question: "운영체제에서 교착상태(Deadlock)가 발생하기 위한 필요조건이 아닌 것은?",
    choices: ["상호 배제", "점유와 대기", "선점", "환형 대기"],
    answer: 2,
    explanation: "4가지 필요조건은 상호 배제, 점유와 대기, 비선점, 환형 대기입니다. '선점'이 가능하면 교착상태가 풀립니다."
  },
  {
    id: "p05", category: "language", difficulty: 2,
    question: "시분할 시스템을 위해 고안된 선점형 프로세스 스케줄링 방식은?",
    choices: ["FCFS", "SJF", "라운드 로빈(RR)", "HRN"],
    answer: 2,
    explanation: "라운드 로빈은 각 프로세스에 일정한 시간 할당량을 주고 돌아가며 실행하는 선점형 방식입니다. FCFS·SJF·HRN은 비선점형입니다."
  },
  {
    id: "p06", category: "language", difficulty: 3,
    question: "다음 Java 코드의 출력 결과는? (문자 'b'의 아스키 코드는 98)",
    code: "public class Main {\n    public static void main(String[] args) {\n        String s = \"abc\";\n        System.out.println(s.length() + s.charAt(1));\n    }\n}",
    choices: ["3b", "101", "99", "컴파일 오류"],
    answer: 1,
    explanation: "int(3)와 char('b')를 더하면 char가 정수 98로 승격되어 3 + 98 = 101이 출력됩니다. 문자열 연결이 아닙니다."
  },

  // ───────── 5과목: 정보시스템 구축관리 ─────────
  {
    id: "s01", category: "system", difficulty: 2,
    question: "소프트웨어 비용 산정 모형인 COCOMO의 프로젝트 유형이 아닌 것은?",
    choices: ["조직형(Organic)", "반분리형(Semi-detached)", "내장형(Embedded)", "단순형(Simple)"],
    answer: 3,
    explanation: "COCOMO는 프로젝트 규모와 복잡도에 따라 조직형, 반분리형, 내장형 3가지로 구분합니다."
  },
  {
    id: "s02", category: "system", difficulty: 1,
    question: "다음 중 대칭키 암호 알고리즘은?",
    choices: ["RSA", "ECC", "AES", "Diffie-Hellman"],
    answer: 2,
    explanation: "AES는 암호화와 복호화에 같은 키를 쓰는 대칭키 방식입니다. RSA, ECC는 공개키(비대칭키) 방식이며, Diffie-Hellman은 키 교환 알고리즘입니다."
  },
  {
    id: "s03", category: "system", difficulty: 1,
    question: "여러 대의 감염된 시스템을 이용해 대량의 트래픽을 보내 대상 서버의 서비스를 마비시키는 공격은?",
    choices: ["DDoS", "스니핑", "피싱", "키로깅"],
    answer: 0,
    explanation: "DDoS(분산 서비스 거부) 공격입니다. 스니핑은 패킷 엿보기, 피싱은 가짜 사이트로 정보 탈취, 키로깅은 키 입력 기록입니다."
  },
  {
    id: "s04", category: "system", difficulty: 1,
    question: "정보 보안의 3요소 중, 인가된 사용자가 필요할 때 정보와 시스템에 접근할 수 있도록 보장하는 것은?",
    choices: ["기밀성", "무결성", "가용성", "부인방지"],
    answer: 2,
    explanation: "정보 보안 3요소는 기밀성(Confidentiality), 무결성(Integrity), 가용성(Availability)이며, 접근 보장은 가용성입니다."
  },
  {
    id: "s05", category: "system", difficulty: 2,
    question: "PERT/CPM에서 프로젝트 완료까지 걸리는 시간을 결정하는, 가장 긴 소요 시간의 경로는?",
    choices: ["최단 경로", "임계 경로", "여유 경로", "병렬 경로"],
    answer: 1,
    explanation: "임계 경로(Critical Path)는 시작부터 종료까지 소요 시간이 가장 긴 경로로, 여유 시간이 0이며 지연되면 전체 일정이 늦어집니다."
  },
  {
    id: "s06", category: "system", difficulty: 2,
    question: "클라우드 서비스 모델 중, 사용자가 애플리케이션을 개발·배포할 수 있는 플랫폼을 제공하는 것은?",
    choices: ["IaaS", "PaaS", "SaaS", "DaaS"],
    answer: 1,
    explanation: "IaaS는 인프라(서버·저장소), PaaS는 개발 플랫폼, SaaS는 완성된 소프트웨어를 서비스로 제공합니다."
  },

  // ───────── 추가 문제 (과목당 4문제). 코드 문제는 gcc·javac·python으로 실행해 정답 확인 ─────────
  {
    id: "d07", category: "design", difficulty: 1,
    question: "객체지향의 특징 중, 같은 메시지를 받아도 객체(클래스)에 따라 서로 다르게 동작하는 성질은?",
    choices: ["캡슐화", "상속", "다형성", "추상화"],
    answer: 2,
    explanation: "다형성(Polymorphism)은 하나의 메시지(메서드 호출)에 대해 객체가 속한 클래스에 따라 다른 방식으로 응답하는 성질입니다. 오버라이딩·오버로딩으로 구현됩니다."
  },
  {
    id: "d08", category: "design", difficulty: 2,
    question: "UML 클래스 간 관계 중 '전체-부분' 관계이면서, 전체 객체가 사라지면 부분 객체도 함께 사라지는 관계는?",
    choices: ["합성(Composition)", "집약(Aggregation)", "일반화(Generalization)", "의존(Dependency)"],
    answer: 0,
    explanation: "합성은 부분이 전체에 생명주기를 의존하는 강한 전체-부분 관계입니다. 집약은 부분이 전체와 별도로 존재할 수 있는 약한 관계입니다."
  },
  {
    id: "d09", category: "design", difficulty: 1,
    question: "객체지향 설계 원칙 SOLID 중 'S'에 해당하는 것은?",
    choices: ["개방-폐쇄 원칙", "단일 책임 원칙", "리스코프 치환 원칙", "인터페이스 분리 원칙"],
    answer: 1,
    explanation: "SOLID의 S는 단일 책임 원칙(Single Responsibility Principle)으로, 클래스는 변경 이유가 하나뿐이어야 한다는 원칙입니다."
  },
  {
    id: "d10", category: "design", difficulty: 1,
    question: "MVC 패턴에서 사용자에게 화면을 보여 주는 인터페이스를 담당하는 구성 요소는?",
    choices: ["Model", "Controller", "View", "Observer"],
    answer: 2,
    explanation: "Model은 데이터와 비즈니스 로직, View는 화면 출력, Controller는 사용자 입력을 받아 Model과 View를 연결하는 역할을 합니다."
  },

  {
    id: "v07", category: "develop", difficulty: 1,
    question: "프로그램을 실행하지 않고 소스 코드를 검토(코드 리뷰, 정적 분석 등)하여 결함을 찾는 테스트는?",
    choices: ["동적 테스트", "회귀 테스트", "인수 테스트", "정적 테스트"],
    answer: 3,
    explanation: "정적 테스트는 코드를 실행하지 않고 검토·분석으로 결함을 찾습니다. 동적 테스트는 코드를 실행하며 동작을 확인합니다."
  },
  {
    id: "v08", category: "develop", difficulty: 3,
    question: "화이트박스 테스트에서, 프로그램의 각 분기(결정) 지점이 참과 거짓의 결과를 모두 한 번 이상 갖도록 테스트 케이스를 설계하는 기준은?",
    choices: ["구문(문장) 커버리지", "결정(분기) 커버리지", "경로 커버리지", "조건 커버리지"],
    answer: 1,
    explanation: "결정(분기) 커버리지는 각 결정문의 전체 결과가 참·거짓을 한 번씩 갖도록 합니다. 구문 커버리지는 모든 문장 실행, 경로 커버리지는 모든 경로 실행이 기준입니다."
  },
  {
    id: "v09", category: "develop", difficulty: 1,
    question: "공백 큐(Queue)에 A, B, C를 차례로 삽입(enqueue)한 뒤 삭제(dequeue)를 한 번 수행하면 삭제되는 원소는?",
    choices: ["A", "B", "C", "알 수 없다"],
    answer: 0,
    explanation: "큐는 먼저 들어간 것이 먼저 나오는 FIFO 구조이므로 가장 먼저 삽입한 A가 삭제됩니다. (스택은 LIFO)"
  },
  {
    id: "v10", category: "develop", difficulty: 2,
    question: "정렬되어 있는 n개의 데이터에서 이진 탐색(Binary Search)의 최악 시간 복잡도는?",
    choices: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
    answer: 1,
    explanation: "이진 탐색은 한 번 비교할 때마다 탐색 범위가 절반으로 줄어 최악의 경우에도 O(log n)입니다."
  },

  {
    id: "b07", category: "database", difficulty: 2,
    question: "관계 대수 연산 중, 릴레이션에서 조건을 만족하는 튜플(행)을 선택하는 연산자는?",
    choices: ["프로젝트(π)", "조인(⋈)", "셀렉트(σ)", "디비전(÷)"],
    answer: 2,
    explanation: "셀렉트(σ)는 조건에 맞는 행(튜플)을 고르고, 프로젝트(π)는 필요한 열(속성)만 고릅니다."
  },
  {
    id: "b08", category: "database", difficulty: 1,
    question: "SQL의 SELECT 문에서 중복된 결과 행을 제거하고 조회할 때 사용하는 키워드는?",
    choices: ["UNIQUE", "SINGLE", "ONLY", "DISTINCT"],
    answer: 3,
    explanation: "SELECT DISTINCT 컬럼 … 형태로 중복 행을 제거합니다. UNIQUE는 조회 키워드가 아니라 중복을 막는 제약조건입니다."
  },
  {
    id: "b09", category: "database", difficulty: 1,
    question: "두 테이블을 조인할 때, 조인 조건이 양쪽 테이블 모두에서 일치하는 행만 결과로 반환하는 조인은?",
    choices: ["LEFT OUTER JOIN", "FULL OUTER JOIN", "INNER JOIN", "CROSS JOIN"],
    answer: 2,
    explanation: "INNER JOIN은 조건이 일치하는 행만 반환합니다. OUTER JOIN은 일치하지 않는 행도(한쪽 또는 양쪽) 포함하고, CROSS JOIN은 모든 조합을 만듭니다."
  },
  {
    id: "b10", category: "database", difficulty: 1,
    question: "다른 릴레이션의 기본키를 참조하는 속성으로, 참조 무결성을 유지하는 데 사용하는 키는?",
    choices: ["기본키", "외래키", "대체키", "슈퍼키"],
    answer: 1,
    explanation: "외래키(Foreign Key)는 다른 릴레이션의 기본키를 참조하며, 참조 무결성 제약조건의 대상이 됩니다."
  },

  {
    id: "p07", category: "language", difficulty: 2,
    question: "다음 C 프로그램의 출력 결과는?",
    code: "#include <stdio.h>\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 5; i++) {\n        if (i % 2 == 0) continue;\n        sum += i;\n    }\n    printf(\"%d\", sum);\n    return 0;\n}",
    choices: ["6", "15", "12", "9"],
    answer: 3,
    explanation: "i가 짝수이면 continue로 건너뛰므로 홀수 1, 3, 5만 더해 9가 출력됩니다."
  },
  {
    id: "p08", category: "language", difficulty: 2,
    question: "다음 Python 코드의 출력 결과는?",
    code: "nums = [1, 2, 3, 4, 5, 6]\nprint([n * n for n in nums if n % 2 == 0])",
    choices: ["[1, 9, 25]", "[2, 4, 6]", "[4, 16, 36]", "[1, 4, 9, 16, 25, 36]"],
    answer: 2,
    explanation: "리스트 컴프리헨션은 조건(n % 2 == 0)을 만족하는 짝수 2, 4, 6만 골라 제곱하므로 [4, 16, 36]입니다. (Python 3.13으로 실행해 확인)"
  },
  {
    id: "p09", category: "language", difficulty: 1,
    question: "다음 Java 코드의 출력 결과는?",
    code: "int x = 10;\nint y = 3;\nSystem.out.println(x / y + \" \" + x % y);",
    choices: ["3 1", "3.33 1", "3 3", "1 3"],
    answer: 0,
    explanation: "정수끼리의 나눗셈 10 / 3은 몫 3, 나머지 연산 10 % 3은 1이므로 \"3 1\"이 출력됩니다."
  },
  {
    id: "p10", category: "language", difficulty: 2,
    question: "페이지 교체 알고리즘 중, 가장 오랫동안 참조되지 않은 페이지를 교체 대상으로 선택하는 방식은?",
    choices: ["LRU", "FIFO", "LFU", "OPT"],
    answer: 0,
    explanation: "LRU(Least Recently Used)는 가장 오래전에 사용된 페이지를 교체합니다. FIFO는 가장 먼저 들어온 페이지, LFU는 참조 횟수가 가장 적은 페이지를 교체합니다."
  },

  {
    id: "s07", category: "system", difficulty: 1,
    question: "'공정과 도구보다 개인과 상호작용', '계획을 따르기보다 변화에 대응하기'를 가치로 내세운 소프트웨어 개발 방법론은?",
    choices: ["애자일(Agile)", "폭포수 모형", "프로토타입 모형", "나선형 모형"],
    answer: 0,
    explanation: "애자일 소프트웨어 개발 선언의 4가지 가치에 해당하며, 짧은 주기의 반복 개발과 고객 협업을 강조합니다. 대표적으로 스크럼, XP가 있습니다."
  },
  {
    id: "s08", category: "system", difficulty: 1,
    question: "공격자가 웹 페이지에 악성 스크립트를 삽입해, 다른 사용자의 브라우저에서 그 스크립트가 실행되게 하는 공격은?",
    choices: ["SQL Injection", "Ping of Death", "Sniffing", "XSS"],
    answer: 3,
    explanation: "XSS(Cross-Site Scripting)는 게시글 등에 악성 스크립트를 심어 방문자의 브라우저에서 실행시키는 공격입니다. 출력 시 입력값을 이스케이프하여 방어합니다."
  },
  {
    id: "s09", category: "system", difficulty: 2,
    question: "OSI 7계층 중 논리 주소(IP) 지정과 경로 설정(라우팅)을 담당하는 계층은?",
    choices: ["데이터 링크 계층", "네트워크 계층", "전송 계층", "세션 계층"],
    answer: 1,
    explanation: "네트워크 계층(3계층)이 IP 주소와 라우팅을 담당합니다. 데이터 링크 계층은 MAC 주소 기반 전달, 전송 계층은 종단 간 신뢰성 있는 전송(TCP/UDP)을 맡습니다."
  },
  {
    id: "s10", category: "system", difficulty: 1,
    question: "다음 중 분산 버전 관리 시스템에 해당하는 것은?",
    choices: ["Git", "CVS", "RCS", "Subversion(SVN)"],
    answer: 0,
    explanation: "Git은 모든 작업자가 저장소 전체 이력을 복제해 가지는 분산 방식입니다. CVS와 Subversion은 중앙 저장소 방식이고, RCS는 개별 파일 단위 관리 도구입니다."
  }
];

const DIFFICULTIES = { 1: "초급", 2: "중급", 3: "상급" };

const CATEGORIES = {
  design:   { name: "소프트웨어 설계",     short: "설계" },
  develop:  { name: "소프트웨어 개발",     short: "개발" },
  database: { name: "데이터베이스 구축",   short: "DB" },
  language: { name: "프로그래밍 언어 활용", short: "언어" },
  system:   { name: "정보시스템 구축관리", short: "구축관리" }
};

if (typeof module !== "undefined") module.exports = { QUESTIONS, CATEGORIES, DIFFICULTIES };
