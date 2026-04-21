# 서대전여고 스마트 시간표 시스템 — claude.md

> AI 코딩 어시스턴트가 이 프로젝트의 맥락을 즉시 파악하기 위한 핵심 참조 문서입니다.

---

## 1. 프로젝트 개요

**학교명:** 서대전여자고등학교  
**목적:** 교사들이 시간표를 조회하고, 수업 교체 / 보강 / 자습 / 합반(통합)을 처리할 수 있는 교무 지원 웹앱  
**상태:** 로컬 개발 진행 중 (Google Sheets 연동 완료, 인증은 현재 우회 상태)

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 클라이언트 | React 19 + TypeScript (Vite 8) |
| 서버 | Node.js + Express 5 (CommonJS) |
| 데이터베이스 | Google Sheets API v4 (서비스 계정 인증) |
| 라우팅 | React Router DOM v7 |
| HTTP 클라이언트 | Axios (조회), Fetch API (수정) |
| 스타일링 | Vanilla CSS (glassmorphism / dark mode) |
| 동시 실행 | concurrently |

---

## 3. 디렉토리 구조

```
Time_schedule/
├── package.json          # 루트 — npm start로 서버+클라이언트 동시 실행
├── claude.md             # 이 파일
│
├── client/               # Vite + React + TypeScript
│   ├── vite.config.ts    # 포트 5000, /api/* → localhost:5001 프록시
│   └── src/
│       ├── App.tsx               # 라우터 설정
│       ├── index.css             # 전역 디자인 시스템
│       ├── pages/
│       │   ├── Login.tsx         # 로그인 UI (구글/일반, 현재 우회)
│       │   └── Dashboard.tsx     # 메인 대시보드
│       └── components/
│           └── ScheduleEditor.tsx # 시간표 수정 에디터 (핵심 컴포넌트)
│
└── server/               # Express 서버
    ├── index.js          # 메인 서버 파일 (포트 5001)
    ├── .env              # PORT=5001, SPREADSHEET_ID=...
    ├── google-key.json   # 서비스 계정 키 (git 제외)
    └── services/
        └── googleAuth.js # Google Sheets / Calendar 클라이언트 초기화
```

---

## 4. 로컬 실행 방법

```powershell
cd f:\Kim_Jungho\jihye_webapp\Time_schedule
npm start
```

| 역할 | 주소 |
|------|------|
| 🌐 클라이언트 (브라우저 접속) | http://localhost:5000 |
| 🖥️ API 서버 (내부용) | http://localhost:5001 |

- `/api/*` 요청은 Vite 프록시가 자동으로 5001 포트로 전달함
- 종료: `Ctrl+C` 하나로 서버·클라이언트 모두 종료

---

## 5. Google Sheets 연동

**스프레드시트 ID:** `1PL4z6byN0KRdfupYuYbNiR9H1Sjl5NaXGmKcRhwbd9I`

### 시트 목록 및 컬럼 구조

#### 강좌_마스터 (A:G)
| 컬럼 | 내용 |
|------|------|
| 강좌코드 | `과목명(학년-반)` 형식. 예: `영어1(2-3)` |
| 과목명 | 수업 과목명 |
| 담당교사 | 교사 이름 (교사 필터 키) |
| 대상학년 | 1, 2, 3 |

#### 교사_명렬표 (A:H)
| 컬럼 | 내용 |
|------|------|
| 교사ID | 고유 식별자 |
| 교사명 | 이름 (UI 표시용, 교사 필터 키) |
| 교과 | 소속 교과 (동/타교과 구분 기준) |

#### 기준_시간표 (A:D) — BASE 데이터
| 컬럼 | 내용 |
|------|------|
| 요일 | 월/화/수/목/금 |
| 교시 | 1~7 |
| 강좌코드 | 강좌_마스터의 강좌코드와 매칭 |
| 담당교사 | 교사명 |

