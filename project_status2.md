# 서대전여고 통합 플랫폼 서버 (SSO) 프로젝트 명세서

> 최종 업데이트: 2026-05-04

---

## 1. 프로젝트 개요

서대전여고의 모든 웹앱(스마트 시간표, 학생용 AI, 진로 상담 등)을 중앙에서 관리하기 위한 **통합 인증 포털(SSO)** 구축 프로젝트.
플랫폼 서버가 사용자 DB(구글 시트)를 독점 관리하고 JWT를 발급하며, 각 서브앱은 자체 로그인 없이 토큰 검증만으로 접근 허용.

---

## 2. 데이터베이스 (구글 스프레드시트)

시트명: `사용자_관리` / 범위: `A2:J`

| 열 | 항목명 | 설명 |
|---|---|---|
| **A** | 구글 계정 | 구글 OAuth 로그인 시 매칭되는 이메일 |
| **B** | 일반 ID | 일반 로그인 아이디 (학번 또는 교직원 번호) |
| **C** | 비밀번호 | bcrypt 해시값. 초기 평문 부여 후 첫 로그인 시 강제 변경 |
| **D** | 이름 | 사용자 실명 |
| **E** | 고유식별자 | 학번(예: 10101) 또는 교사ID(예: T-038). 앱 간 연동 핵심 키 |
| **F** | 권한(role) | `관리자` / `교사` / `학생` / `학부모` / `졸업생` |
| **G** | 상태 | `Active` / `Inactive` / `Pending` |
| **H** | 가입일시 | 계정 최초 생성 일시 |
| **I** | 비번변경필요 | `TRUE` 이면 로그인 직후 강제 비밀번호 변경 화면으로 이동 |
| **J** | 업무담당자앱 | 교사가 관리자 권한을 갖는 앱. 쉼표 구분으로 복수 허용 (예: `timetable,career`). 해당 없으면 빈칸 |

### 권한 설계 원칙
- **업무담당자**는 독립 role이 아님. `role=교사` + J열 `업무담당자앱` 조합으로 표현.
- `관리자`는 별도 처리 없이 모든 앱에 접근 가능 (앱 레벨에서 role 확인).
- 앱 ID 목록: `timetable` / `studentAI` / `career`

---

## 3. 핵심 아키텍처 (SSO 동작 원리)

```
사용자 → 플랫폼 로그인 → JWT 발급 (role + managedApp 포함)
       → 앱 카드 클릭 → https://sdjgh-timetable.sdjgh-ai.kr?token=xxx
       → 서브앱: JWT_SECRET으로 토큰 검증 → 즉시 접속 허용
```

**JWT 페이로드 구성**
```json
{
  "userId": "teacher01",
  "name": "홍길동",
  "uid": "T-038",
  "role": "교사",
  "managedApp": "timetable,career",
  "iat": ...,
  "exp": ...
}
```

---

## 4. 파일 구조

```
sdjgh_platfom/
├── index.html              # 디자인 시안 캔버스 (개발용)
├── index-live.html         # 실제 앱 진입점 ★
├── styles.css              # 디자인 토큰 + 글로벌 스타일
├── app-live.jsx            # 루트 컴포넌트 (screen state 관리)
├── shared.jsx              # 공통 컴포넌트 (SchoolLogo, Field, GoogleG 등)
├── login-final.jsx         # 로그인 화면 (최종안)
├── home-final.jsx          # 메인 화면 (최종안, 다이어리 펼침)
├── home-variants.jsx       # HomeA (데스크톱 다이어리), UserDropdown 포함
├── change-password.jsx     # 비밀번호 변경 화면
├── login-variants.jsx      # 이전 비교용 변형
├── design-canvas.jsx       # 시안 캔버스 (개발용)
├── tweaks-panel.jsx        # 디자인 Tweaks 패널
├── assets/                 # 로고, 학교 풍경 이미지, 시간표 아이콘
└── server/
    ├── index.js            # Express 진입점 (CORS, 라우터 마운트)
    ├── .env                # 환경변수
    ├── routes/
    │   ├── auth.js         # /api/auth/login, /api/auth/google
    │   └── user.js         # /api/user/change-password
    └── services/
        ├── sheets.js       # 구글 시트 CRUD (A2:J 범위)
        └── jwt.js          # signToken / verifyToken
```

