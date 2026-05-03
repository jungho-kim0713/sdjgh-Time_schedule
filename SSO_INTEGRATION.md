# SSO 연동 작업 인수인계

> 작성일: 2026-05-04
> 이 파일은 플랫폼 포털(sdjgh_platfom)과의 SSO 연동 작업 맥락 전달용입니다.

---

## 배경

서대전여고 통합 플랫폼(`https://platform.sdjgh-ai.kr`)이 배포 완료됐습니다.
플랫폼에서 '스마트 시간표' 카드를 클릭하면 아래 URL로 이동합니다:

```
https://sdjgh-timetable.sdjgh-ai.kr?token=JWT값
```

시간표 앱은 이 JWT를 받아서 검증만 하면 로그인 없이 바로 접속을 허용해야 합니다.

---

## JWT 정보

### 서명 알고리즘
`jsonwebtoken` 라이브러리, 기본 알고리즘 (HS256), 유효기간 8시간

### JWT 페이로드 구조
```json
{
  "userId": "teacher01",
  "name": "홍길동",
  "uid": "T-038",
  "role": "교사",
  "managedApp": "timetable,career",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 권한(role) 종류
`관리자` / `교사` / `학생` / `학부모` / `졸업생`

### JWT_SECRET
플랫폼 서버의 `server/.env`에 있는 `JWT_SECRET` 값과 동일하게 시간표 앱 서버에 설정해야 합니다.
(직접 확인: OCI 서버 `~/sdjgh_platfom/server/.env`)

---

## 시간표 앱에서 해야 할 작업

### 1. JWT_SECRET 환경변수 추가
시간표 앱 서버 `.env`에 추가:
```
JWT_SECRET=플랫폼과_동일한_값
```

### 2. URL 파라미터에서 토큰 수신 및 검증
`?token=xxx` 쿼리 파라미터를 받아서 `jsonwebtoken`의 `verify()`로 검증.

서버 측 미들웨어 예시:
```js
const jwt = require('jsonwebtoken');

function verifySSO(req, res, next) {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: '토큰 없음' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}
```

클라이언트 측 처리 예시 (React):
```js
// 앱 진입 시 URL에서 토큰 추출 → 세션에 저장
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
if (token) {
  sessionStorage.setItem('sso_token', token);
  // URL에서 token 파라미터 제거
  window.history.replaceState({}, '', window.location.pathname);
}
```

### 3. 기존 Google OAuth 로그인 처리
- SSO 토큰이 있으면 → 토큰 검증 후 바로 접속
- SSO 토큰이 없으면 → 기존 Google OAuth 로그인 흐름 유지 (또는 플랫폼으로 리다이렉트)

---

## 플랫폼 서버 정보

| 항목 | 값 |
|------|-----|
| 운영 URL | `https://platform.sdjgh-ai.kr` |
| OCI IP | `152.67.193.142` |
| SSH 키 | `F:\Kim_Jungho\jungho_webapp\keys\oracle_celbeloss_sdjgh.key` |
| .env 경로 (OCI) | `~/sdjgh_platfom/server/.env` |
| GitHub | `https://github.com/jungho-kim0713/sdjgh_platfom` (Private) |