#### 일별_시간표 (A:G) — 이벤트 소싱(변경 이력) DB
| 컬럼 | 내용 |
|------|------|
| 날짜 | YYYY-MM-DD |
| 교시 | 1~7 |
| 강좌코드 | 변경 대상 강좌 |
| 원래교사 | 변경 전 담당교사 |
| 변경교사 | 변경 후 담당교사 |
| 상태 | 아래 상태값 참조 |
| 사유 | 자유 텍스트 또는 트랜잭션ID |

#### 학생_명렬표 (A:N)
학생 정보 (현재 UI에서 직접 사용하지 않음)

---

## 6. 핵심 비즈니스 로직

### 6-1. 이벤트 소싱(Event Sourcing) 모델

기준_시간표는 **절대 수정하지 않는다**.  
모든 변경은 **일별_시간표에 행을 추가(append)** 하는 방식으로 기록한다.  
화면에 표시할 때마다 기준_시간표 + 일별_시간표를 합산하여 최종 상태를 계산한다.

```
최종 스케줄 = 기준_시간표 + (일별_시간표 Override 적용)
```

**상태값(status) 종류:**

| 상태 | 의미 |
|------|------|
| `이동(OUT)` | 해당 시간/강좌의 기존 수업을 제거 |
| `이동(IN)` | 해당 시간에 수업을 새로 추가 |
| `보강` | 대리 교사가 수업 진행 |
| `자습` | 자습 감독 지정 |
| `통합` | 두 클래스를 한 교실에서 수업 |
| `취소` | 이전 변경 내역을 원복 (보상 트랜잭션) |
| `정상` | 기준 상태 복구 |

### 6-2. 수업 교체 (True Swap) — 4행 트랜잭션

교체 시 원자적으로 4개의 행이 동시에 삽입됨:

```
사유(txID) = [교체-{타임스탬프}] {입력한 사유}

1. 내 원래 수업 제거:   날짜A, 교시A, 강좌A → 이동(OUT)
2. 내 수업을 타겟 시간에 추가: 날짜B, 교시B, 강좌A → 이동(IN)
3. 타겟 수업 제거:       날짜B, 교시B, 강좌B → 이동(OUT)
4. 타겟 수업을 내 시간에 추가: 날짜A, 교시A, 강좌B → 이동(IN)
```

취소 시 `사유(txID)` 필드로 4개 행을 찾아 모두 `취소`로 상계 처리.

### 6-3. 강좌코드 형식

```
과목명(학년-반)
예: 영어1(2-3)  →  2학년 3반 영어1 강좌
```

- `extractClassInfo('영어1(2-3)')` → `'2-3'`
- 교체 알고리즘에서 **동일 학급(classInfo)끼리만 교환 가능** 체크에 사용

### 6-4. 교체 후보 탐색 알고리즘 (ScheduleEditor)

```
조건 A: 타겟 교사가 [내 원래 날짜/교시]에 공강인가?
조건 B: 내가 [타겟 교사의 타겟 날짜/교시]에 공강인가?
조건 C: 같은 학급(강좌코드의 괄호 안 학년-반)인가?
→ A && B && C 모두 만족 시 추천 목록에 표시
```

탐색 범위: 당일만 / ±1주일 / ±2주일 (과거 및 주말은 자동 제외)

---

## 7. 서버 API 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/data` | 5개 시트 일괄 조회 (강좌, 교사, 기준/일별 시간표, 학생) |
| POST | `/api/schedule/update` | 일별_시간표에 변경 내역 Append |

### `/api/data` 응답 구조

```json
{
  "success": true,
  "data": {
    "courses": [...],        // 강좌_마스터
    "teachers": [...],       // 교사_명렬표
    "baseSchedules": [...],  // 기준_시간표
    "dailySchedules": [...], // 일별_시간표
    "students": [...]        // 학생_명렬표
  }
}
```

### `/api/schedule/update` 요청 구조

```json
{
  "payloads": [
    {
      "date": "2026-04-22",
      "period": "3",
      "courseCode": "영어1(2-3)",
      "sourceTeacher": "홍길동",
      "targetTeacher": "김철수",
      "status": "이동(OUT)",
      "reason": "[교체-123456] 연가"
    }
  ]
}
```