---

## 5. 완성된 기능 ✅

### 백엔드
- [x] 일반 로그인 (`POST /api/auth/login`) — 평문/bcrypt 자동 감지
- [x] 구글 OAuth 로그인 (`GET /api/auth/google`) — 콜백 후 `#token=` 해시로 전달
- [x] 비밀번호 변경 (`POST /api/user/change-password`) — 영문+숫자+특수문자+8자 이상 검증
- [x] JWT 발급 (role + managedApp 포함, 8시간 유효)
- [x] CORS 허용: `127.0.0.1:5500`, `localhost:5500` 모두 허용

### 프론트엔드
- [x] 로그인 화면 — 아이디/비밀번호 폼, 구글 로그인 버튼, 에러 표시
- [x] 비밀번호 강제 변경 화면 — 첫 로그인 또는 평문 비번 감지 시 자동 진입
- [x] 메인 화면 — 다이어리 펼침 디자인, 실제 날짜/사용자 이름/권한 표시
- [x] UserDropdown — 우측 상단 이름 클릭 → 드롭다운 → 로그아웃 확인 모달
- [x] 자동 로그인 (localStorage) / 세션 로그인 (sessionStorage) 구분
- [x] 토큰 만료 감지 → 자동 로그아웃

---

## 6. 다음 작업: 스마트 시간표 연동

### 목표
플랫폼 메인에서 '스마트 시간표' 카드 클릭 시 `https://sdjgh-timetable.sdjgh-ai.kr?token=xxx` 로 이동,
시간표 앱은 JWT를 검증해 로그인 없이 바로 접속.

### 시간표 앱 정보
- 운영 URL: `https://sdjgh-timetable.sdjgh-ai.kr`
- 로컬 URL: `http://localhost:5000`
- Google Cloud 프로젝트: 기존 시간표 앱 프로젝트 (OAuth redirect URI 설정 확인 필요)

### 플랫폼 측 작업 (home-variants.jsx)
- [ ] `APPS` 배열에 `url` 필드 추가 (`https://sdjgh-timetable.sdjgh-ai.kr`)
- [ ] 앱 카드 클릭 시 `localStorage`에서 토큰 읽어 `?token=xxx`로 이동

### 시간표 앱 측 작업
- [ ] 스택 파악 (Node.js / Python / 순수 프론트?)
- [ ] JWT 검증 미들웨어 추가 (`JWT_SECRET` 공유 필요)
- [ ] URL 파라미터 `?token=xxx` 수신 → 검증 → 세션/쿠키 저장
- [ ] 기존 Google OAuth 로그인 로직 제거 또는 우회 처리

### JWT_SECRET 공유 방법
플랫폼 서버의 `.env`에 있는 `JWT_SECRET` 값을 시간표 앱 서버 환경변수에도 동일하게 설정.
토큰 위조 여부만 검증하면 되므로 시간표 앱에서는 `jsonwebtoken` 라이브러리의 `verify()`만 사용.

---

## 7. 향후 작업 후보

- [ ] 학생용 AI 앱 연동 (`https://student-ai.sdjgh-ai.kr?token=xxx`)
- [ ] 진로 상담 앱 연동
- [ ] 권한별 메인 화면 차이 (학생 / 교사 / 학부모 뷰 분기)
- [ ] 모바일 하단 탭바 (홈/일정/알림/내정보)
- [ ] 알림센터, 마이페이지
- [ ] 가입 안내 / 비밀번호 찾기 플로우
- [ ] OCI 배포 (`platform.sdjgh-ai.kr`)
- [ ] `/debug/sheets` 엔드포인트 제거 (프로덕션 전)
