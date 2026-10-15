/*
 * 정보처리기사 필기 5과목 퀴즈 문제 은행 (과목당 6문제, 총 30문제)
 * - answer: choices 배열에서 정답의 인덱스(0부터)
 * - code: 코드 출력 문제의 소스 (선택)
 * - explanation: 정답 해설. 문제를 추가할 때는 CLAUDE.md의 검증 가이드라인을 따를 것
 */
const QUESTIONS = [
  // ───────── 1과목: 소프트웨어 설계 ─────────
  {
    id: "d01", category: "design",
    question: "럼바우(Rumbaugh)의 객체지향 분석에서, 시간에 따른 객체의 상태 변화를 상태도로 표현하는 모델은?",
    choices: ["객체 모델", "동적 모델", "기능 모델", "정적 모델"],
    answer: 1,
    explanation: "럼바우 방법은 객체 모델(클래스 다이어그램), 동적 모델(상태도), 기능 모델(자료 흐름도) 3가지로 분석합니다."
  },
  {
    id: "d02", category: "design",
    question: "GoF 디자인 패턴 중 '생성 패턴'에 속하지 않는 것은?",
    choices: ["Singleton", "Factory Method", "Builder", "Adapter"],
    answer: 3,
    explanation: "Adapter는 구조 패턴입니다. 생성 패턴에는 Singleton, Factory Method, Abstract Factory, Builder, Prototype이 있습니다."
  },
  {
    id: "d03", category: "design",
    question: "UML 다이어그램 중 객체들 사이에 시간 순서에 따라 주고받는 메시지를 표현하는 것은?",
    choices: ["클래스 다이어그램", "시퀀스 다이어그램", "유스케이스 다이어그램", "컴포넌트 다이어그램"],
    answer: 1,
    explanation: "시퀀스 다이어그램은 상호작용 다이어그램의 하나로, 객체 간 메시지를 시간 흐름에 따라 나타냅니다."
  },
  {
    id: "d04", category: "design",
    question: "모듈의 응집도(Cohesion) 중 가장 강한(가장 바람직한) 것은?",
    choices: ["우연적 응집도", "논리적 응집도", "시간적 응집도", "기능적 응집도"],
    answer: 3,
    explanation: "응집도 강도: 기능적 > 순차적 > 교환(통신)적 > 절차적 > 시간적 > 논리적 > 우연적 순입니다."
  },
  {
    id: "d05", category: "design",
    question: "모듈의 결합도(Coupling) 중 가장 약한(가장 바람직한) 것은?",
    choices: ["내용 결합도", "공통 결합도", "외부 결합도", "자료 결합도"],
    answer: 3,
    explanation: "결합도 강도: 내용 > 공통 > 외부 > 제어 > 스탬프 > 자료 순입니다. 자료 결합도가 가장 약합니다."
  },
  {
    id: "d06", category: "design",
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
    id: "v01", category: "develop",
    question: "다음 중 블랙박스 테스트 기법이 아닌 것은?",
    choices: ["동치 분할", "경계값 분석", "원인-결과 그래프", "기초 경로 검사"],
    answer: 3,
    explanation: "기초 경로 검사(Basis Path Testing)는 프로그램 내부 구조를 보는 화이트박스 테스트 기법입니다."
  },
  {
    id: "v02", category: "develop",
    question: "소프트웨어 개발 생명주기 모형 중 '위험 분석'을 반복 주기마다 포함하는 것은?",
    choices: ["폭포수 모형", "프로토타입 모형", "나선형 모형", "V 모형"],
    answer: 2,
    explanation: "보엠(Boehm)이 제안한 나선형 모형은 계획 수립 → 위험 분석 → 개발 → 고객 평가를 반복합니다."
  },
  {
    id: "v03", category: "develop",
    question: "최악의 경우에도 시간 복잡도가 O(n log n)인 정렬 알고리즘은?",
    choices: ["버블 정렬", "삽입 정렬", "선택 정렬", "합병(병합) 정렬"],
    answer: 3,
    explanation: "버블·삽입·선택 정렬은 최악 O(n²)입니다. 합병 정렬은 최선·평균·최악 모두 O(n log n)입니다."
  },
  {
    id: "v04", category: "develop",
    question: "루트 A의 왼쪽 자식이 B, 오른쪽 자식이 C이고, B의 왼쪽 자식이 D, 오른쪽 자식이 E인 이진 트리를 후위 순회(Postorder)한 결과는?",
    choices: ["A B D E C", "D B E A C", "D E B C A", "A B C D E"],
    answer: 2,
    explanation: "후위 순회는 왼쪽 → 오른쪽 → 루트 순입니다. 따라서 D E B C A입니다. (전위: A B D E C, 중위: D B E A C)"
  },
  {
    id: "v05", category: "develop",
    question: "개발자 없이 실제 사용자 환경에서 사용자가 직접 수행하는 시험 방식은?",
    choices: ["알파 테스트", "베타 테스트", "단위 테스트", "회귀 테스트"],
    answer: 1,
    explanation: "알파 테스트는 개발 환경에서 개발자 앞에서 진행하고, 베타 테스트는 사용자 환경에서 개발자 없이 진행합니다."
  },
  {
    id: "v06", category: "develop",
    question: "공백 스택에 A, B, C를 차례로 삽입(push)한 뒤 삭제(pop)를 한 번 수행하면 삭제되는 원소는?",
    choices: ["A", "B", "C", "모두 삭제된다"],
    answer: 2,
    explanation: "스택은 후입선출(LIFO) 구조라서 가장 나중에 넣은 C가 먼저 나옵니다."
  },

  // ───────── 3과목: 데이터베이스 구축 ─────────
  {
    id: "b01", category: "database",
    question: "정규화를 하지 않았을 때 발생하는 이상(Anomaly) 현상에 속하지 않는 것은?",
    choices: ["삽입 이상", "삭제 이상", "갱신 이상", "조회 이상"],
    answer: 3,
    explanation: "이상 현상은 삽입·삭제·갱신 이상 3가지입니다. '조회 이상'이라는 이상 현상은 없습니다."
  },
  {
    id: "b02", category: "database",
    question: "부분 함수 종속을 제거하여 만드는 정규형은?",
    choices: ["제1정규형", "제2정규형", "제3정규형", "BCNF"],
    answer: 1,
    explanation: "제1정규형은 원자값, 제2정규형은 부분 함수 종속 제거, 제3정규형은 이행 함수 종속 제거, BCNF는 결정자이면서 후보키가 아닌 것을 제거합니다."
  },
  {
    id: "b03", category: "database",
    question: "다음 SQL 명령 중 DCL(데이터 제어어)에 속하는 것은?",
    choices: ["CREATE", "INSERT", "GRANT", "UPDATE"],
    answer: 2,
    explanation: "DCL에는 GRANT, REVOKE(권한), COMMIT, ROLLBACK(트랜잭션 제어) 등이 있습니다. CREATE는 DDL, INSERT·UPDATE는 DML입니다."
  },
  {
    id: "b04", category: "database",
    question: "트랜잭션의 ACID 특성 중, 트랜잭션의 연산이 모두 완전히 수행되거나 전혀 수행되지 않아야 한다는 성질은?",
    choices: ["원자성(Atomicity)", "일관성(Consistency)", "격리성(Isolation)", "영속성(Durability)"],
    answer: 0,
    explanation: "원자성은 All or Nothing 성질입니다. 중간에 실패하면 이미 수행한 연산도 모두 취소(Rollback)됩니다."
  },
  {
    id: "b05", category: "database",
    question: "후보키 중에서 기본키로 선택되지 않은 나머지 키를 무엇이라 하는가?",
    choices: ["대체키", "외래키", "슈퍼키", "복합키"],
    answer: 0,
    explanation: "후보키 중 기본키가 되고 남은 키가 대체키(Alternate Key)입니다."
  },
  {
    id: "b06", category: "database",
    question: "SQL에서 GROUP BY로 그룹화한 결과에 조건을 지정할 때 사용하는 절은?",
    choices: ["WHERE", "HAVING", "ORDER BY", "DISTINCT"],
    answer: 1,
    explanation: "WHERE는 그룹화 전 행을 거르고, HAVING은 그룹화 후 그룹을 거릅니다."
  },

  // ───────── 4과목: 프로그래밍 언어 활용 ─────────
  {
    id: "p01", category: "language",
    question: "다음 C 프로그램의 출력 결과는?",
    code: "#include <stdio.h>\nint main(void) {\n    int a = 10, b = 3;\n    printf(\"%d %d\", a / b, a % b);\n    return 0;\n}",
    choices: ["3 1", "3.33 1", "1 3", "3 3"],
    answer: 0,
    explanation: "정수끼리의 나눗셈이므로 10 / 3 = 3(소수점 버림), 10 % 3 = 1(나머지)입니다."
  },
  {
    id: "p02", category: "language",
    question: "상위 클래스에 정의된 메서드를 하위 클래스에서 같은 이름·같은 매개변수로 다시 정의하는 것을 무엇이라 하는가?",
    choices: ["오버로딩(Overloading)", "오버라이딩(Overriding)", "캡슐화(Encapsulation)", "추상화(Abstraction)"],
    answer: 1,
    explanation: "재정의는 오버라이딩, 같은 이름에 매개변수만 다르게 여러 개 정의하는 것은 오버로딩입니다."
  },
  {
    id: "p03", category: "language",
    question: "다음 Python 코드의 출력 결과는?",
    code: "a = [1, 2, 3, 4, 5]\nprint(a[1:4])",
    choices: ["[1, 2, 3, 4]", "[2, 3, 4]", "[2, 3, 4, 5]", "[1, 2, 3]"],
    answer: 1,
    explanation: "슬라이싱 a[1:4]는 인덱스 1 이상 4 미만이므로 인덱스 1, 2, 3의 값인 [2, 3, 4]입니다."
  },
  {
    id: "p04", category: "language",
    question: "운영체제에서 교착상태(Deadlock)가 발생하기 위한 필요조건이 아닌 것은?",
    choices: ["상호 배제", "점유와 대기", "선점", "환형 대기"],
    answer: 2,
    explanation: "4가지 필요조건은 상호 배제, 점유와 대기, 비선점, 환형 대기입니다. '선점'이 가능하면 교착상태가 풀립니다."
  },
  {
    id: "p05", category: "language",
    question: "시분할 시스템을 위해 고안된 선점형 프로세스 스케줄링 방식은?",
    choices: ["FCFS", "SJF", "라운드 로빈(RR)", "HRN"],
    answer: 2,
    explanation: "라운드 로빈은 각 프로세스에 일정한 시간 할당량을 주고 돌아가며 실행하는 선점형 방식입니다. FCFS·SJF·HRN은 비선점형입니다."
  },
  {
    id: "p06", category: "language",
    question: "다음 Java 코드의 출력 결과는? (문자 'b'의 아스키 코드는 98)",
    code: "public class Main {\n    public static void main(String[] args) {\n        String s = \"abc\";\n        System.out.println(s.length() + s.charAt(1));\n    }\n}",
    choices: ["3b", "101", "99", "컴파일 오류"],
    answer: 1,
    explanation: "int(3)와 char('b')를 더하면 char가 정수 98로 승격되어 3 + 98 = 101이 출력됩니다. 문자열 연결이 아닙니다."
  },

  // ───────── 5과목: 정보시스템 구축관리 ─────────
  {
    id: "s01", category: "system",
    question: "소프트웨어 비용 산정 모형인 COCOMO의 프로젝트 유형이 아닌 것은?",
    choices: ["조직형(Organic)", "반분리형(Semi-detached)", "내장형(Embedded)", "단순형(Simple)"],
    answer: 3,
    explanation: "COCOMO는 프로젝트 규모와 복잡도에 따라 조직형, 반분리형, 내장형 3가지로 구분합니다."
  },
  {
    id: "s02", category: "system",
    question: "다음 중 대칭키 암호 알고리즘은?",
    choices: ["RSA", "ECC", "AES", "Diffie-Hellman"],
    answer: 2,
    explanation: "AES는 암호화와 복호화에 같은 키를 쓰는 대칭키 방식입니다. RSA, ECC는 공개키(비대칭키) 방식이며, Diffie-Hellman은 키 교환 알고리즘입니다."
  },
  {
    id: "s03", category: "system",
    question: "여러 대의 감염된 시스템을 이용해 대량의 트래픽을 보내 대상 서버의 서비스를 마비시키는 공격은?",
    choices: ["DDoS", "스니핑", "피싱", "키로깅"],
    answer: 0,
    explanation: "DDoS(분산 서비스 거부) 공격입니다. 스니핑은 패킷 엿보기, 피싱은 가짜 사이트로 정보 탈취, 키로깅은 키 입력 기록입니다."
  },
  {
    id: "s04", category: "system",
    question: "정보 보안의 3요소 중, 인가된 사용자가 필요할 때 정보와 시스템에 접근할 수 있도록 보장하는 것은?",
    choices: ["기밀성", "무결성", "가용성", "부인방지"],
    answer: 2,
    explanation: "정보 보안 3요소는 기밀성(Confidentiality), 무결성(Integrity), 가용성(Availability)이며, 접근 보장은 가용성입니다."
  },
  {
    id: "s05", category: "system",
    question: "PERT/CPM에서 프로젝트 완료까지 걸리는 시간을 결정하는, 가장 긴 소요 시간의 경로는?",
    choices: ["최단 경로", "임계 경로", "여유 경로", "병렬 경로"],
    answer: 1,
    explanation: "임계 경로(Critical Path)는 시작부터 종료까지 소요 시간이 가장 긴 경로로, 여유 시간이 0이며 지연되면 전체 일정이 늦어집니다."
  },
  {
    id: "s06", category: "system",
    question: "클라우드 서비스 모델 중, 사용자가 애플리케이션을 개발·배포할 수 있는 플랫폼을 제공하는 것은?",
    choices: ["IaaS", "PaaS", "SaaS", "DaaS"],
    answer: 1,
    explanation: "IaaS는 인프라(서버·저장소), PaaS는 개발 플랫폼, SaaS는 완성된 소프트웨어를 서비스로 제공합니다."
  }
];

const CATEGORIES = {
  design:   { name: "소프트웨어 설계",     short: "설계" },
  develop:  { name: "소프트웨어 개발",     short: "개발" },
  database: { name: "데이터베이스 구축",   short: "DB" },
  language: { name: "프로그래밍 언어 활용", short: "언어" },
  system:   { name: "정보시스템 구축관리", short: "구축관리" }
};

if (typeof module !== "undefined") module.exports = { QUESTIONS, CATEGORIES };