---

## 8. 클라이언트 페이지 구조

### 라우팅 (App.tsx)

```
/           → Login.tsx
/dashboard  → Dashboard.tsx
```

### Login.tsx
- 구글 로그인 탭 / 일반 로그인 탭 UI
- **현재 실제 인증 없이 버튼 클릭 시 `/dashboard`로 바로 이동** (우회 상태)
- 학교 방화벽 환경을 위해 일반 로그인 탭 병행 제공

### Dashboard.tsx — 2개 탭

**탭 1: 시간표 조회 (view)**
- 기준일 날짜 선택 → 해당 주(월~금)의 주간 시간표 표시
- 교사 필터: 전체 / 특정 교사 선택
  - 전체 선택 시: 각 셀에 학년별 강좌 수 요약 표시 + 클릭 시 학급 배치 모달
  - 특정 교사 선택 시: 해당 교사의 수업만 표시
- Override(변경) 셀은 초록색 테두리/배경으로 구분 표시

**탭 2: 시간표 수정 (edit)**
- `ScheduleEditor` 컴포넌트를 렌더링
- 탭 상태는 `sessionStorage`에 저장 (새로고침 유지)

### ScheduleEditor.tsx — 3패널 레이아웃

```
[좌측 패널]          [중앙 액션]         [우측 패널]
Source 선택          수정 타입 선택       Target 추천 목록
- 날짜 선택          - 수업 교체          - 알고리즘 필터 결과
- 교사 선택          - 수업 보강          - 탐색 범위 선택
- 해당일 수업 목록   - 수업 자습          - [선택 적용] 버튼
  (클릭 → 교시 선택)  - 클래스 통합
- 변경된 수업 취소버튼 - 동교과/타교과 토글
```

**sessionStorage 저장 항목:**
- `editor_selectedDate`: 마지막 선택 날짜
- `editor_sourceTeacher`: 마지막 선택 교사
- `dashboard_activeTab`: 마지막 활성 탭

---

## 9. 디자인 시스템 (index.css)

- **테마:** Vantablack Luxe + Glassmorphism
- **주요 CSS 변수:**
  - `--glass-outer`: 바깥 카드 배경 (반투명 유리)
  - `--glass-inner`: 안쪽 카드 배경
  - `--glass-border`: 유리 테두리
  - `--accent`: 강조색 (파란계열)
  - `--text-secondary`: 보조 텍스트 색상
  - `--transition-spring`: 스프링 애니메이션 트랜지션
- **주요 클래스:**
  - `.double-bezel-outer` / `.double-bezel-inner`: 이중 베젤 카드 컨테이너
  - `.btn-primary`: 메인 버튼 스타일
  - `.animate-fade-in`: 페이드인 애니메이션
- **폰트:** Pretendard (한국어), 시스템 sans-serif 폴백

---

## 10. 현재 알려진 이슈 / TODO

| 항목 | 상태 | 설명 |
|------|------|------|
| 관리자 계정 시스템 | ❌ 미구현 | `사용자_관리` 또는 정보 시트 추가 후 최고 관리자(Admin) 권한 연동 |
| 관리자 대시보드 | ❌ 미구현 | 가입자(선생님) 권한 승인 및 관리자 권한 부여 기능 |
| 실제 Google OAuth 로그인 | ❌ 미구현 | 우회 방식 제거 후 시트에 등록/승인된 구글 계정으로만 접근 허용 |
| JWT 기반 인증 처리 | ❌ 미구현 | 로그인 성공 시 토큰 발급 및 API 라우트 보안 적용 |
| API URL 하드코딩 | ✅ 해결 | `/api/...` 상대경로 사용. Vite 프록시가 5001로 전달 |
| 학생_명렬표 | ❌ 미사용 | API로 가져오지만 UI에서 미표시 |
| Calendar API | ❌ 미사용 | `googleAuth.js`에서 초기화하지만 아직 미연동 |

