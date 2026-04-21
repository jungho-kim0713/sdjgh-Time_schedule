# OCI 배포 가이드 (134.185.98.191)

## 🏗️ 배포 구조

```
OCI 인스턴스 (포트 3000)
└── Express 서버
    ├── /api/*          → Google Sheets API 처리
    └── /*              → client/dist 정적 파일 서빙 (빌드된 React)
```

로컬 개발과 달리 **Vite 서버 없음** — Express 하나로 전부 처리하며, 코드는 **Git**을 통해 배포/동기화됩니다.

---

## 📋 배포 순서 (최초 1회 세팅)

### STEP 1. 로컬 코드를 GitHub에 PUSH
```powershell
git add -A
git commit -m "배포용 업데이트 완료"
git push origin main
```

---

### STEP 2. OCI 서버에 접속 및 레포지토리 Clone

```powershell
# 서버에 접속
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" ubuntu@134.185.98.191

# (서버에서 실행) 프로젝트 Clone
cd ~
git clone https://github.com/jungho-kim0713/sdjgh-Time_schedule.git time-schedule
cd time-schedule
```

> ⚠️ `.env` 파일과 `google-key.json`은 Git에 올라가지 않기 때문에 `~/time-schedule/server/` 안에 직접 넣어주어야 합니다. (현재 서버에는 적용 완료 상태)

---

### STEP 3. 의존성 설치 및 React 빌드

```bash
# (서버에서 실행)
# 1. 서버 의존성 설치
cd ~/time-schedule/server
npm install

# 2. 클라이언트 의존성 설치 및 빌드
cd ~/time-schedule/client
npm install
npm run build
```

---

### STEP 4. PM2로 서버 실행

```bash
# (서버에서 실행)
cd ~/time-schedule
pm2 start server/index.js --name "time-schedule"

pm2 save           # 재부팅 시 자동 실행 등록 저장
pm2 startup        # 출력된 설정 명령어를 붙여넣기 하여 등록
```

---

### 접속 확인
- 앱 접근: **http://134.185.98.191**
- API 상태: **http://134.185.98.191/api/health**

*(인스턴스의 iptables 포트 포워딩 `80 -> 3000` 설정이 완료된 상태이므로 포트 번호를 생략할 수 있습니다.)*

---

## 🔄 코드 업데이트(재배포) 방법 

향후 코드를 수정한 뒤 다시 서버에 배포하는 방식이 매우 쉬워졌습니다.

### 1️⃣ 로컬에서 GitHub으로 전송 (Windows Terminal)
```powershell
git add -A
git commit -m "여기에 수정 내용 작성"
git push origin main
```

### 2️⃣ 서버에서 자동 최신화 및 재시작 (Windows Terminal에서 바로 실행)
위 1단계를 마치고 나면 아래 명령어를 복사/붙여넣기하여 서버에 배포를 완료하세요:

```powershell
ssh -i "F:\Kim_Jungho\jihye_webapp\[key]\oracle_newif9888.key" ubuntu@134.185.98.191 "cd ~/time-schedule && git pull origin main && cd client && npm install && npm run build && cd ../server && npm install && pm2 restart time-schedule"
```
*(위 1줄 명령어는 소스 코드 동기화, 클라이언트 빌드 갱신, 패키지 갱신 및 서버 재시작까지 모두 한 번에 수행합니다.)*

---

## 🛠️ PM2 서버 관리 명령어

OCI 서버에 접속한 상태(`ssh ubuntu@134.185.98.191`)에서 아래 명령어를 사용할 수 있습니다.

```bash
pm2 list                        # 실행 중인 서버 프로세스 상태 보기
pm2 logs time-schedule          # 실시간 오류 로그 / 접속 로그 보기
pm2 restart time-schedule       # 서버 수동 재시작
pm2 stop time-schedule          # 서버 임시 중단
```
