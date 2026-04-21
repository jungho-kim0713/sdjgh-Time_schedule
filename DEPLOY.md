# OCI 배포 가이드 (134.185.98.191)

## 🏗️ 배포 구조

```
OCI 인스턴스 (포트 3000)
└── Express 서버
    ├── /api/*          → Google Sheets API 처리
    └── /*              → client/dist 정적 파일 서빙 (빌드된 React)
```

로컬 개발과 달리 **Vite 서버 없음** — Express 하나로 전부 처리.

---

## 📋 배포 순서

### STEP 1. 로컬에서 빌드 (Windows 터미널)

```powershell
cd f:\Kim_Jungho\jihye_webapp\Time_schedule
npm run build
```
→ `client/dist/` 폴더가 생성됨

---

### STEP 2. OCI 서버에 파일 전송 (scp)

아래 명령어에서 `<SSH_KEY_PATH>`를 실제 SSH 키 경로로 바꾸세요.

```powershell
# server 폴더 전송
scp -i <SSH_KEY_PATH> -r f:\Kim_Jungho\jihye_webapp\Time_schedule\server ubuntu@134.185.98.191:~/time-schedule/

# 빌드된 client/dist 폴더 전송
scp -i <SSH_KEY_PATH> -r f:\Kim_Jungho\jihye_webapp\Time_schedule\client\dist ubuntu@134.185.98.191:~/time-schedule/client/

# 루트 package.json 전송
scp -i <SSH_KEY_PATH> f:\Kim_Jungho\jihye_webapp\Time_schedule\package.json ubuntu@134.185.98.191:~/time-schedule/
```

> ⚠️ `google-key.json`과 `server/.env`는 **별도로** 전송해야 합니다 (git에 올리지 말 것).

```powershell
scp -i <SSH_KEY_PATH> f:\Kim_Jungho\jihye_webapp\Time_schedule\server\google-key.json ubuntu@134.185.98.191:~/time-schedule/server/
scp -i <SSH_KEY_PATH> f:\Kim_Jungho\jihye_webapp\Time_schedule\server\.env ubuntu@134.185.98.191:~/time-schedule/server/
```

---

### STEP 3. OCI 서버에 SSH 접속

```powershell
ssh -i <SSH_KEY_PATH> ubuntu@134.185.98.191
```

---

### STEP 4. OCI 서버 초기 환경 설정 (최초 1회)

```bash
# Node.js 설치 (LTS 버전)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 설치 (서버 상시 실행 관리자)
sudo npm install -g pm2

# 서버 의존성 설치
cd ~/time-schedule/server
npm install
```

---

### STEP 5. 서버 실행 (PM2)

```bash
cd ~/time-schedule
pm2 start server/index.js --name "time-schedule"
pm2 save           # 재부팅 후에도 자동 시작 저장
pm2 startup        # 자동 시작 설정 (출력 명령어 복사해서 실행)
```

---

### STEP 6. OCI 방화벽 포트 오픈

두 곳에서 포트 3000을 열어야 합니다.

#### ① OCI 콘솔 (Security List)
1. OCI 콘솔 → Networking → Virtual Cloud Networks
2. 해당 VCN → Security Lists → Default Security List
3. **Add Ingress Rules** 클릭
4. Source CIDR: `0.0.0.0/0`, Destination Port: `3000`

#### ② OCI 인스턴스 내부 방화벽 (iptables)

```bash
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save   # Ubuntu 22.04+
```

---

### 접속 확인

브라우저에서: **http://134.185.98.191:3000**

서버 상태 확인: **http://134.185.98.191:3000/api/health**

---

## 🔄 코드 업데이트 방법 (이후 배포)

로컬에서:
```powershell
# 1. 빌드
npm run build

# 2. 변경된 파일만 전송
scp -i <SSH_KEY_PATH> -r f:\...\client\dist ubuntu@134.185.98.191:~/time-schedule/client/
scp -i <SSH_KEY_PATH> f:\...\server\index.js ubuntu@134.185.98.191:~/time-schedule/server/
```

OCI 서버에서:
```bash
pm2 restart time-schedule
```

---

## 🛠️ PM2 유용한 명령어

```bash
pm2 list                        # 실행 중인 프로세스 목록
pm2 logs time-schedule          # 실시간 로그 보기
pm2 restart time-schedule       # 재시작
pm2 stop time-schedule          # 정지
pm2 delete time-schedule        # 제거
```

---

## ⚙️ 서버 .env 설정 (OCI)

`~/time-schedule/server/.env` 내용:
```
PORT=3000
SPREADSHEET_ID=1PL4z6byN0KRdfupYuYbNiR9H1Sjl5NaXGmKcRhwbd9I
```