### 🚀 향후 개발 순서 (Next Session)
1. **DB 재설계:** Google Sheets에 로그인 정보용 시트(`사용자_관리`) 추가 또는 기존 `교사_명렬표` 컬럼 확장 (이메일, 권한 등).
2. **관리자(Admin) 기능:** 권한이 높은 사용자를 위한 전용 페이지 구현. 여기서 일반 교사의 가입을 승인(Pending -> User).
3. **Google 로그인 연동:** JWT를 활용하여 인증 유지. 로그인 시 해당 이메일이 시트에 존재하는지 여부를 확인하고 미가입/대기 상태/정상 유저에 따라 라우팅.

---

## 11. 환경 변수 (.env)

```
# server/.env
PORT=5001
SPREADSHEET_ID=1PL4z6byN0KRdfupYuYbNiR9H1Sjl5NaXGmKcRhwbd9I
```

`google-key.json`은 서비스 계정 비밀키 파일이므로 `.gitignore`에 반드시 포함되어야 함.

---

## 12. OCI 프로덕션 서버

**공인 IP:** `134.185.98.191`  
**앱 주소:** http://134.185.98.191:3000  
**SSH 키 경로:** `F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key`  
**SSH 유저:** `ubuntu`  
**서버 경로:** `~/time-schedule/`  
**프로세스 관리:** PM2 (`time-schedule` 이름)

### 배포 구조 (프로덕션)

```
OCI 인스턴스 포트 3000
└── Express 서버 (server/index.js)
    ├── /api/*          → Google Sheets API 처리
    └── /*              → client/dist 정적 파일 서빙
```

로컬 개발과 달리 Vite 서버 없음 — Express 하나로 전부 처리.

### OCI 방화벽 설정 현황

| 레이어 | 포트 | 상태 |
|--------|------|------|
| OCI Security List | 22 (SSH) | ✅ 오픈 |
| OCI Security List | 3000 (앱) | ✅ 오픈 |
| 인스턴스 iptables | 3000 | ✅ 오픈 |
| iptables NAT | 80 → 3000 포워딩 | ✅ 설정됨 |

---

## 13. 코드 업데이트 (재배포) 방법

로컬에서 코드 수정 후 **Git을 활용하여** 쉽고 빠르게 배포합니다.

### 1단계: 로컬에서 GitHub으로 갱신
```powershell
# 개발 폴더에서 변경 내역을 저장소로 푸시
git add -A
git commit -m "수정 내용 요약"
git push origin main
```

### 2단계: OCI 서버 원격 배포 명령어 실행
코드를 푸시한 후, 로컬 (Windows PowerShell) 에서 아래 한 줄 명령어만 입력하면 서버에서 코드를 Pull 받아 빌드 후 자동 재시작합니다.

```powershell
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "cd ~/time-schedule && git pull origin main && cd client && npm install && npm run build && cd ../server && npm install && pm2 restart time-schedule"
```

---

## 14. OCI 서버 관리 명령어

모든 명령어는 Windows PowerShell에서 실행합니다.

### SSH 접속

```powershell
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191
```

### PM2 서버 상태 확인

```powershell
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "pm2 list"
```

### 실시간 로그 확인

```powershell
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "pm2 logs time-schedule --lines 30 --nostream"
```

### 서버 재시작 / 정지 / 삭제

```powershell
# 재시작
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "pm2 restart time-schedule"

# 정지
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "pm2 stop time-schedule"

# 시작 (정지 후 재시작)
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" -o ServerAliveInterval=5 ubuntu@134.185.98.191 "pm2 start time-schedule"
```

### 외부 접속 빠른 확인 (PowerShell)

```powershell
Invoke-WebRequest -Uri "http://134.185.98.191:3000/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

> ⚠️ **주의:** `pm2 stop` 실행 후 반드시 `pm2 start time-schedule`로 재시작해야 합니다.  
> 재부팅 후에도 자동 시작되도록 `pm2 startup` + `pm2 save`가 설정되어 있습니다.
